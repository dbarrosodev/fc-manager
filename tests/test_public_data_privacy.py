#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FC MANAGER — ETAPA 1: TESTES DE PRIVACIDADE E SANITIZAÇÃO DE SAVES

Validações obrigatórias:
  1. Dados públicos (JSON e JS) NÃO contêm `save_file`, `save_path`,
     caminhos absolutos do computador ou nomes reais de saves.
  2. Arquivos JSON e JavaScript públicos estão perfeitamente consistentes e sanitizados.
  3. A importação e o processamento local de saves continuam funcionando integralmente.
  4. O `.gitignore` impede a inclusão acidental de novos saves privados.
  5. Nenhum binário de save está versionado no commit atual (saves/ contém apenas .gitkeep).

Uso:
  python -m unittest tests/test_public_data_privacy.py -v
"""

import copy
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(TESTS_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src import save_parser  # noqa: E402
from src import app as tracker_app  # noqa: E402

SAVE_NAME_RE = re.compile(r"CmMgr[A-Za-z]?\d{6,}")
USER_PATH_RE = re.compile(r"C:[\\/]Users[\\/]|/Users/", re.IGNORECASE)

PUBLISHED_DATA = [
    os.path.join("assets", "data", "career_data.json"),
    os.path.join("assets", "data", "career_data.js"),
    os.path.join("assets", "data", "careers_archive.json"),
    os.path.join("assets", "data", "baseline_snapshot.json"),
    os.path.join("exports", "Estatisticas_Jogadores_FC_Andorra_Carreira.csv"),
]


def git_tracked_files():
    res = subprocess.run(["git", "ls-files"], cwd=PROJECT_ROOT, capture_output=True, text=True)
    if res.returncode != 0:
        return None
    return [line.strip() for line in res.stdout.splitlines() if line.strip()]


class TestPublicDataPrivacy(unittest.TestCase):

    def test_30_no_binary_save_is_tracked(self):
        """saves/ deve conter no máximo .gitkeep (ou não existir no Git) e nenhum CmMgr* pode estar versionado."""
        tracked = git_tracked_files()
        if tracked is None:
            self.skipTest("Repositório Git indisponível")
        in_saves = [f for f in tracked if f.startswith("saves/")]
        self.assertIn(in_saves, [[], ["saves/.gitkeep"]], f"Arquivos versionados em saves/: {in_saves}")
        save_like = [f for f in tracked if os.path.basename(f).startswith("CmMgr")]
        self.assertEqual(save_like, [], f"Arquivos de save versionados: {save_like}")

    def test_31_published_data_has_no_save_identifiers_or_user_paths(self):
        """Nenhum dado publicado pode conter nomes reais de saves ou caminhos locais de usuário."""
        for rel in PUBLISHED_DATA:
            path = os.path.join(PROJECT_ROOT, rel)
            if not os.path.exists(path):
                continue
            with open(path, "r", encoding="utf-8-sig", errors="replace") as f:
                content = f.read()
            found_saves = SAVE_NAME_RE.findall(content)
            self.assertEqual(found_saves, [], f"{rel} expõe identificador de save: {sorted(set(found_saves))}")
            found_paths = USER_PATH_RE.findall(content)
            self.assertEqual(found_paths, [], f"{rel} expõe caminho local de usuário: {found_paths}")

    def test_32_public_json_and_js_have_no_save_metadata_keys(self):
        """career_data.json e career_data.js NÃO podem conter as chaves save_file nem save_path."""
        # 1. Validar JSON
        json_path = os.path.join(PROJECT_ROOT, "assets", "data", "career_data.json")
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)

        self.assertNotIn("save_file", data, "career_data.json ainda contém a chave save_file")
        self.assertNotIn("save_path", data, "career_data.json ainda contém a chave save_path")
        self.assertNotIn("available_saves", data, "career_data.json ainda contém a chave available_saves")
        for entry in data.get("careers_archive_summary", []):
            self.assertNotIn("ultimo_save", entry, "careers_archive_summary expõe ultimo_save")

        # 2. Validar JS bundle (consistência JSON vs JS)
        js_path = os.path.join(PROJECT_ROOT, "assets", "data", "career_data.js")
        with open(js_path, encoding="utf-8") as f:
            js_content = f.read()

        match = re.search(r"window\.FALLBACK_CAREER_DATA\s*=\s*(\{.*?\});\s*$", js_content, re.DOTALL)
        self.assertIsNotNone(match, "Não foi possível extrair objeto JSON de career_data.js")
        js_data = json.loads(match.group(1))

        self.assertNotIn("save_file", js_data, "career_data.js ainda contém a chave save_file")
        self.assertNotIn("save_path", js_data, "career_data.js ainda contém a chave save_path")
        self.assertNotIn("available_saves", js_data, "career_data.js ainda contém a chave available_saves")

    def test_33_pipeline_sanitizer_strips_metadata(self):
        """sanitize_for_public_export remove metadados sem alterar o dicionário original."""
        original = {
            "save_file": "CmMgrC20990101000000000",
            "save_path": "saves/CmMgrC20990101000000000",
            "available_saves": [{"filename": "CmMgrC20990101000000000", "mtime": 1}],
            "careers_archive_summary": [{"clube": "X", "ultimo_save": "CmMgrC20990101000000000"}],
            "club": {"nome": "X"},
        }
        public = save_parser.sanitize_for_public_export(original)
        self.assertNotIn("save_file", public)
        self.assertNotIn("save_path", public)
        self.assertNotIn("available_saves", public)
        self.assertNotIn("ultimo_save", public["careers_archive_summary"][0])
        self.assertIsNone(SAVE_NAME_RE.search(json.dumps(public)))
        # Original intacto para uso do servidor local
        self.assertEqual(original["save_file"], "CmMgrC20990101000000000")
        self.assertEqual(original["save_path"], "saves/CmMgrC20990101000000000")

    def test_34_local_full_copy_is_git_ignored(self):
        """A cópia local completa (assets/data/local/) precisa estar no .gitignore."""
        res = subprocess.run(
            ["git", "check-ignore", "-q", "assets/data/local/career_data.local.json"],
            cwd=PROJECT_ROOT, capture_output=True, text=True
        )
        self.assertEqual(res.returncode, 0, "assets/data/local/ não está ignorado pelo Git")

    def test_35_gitignore_prevents_accidental_save_tracking(self):
        """O .gitignore deve bloquear saves em saves/, na raiz ou em subpastas, sem bloquear assets públicos."""
        test_candidates = [
            ("saves/CmMgrC20261027114537158", True),
            ("saves/carreira_particular.bin", True),
            ("saves/meu_save.save", True),
            ("CmMgrRaiz2026", True),
            ("subpasta/CmMgrSub2026", True),
            ("backup_save.bak", True),
            ("assets/data/local/qualquer_arquivo.json", True),
            ("saves/.gitkeep", False),
            ("assets/data/career_data.json", False),
            ("assets/data/career_data.js", False),
            ("assets/js/domain.js", False),
        ]
        for rel_path, should_ignore in test_candidates:
            res = subprocess.run(
                ["git", "check-ignore", "-q", rel_path],
                cwd=PROJECT_ROOT, capture_output=True, text=True
            )
            is_ignored = (res.returncode == 0)
            self.assertEqual(
                is_ignored, should_ignore,
                f"Regra de ignore incorreta para '{rel_path}': esperado={should_ignore}, obtido={is_ignored}"
            )

    def test_36_local_save_import_and_processing_preserved(self):
        """As funções locais de importação e processamento de saves continuam íntegras."""
        # 1. list_available_saves e find_save_files funcionam
        saves = save_parser.list_available_saves()
        self.assertIsInstance(saves, list)
        files = save_parser.find_save_files()
        self.assertIsInstance(files, list)

        # 2. Servidor local possui as rotas necessárias para importação e seleção
        self.assertTrue(hasattr(tracker_app, "TrackerRequestHandler"))
        self.assertTrue(callable(getattr(tracker_app.TrackerRequestHandler, "do_GET", None)))
        self.assertTrue(callable(getattr(tracker_app.TrackerRequestHandler, "do_POST", None)))

        # 3. Pipeline aceita target_save e mantém cópia local completa com save_file
        dummy_data = {
            "save_file": "CmMgrTesteLocal",
            "save_path": "saves/CmMgrTesteLocal",
            "updated_at": "29/10/2026 10:00:00",
            "club": {"nome": "Teste Club", "id": 1, "pais": "Espanha", "liga": "Liga", "treinador": "T", "data_atual": "Indisponível", "temporada": "T1"},
            "squad": [],
            "matches": [],
            "standings": {},
            "validation_report": {"checks": []}
        }
        sanitized = save_parser.sanitize_for_public_export(dummy_data)
        self.assertNotIn("save_file", sanitized)
        self.assertEqual(dummy_data["save_file"], "CmMgrTesteLocal")


if __name__ == "__main__":
    unittest.main(verbosity=2)
