#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EA FC 26 Career Tracker — Servidor Local & Motor de Exportação (v3.1)
Serve a estrutura estática (GitHub Pages ready) na raiz do repositório + APIs locais para extração de saves.
"""
import os
import sys
import json
import webbrowser
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, SimpleHTTPRequestHandler

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SRC_DIR, ".."))
SAVES_DIR = os.path.join(ROOT_DIR, "saves")
DATA_DIR = os.path.join(ROOT_DIR, "assets", "data")
EXPORTS_DIR = os.path.join(ROOT_DIR, "exports")

if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

import save_parser

PORT = 8080


class TrackerRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def _send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        route = parsed.path

        if route == "/api/data":
            json_path = os.path.join(DATA_DIR, "career_data.json")
            if not os.path.exists(json_path):
                data = save_parser.run_full_pipeline()
                return self._send_json(data)
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return self._send_json(data)

        if route == "/api/saves":
            saves = save_parser.find_save_files()
            return self._send_json({"saves": [os.path.basename(s) for s in saves]})

        if route == "/api/reload":
            qs = parse_qs(parsed.query)
            save_name = qs.get("save", [None])[0]
            target = None
            if save_name:
                cand_saves = os.path.join(SAVES_DIR, os.path.basename(save_name))
                cand_root = os.path.join(ROOT_DIR, os.path.basename(save_name))
                if os.path.exists(cand_saves):
                    target = cand_saves
                elif os.path.exists(cand_root):
                    target = cand_root
            data = save_parser.run_full_pipeline(target)
            return self._send_json(data)

        if route == "/api/export/xlsx":
            xlsx_path = os.path.join(EXPORTS_DIR, "Estatisticas_Jogadores_FC_Andorra_Carreira.xlsx")
            if not os.path.exists(xlsx_path):
                save_parser.run_full_pipeline()
            if os.path.exists(xlsx_path):
                with open(xlsx_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                self.send_header("Content-Disposition", 'attachment; filename="Estatisticas_Jogadores_FC_Andorra_Carreira.xlsx"')
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            return self._send_json({"error": "Arquivo XLSX nao encontrado"}, 404)

        if route == "/api/export/csv":
            csv_path = os.path.join(EXPORTS_DIR, "Estatisticas_Jogadores_FC_Andorra_Carreira.csv")
            if not os.path.exists(csv_path):
                save_parser.run_full_pipeline()
            if os.path.exists(csv_path):
                with open(csv_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/csv; charset=utf-8")
                self.send_header("Content-Disposition", 'attachment; filename="Estatisticas_Jogadores_FC_Andorra_Carreira.csv"')
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            return self._send_json({"error": "Arquivo CSV nao encontrado"}, 404)

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        route = parsed.path

        if route == "/api/select_save":
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
            body = json.loads(raw)
            save_file = body.get("save_file", "")
            cand_saves = os.path.join(SAVES_DIR, os.path.basename(save_file))
            cand_root = os.path.join(ROOT_DIR, os.path.basename(save_file))
            target = cand_saves if os.path.exists(cand_saves) else (cand_root if os.path.exists(cand_root) else None)
            if target:
                data = save_parser.run_full_pipeline(target)
                return self._send_json(data)
            return self._send_json({"error": "Arquivo de save nao encontrado"}, 404)

        if route == "/api/upload":
            filename = self.headers.get("X-Filename", "CmMgrUploadedSave")
            safe_name = os.path.basename(filename)
            if not safe_name.startswith("CmMgr"):
                safe_name = "CmMgr_" + safe_name
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0:
                return self._send_json({"error": "Upload vazio"}, 400)
            content = self.rfile.read(length)
            os.makedirs(SAVES_DIR, exist_ok=True)
            dest = os.path.join(SAVES_DIR, safe_name)
            with open(dest, "wb") as f:
                f.write(content)
            data = save_parser.run_full_pipeline(dest)
            return self._send_json(data)

        return self._send_json({"error": "Rota nao encontrada"}, 404)


def main():
    json_path = os.path.join(DATA_DIR, "career_data.json")
    if not os.path.exists(json_path):
        print("Gerando dados iniciais da carreira...")
        save_parser.run_full_pipeline()

    server = HTTPServer(("127.0.0.1", PORT), TrackerRequestHandler)
    url = f"http://127.0.0.1:{PORT}"
    print("=" * 65)
    print(f"EA FC 26 Career Tracker v3.1 rodando em: {url}")
    print(f"Diretorio raiz servido: {ROOT_DIR}")
    print("Pressione Ctrl+C para encerrar.")
    print("=" * 65)

    if "--no-browser" not in sys.argv:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando servidor...")
        server.server_close()


if __name__ == "__main__":
    main()
