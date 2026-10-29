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


if __name__ == "__main__":
    unittest.main(verbosity=2)
