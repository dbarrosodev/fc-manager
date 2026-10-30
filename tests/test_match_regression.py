#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FC MANAGER — TESTES DE REGRESSÃO: ÚLTIMO CONFRONTO E RESULTADOS DAS PARTIDAS

Cobre especificamente os dois bugs reportados na revisão da v3.2:
  1. "Último confronto" exibindo "undefined - undefined" (resumo club.ultima_partida
     sem mandante/visitante/placar_mandante/placar_visitante).
  2. Cores dos resultados incorretas quando os dados vêm como "Vitória"/"Empate"
     em vez de "V"/"E".

Inclui testes de domínio (domain.js) e testes de renderização que executam o
main.js REAL com um DOM simulado (tests/ui_harness.js), validando o texto que a
interface efetivamente escreve na tela.

Uso:
  python -m unittest tests/test_match_regression.py -v
"""

import copy
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(TESTS_DIR, ".."))
DATA_PATH = os.path.join(PROJECT_ROOT, "assets", "data", "career_data.json")
MAIN_JS_PATH = os.path.join(PROJECT_ROOT, "assets", "js", "main.js")
HARNESS = os.path.join(TESTS_DIR, "ui_harness.js")


def run_node(script):
    """Executa um trecho JS com domain.js disponível como `d` e retorna o JSON impresso."""
    prelude = "const d = require('./assets/js/domain.js');\n"
    res = subprocess.run(
        ["node", "-e", prelude + script],
        cwd=PROJECT_ROOT, capture_output=True, text=True, encoding="utf-8"
    )
    if res.returncode != 0:
        raise AssertionError(f"Node falhou:\n{res.stderr}")
    return json.loads(res.stdout.strip())


def render_ui(data):
    """Renderiza main.js real com os dados fornecidos e retorna o que foi escrito na tela."""
    fd, tmp = tempfile.mkstemp(suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        res = subprocess.run(
            ["node", HARNESS, tmp],
            cwd=PROJECT_ROOT, capture_output=True, text=True, encoding="utf-8"
        )
    finally:
        os.remove(tmp)
    if res.returncode != 0:
        raise AssertionError(f"Harness de UI falhou:\n{res.stderr}")
    return json.loads(res.stdout)


def legacy_summary(match):
    """Reproduz o resumo antigo gerado pelo save_parser (sem mandante/visitante/placares)."""
    keys = ["id", "data", "competicao", "adversario", "mando", "placar", "resultado", "artilheiros"]
    return {k: match.get(k) for k in keys}


class TestLastMatchAndResults(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            cls.data = json.load(f)
        cls.latest = sorted(cls.data["matches"], key=lambda m: m["date_int"])[-1]

    # ------------------------------------------------------------------
    # BUG 1 — ÚLTIMO CONFRONTO
    # ------------------------------------------------------------------
    def test_19_legacy_summary_resolves_to_full_match_record(self):
        """Resumo legado (sem mandante/placares) deve ser trocado pelo registro completo."""
        out = run_node(f"""
            const data = JSON.parse(JSON.stringify(require('./assets/data/career_data.json')));
            data.club.ultima_partida = {json.dumps(legacy_summary(self.latest), ensure_ascii=False)};
            const n = d.normalizeCareerData(data);
            const u = n.club.ultima_partida;
            console.log(JSON.stringify({{ id: u.id, mandante: u.mandante, visitante: u.visitante,
              pm: u.placar_mandante, pv: u.placar_visitante, escalacao: u.escalacao.length }}));
        """)
        self.assertEqual(out["id"], self.latest["id"])
        self.assertEqual(out["mandante"], self.latest["mandante"])
        self.assertEqual(out["visitante"], self.latest["visitante"])
        self.assertEqual(out["pm"], self.latest["placar_mandante"])
        self.assertEqual(out["pv"], self.latest["placar_visitante"])
        self.assertEqual(out["escalacao"], len(self.latest.get("escalacao", [])))

    def test_20_summary_without_record_is_derived_from_mando_and_score(self):
        """Sem registro correspondente, o resumo é normalizado respeitando o mando (jogo fora inverte)."""
        out = run_node("""
            const n = d.normalizeCareerData({
              club: { nome: 'FC Andorra',
                      ultima_partida: { id: 99, data: '01/09/2025', competicao: 'Liga',
                                        adversario: 'Real Zaragoza', mando: 'Fora',
                                        placar: '1 x 5', resultado: 'Vitória' } },
              matches: []
            });
            const u = n.club.ultima_partida;
            console.log(JSON.stringify(u));
        """)
        self.assertEqual(out["mandante"], "Real Zaragoza")
        self.assertEqual(out["visitante"], "FC Andorra")
        self.assertEqual(out["placar_mandante"], 1)
        self.assertEqual(out["placar_visitante"], 5)
        self.assertEqual(out["gols_pro"], 5)
        self.assertEqual(out["gols_contra"], 1)
        self.assertEqual(out["resultado_canonico"], "vitoria")

    def test_21_stale_summary_id_falls_back_to_latest_by_date(self):
        """Resumo apontando para id inexistente não pode prevalecer sobre os registros reais."""
        out = run_node("""
            const data = JSON.parse(JSON.stringify(require('./assets/data/career_data.json')));
            data.club.ultima_partida = { id: 12345, adversario: 'Fantasma' };
            const n = d.normalizeCareerData(data);
            console.log(JSON.stringify({ id: n.club.ultima_partida.id }));
        """)
        self.assertEqual(out["id"], self.latest["id"])

    def test_22_published_data_last_match_points_to_latest_record(self):
        """No JSON publicado, o resumo deve apontar para a partida mais recente por date_int."""
        summary = self.data["club"].get("ultima_partida")
        self.assertIsNotNone(summary, "club.ultima_partida ausente no career_data.json")
        self.assertEqual(summary["id"], self.latest["id"])

    def test_23_ui_hero_never_renders_undefined(self):
        """Renderiza a UI real com o resumo legado e confere o placar exibido no card."""
        data = copy.deepcopy(self.data)
        data["club"]["ultima_partida"] = legacy_summary(self.latest)
        out = render_ui(data)
        hero = out["hero"]
        self.assertEqual(out["error"], "", f"UI entrou em estado de erro: {out['error']}")
        for field, value in hero.items():
            self.assertNotIn("undefined", value, f"hero.{field} contém 'undefined': {value!r}")
            self.assertNotIn("null", value, f"hero.{field} contém 'null': {value!r}")
        self.assertEqual(hero["home"], self.latest["mandante"])
        self.assertEqual(hero["away"], self.latest["visitante"])
        self.assertEqual(
            hero["score"], f"{self.latest['placar_mandante']} - {self.latest['placar_visitante']}"
        )

    def test_24_ui_match_modal_shows_lineup_fields(self):
        """A ficha técnica aberta pelo card não pode exibir 'undefined' (posição/assistências)."""
        out = render_ui(copy.deepcopy(self.data))
        self.assertIn(self.latest["mandante"], out["matchModalTitle"])
        self.assertNotIn("undefined", out["matchModalTitle"])
        self.assertNotIn("undefined", out["matchModalBody"])
        first = self.latest["escalacao"][0]
        self.assertIn(f">{first['posicao']}<", out["matchModalBody"],
                      "Posição jogada do primeiro atleta não aparece na ficha técnica")

    # ------------------------------------------------------------------
    # BUG 2 — PADRONIZAÇÃO DE RESULTADOS E CORES
    # ------------------------------------------------------------------
    def test_25_result_normalization_accepts_all_formats(self):
        """'V', 'Vitória', 'vitoria', 'W', 'E', 'Empate', 'D', 'Derrota' → valores canônicos."""
        out = run_node("""
            const inputs = ['V','Vitória','vitoria','VITÓRIA','W','win','E','Empate','empate','draw',
                            'D','Derrota','derrota','L','loss'];
            const r = {};
            for (const i of inputs) r[i] = d.normalizeResult(i);
            r.__derived_win = d.normalizeResult('Disputado', 3, 1);
            r.__derived_loss = d.normalizeResult(undefined, 0, 2);
            r.__derived_draw = d.normalizeResult('', 1, 1);
            r.__unknown = d.normalizeResult('???');
            console.log(JSON.stringify(r));
        """)
        for k in ["V", "Vitória", "vitoria", "VITÓRIA", "W", "win"]:
            self.assertEqual(out[k], "vitoria", k)
        for k in ["E", "Empate", "empate", "draw"]:
            self.assertEqual(out[k], "empate", k)
        for k in ["D", "Derrota", "derrota", "L", "loss"]:
            self.assertEqual(out[k], "derrota", k)
        self.assertEqual(out["__derived_win"], "vitoria")
        self.assertEqual(out["__derived_loss"], "derrota")
        self.assertEqual(out["__derived_draw"], "empate")
        self.assertEqual(out["__unknown"], "indefinido")

    def test_26_mixed_result_formats_count_identically(self):
        """Partidas com 'V' e 'Vitória' misturados devem gerar o mesmo saldo de V/E/D."""
        out = run_node("""
            const mk = (id, res, gp, gc) => ({ id, date_int: 20250800 + id, competicao: 'Liga X',
              tipo_competicao: 'Liga Nacional', mandante: 'A', visitante: 'B',
              placar_mandante: gp, placar_visitante: gc, gols_pro: gp, gols_contra: gc,
              mando: 'Casa', resultado: res });
            const n = d.normalizeCareerData({ club: { nome: 'A' }, matches: [
              mk(1, 'V', 2, 0), mk(2, 'Vitória', 3, 1), mk(3, 'E', 1, 1),
              mk(4, 'Empate', 0, 0), mk(5, 'D', 0, 1), mk(6, 'Derrota', 1, 2) ] });
            console.log(JSON.stringify(n.club.competicoes_separadas.liga));
        """)
        self.assertEqual(out["vitorias"], 2)
        self.assertEqual(out["empates"], 2)
        self.assertEqual(out["derrotas"], 2)
        self.assertEqual(out["pontos"], 8)

    def test_27_ui_result_badges_use_correct_colors(self):
        """Na UI real, 'Vitória' → win, 'Empate' → draw, 'Derrota' → loss (texto longo ou sigla)."""
        data = copy.deepcopy(self.data)
        base = data["matches"][0]
        variants = [("Vitória", 2, 0), ("V", 2, 0), ("Empate", 1, 1), ("E", 1, 1),
                    ("Derrota", 0, 1), ("D", 0, 1)]
        data["matches"] = []
        for i, (res, pm, pv) in enumerate(variants, start=1):
            m = copy.deepcopy(base)
            m.update({"id": i, "date_int": 20250900 + i, "mando": "Casa",
                      "placar_mandante": pm, "placar_visitante": pv, "placar": f"{pm} x {pv}",
                      "gols_pro": pm, "gols_contra": pv, "resultado": res})
            data["matches"].append(m)
        data["club"]["ultima_partida"] = None

        html = render_ui(data)["matchesGridHtml"]
        classes = re.findall(r'badge badge-result (\w+)', html)
        self.assertEqual(classes, ["win", "win", "draw", "draw", "loss", "loss"])

    def test_28_real_data_badges_match_scores(self):
        """Com os dados publicados, a cor de cada card coincide com o placar da partida."""
        html = render_ui(copy.deepcopy(self.data))["matchesGridHtml"]
        classes = re.findall(r'badge badge-result (\w+)', html)
        expected = []
        for m in self.data["matches"]:
            gp, gc = m["gols_pro"], m["gols_contra"]
            expected.append("win" if gp > gc else "loss" if gp < gc else "draw")
        self.assertEqual(classes, expected)
        self.assertNotIn("undefined", html)

    def test_29_main_js_has_no_raw_result_or_score_comparisons(self):
        """Guarda estática: main.js não volta a comparar resultado com 'V'/'E' nem a interpolar placares crus."""
        with open(MAIN_JS_PATH, "r", encoding="utf-8") as f:
            src = f.read()
        self.assertIsNone(re.search(r"resultado\s*===?\s*[\"'](V|E|D)[\"']", src),
                          "main.js compara resultado com sigla crua")
        self.assertNotIn("${lastMatch.placar_mandante}", src)
        self.assertNotIn("${m.placar_mandante}", src)
        self.assertIsNone(re.search(r"\|\|\s*[1-9]\d*\}[JVED]", src),
                          "main.js usa números fictícios como fallback no placar da campanha")

    def test_30_save_matches_deterministic_coupling_and_history_audit(self):
        """Valida que o parser casa deterministicamente os registros do mham com o ledger,
        elimina fallbacks 0-0 'Adversário', valida totais e audita contra career_managerhistory."""
        import sys
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from src.save_parser import parse_save_file

        save9_path = os.path.join(PROJECT_ROOT, "saves", "CmMgrC20261029111706028")
        save10_path = r"C:\Users\Daniel\Downloads\save\saves\CmMgrC20261029172849669"

        if os.path.exists(save9_path):
            d9 = parse_save_file(save9_path)
            m9 = d9["matches"]
            self.assertEqual(len(m9), 9)
            w9 = sum(1 for m in m9 if m["resultado"] == "Vitória")
            d9_c = sum(1 for m in m9 if m["resultado"] == "Empate")
            l9 = sum(1 for m in m9 if m["resultado"] == "Derrota")
            gp9 = sum(m["gols_pro"] or 0 for m in m9)
            gc9 = sum(m["gols_contra"] or 0 for m in m9)
            self.assertEqual((w9, d9_c, l9, gp9, gc9), (6, 3, 0, 19, 5))
            self.assertEqual(m9[8]["adversario"], "SD Eibar")
            self.assertEqual(m9[8]["placar_origem"], "save")
            self.assertEqual(d9.get("auditoria_historico", {}).get("status"), "OK")

        if os.path.exists(save10_path):
            d10 = parse_save_file(save10_path)
            m10 = d10["matches"]
            self.assertEqual(len(m10), 10)
            w10 = sum(1 for m in m10 if m["resultado"] == "Vitória")
            d10_c = sum(1 for m in m10 if m["resultado"] == "Empate")
            l10 = sum(1 for m in m10 if m["resultado"] == "Derrota")
            gp10 = sum(m["gols_pro"] or 0 for m in m10)
            gc10 = sum(m["gols_contra"] or 0 for m in m10)
            self.assertEqual((w10, d10_c, l10, gp10, gc10), (7, 3, 0, 24, 5))

            # Match 9 (Eibar) mantido via ledger histórico
            self.assertEqual(m10[8]["adversario"], "SD Eibar")
            self.assertEqual(m10[8]["placar"], "0 x 1")
            self.assertEqual(m10[8]["placar_origem"], "histórico anterior")

            # Match 10 (Racing 0-5) em 27/09 com Cardona (4) e Molina (1)
            self.assertEqual(m10[9]["data"], "27/09/2025")
            self.assertEqual(m10[9]["adversario"], "Racing de Santander")
            self.assertEqual(m10[9]["placar"], "0 x 5")
            self.assertEqual(m10[9]["placar_origem"], "save")
            self.assertIn("Marc Cardona (4)", m10[9]["artilheiros"])
            self.assertIn("Sergio Molina (1)", m10[9]["artilheiros"])

            # Nenhum 0-0 Adversário
            self.assertFalse(any(m["adversario"] == "Adversário" for m in m10))
            self.assertFalse(any(m["placar"] == "0 x 0" for m in m10))
            self.assertEqual(d10.get("auditoria_historico", {}).get("status"), "OK")

    def test_31_simulated_match_11_new_opponent(self):
        """(a) Simula o 11º jogo contra adversário novo (Levante UD 1880 em 04/10/2025).
        Verifica que o jogo é cadastrado no ledger sob a chave '114554_20251004_1880' e preserva
        todos os 10 jogos anteriores sem nenhuma perda."""
        from src.save_parser import load_match_ledger, resolve_matches_with_ledger

        base_ledger = {k: copy.deepcopy(v) for k, v in load_match_ledger().items() if v.get("date_int", 0) <= 20250927}
        self.assertEqual(len(base_ledger), 10)

        ratings_dates = [20250718, 20250722, 20250726, 20250817, 20250823, 20250831,
                         20250907, 20250913, 20250921, 20250927, 20251004]

        # mham rotativo contém os últimos 3 jogos (Levante 1880, Racing 456, Mirandés 110069)
        # Córdoba 1867 e Eibar 467 já saíram do buffer mham!
        mham_records = [
            {"hid": 114554, "aid": 1880, "hsc": 3, "asc": 1, "opp_id": 1880, "is_home": True, "gp": 3, "gc": 1},
            {"hid": 456, "aid": 114554, "hsc": 0, "asc": 5, "opp_id": 456, "is_home": False, "gp": 5, "gc": 0},
            {"hid": 114554, "aid": 110069, "hsc": 2, "asc": 0, "opp_id": 110069, "is_home": True, "gp": 2, "gc": 0}
        ]
        teams_map = {1880: "Levante UD", 456: "Racing de Santander", 110069: "CD Mirandés", 114554: "FC Andorra"}

        matches, updated_ledger, changed, conflitos = resolve_matches_with_ledger(
            ratings_dates=ratings_dates,
            mham_parsed_records=mham_records,
            teams_map=teams_map,
            full_ledger=base_ledger
        )

        self.assertEqual(len(matches), 11)
        self.assertTrue(changed)
        self.assertIn("114554_20251004_1880", updated_ledger)
        self.assertEqual(updated_ledger["114554_20251004_1880"]["placar"], "3 x 1")
        self.assertEqual(updated_ledger["114554_20251004_1880"]["opp_name"], "Levante UD")

        # 11º jogo veio do save
        m11 = matches[10]
        self.assertEqual(m11["data"], "04/10/2025")
        self.assertEqual(m11["adversario"], "Levante UD")
        self.assertEqual(m11["placar"], "3 x 1")
        self.assertEqual(m11["placar_origem"], "save")

        # Jogos que já saíram do mham (ex.: Eibar 21/09 e Córdoba 13/09) mantidos via histórico
        m_eibar = next(m for m in matches if m["date_int"] == 20250921)
        self.assertEqual(m_eibar["adversario"], "SD Eibar")
        self.assertEqual(m_eibar["placar"], "0 x 1")
        self.assertEqual(m_eibar["placar_origem"], "histórico anterior")

    def test_32_simulated_match_11_repeated_opponent(self):
        """(b) Simula 11º jogo contra adversário repetido (Racing 456 em 11/10/2025),
        garantindo chave composta '114554_20251011_456' sem colidir com '114554_20250927_456'."""
        from src.save_parser import load_match_ledger, resolve_matches_with_ledger

        base_ledger = {k: copy.deepcopy(v) for k, v in load_match_ledger().items() if v.get("date_int", 0) <= 20250927}
        self.assertIn("114554_20250927_456", base_ledger)
        first_leg_score = base_ledger["114554_20250927_456"]["placar"]
        self.assertEqual(first_leg_score, "0 x 5")

        ratings_dates = [20250718, 20250722, 20250726, 20250817, 20250823, 20250831,
                         20250907, 20250913, 20250921, 20250927, 20251011]

        # Andorra recebe o Racing em casa pela Copa ou returno: placar 2 x 1
        mham_records = [
            {"hid": 114554, "aid": 456, "hsc": 2, "asc": 1, "opp_id": 456, "is_home": True, "gp": 2, "gc": 1},
            {"hid": 456, "aid": 114554, "hsc": 0, "asc": 5, "opp_id": 456, "is_home": False, "gp": 5, "gc": 0},
            {"hid": 114554, "aid": 110069, "hsc": 2, "asc": 0, "opp_id": 110069, "is_home": True, "gp": 2, "gc": 0}
        ]
        teams_map = {456: "Racing de Santander", 110069: "CD Mirandés", 114554: "FC Andorra"}

        matches, updated_ledger, changed, conflitos = resolve_matches_with_ledger(
            ratings_dates=ratings_dates,
            mham_parsed_records=mham_records,
            teams_map=teams_map,
            full_ledger=base_ledger
        )

        self.assertEqual(len(matches), 11)
        # Ambas as chaves coexistem sem colisão!
        self.assertIn("114554_20250927_456", updated_ledger)
        self.assertIn("114554_20251011_456", updated_ledger)

        # 1º confronto inalterado (Racing 0 x 5 Andorra)
        self.assertEqual(updated_ledger["114554_20250927_456"]["placar"], "0 x 5")
        self.assertEqual(updated_ledger["114554_20250927_456"]["mando"], "Fora")

        # 2º confronto registrado com sucesso (Andorra 2 x 1 Racing)
        self.assertEqual(updated_ledger["114554_20251011_456"]["placar"], "2 x 1")
        self.assertEqual(updated_ledger["114554_20251011_456"]["mando"], "Casa")

        # Na lista de partidas
        m10 = matches[9]
        m11 = matches[10]
        self.assertEqual(m10["placar"], "0 x 5")
        self.assertEqual(m11["placar"], "2 x 1")

    def test_33_sequence_saves_10_11_12_13_preservation(self):
        """(c) Simula sequência contínua de 4 saves (10, 11, 12 e 13 jogos).
        Comprova que com a rotação contínua do buffer mham da EA (tamanho 3),
        partidas que saíram do buffer (Racing, Levante, etc.) são 100% preservadas
        pelo ledger e nenhum placar é perdido ou substituído por 0-0/Adversário."""
        from src.save_parser import load_match_ledger, resolve_matches_with_ledger

        current_ledger = {k: copy.deepcopy(v) for k, v in load_match_ledger().items() if v.get("date_int", 0) <= 20250927}
        teams_map = {
            634: "Fortuna Sittard", 77: "Aberdeen", 718: "Estrela da Amadora",
            472: "UD Las Palmas", 244: "Real Zaragoza", 111005: "Burgos CF",
            110069: "CD Mirandés", 1867: "Córdoba CF", 467: "SD Eibar",
            456: "Racing de Santander", 1880: "Levante UD", 110839: "SD Huesca",
            459: "Sporting Gijón", 114554: "FC Andorra"
        }

        # Save 11 (04/10/2025 vs Levante 3-1): mham = [Levante, Racing, Mirandés]
        dates_11 = [20250718, 20250722, 20250726, 20250817, 20250823, 20250831,
                    20250907, 20250913, 20250921, 20250927, 20251004]
        mham_11 = [
            {"hid": 114554, "aid": 1880, "hsc": 3, "asc": 1, "opp_id": 1880, "is_home": True, "gp": 3, "gc": 1},
            {"hid": 456, "aid": 114554, "hsc": 0, "asc": 5, "opp_id": 456, "is_home": False, "gp": 5, "gc": 0},
            {"hid": 114554, "aid": 110069, "hsc": 2, "asc": 0, "opp_id": 110069, "is_home": True, "gp": 2, "gc": 0}
        ]
        m11_list, current_ledger, _, _ = resolve_matches_with_ledger(
            dates_11, mham_11, teams_map, full_ledger=current_ledger
        )
        self.assertEqual(len(m11_list), 11)
        self.assertIn("114554_20251004_1880", current_ledger)

        # Save 12 (11/10/2025 vs Huesca 1-0): mham = [Huesca, Levante, Racing] -> Mirandés sai do buffer
        dates_12 = dates_11 + [20251011]
        mham_12 = [
            {"hid": 110839, "aid": 114554, "hsc": 0, "asc": 1, "opp_id": 110839, "is_home": False, "gp": 1, "gc": 0},
            {"hid": 114554, "aid": 1880, "hsc": 3, "asc": 1, "opp_id": 1880, "is_home": True, "gp": 3, "gc": 1},
            {"hid": 456, "aid": 114554, "hsc": 0, "asc": 5, "opp_id": 456, "is_home": False, "gp": 5, "gc": 0}
        ]
        m12_list, current_ledger, _, _ = resolve_matches_with_ledger(
            dates_12, mham_12, teams_map, full_ledger=current_ledger
        )
        self.assertEqual(len(m12_list), 12)
        self.assertIn("114554_20251011_110839", current_ledger)
        # Mirandés (07/09) saiu do buffer mham, mas foi preservado perfeitamente!
        m_mir = next(m for m in m12_list if m["date_int"] == 20250907)
        self.assertEqual(m_mir["adversario"], "CD Mirandés")
        self.assertEqual(m_mir["placar"], "2 x 0")
        self.assertEqual(m_mir["placar_origem"], "histórico anterior")

        # Save 13 (18/10/2025 vs Sporting 2-0): mham = [Sporting, Huesca, Levante] -> Racing sai do buffer
        dates_13 = dates_12 + [20251018]
        mham_13 = [
            {"hid": 114554, "aid": 459, "hsc": 2, "asc": 0, "opp_id": 459, "is_home": True, "gp": 2, "gc": 0},
            {"hid": 110839, "aid": 114554, "hsc": 0, "asc": 1, "opp_id": 110839, "is_home": False, "gp": 1, "gc": 0},
            {"hid": 114554, "aid": 1880, "hsc": 3, "asc": 1, "opp_id": 1880, "is_home": True, "gp": 3, "gc": 1}
        ]
        m13_list, current_ledger, _, _ = resolve_matches_with_ledger(
            dates_13, mham_13, teams_map, full_ledger=current_ledger
        )
        self.assertEqual(len(m13_list), 13)
        self.assertEqual(len(current_ledger), 13)

        # Racing (27/09) saiu do mham, mas placar 0 x 5 está 100% preservado!
        m_rac = next(m for m in m13_list if m["date_int"] == 20250927)
        self.assertEqual(m_rac["adversario"], "Racing de Santander")
        self.assertEqual(m_rac["placar"], "0 x 5")
        self.assertEqual(m_rac["placar_origem"], "histórico anterior")

        # NENHUM 'Adversário', NENHUM '0 x 0' em nenhuma das 13 partidas
        self.assertFalse(any(m["adversario"] == "Adversário" for m in m13_list))
        self.assertFalse(any(m["placar"] == "0 x 0" for m in m13_list))

    def test_34_unavailable_match_without_mham_or_ledger(self):
        """(d) Jogo sem registro no mham nem no ledger deve aparecer explicitamente
        como 'indisponível', sem criar placar fictício 0-0 e sem 'Adversário'."""
        from src.save_parser import resolve_matches_with_ledger

        empty_ledger = {}
        empty_mham = []
        dates = [20251025]
        teams_map = {114554: "FC Andorra"}

        matches, _, _, _ = resolve_matches_with_ledger(
            ratings_dates=dates,
            mham_parsed_records=empty_mham,
            teams_map=teams_map,
            full_ledger=empty_ledger
        )

        self.assertEqual(len(matches), 1)
        m = matches[0]
        self.assertEqual(m["placar_origem"], "indisponível")
        self.assertEqual(m["placar"], "Indisponível")
        self.assertIsNone(m["placar_mandante"])
        self.assertIsNone(m["placar_visitante"])
        self.assertEqual(m["adversario"], "Dados indisponíveis")
        self.assertEqual(m["resultado"], "Indisponível")
        self.assertNotEqual(m["adversario"], "Adversário")
        self.assertNotEqual(m["placar"], "0 x 0")
        self.assertNotEqual(m["placar"], "0-0")

    def test_35_ambiguous_tie_never_chosen_and_reported(self):
        """Item 2: Empate de pontuação entre candidatos: nunca escolher.
        Dois candidatos com mesma assinatura (ambos 2-0 Casa com clean sheet) devem ser
        rejeitados por ambiguidade, marcados como indisponível e reportados em conflitos_ledger."""
        from src.save_parser import resolve_matches_with_ledger

        dates = [20251025]
        mham_records = [
            {"hid": 114554, "aid": 1880, "hsc": 2, "asc": 0, "opp_id": 1880, "is_home": True, "gp": 2, "gc": 0},
            {"hid": 114554, "aid": 459, "hsc": 2, "asc": 0, "opp_id": 459, "is_home": True, "gp": 2, "gc": 0}
        ]
        teams_map = {1880: "Levante UD", 459: "Sporting Gijón", 114554: "FC Andorra"}
        known_goals = {20251025: 2}

        matches, updated_ledger, changed, conflitos = resolve_matches_with_ledger(
            ratings_dates=dates,
            mham_parsed_records=mham_records,
            teams_map=teams_map,
            known_match_goals=known_goals,
            full_ledger={}
        )

        self.assertEqual(len(matches), 1)
        m = matches[0]
        self.assertEqual(m["placar_origem"], "ambíguo")
        self.assertEqual(m["placar"], "Indisponível")
        self.assertIsNone(m["placar_mandante"])
        self.assertIsNone(m["placar_visitante"])
        self.assertTrue(any(c.get("tipo") == "ambiguidade" for c in conflitos))
        self.assertEqual(len(updated_ledger), 0)

    def test_36_unverified_ledger_entry_never_self_reinforces(self):
        """Item 3: O bônus de 'placar consolidado prévio' só vale para entradas do ledger
        com placar_origem = 'save'. Entradas do ledger nunca podem reforçar a si mesmas.
        Prova que entrada com placar_origem = 'histórico anterior' NÃO concede bônus de 50 pts."""
        from src.save_parser import resolve_matches_with_ledger

        test_ledger = {
            "114554_20251004_1880": {
                "date_int": 20251004,
                "data": "04/10/2025",
                "club_id": 114554,
                "opp_id": 1880,
                "opp_name": "Levante UD",
                "mando": "Casa",
                "mandante": "FC Andorra",
                "visitante": "Levante UD",
                "placar_mandante": 1,
                "placar_visitante": 0,
                "placar": "1 x 0",
                "placar_origem": "histórico anterior"
            }
        }

        # No save, placar real foi 3 x 1
        mham_records = [
            {"hid": 114554, "aid": 1880, "hsc": 3, "asc": 1, "opp_id": 1880, "is_home": True, "gp": 3, "gc": 1}
        ]
        teams_map = {1880: "Levante UD", 114554: "FC Andorra"}
        known_goals = {20251004: 3}

        matches, updated_ledger, changed, conflitos = resolve_matches_with_ledger(
            ratings_dates=[20251004],
            mham_parsed_records=mham_records,
            teams_map=teams_map,
            known_match_goals=known_goals,
            full_ledger=test_ledger
        )

        self.assertEqual(len(matches), 1)
        m = matches[0]
        self.assertEqual(m["placar"], "3 x 1")
        self.assertEqual(m["placar_origem"], "save")
        self.assertEqual(updated_ledger["114554_20251004_1880"]["placar"], "3 x 1")
        self.assertEqual(updated_ledger["114554_20251004_1880"]["placar_origem"], "save")
        self.assertTrue(len(conflitos) > 0)

    def test_37_empty_ledger_resolves_recent_mham_and_marks_evicted_unavailable(self):
        """Item 1: Executa o parser do save real de 10 jogos com match_ledger.json VAZIO ({}).
        Comprova que:
          - 07/09 Mirandés 2-0 (Casa, save)
          - 13/09 Córdoba 2-2 (Casa, save)
          - 27/09 Racing 0-5 (visitante, save)
          são resolvidos exclusivamente por gols marcados, goleiro (clean sheet/gols sofridos) e mando.
          - 21/09 (Eibar) é marcado como 'indisponível' (pois saiu do buffer rotativo mham).
          - Jogos 1 a 6 (18/07 a 31/08) são marcados como 'indisponível' (fora da capacidade do mham)."""
        import tempfile
        from src.save_parser import parse_save_file

        save10_path = r"C:\Users\Daniel\Downloads\save\saves\CmMgrC20261029172849669"
        if not os.path.exists(save10_path):
            self.skipTest(f"Save de 10 jogos não encontrado em {save10_path}")

        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tf:
            tf.write("{}")
            tmp_empty_ledger = tf.name

        try:
            res = parse_save_file(save10_path, ledger_path=tmp_empty_ledger)
            matches = res["matches"]
            self.assertEqual(len(matches), 10)

            # Mapeamento por date_int
            m_by_date = {m["date_int"]: m for m in matches}

            # 1. Jogos 1 a 6 (18/07 a 31/08): Fora da janela física do mham -> indisponíveis
            for d in [20250718, 20250722, 20250726, 20250817, 20250823, 20250831]:
                m = m_by_date[d]
                self.assertEqual(m["placar_origem"], "indisponível", f"Data {d} deveria ser indisponível sem ledger")
                self.assertEqual(m["placar"], "Indisponível")
                self.assertEqual(m["adversario"], "Dados indisponíveis")

            # 2. Match 7 (07/09/2025 vs CD Mirandés): GP=2, Clean Sheet Owono (8.0), Mando Casa -> 2 x 0
            m_mirandes = m_by_date[20250907]
            self.assertEqual(m_mirandes["placar_origem"], "save")
            self.assertEqual(m_mirandes["adversario"], "CD Mirandés")
            self.assertEqual(m_mirandes["placar"], "2 x 0")
            self.assertEqual(m_mirandes["mando"], "Casa")

            # 3. Match 8 (13/09/2025 vs Córdoba CF): GP=2, Yaakobishvili GC=2 (6.0), Mando Casa -> 2 x 2
            m_cordoba = m_by_date[20250913]
            self.assertEqual(m_cordoba["placar_origem"], "save")
            self.assertEqual(m_cordoba["adversario"], "Córdoba CF")
            self.assertEqual(m_cordoba["placar"], "2 x 2")
            self.assertEqual(m_cordoba["mando"], "Casa")

            # 4. Match 9 (21/09/2025 vs SD Eibar): Rotacionou fora do buffer mham -> Indisponível
            m_eibar = m_by_date[20250921]
            self.assertEqual(m_eibar["placar_origem"], "indisponível")
            self.assertEqual(m_eibar["placar"], "Indisponível")
            self.assertEqual(m_eibar["adversario"], "Dados indisponíveis")

            # 5. Match 10 (27/09/2025 vs Racing de Santander): GP=5, Clean Sheet Yaakobishvili (8.0), Fora -> 0 x 5
            m_racing = m_by_date[20250927]
            self.assertEqual(m_racing["placar_origem"], "save")
            self.assertEqual(m_racing["adversario"], "Racing de Santander")
            self.assertEqual(m_racing["placar"], "0 x 5")
            self.assertEqual(m_racing["mando"], "Fora")
            self.assertEqual(m_racing["mandante"], "Racing de Santander")
            self.assertEqual(m_racing["visitante"], "FC Andorra")

        finally:
            if os.path.exists(tmp_empty_ledger):
                os.remove(tmp_empty_ledger)

    def test_38_mham_record_used_once_cannot_be_reused_by_new_match(self):
        """Item 2: Garante que cada registro do buffer mham só pode ser atribuído a UMA data.
        Cenário: 11º jogo em 04/10/2025 onde o mham traz [novo (Levante), Racing, Mirandés].
        Racing e Mirandés já estão no ledger com datas 27/09 e 07/09.
        Comprova que:
          - Racing e Mirandés são ancorados exclusivamente às suas respectivas datas originais.
          - O 11º jogo casa exclusivamente com o registro novo (Levante) e NUNCA reaproveita
            Racing ou Mirandés para a nova data.
          - Se o registro novo não existisse no mham, a data 04/10 ficaria como 'indisponível',
            provando a impossibilidade física de reutilização."""
        from src.save_parser import resolve_matches_with_ledger

        # Ledger existente contendo 07/09 (Mirandés) e 27/09 (Racing)
        test_ledger = {
            "114554_20250907_110069": {
                "date_int": 20250907,
                "data": "07/09/2025",
                "club_id": 114554,
                "opp_id": 110069,
                "opp_name": "CD Mirandés",
                "mando": "Casa",
                "mandante": "FC Andorra",
                "visitante": "CD Mirandés",
                "placar_mandante": 2,
                "placar_visitante": 0,
                "placar": "2 x 0",
                "placar_origem": "save"
            },
            "114554_20250927_456": {
                "date_int": 20250927,
                "data": "27/09/2025",
                "club_id": 114554,
                "opp_id": 456,
                "opp_name": "Racing de Santander",
                "mando": "Fora",
                "mandante": "Racing de Santander",
                "visitante": "FC Andorra",
                "placar_mandante": 0,
                "placar_visitante": 5,
                "placar": "0 x 5",
                "placar_origem": "save"
            }
        }

        # Buffer mham do 11º jogo contendo [Novo (Levante), Racing, Mirandés]
        # Nota: Mirandés tem GP=2 e Clean Sheet (2-0). Suponha que o jogo 11 também tivesse 2 gols.
        mham_records = [
            {"hid": 114554, "aid": 1880, "hsc": 2, "asc": 1, "opp_id": 1880, "is_home": True, "gp": 2, "gc": 1},
            {"hid": 456, "aid": 114554, "hsc": 0, "asc": 5, "opp_id": 456, "is_home": False, "gp": 5, "gc": 0},
            {"hid": 114554, "aid": 110069, "hsc": 2, "asc": 0, "opp_id": 110069, "is_home": True, "gp": 2, "gc": 0}
        ]
        teams_map = {1880: "Levante UD", 456: "Racing de Santander", 110069: "CD Mirandés", 114554: "FC Andorra"}
        known_goals = {20250907: 2, 20250927: 5, 20251004: 2}

        ratings_dates = [20250907, 20250927, 20251004]

        matches, updated_ledger, changed, conflitos = resolve_matches_with_ledger(
            ratings_dates=ratings_dates,
            mham_parsed_records=mham_records,
            teams_map=teams_map,
            known_match_goals=known_goals,
            full_ledger=copy.deepcopy(test_ledger)
        )

        m_by_d = {m["date_int"]: m for m in matches}

        # 07/09 consumiu o registro de Mirandés (índice 2)
        self.assertEqual(m_by_d[20250907]["adversario"], "CD Mirandés")
        self.assertEqual(m_by_d[20250907]["placar"], "2 x 0")

        # 27/09 consumiu o registro de Racing (índice 1)
        self.assertEqual(m_by_d[20250927]["adversario"], "Racing de Santander")
        self.assertEqual(m_by_d[20250927]["placar"], "0 x 5")

        # 04/10 consumiu EXCLUSIVAMENTE o registro do Levante (índice 0)
        self.assertEqual(m_by_d[20251004]["adversario"], "Levante UD")
        self.assertEqual(m_by_d[20251004]["placar"], "2 x 1")
        self.assertEqual(m_by_d[20251004]["placar_origem"], "save")

        # Prova de não-reaproveitamento: se mham não trouxesse Levante (só Racing e Mirandés repetidos)
        mham_sem_novo = [
            {"hid": 456, "aid": 114554, "hsc": 0, "asc": 5, "opp_id": 456, "is_home": False, "gp": 5, "gc": 0},
            {"hid": 114554, "aid": 110069, "hsc": 2, "asc": 0, "opp_id": 110069, "is_home": True, "gp": 2, "gc": 0}
        ]
        matches2, _, _, _ = resolve_matches_with_ledger(
            ratings_dates=ratings_dates,
            mham_parsed_records=mham_sem_novo,
            teams_map=teams_map,
            known_match_goals=known_goals,
            full_ledger=copy.deepcopy(test_ledger)
        )
        m2_by_d = {m["date_int"]: m for m in matches2}
        # Racing e Mirandés não podem ser reutilizados para 04/10, logo 04/10 fica indisponível
        self.assertEqual(m2_by_d[20251004]["placar_origem"], "indisponível")
        self.assertEqual(m2_by_d[20251004]["placar"], "Indisponível")


if __name__ == "__main__":
    unittest.main(verbosity=2)
