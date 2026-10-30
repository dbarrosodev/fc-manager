#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Testes para Completar Placar, Reconciliação de Gols e Sincronização Local vs. Web.
"""
import os
import sys
import json
import unittest
import subprocess

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src import save_parser


class TestMatchCompletionAndSync(unittest.TestCase):

    def test_01_lineup_goals_calculation_when_score_is_null_in_domain(self):
        """Verifica que domain.js calcula gols do clube a partir da escalação quando gols_pro é nulo/0."""
        cmd = [
            "node", "-e",
            """
            const d = require('./assets/js/domain.js');
            const matchRaw = {
              id: 11,
              date_int: 20251004,
              data: '04/10/2025',
              competicao: 'LaLiga Hypermotion',
              tipo_competicao: 'Liga Nacional',
              mando: 'Casa',
              mandante: 'FC Andorra',
              visitante: 'CD Leganés',
              placar: '-',
              placar_mandante: null,
              placar_visitante: null,
              gols_pro: null,
              gols_contra: null,
              escalacao: [
                { playerid: 1, nome: 'Marc Cardona', posicao: 'CA', minutos: 90, gols: 1, nota: 7.8 },
                { playerid: 2, nome: 'Lautaro de León', posicao: 'ATA', minutos: 25, gols: 0, nota: 6.5 }
              ]
            };
            const norm = d.normalizeMatch(matchRaw, 'FC Andorra');
            console.log(JSON.stringify({ gols_pro: norm.gols_pro, placar: norm.placar }));
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(res.returncode, 0, f"Erro no node: {res.stderr}")
        data = json.loads(res.stdout)
        self.assertEqual(data["gols_pro"], 1, "Gols pró deve ter sido calculado como 1 a partir dos logs de Marc Cardona")

    def test_02_squad_and_matches_goals_parity_with_unresolved_match(self):
        """Garante que normalizeCareerData soma os gols calculados da escalação eliminando divergências."""
        cmd = [
            "node", "-e",
            """
            const d = require('./assets/js/domain.js');
            const raw = {
              club: { nome: 'FC Andorra', liga: 'LaLiga Hypermotion' },
              squad: [
                { playerid: 1, nome: 'Marc Cardona', gols: 5, assistencias: 2, minutos: 900, status_elenco: 'Titular' }
              ],
              matches: [
                {
                  id: 1,
                  date_int: 20251004,
                  tipo_competicao: 'Liga Nacional',
                  competicao: 'LaLiga Hypermotion',
                  mando: 'Casa',
                  placar: '-',
                  escalacao: [{ playerid: 1, nome: 'Marc Cardona', gols: 5, minutos: 90 }]
                }
              ]
            };
            const norm = d.normalizeCareerData(raw);
            console.log(JSON.stringify({
              squadGoals: norm.squad[0].gols,
              ligaGoals: norm.club.competicoes_separadas.liga.gols_pro,
              totalGoals: norm.club.competicoes_separadas.total_temporada.gols_pro
            }));
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(res.returncode, 0, f"Erro no node: {res.stderr}")
        data = json.loads(res.stdout)
        self.assertEqual(data["squadGoals"], 5)
        self.assertEqual(data["ligaGoals"], 5)
        self.assertEqual(data["totalGoals"], 5)

    def test_03_match_ledger_key_structure_and_persistence(self):
        """Verifica a estrutura da chave tripla {club_id}_{date_int}_{opp_id} e integridade do ledger."""
        ledger = save_parser.load_match_ledger()
        self.assertIsInstance(ledger, dict)
        for key, entry in ledger.items():
            parts = key.split("_")
            self.assertEqual(len(parts), 3, f"Chave do ledger deve ser tripla: {key}")
            self.assertEqual(int(parts[0]), entry.get("club_id", 114554))
            self.assertEqual(int(parts[1]), entry.get("date_int"))
            self.assertEqual(int(parts[2]), entry.get("opp_id"))
            self.assertIn("placar", entry)
            self.assertIn("mando", entry)

    def test_04_pipeline_updates_public_data_files(self):
        """Comprova que run_full_pipeline gera simultaneamente career_data.json e career_data.js."""
        data = save_parser.run_full_pipeline()
        self.assertIn("matches", data)
        self.assertIn("squad", data)

        json_path = os.path.join(PROJECT_ROOT, "assets", "data", "career_data.json")
        js_path = os.path.join(PROJECT_ROOT, "assets", "data", "career_data.js")

        self.assertTrue(os.path.exists(json_path))
        self.assertTrue(os.path.exists(js_path))

        with open(json_path, "r", encoding="utf-8") as f:
            public_json = json.load(f)
        self.assertEqual(len(public_json["matches"]), len(data["matches"]))

        with open(js_path, "r", encoding="utf-8") as f:
            js_content = f.read()
        self.assertTrue(js_content.startswith("window.FALLBACK_CAREER_DATA = {"))


if __name__ == "__main__":
    unittest.main()
