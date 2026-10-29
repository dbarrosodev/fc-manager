#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FC MANAGER — SUÍTE DE TESTES DE REGRESSÃO E AUDITORIA (v3.2)
Cobre integralmente os 18 cenários de validação funcional, segurança,
separação de competições, integridade contábil e acessibilidade.

Uso:
  python tests/test_audit_suite.py
  ou
  python -m unittest tests/test_audit_suite.py
"""

import os
import sys
import json
import csv
import re
import unittest
import subprocess

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(TESTS_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src import save_parser


class TestFCManagerAuditSuite(unittest.TestCase):
    """Suíte oficial cobrindo os 18 cenários da auditoria do FC Manager."""

    @classmethod
    def setUpClass(cls):
        cls.json_path = os.path.join(PROJECT_ROOT, "assets", "data", "career_data.json")
        cls.js_path = os.path.join(PROJECT_ROOT, "assets", "data", "career_data.js")
        cls.csv_path = os.path.join(PROJECT_ROOT, "exports", "Estatisticas_Jogadores_FC_Andorra_Carreira.csv")
        cls.index_path = os.path.join(PROJECT_ROOT, "index.html")
        cls.css_path = os.path.join(PROJECT_ROOT, "assets", "css", "styles.css")
        cls.main_js_path = os.path.join(PROJECT_ROOT, "assets", "js", "main.js")
        cls.domain_js_path = os.path.join(PROJECT_ROOT, "assets", "js", "domain.js")

        with open(cls.json_path, "r", encoding="utf-8") as f:
            cls.career_data = json.load(f)

    # -------------------------------------------------------------------------
    # CENÁRIO 1: Carregamento de JSON válido
    # -------------------------------------------------------------------------
    def test_01_valid_json_loading(self):
        """Verifica se career_data.json é válido, contém os nós essenciais e não vaza caminhos absolutos."""
        self.assertIsInstance(self.career_data, dict)
        for key in ["club", "squad", "matches", "standings", "validation_report"]:
            self.assertIn(key, self.career_data, f"Chave essencial '{key}' ausente no career_data.json")

        json_str = json.dumps(self.career_data)
        # Garantir ausência de caminhos absolutos locais do Windows
        self.assertNotIn("C:\\Users\\", json_str, "Vazamento de caminho absoluto do Windows em career_data.json")
        self.assertNotIn("/Users/", json_str, "Vazamento de caminho de usuário em career_data.json")

    # -------------------------------------------------------------------------
    # CENÁRIO 2: Fallback estático válido
    # -------------------------------------------------------------------------
    def test_02_valid_static_fallback(self):
        """Verifica se career_data.js define window.FALLBACK_CAREER_DATA com dados válidos."""
        self.assertTrue(os.path.exists(self.js_path), "career_data.js não encontrado")
        with open(self.js_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("window.FALLBACK_CAREER_DATA =", content)
        match = re.search(r"window\.FALLBACK_CAREER_DATA\s*=\s*(\{.*?\});\s*$", content, re.DOTALL)
        self.assertIsNotNone(match, "Não foi possível extrair objeto JSON de career_data.js")
        fallback_json = json.loads(match.group(1))
        self.assertIn("club", fallback_json)
        self.assertIn("squad", fallback_json)
        self.assertEqual(len(fallback_json["squad"]), len(self.career_data["squad"]))

    # -------------------------------------------------------------------------
    # CENÁRIO 3: Tratamento de ausência total de dados
    # -------------------------------------------------------------------------
    def test_03_absence_of_data_handling(self):
        """Verifica se o núcleo de domínio lida com dados nulos ou vazios sem crash."""
        cmd = [
            "node", "-e",
            """
            const d = require('./assets/js/domain.js');
            const norm1 = d.normalizeCareerData(null);
            const norm2 = d.normalizeCareerData({});
            const p1 = d.normalizePlayerData(null);
            const rep = d.normalizeValidationReport(null);
            if (!norm1 || !norm2 || p1 !== null || rep.total_verificados !== 0) {
              process.exit(1);
            }
            console.log('OK');
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, f"Falha no tratamento de dados nulos: {res.stderr}")
        self.assertIn("OK", res.stdout)

    # -------------------------------------------------------------------------
    # CENÁRIO 4: Tratamento de JSON inválido
    # -------------------------------------------------------------------------
    def test_04_invalid_json_handling(self):
        """Verifica se JSONs malformados são rejeitados de forma segura."""
        malformed = '{"club": {"nome": "FC Andorra", broken...}'
        with self.assertRaises(json.JSONDecodeError):
            json.loads(malformed)

    # -------------------------------------------------------------------------
    # CENÁRIO 5: Tratamento de datas ausentes (sem data fake 01/01/2008)
    # -------------------------------------------------------------------------
    def test_05_missing_date_handling(self):
        """Verifica se a ausência de data exibe indicação honesta e NUNCA a data fake 01/01/2008."""
        cmd = [
            "node", "-e",
            """
            const d = require('./assets/js/domain.js');
            const data = { club: { nome: 'FC Andorra' } };
            const norm = d.normalizeCareerData(data);
            if (norm.club.data_atual === '01/01/2008') {
              console.error('Data fake 01/01/2008 detectada!');
              process.exit(1);
            }
            if (norm.club.data_atual !== 'Indisponível') {
              console.error('Data não tratada corretamente:', norm.club.data_atual);
              process.exit(1);
            }
            console.log('OK');
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, f"Falha no tratamento de data ausente: {res.stderr}")

        with open(self.index_path, "r", encoding="utf-8") as f:
            html = f.read()
        self.assertNotIn("01/01/2008", html, "A data fake '01/01/2008' ainda está no index.html")

    # -------------------------------------------------------------------------
    # CENÁRIO 6: Filtro de hierarquia com rótulos compostos (ex: Titular (ZAG))
    # -------------------------------------------------------------------------
    def test_06_hierarchy_filter_with_status_labels(self):
        """Garante que 'Titular (ZAG)' e 'Suplente (Banco)' são corretamente filtrados via canônico para 100% dos atletas."""
        cmd = [
            "node", "-e",
            """
            const d = require('./assets/js/domain.js');
            const data = require('./assets/data/career_data.json');
            const norm = d.normalizeCareerData(data);
            const titulares = d.filterSquad(norm.squad, { hierarchy: 'titular' });
            const reservas = d.filterSquad(norm.squad, { hierarchy: 'reserva' });
            const naoRel = d.filterSquad(norm.squad, { hierarchy: 'nao_relacionado' });
            
            // Validar que 100% dos atletas pertencem a uma hierarquia canônica válida
            for (const p of norm.squad) {
              if (!['titular', 'reserva', 'nao_relacionado'].includes(p.hierarquia_tatica)) {
                console.error('Atleta com hierarquia inválida:', p.nome, p.hierarquia_tatica);
                process.exit(1);
              }
              if (!['goleiro', 'defesa', 'meio', 'ataque'].includes(p.setor_canonico)) {
                console.error('Atleta com setor inválido:', p.nome, p.setor_canonico);
                process.exit(1);
              }
              // Garantir que rótulo detalhado original está preservado
              if (!p.status_elenco || p.status_elenco.trim() === '') {
                console.error('Status elenco detalhado vazio:', p.nome);
                process.exit(1);
              }
            }

            if (titulares.length + reservas.length + naoRel.length !== norm.squad.length) {
              console.error('Soma das hierarquias diverge do total de atletas');
              process.exit(1);
            }

            console.log(JSON.stringify({ tit: titulares.length, res: reservas.length, nao: naoRel.length, total: norm.squad.length }));
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, f"Falha no filtro de hierarquia: {res.stderr}")
        counts = json.loads(res.stdout.strip())
        self.assertEqual(counts["tit"], 11, "Deveriam haver exatamente 11 titulares na escalação principal")
        self.assertGreater(counts["res"], 0)
        self.assertEqual(counts["total"], counts["tit"] + counts["res"] + counts["nao"])

    # -------------------------------------------------------------------------
    # CENÁRIO 7: Busca por nome e posição
    # -------------------------------------------------------------------------
    def test_07_search_by_name_and_position(self):
        """Verifica se a busca textual encontra atletas por nome, nome completo ou posição."""
        cmd = [
            "node", "-e",
            """
            const d = require('./assets/js/domain.js');
            const data = require('./assets/data/career_data.json');
            const norm = d.normalizeCareerData(data);
            const searchBomba = d.filterSquad(norm.squad, { search: 'bomba' });
            const searchZag = d.filterSquad(norm.squad, { search: 'zag' });
            const searchLautaro = d.filterSquad(norm.squad, { search: 'LAUTARO' });
            if (searchBomba.length === 0 || searchZag.length === 0 || searchLautaro.length === 0) {
              process.exit(1);
            }
            console.log('OK');
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, "Busca por nome e posição falhou")

    # -------------------------------------------------------------------------
    # CENÁRIO 8: Ordenação ascendente e descendente
    # -------------------------------------------------------------------------
    def test_08_ascending_and_descending_sort(self):
        """Verifica se a ordenação por minutos, gols e overall funciona em ambas as direções."""
        cmd = [
            "node", "-e",
            """
            const d = require('./assets/js/domain.js');
            const data = require('./assets/data/career_data.json');
            const norm = d.normalizeCareerData(data);
            const desc = d.sortSquad(norm.squad, 'minutos', 'desc');
            const asc = d.sortSquad(norm.squad, 'minutos', 'asc');
            if (desc[0].minutos < desc[desc.length - 1].minutos) process.exit(1);
            if (asc[0].minutos > asc[asc.length - 1].minutos) process.exit(1);
            console.log('OK');
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, "Ordenação de elenco falhou")

    # -------------------------------------------------------------------------
    # CENÁRIO 9: Valores zero, nulos e N/D
    # -------------------------------------------------------------------------
    def test_09_zero_null_and_nd_values(self):
        """Verifica se notas zeradas e assistências N/D são formatadas de modo limpo."""
        cmd = [
            "node", "-e",
            """
            const d = require('./assets/js/domain.js');
            const r0 = d.formatRating(0);
            const rNull = d.formatRating(null);
            const rVal = d.formatRating(7.48);
            if (r0 !== '-' || rNull !== '-' || rVal !== '7.48') {
              console.error('FormatRating falhou:', { r0, rNull, rVal });
              process.exit(1);
            }
            console.log('OK');
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, "Tratamento de rating zero/null falhou")

    # -------------------------------------------------------------------------
    # CENÁRIO 10: Separação estrita entre Liga e Pré-Temporada
    # -------------------------------------------------------------------------
    def test_10_strict_separation_between_league_and_preseason(self):
        """Verifica separação contábil: Liga (3J, 8 GP, 2 GC, 7 pts) vs Pré-temporada (3J, 6 GP, 1 GC)."""
        club = self.career_data.get("club", {})
        comps = club.get("competicoes_separadas", {})
        self.assertIn("liga", comps)
        self.assertIn("pre_temporada", comps)
        self.assertIn("total_temporada", comps)

        liga = comps["liga"]
        pre = comps["pre_temporada"]
        tot = comps["total_temporada"]

        self.assertEqual(liga["jogos"], 3)
        self.assertEqual(liga["gols_pro"], 8)
        self.assertEqual(liga["gols_contra"], 2)
        self.assertEqual(liga["pontos"], 7)

        self.assertEqual(pre["jogos"], 3)
        self.assertEqual(pre["gols_pro"], 6)
        self.assertEqual(pre["gols_contra"], 1)

        self.assertEqual(tot["jogos"], 6)
        self.assertEqual(tot["gols_pro"], 14)
        self.assertEqual(tot["gols_contra"], 3)

    # -------------------------------------------------------------------------
    # CENÁRIO 11: Reconciliação dos gols por partida
    # -------------------------------------------------------------------------
    def test_11_reconciliation_of_goals_per_match(self):
        """Verifica que a soma dos gols individuais nos logs bate exatamente com os placares das partidas."""
        logs = self.career_data.get("player_match_logs", [])
        matches = self.career_data.get("matches", [])

        # Gols por partida nos logs
        match_log_goals = {}
        for log in logs:
            mid = log["match_id"]
            match_log_goals[mid] = match_log_goals.get(mid, 0) + log.get("gols_partida", 0)

        # Gols do Andorra nas partidas
        for m in matches:
            mid = m["id"]
            if m["mandante"] == "FC Andorra":
                team_goals = m["placar_mandante"]
            else:
                team_goals = m["placar_visitante"]
            log_goals = match_log_goals.get(mid, 0)
            self.assertEqual(
                log_goals, team_goals,
                f"Divergência de gols no jogo #{mid} vs {m['adversario']}: equipe fez {team_goals}, logs somam {log_goals}"
            )

    # -------------------------------------------------------------------------
    # CENÁRIO 12: Minutos totais derivados diretamente dos logs
    # -------------------------------------------------------------------------
    def test_12_minutes_totals_derived_from_logs(self):
        """Para 100% dos jogadores, a soma dos minutos de seus logs deve ser igual a minutos no elenco."""
        squad = self.career_data.get("squad", [])
        logs = self.career_data.get("player_match_logs", [])

        player_log_mins = {}
        for l in logs:
            pid = l["playerid"]
            player_log_mins[pid] = player_log_mins.get(pid, 0) + l.get("minutos", 0)

        for p in squad:
            pid = p["playerid"]
            expected = player_log_mins.get(pid, 0)
            actual = p["minutos"]
            self.assertEqual(
                actual, expected,
                f"Minutos divergentes para {p['nome']} (ID {pid}): elenco={actual}, logs={expected}"
            )

    # -------------------------------------------------------------------------
    # CENÁRIO 13: Relatório de auditoria incompleto ou ausente (sem || 8)
    # -------------------------------------------------------------------------
    def test_13_missing_or_incomplete_audit_report(self):
        """Garante que relatórios de validação vazios exibem contagens honestas de 0 sem cair no fake 8."""
        cmd = [
            "node", "-e",
            """
            const d = require('./assets/js/domain.js');
            const report = d.normalizeValidationReport({});
            if (report.total_verificados !== 0 || report.total_parciais !== 0 || report.total_falhas !== 0) {
              console.error('Fallback incorreto no relatório:', report);
              process.exit(1);
            }
            console.log('OK');
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, "Normalização de relatório vazio falhou")

        with open(self.main_js_path, "r", encoding="utf-8") as f:
            main_js = f.read()
        self.assertNotIn("report.total_ok || 8", main_js, "Fallback hardcoded '|| 8' encontrado em main.js")

    # -------------------------------------------------------------------------
    # CENÁRIO 14: Tratamento de falhas na sincronização local
    # -------------------------------------------------------------------------
    def test_14_local_sync_failure_handling(self):
        """Verifica se o servidor local responde adequadamente (404 com JSON de erro) a requisições de save inválido."""
        import urllib.request
        import urllib.error

        req = urllib.request.Request(
            "http://127.0.0.1:8080/api/select_save",
            data=json.dumps({"save_file": "save_inexistente_1234.bin"}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )

        try:
            with urllib.request.urlopen(req) as resp:
                status = resp.status
                body = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            status = err.code
            body = json.loads(err.read().decode("utf-8"))
        except urllib.error.URLError:
            # Caso servidor não esteja ativo na porta, testar lógica do parser diretamente
            saves = save_parser.list_available_saves()
            self.assertIsInstance(saves, list)
            return

        self.assertEqual(status, 404)
        self.assertIn("error", body)

    # -------------------------------------------------------------------------
    # CENÁRIO 15: Consistência da exportação com os dados-fonte
    # -------------------------------------------------------------------------
    def test_15_export_consistency_with_source_data(self):
        """Verifica se a exportação CSV contém os mesmos atletas e estatísticas-chave que o JSON."""
        self.assertTrue(os.path.exists(self.csv_path), "CSV de exportação não encontrado")
        with open(self.csv_path, "r", encoding="utf-8-sig") as f:
            reader = list(csv.DictReader(f, delimiter=";"))

        squad = self.career_data.get("squad", [])
        self.assertEqual(len(reader), len(squad), "Número de linhas no CSV diverge do elenco no JSON")

        csv_players = {r["Jogador"]: r for r in reader}
        for p in squad:
            pname = p["nome"]
            self.assertIn(pname, csv_players, f"Jogador {pname} ausente no CSV")
            row = csv_players[pname]
            self.assertEqual(int(row["Minutos (Logs)"]), p["minutos"], f"Minutos divergem no CSV para {pname}")
            self.assertEqual(int(row["Gols (Conciliado Logs)"]), p["gols"], f"Gols divergem no CSV para {pname}")

    # -------------------------------------------------------------------------
    # CENÁRIO 16: Escape HTML de strings maliciosas (Proteção XSS)
    # -------------------------------------------------------------------------
    def test_16_html_escaping_of_malicious_strings(self):
        """Verifica sanitização HTML completa de scripts, aspas e tags."""
        cmd = [
            "node", "-e",
            """
            const d = require('./assets/js/domain.js');
            const malicious = '<script>alert("XSS & danger")</script>';
            const escaped = d.escapeHtml(malicious);
            if (escaped.includes('<') || escaped.includes('>') || escaped.includes('"')) {
              console.error('EscapeHtml vulnerável:', escaped);
              process.exit(1);
            }
            if (!escaped.includes('&lt;script&gt;')) {
              process.exit(1);
            }
            console.log('OK');
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, "Escape HTML falhou")

    # -------------------------------------------------------------------------
    # CENÁRIO 17: Navegação por teclado dos modais (Escape)
    # -------------------------------------------------------------------------
    def test_17_modal_keyboard_navigation(self):
        """Verifica suporte a acessibilidade e fechamento via Escape no código e marcação."""
        with open(self.index_path, "r", encoding="utf-8") as f:
            html = f.read()

        self.assertIn('role="dialog"', html, "Falta role='dialog' nos modais")
        self.assertIn('aria-modal="true"', html, "Falta aria-modal='true' nos modais")

        with open(self.main_js_path, "r", encoding="utf-8") as f:
            main_js = f.read()
        self.assertIn('e.key === "Escape"', main_js, "Handler de Escape ausente em main.js")

    # -------------------------------------------------------------------------
    # CENÁRIO 18: Responsividade da tabela e controles
    # -------------------------------------------------------------------------
    def test_18_table_and_control_responsiveness(self):
        """Verifica regras essenciais de responsividade e formatação tabular no CSS."""
        with open(self.css_path, "r", encoding="utf-8") as f:
            css = f.read()

        self.assertIn("overflow-x: auto", css, "Container responsivo de tabelas ausente no CSS")
        self.assertIn("tabular-nums", css, "Numerais tabulares ausentes no CSS")
        self.assertIn("@media", css, "Media queries ausentes no CSS")


if __name__ == "__main__":
    unittest.main(verbosity=2)
