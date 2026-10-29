#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FC MANAGER — TESTES DE REFATORAÇÃO DE UI & SPORTS ANALYTICS

Cenários validados:
  37. Ausência total de jargões de auto-auditoria e AI slop na interface.
  38. Remoção de subtítulos descritivos redundantes sob os títulos das seções.
  39. Remoção da 5ª aba ("Auditoria & Sistema") e seus blocos do DOM.
  40. Desacoplamento dos dados fixos do clube no index.html.
  41. Seletor de saves compacto integrado no header do app.
  42. Renderização interativa da Prancheta Tática do XI Titular com 11 atletas e métricas reais.
  43. Validação silenciosa de integridade de dados (health check discreto).

Uso:
  python -m unittest tests/test_ui_sports_analytics_refactor.py -v
"""

import json
import os
import re
import subprocess
import unittest

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(TESTS_DIR, ".."))


class TestUISportsAnalyticsRefactor(unittest.TestCase):

    def setUp(self):
        self.index_path = os.path.join(PROJECT_ROOT, "index.html")
        self.main_js_path = os.path.join(PROJECT_ROOT, "assets", "js", "main.js")
        self.css_path = os.path.join(PROJECT_ROOT, "assets", "css", "styles.css")
        self.career_data_path = os.path.join(PROJECT_ROOT, "assets", "data", "career_data.json")

        with open(self.index_path, "r", encoding="utf-8") as f:
            self.index_html = f.read()

        with open(self.main_js_path, "r", encoding="utf-8") as f:
            self.main_js = f.read()

    # -------------------------------------------------------------------------
    # CENÁRIO 37: Expurgar Vocabulário de Auto-Auditoria / AI Slop
    # -------------------------------------------------------------------------
    def test_37_ui_free_of_ai_audit_slop(self):
        """Verifica que termos de auto-auditoria/AI não aparecem na UI (HTML e JS)."""
        forbidden_terms = [
            "fonte primária da verdade",
            "normalização canônica",
            "gols e assistências auditados",
            "validados contra registros primários",
            "sem falsos positivos",
            "v3.2 (auditado)",
            "confiança da amostra",
            "logs primários",
            "checklist técnico de auditoria",
            "arquivos e estrutura técnica"
        ]

        # Em index.html
        for term in forbidden_terms:
            self.assertNotIn(
                term,
                self.index_html.lower(),
                f"Termo proibido de auditoria '{term}' encontrado em index.html"
            )

        # Em main.js (exceto chaves de dados internas de domain.js como confianca_amostra_canonica)
        js_forbidden = [
            "fonte primária da verdade",
            "gols e assistências auditados",
            "sem falsos positivos",
            "v3.2 (auditado)",
            "histórico de atuações do jogador (fonte primária)"
        ]
        for term in js_forbidden:
            self.assertNotIn(
                term,
                self.main_js.lower(),
                f"Termo proibido de auditoria '{term}' encontrado em main.js"
            )

    # -------------------------------------------------------------------------
    # CENÁRIO 38: Subtítulos Redundantes Removidos
    # -------------------------------------------------------------------------
    def test_38_no_redundant_card_subtitles_under_headers(self):
        """Verifica que os parágrafos explicativos de metodologia sob os h2 foram removidos."""
        self.assertNotIn("card-subtitle", self.index_html, "Classes card-subtitle ainda presentes em index.html")
        self.assertNotIn("Estatísticas calculadas a partir da fonte primária", self.index_html)
        self.assertNotIn("Análise esportiva rápida: destaques estatísticos", self.index_html)

    # -------------------------------------------------------------------------
    # CENÁRIO 39: Aba de Auditoria Removida do DOM Principal
    # -------------------------------------------------------------------------
    def test_39_career_audit_tab_removed_from_ui(self):
        """Verifica que a aba 5 (Carreira & Auditoria) foi removida da interface."""
        self.assertNotIn('data-tab="career"', self.index_html, "Botão da aba 'career' ainda presente na navegação")
        self.assertNotIn('id="tab-career"', self.index_html, "Seção tab-career ainda presente no DOM")
        self.assertNotIn('id="audit-table-body"', self.index_html, "Tabela de auditoria ainda presente no DOM")
        self.assertNotIn('audit-stats-grid', self.index_html, "Grid de estatísticas de auditoria ainda presente no DOM")

    # -------------------------------------------------------------------------
    # CENÁRIO 40: Desacoplamento dos Dados Fixos do Clube
    # -------------------------------------------------------------------------
    def test_40_club_header_and_data_decoupled(self):
        """Verifica que dados do FC Andorra não estão hardcoded no corpo do HTML."""
        # O HTML não deve ter FCA estático como escudo nem nomes fixos nos headers
        self.assertNotIn('id="club-crest">FCA<', self.index_html, "Escudo estático 'FCA' hardcoded no HTML")
        self.assertNotIn('id="coach-name">Carles Manso', self.index_html, "Treinador estático hardcoded no HTML")
        self.assertNotIn('id="club-name">FC Andorra<', self.index_html, "Nome do clube estático hardcoded no HTML")

        # Em main.js, verifica cálculo de iniciais do escudo dinâmico
        self.assertIn("getInitials", self.main_js, "Função getInitials ausente em main.js para geração de escudo")
        self.assertIn("setText(\"club-crest\", getInitials(club.nome))", self.main_js)

    # -------------------------------------------------------------------------
    # CENÁRIO 41: Seletor de Saves Compacto no Header
    # -------------------------------------------------------------------------
    def test_41_compact_save_selector_in_header(self):
        """Verifica a presença do seletor compacto de saves no cabeçalho."""
        self.assertIn('id="save-selector-wrap"', self.index_html, "Container do seletor compacto ausente no topbar")
        self.assertIn('id="select-save-file"', self.index_html, "Elemento select de saves ausente")
        self.assertIn('id="btn-apply-save"', self.index_html, "Botão Carregar Save ausente")

    # -------------------------------------------------------------------------
    # CENÁRIO 42: Renderização da Prancheta Tática do XI Titular
    # -------------------------------------------------------------------------
    def test_42_tactical_pitch_board_rendered(self):
        """Executa renderização real e verifica se a prancheta posiciona 11 titulares."""
        self.assertIn('id="tactical-board-section"', self.index_html, "Prancheta tática ausente em index.html")
        self.assertIn('id="tactical-pitch"', self.index_html, "Container do campo ausente em index.html")
        self.assertIn('id="tactical-formation"', self.index_html, "Indicador de formação ausente em index.html")

        # Executa simulação DOM via Node.js
        cmd = [
            "node", "-e",
            """
            const fs = require('fs');
            const vm = require('vm');
            const data = JSON.parse(fs.readFileSync('assets/data/career_data.json', 'utf-8'));

            function makeElement(id) {
              return {
                id,
                textContent: '',
                innerHTML: '',
                children: [],
                style: {},
                classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
                appendChild(c) { this.children.push(c); return c; },
                addEventListener() {},
                querySelector() { return makeElement(null); },
                querySelectorAll() { return []; }
              };
            }

            const elements = new Map();
            const listeners = {};
            const doc = {
              getElementById: id => {
                if (!elements.has(id)) elements.set(id, makeElement(id));
                return elements.get(id);
              },
              createElement: tag => makeElement(tag),
              querySelectorAll: () => [],
              addEventListener: (e, fn) => { (listeners[e] = listeners[e] || []).push(fn); }
            };

            const sandbox = {
              console,
              document: doc,
              window: {},
              FALLBACK_CAREER_DATA: data,
              setTimeout,
              clearTimeout,
              fetch: () => Promise.reject(new Error('offline'))
            };
            sandbox.window = sandbox;
            sandbox.self = sandbox;
            vm.createContext(sandbox);

            vm.runInContext(fs.readFileSync('assets/js/domain.js', 'utf-8'), sandbox);
            vm.runInContext(fs.readFileSync('assets/js/main.js', 'utf-8'), sandbox);

            (async () => {
              for (const fn of listeners.DOMContentLoaded || []) await fn();
              await new Promise(r => setTimeout(r, 40));

              const pitch = doc.getElementById('tactical-pitch');
              const formation = doc.getElementById('tactical-formation');
              const avgOvr = doc.getElementById('tactical-avg-ovr');
              const avgAge = doc.getElementById('tactical-avg-age');

              const tokens = (pitch.innerHTML.match(/pitch-player-token/g) || []).length;
              const result = {
                tokens,
                formation: formation.textContent,
                avgOvr: avgOvr.textContent,
                avgAge: avgAge.textContent
              };
              process.stdout.write(JSON.stringify(result));
            })();
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(res.returncode, 0, f"Falha na simulação da prancheta tática: {res.stderr}")

        info = json.loads(res.stdout)
        self.assertEqual(info["tokens"], 11, "A prancheta tática deve renderizar exatamente 11 titulares")
        self.assertEqual(info["formation"], "4-3-3", "A formação calculada dos titulares deve ser 4-3-3")
        self.assertTrue(float(info["avgOvr"]) > 60, "Média de OVR deve ser válida")

    # -------------------------------------------------------------------------
    # CENÁRIO 43: Validação Silenciosa de Integridade
    # -------------------------------------------------------------------------
    def test_43_silent_validation_health_status(self):
        """Verifica que a validação silenciosa define 'Status: Dados Sincronizados' sem poluir a interface."""
        self.assertIn("validateDataIntegritySilently", self.main_js)

        cmd = [
            "node", "-e",
            """
            const fs = require('fs');
            const vm = require('vm');
            const data = JSON.parse(fs.readFileSync('assets/data/career_data.json', 'utf-8'));

            function makeElement(id) {
              return {
                id,
                textContent: '',
                innerHTML: '',
                children: [],
                style: {},
                classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
                appendChild(c) { this.children.push(c); return c; },
                addEventListener() {},
                querySelector() { return makeElement(null); },
                querySelectorAll() { return []; }
              };
            }

            const elements = new Map();
            const listeners = {};
            const doc = {
              getElementById: id => {
                if (!elements.has(id)) elements.set(id, makeElement(id));
                return elements.get(id);
              },
              createElement: tag => makeElement(tag),
              querySelectorAll: () => [],
              addEventListener: (e, fn) => { (listeners[e] = listeners[e] || []).push(fn); }
            };

            const sandbox = {
              console,
              document: doc,
              window: {},
              FALLBACK_CAREER_DATA: data,
              setTimeout,
              clearTimeout,
              fetch: () => Promise.reject(new Error('offline'))
            };
            sandbox.window = sandbox;
            sandbox.self = sandbox;
            vm.createContext(sandbox);

            vm.runInContext(fs.readFileSync('assets/js/domain.js', 'utf-8'), sandbox);
            vm.runInContext(fs.readFileSync('assets/js/main.js', 'utf-8'), sandbox);

            (async () => {
              for (const fn of listeners.DOMContentLoaded || []) await fn();
              await new Promise(r => setTimeout(r, 40));

              const badge = doc.getElementById('data-source-badge');
              const footer = doc.getElementById('footer-sync-status');
              process.stdout.write(JSON.stringify({
                badgeText: badge.textContent,
                footerText: footer.textContent
              }));
            })();
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(res.returncode, 0, f"Falha na validação silenciosa: {res.stderr}")
        data = json.loads(res.stdout)
        self.assertEqual(data["badgeText"], "Status: Dados Sincronizados")
        self.assertEqual(data["footerText"], "Status: Dados Sincronizados")

    # -------------------------------------------------------------------------
    # CENÁRIO 44: Zero Options Hardcoded de Competição no HTML
    # -------------------------------------------------------------------------
    def test_44_no_hardcoded_competition_options_in_html(self):
        """Verifica que o HTML não possui opções fixas de LaLiga ou Champions nos selects."""
        forbidden_options = [
            '<option value="laliga"',
            '<option value="champions"',
            '<option value="liga"',
            '<option value="copa"'
        ]
        for opt in forbidden_options:
            self.assertNotIn(opt, self.index_html.lower(), f"Option hardcoded '{opt}' encontrado no HTML")

    # -------------------------------------------------------------------------
    # CENÁRIO 45: Filtros de Competição Populados Dinamicamente e Remoção de Selects Fantasmas
    # -------------------------------------------------------------------------
    def test_45_dynamic_competition_filters_populated(self):
        """Executa simulação e confere se os dropdowns de competição foram hidratados via JS e selects fantasmas removidos."""
        self.assertIn("populateCompetitionFilters", self.main_js)
        self.assertNotIn('id="log-comp-filter"', self.index_html, "Select fantasma log-comp-filter ainda presente no HTML")
        self.assertNotIn('id="squad-confidence-filter"', self.index_html, "Select fantasma squad-confidence-filter ainda presente no HTML")

        cmd = [
            "node", "-e",
            """
            const fs = require('fs');
            const vm = require('vm');
            const data = JSON.parse(fs.readFileSync('assets/data/career_data.json', 'utf-8'));

            function makeElement(id) {
              return {
                id,
                textContent: '',
                innerHTML: '',
                children: [],
                style: {},
                classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
                appendChild(c) { this.children.push(c); return c; },
                addEventListener() {},
                querySelector() { return makeElement(null); },
                querySelectorAll() { return []; }
              };
            }

            const elements = new Map();
            const listeners = {};
            const doc = {
              getElementById: id => {
                if (!elements.has(id)) elements.set(id, makeElement(id));
                return elements.get(id);
              },
              createElement: tag => makeElement(tag),
              querySelectorAll: () => [],
              addEventListener: (e, fn) => { (listeners[e] = listeners[e] || []).push(fn); }
            };

            const sandbox = {
              console,
              document: doc,
              window: {},
              FALLBACK_CAREER_DATA: data,
              setTimeout,
              clearTimeout,
              fetch: () => Promise.reject(new Error('offline'))
            };
            sandbox.window = sandbox;
            sandbox.self = sandbox;
            vm.createContext(sandbox);

            vm.runInContext(fs.readFileSync('assets/js/domain.js', 'utf-8'), sandbox);
            vm.runInContext(fs.readFileSync('assets/js/main.js', 'utf-8'), sandbox);

            (async () => {
              for (const fn of listeners.DOMContentLoaded || []) await fn();
              await new Promise(r => setTimeout(r, 40));

              const matchFilter = doc.getElementById('matches-comp-filter');

              process.stdout.write(JSON.stringify({
                matchOptions: matchFilter.innerHTML
              }));
            })();
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(res.returncode, 0, f"Falha ao validar filtros dinâmicos: {res.stderr}")
        out = json.loads(res.stdout)
        self.assertIn("Todas as Competições", out["matchOptions"])
        self.assertIn("LaLiga Hypermotion", out["matchOptions"])

    # -------------------------------------------------------------------------
    # CENÁRIO 46: Exportação Dinâmica (Client-side Blob CSV e Excel)
    # -------------------------------------------------------------------------
    def test_46_dynamic_csv_and_xlsx_export(self):
        """Verifica que o botão CSV expõe gerador via Blob e que Excel tem metadados dinâmicos."""
        self.assertIn("exportSquadToCsvClientSide", self.main_js)
        self.assertIn("setupDynamicExports", self.main_js)
        # O HTML não deve ter arquivo hardcoded em href
        self.assertNotIn('href="exports/Estatisticas_Jogadores_FC_Andorra_Carreira.xlsx"', self.index_html)
        self.assertNotIn('href="exports/Estatisticas_Jogadores_FC_Andorra_Carreira.csv"', self.index_html)

    # -------------------------------------------------------------------------
    # CENÁRIO 47: Coluna Fixa do Atleta (Sticky) em Telas Menores
    # -------------------------------------------------------------------------
    def test_47_mobile_sticky_player_column_css(self):
        """Verifica a presença de position: sticky na coluna do jogador no CSS responsivo."""
        with open(self.css_path, "r", encoding="utf-8") as f:
            css = f.read()

        self.assertIn("position: sticky", css)
        self.assertIn("#squad-table", css)
        self.assertIn("@media (max-width: 768px)", css)

    # -------------------------------------------------------------------------
    # CENÁRIO 48: Hero do Clube & Form Guide + 4 KPI Cards
    # -------------------------------------------------------------------------
    def test_48_form_guide_and_4_kpi_cards(self):
        """Verifica se a Forma Recente (pílulas V/E/D) e os 4 KPI Cards foram renderizados com dados reais."""
        self.assertIn('id="club-form-guide"', self.index_html)
        self.assertIn('id="form-guide-pills"', self.index_html)
        self.assertIn('class="kpi-cards-grid"', self.index_html)

        cmd = [
            "node", "-e",
            """
            const fs = require('fs');
            const vm = require('vm');
            const data = JSON.parse(fs.readFileSync('assets/data/career_data.json', 'utf-8'));

            function makeElement(id) {
              return {
                id,
                textContent: '',
                innerHTML: '',
                children: [],
                style: {},
                classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
                appendChild(c) { this.children.push(c); return c; },
                addEventListener() {},
                setAttribute() {},
                getAttribute() { return null; },
                querySelector() { return makeElement(null); },
                querySelectorAll() { return []; }
              };
            }

            const elements = new Map();
            const listeners = {};
            const doc = {
              getElementById: id => {
                if (!elements.has(id)) elements.set(id, makeElement(id));
                return elements.get(id);
              },
              createElement: tag => makeElement(tag),
              querySelectorAll: () => [],
              addEventListener: (e, fn) => { (listeners[e] = listeners[e] || []).push(fn); }
            };

            const sandbox = {
              console,
              document: doc,
              window: {},
              FALLBACK_CAREER_DATA: data,
              setTimeout,
              clearTimeout,
              fetch: () => Promise.reject(new Error('offline'))
            };
            sandbox.window = sandbox;
            sandbox.self = sandbox;
            vm.createContext(sandbox);

            vm.runInContext(fs.readFileSync('assets/js/domain.js', 'utf-8'), sandbox);
            vm.runInContext(fs.readFileSync('assets/js/main.js', 'utf-8'), sandbox);

            (async () => {
              for (const fn of listeners.DOMContentLoaded || []) await fn();
              await new Promise(r => setTimeout(r, 40));

              const formPills = doc.getElementById('form-guide-pills').innerHTML;
              const leagueRec = doc.getElementById('stat-league-record').textContent;
              const leaguePct = doc.getElementById('stat-league-pct').textContent;
              const totalRec = doc.getElementById('stat-total-record').textContent;
              const totalGoals = doc.getElementById('stat-total-goals').textContent;
              const goalsTotal = doc.getElementById('stat-goals-total').textContent;
              const topScorer = doc.getElementById('stat-top-scorer').textContent;
              const squadVal = doc.getElementById('stat-squad-value').textContent;
              const squadAvg = doc.getElementById('stat-squad-averages').textContent;

              process.stdout.write(JSON.stringify({
                pillsCount: (formPills.match(/form-pill-/g) || []).length,
                hasWin: formPills.includes('form-pill-win'),
                hasDraw: formPills.includes('form-pill-draw'),
                leagueRec,
                leaguePct,
                totalRec,
                totalGoals,
                goalsTotal,
                topScorer,
                squadVal,
                squadAvg
              }));
            })();
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(res.returncode, 0, f"Falha na validação do Form Guide e KPIs: {res.stderr}")
        out = json.loads(res.stdout)
        self.assertEqual(out["pillsCount"], 5, "Form Guide deve conter exatamente 5 pílulas")
        self.assertTrue(out["hasWin"])
        self.assertTrue(out["hasDraw"])
        self.assertIn("2V 1E 0D", out["leagueRec"])
        self.assertIn("77.8%", out["leaguePct"])
        self.assertIn("4V 2E 0D", out["totalRec"])
        self.assertIn("GP", out["totalGoals"])
        self.assertIn("Marc Cardona", out["topScorer"])
        self.assertIn("€", out["squadVal"])
        self.assertIn("OVR", out["squadAvg"])

    # -------------------------------------------------------------------------
    # CENÁRIO 49: Campinho Tático na Visão Geral e Radar com 4 Colunas
    # -------------------------------------------------------------------------
    def test_49_tactical_board_in_overview_tab_and_assists_radar(self):
        """Verifica se a prancheta tática está no Overview e se o radar possui a coluna de assistências."""
        # Tactical board deve estar antes do fechamento de tab-overview
        overview_idx = self.index_html.find('id="tab-overview"')
        squad_idx = self.index_html.find('id="tab-squad"')
        board_idx = self.index_html.find('id="tactical-board-section"')

        self.assertTrue(overview_idx < board_idx < squad_idx, "Prancheta tática deve estar dentro da Aba 1 (Visão Geral)")
        self.assertIn('id="radar-top-assists"', self.index_html, "Coluna de Líderes em Assistências ausente no HTML")

        cmd = [
            "node", "-e",
            """
            const fs = require('fs');
            const vm = require('vm');
            const data = JSON.parse(fs.readFileSync('assets/data/career_data.json', 'utf-8'));

            function makeElement(id) {
              return {
                id,
                textContent: '',
                innerHTML: '',
                children: [],
                style: {},
                classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
                appendChild(c) { this.children.push(c); return c; },
                addEventListener() {},
                setAttribute() {},
                getAttribute() { return null; },
                querySelector() { return makeElement(null); },
                querySelectorAll() { return []; }
              };
            }

            const elements = new Map();
            const listeners = {};
            const doc = {
              getElementById: id => {
                if (!elements.has(id)) elements.set(id, makeElement(id));
                return elements.get(id);
              },
              createElement: tag => makeElement(tag),
              querySelectorAll: () => [],
              addEventListener: (e, fn) => { (listeners[e] = listeners[e] || []).push(fn); }
            };

            const sandbox = {
              console,
              document: doc,
              window: {},
              FALLBACK_CAREER_DATA: data,
              setTimeout,
              clearTimeout,
              fetch: () => Promise.reject(new Error('offline'))
            };
            sandbox.window = sandbox;
            sandbox.self = sandbox;
            vm.createContext(sandbox);

            vm.runInContext(fs.readFileSync('assets/js/domain.js', 'utf-8'), sandbox);
            vm.runInContext(fs.readFileSync('assets/js/main.js', 'utf-8'), sandbox);

            (async () => {
              for (const fn of listeners.DOMContentLoaded || []) await fn();
              await new Promise(r => setTimeout(r, 40));

              const pitchHtml = doc.getElementById('tactical-pitch').innerHTML;
              const assistsHtml = doc.getElementById('radar-top-assists').innerHTML;

              process.stdout.write(JSON.stringify({
                hasRatingBadge: pitchHtml.includes('rating-badge'),
                hasAssistsList: assistsHtml.includes('radar-item'),
                hasAssistsText: assistsHtml.includes('assists')
              }));
            })();
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(res.returncode, 0, f"Falha na validação do Overview: {res.stderr}")
        out = json.loads(res.stdout)
        self.assertTrue(out["hasRatingBadge"], "Nós do campinho devem exibir badge de nota Sofascore")
        self.assertTrue(out["hasAssistsList"])
        self.assertTrue(out["hasAssistsText"])

    # -------------------------------------------------------------------------
    # CENÁRIO 50: Alternador de Visão da Tabela de Elenco (Segmented Control)
    # -------------------------------------------------------------------------
    def test_50_squad_segmented_control_and_views(self):
        """Verifica se o alternador de visão da tabela alterna entre Desempenho e Contratos."""
        self.assertIn('id="btn-view-performance"', self.index_html)
        self.assertIn('id="btn-view-contracts"', self.index_html)
        self.assertIn('id="squad-min-minutes-toggle"', self.index_html)

        cmd = [
            "node", "-e",
            """
            const fs = require('fs');
            const vm = require('vm');
            const data = JSON.parse(fs.readFileSync('assets/data/career_data.json', 'utf-8'));

            function makeElement(id) {
              return {
                id,
                textContent: '',
                innerHTML: '',
                children: [],
                style: {},
                classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
                appendChild(c) { this.children.push(c); return c; },
                addEventListener() {},
                setAttribute() {},
                getAttribute() { return null; },
                querySelector() { return makeElement(null); },
                querySelectorAll() { return []; }
              };
            }

            const elements = new Map();
            const listeners = {};
            const doc = {
              getElementById: id => {
                if (!elements.has(id)) elements.set(id, makeElement(id));
                return elements.get(id);
              },
              createElement: tag => makeElement(tag),
              querySelectorAll: () => [],
              addEventListener: (e, fn) => { (listeners[e] = listeners[e] || []).push(fn); }
            };

            const sandbox = {
              console,
              document: doc,
              window: {},
              FALLBACK_CAREER_DATA: data,
              setTimeout,
              clearTimeout,
              fetch: () => Promise.reject(new Error('offline'))
            };
            sandbox.window = sandbox;
            sandbox.self = sandbox;
            vm.createContext(sandbox);

            vm.runInContext(fs.readFileSync('assets/js/domain.js', 'utf-8'), sandbox);
            vm.runInContext(fs.readFileSync('assets/js/main.js', 'utf-8'), sandbox);

            (async () => {
              for (const fn of listeners.DOMContentLoaded || []) await fn();
              await new Promise(r => setTimeout(r, 40));

              const headPerf = doc.getElementById('squad-table-head').innerHTML;
              const bodyPerf = doc.getElementById('squad-table-body').innerHTML;

              // Alterna para Visão 2: Contratos & Atributos
              sandbox.window.TrackerApp.setSquadViewMode('contracts');
              const headContr = doc.getElementById('squad-table-head').innerHTML;
              const bodyContr = doc.getElementById('squad-table-body').innerHTML;

              process.stdout.write(JSON.stringify({
                hasGa90: headPerf.includes('G+A/90'),
                hasStatusTactical: headPerf.includes('Status Tático'),
                hasRatingBadgeInRow: bodyPerf.includes('rating-badge'),
                hasSecPosBadge: bodyPerf.includes('badge-sec-pos'),
                hasPot: headContr.includes('POT'),
                hasMargem: headContr.includes('Margem'),
                hasContractVal: bodyContr.includes('/sem')
              }));
            })();
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(res.returncode, 0, f"Falha na validação do alternador da tabela: {res.stderr}")
        out = json.loads(res.stdout)
        self.assertTrue(out["hasGa90"])
        self.assertTrue(out["hasStatusTactical"])
        self.assertTrue(out["hasRatingBadgeInRow"])
        self.assertTrue(out["hasSecPosBadge"])
        self.assertTrue(out["hasPot"])
        self.assertTrue(out["hasMargem"])
        self.assertTrue(out["hasContractVal"])

    # -------------------------------------------------------------------------
    # CENÁRIO 51: Man of the Match (Melhor em Campo) e Filtro de Mando
    # -------------------------------------------------------------------------
    def test_51_match_center_motm_and_venue_filter(self):
        """Verifica se os cards exibem o Melhor em Campo e suporte a filtro de mando."""
        self.assertIn('id="matches-venue-filter"', self.index_html)
        self.assertNotIn('id="logs-table-body"', self.index_html, "Tabela redundante de logs não deve poluir a aba Partidas")

        cmd = [
            "node", "-e",
            """
            const fs = require('fs');
            const vm = require('vm');
            const data = JSON.parse(fs.readFileSync('assets/data/career_data.json', 'utf-8'));

            function makeElement(id) {
              return {
                id,
                textContent: '',
                innerHTML: '',
                children: [],
                style: {},
                classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
                appendChild(c) { this.children.push(c); return c; },
                addEventListener() {},
                setAttribute() {},
                getAttribute() { return null; },
                querySelector() { return makeElement(null); },
                querySelectorAll() { return []; }
              };
            }

            const elements = new Map();
            const listeners = {};
            const doc = {
              getElementById: id => {
                if (!elements.has(id)) elements.set(id, makeElement(id));
                return elements.get(id);
              },
              createElement: tag => makeElement(tag),
              querySelectorAll: () => [],
              addEventListener: (e, fn) => { (listeners[e] = listeners[e] || []).push(fn); }
            };

            const sandbox = {
              console,
              document: doc,
              window: {},
              FALLBACK_CAREER_DATA: data,
              setTimeout,
              clearTimeout,
              fetch: () => Promise.reject(new Error('offline'))
            };
            sandbox.window = sandbox;
            sandbox.self = sandbox;
            vm.createContext(sandbox);

            vm.runInContext(fs.readFileSync('assets/js/domain.js', 'utf-8'), sandbox);
            vm.runInContext(fs.readFileSync('assets/js/main.js', 'utf-8'), sandbox);

            (async () => {
              for (const fn of listeners.DOMContentLoaded || []) await fn();
              await new Promise(r => setTimeout(r, 40));

              const gridHtml = doc.getElementById('matches-grid-container').innerHTML;

              process.stdout.write(JSON.stringify({
                hasMotm: gridHtml.includes('match-motm'),
                hasMotmLabel: gridHtml.includes('Melhor em Campo'),
                hasRatingBadge: gridHtml.includes('rating-badge')
              }));
            })();
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(res.returncode, 0, f"Falha na validação do Match Center: {res.stderr}")
        out = json.loads(res.stdout)
        self.assertTrue(out["hasMotm"])
        self.assertTrue(out["hasMotmLabel"])
        self.assertTrue(out["hasRatingBadge"])

    # -------------------------------------------------------------------------
    # CENÁRIO 52: Modais de Partida e Jogador (Drill-down Esportivo)
    # -------------------------------------------------------------------------
    def test_52_modal_lineup_split_and_player_per90(self):
        """Verifica a divisão de Titulares/Reservas no modal de partida e métricas per-90 no jogador."""
        cmd = [
            "node", "-e",
            """
            const fs = require('fs');
            const vm = require('vm');
            const data = JSON.parse(fs.readFileSync('assets/data/career_data.json', 'utf-8'));

            function makeElement(id) {
              return {
                id,
                textContent: '',
                innerHTML: '',
                children: [],
                style: {},
                classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
                appendChild(c) { this.children.push(c); return c; },
                addEventListener() {},
                setAttribute() {},
                getAttribute() { return null; },
                querySelector() { return makeElement(null); },
                querySelectorAll() { return []; },
                focus() {}
              };
            }

            const elements = new Map();
            const listeners = {};
            const doc = {
              getElementById: id => {
                if (!elements.has(id)) elements.set(id, makeElement(id));
                return elements.get(id);
              },
              createElement: tag => makeElement(tag),
              querySelectorAll: () => [],
              addEventListener: (e, fn) => { (listeners[e] = listeners[e] || []).push(fn); }
            };

            const sandbox = {
              console,
              document: doc,
              window: {},
              FALLBACK_CAREER_DATA: data,
              setTimeout,
              clearTimeout,
              fetch: () => Promise.reject(new Error('offline'))
            };
            sandbox.window = sandbox;
            sandbox.self = sandbox;
            vm.createContext(sandbox);

            vm.runInContext(fs.readFileSync('assets/js/domain.js', 'utf-8'), sandbox);
            vm.runInContext(fs.readFileSync('assets/js/main.js', 'utf-8'), sandbox);

            (async () => {
              for (const fn of listeners.DOMContentLoaded || []) await fn();
              await new Promise(r => setTimeout(r, 40));

              // 1. Abrir Modal da Partida 1
              sandbox.window.TrackerApp.openMatchModal(1);
              const matchBody = doc.getElementById('modal-match-body').innerHTML;

              // 2. Abrir Modal do Jogador (Lautaro de León: 260044)
              sandbox.window.TrackerApp.openPlayerModal(260044);
              const playerBody = doc.getElementById('modal-player-body').innerHTML;

              process.stdout.write(JSON.stringify({
                hasStartersSection: matchBody.includes('Titulares'),
                hasSubsSection: matchBody.includes('Reservas Utilizados'),
                hasPer90Grid: playerBody.includes('metrics-per90-grid'),
                hasGols90: playerBody.includes('Gols / 90'),
                hasMatchHistoryTable: playerBody.includes('Histórico de Partidas do Atleta')
              }));
            })();
            """
        ]
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(res.returncode, 0, f"Falha na validação dos modais esportivos: {res.stderr}")
        out = json.loads(res.stdout)
        self.assertTrue(out["hasStartersSection"], "Modal da partida deve listar Titulares")
        self.assertTrue(out["hasSubsSection"], "Modal da partida deve listar Reservas Utilizados")
        self.assertTrue(out["hasPer90Grid"], "Modal do jogador deve conter grid de métricas per-90")
        self.assertTrue(out["hasGols90"])
        self.assertTrue(out["hasMatchHistoryTable"], "Modal do jogador deve conter tabela do histórico de partidas")

    # -------------------------------------------------------------------------
    # CENÁRIO 53: Bento Grid da Aba Visão Geral (Estrutura e CSS)
    # -------------------------------------------------------------------------
    def test_53_overview_bento_grid_layout(self):
        """Verifica se a aba Visão Geral implementa o Bento Grid simétrico com 12 colunas, span 5 e 7."""
        with open(self.css_path, "r", encoding="utf-8") as f:
            css = f.read()

        # 1. Estrutura no HTML
        self.assertIn('class="overview-col-left"', self.index_html, "Coluna esquerda (span 5) ausente no HTML")
        self.assertIn('class="overview-col-right"', self.index_html, "Coluna direita (span 7) ausente no HTML")
        self.assertIn('class="overview-row-bottom"', self.index_html, "Linha inferior (largura total) ausente no HTML")

        # 2. Regras no CSS
        self.assertIn("grid-column: span 5", css, "Regra grid-column: span 5 ausente no CSS")
        self.assertIn("grid-column: span 7", css, "Regra grid-column: span 7 ausente no CSS")
        self.assertIn("grid-column: 1 / -1", css, "Regra grid-column: 1 / -1 ausente no CSS")
        self.assertIn("repeat(4, minmax(0, 1fr))", css, "Grid do radar com 4 colunas simétricas ausente no CSS")

    # -------------------------------------------------------------------------
    # CENÁRIO 54: Campinho Tático em SVG Real e Nós de Jogadores Anti-Colisão
    # -------------------------------------------------------------------------
    def test_54_tactical_pitch_real_svg_and_anti_collision(self):
        """Verifica se as divs vazias foram substituídas por SVG real 680x520 e estilos de nós com anti-colisão."""
        with open(self.css_path, "r", encoding="utf-8") as f:
            css = f.read()

        # 1. Validação do SVG no index.html
        self.assertIn('viewBox="0 0 680 520"', self.index_html, "viewBox 0 0 680 520 ausente no SVG do campo")
        self.assertIn('preserveAspectRatio="xMidYMid meet"', self.index_html)
        self.assertIn('rgba(255,255,255,0.02)', self.index_html, "Listras alternadas sutis ausentes no SVG")
        self.assertIn('Arcos da meia-lua', self.index_html)

        # 2. Ausência das 6 divs vazias que imitavam o campo
        self.assertNotIn('class="pitch-line-half"', self.index_html)
        self.assertNotIn('class="pitch-center-circle"', self.index_html)
        self.assertNotIn('class="pitch-penalty-area-top"', self.index_html)
        self.assertNotIn('class="pitch-penalty-area-bottom"', self.index_html)
        self.assertNotIn('class="pitch-goal-area-bottom"', self.index_html)

        # 3. Regras CSS dos nós dos jogadores (.pitch-player) e anti-colisão
        self.assertIn(".pitch-player {", css)
        self.assertIn("transform: translate(-50%, -50%);", css)
        self.assertIn("transform: translate(-50%, -50%) scale(1.08);", css)
        self.assertIn("z-index: 30;", css)

        # 4. Pílula inferior com estilo Sofascore e truncation
        self.assertIn("max-width: 92px", css)
        self.assertIn("backdrop-filter: blur(4px)", css)
        self.assertIn("text-overflow: ellipsis", css)

    # -------------------------------------------------------------------------
    # CENÁRIO 55: Padronização dos 4 KPI Cards do Topo
    # -------------------------------------------------------------------------
    def test_55_kpi_cards_standardization(self):
        """Verifica se o 4º card tem no máximo 3 itens e se os 4 cards possuem layout flex padronizado."""
        with open(self.css_path, "r", encoding="utf-8") as f:
            css = f.read()

        # 1. Regra no CSS para os 4 cards
        self.assertIn(".kpi-card {", css)
        self.assertIn("display: flex;", css)
        self.assertIn("flex-direction: column;", css)
        self.assertIn("justify-content: space-between;", css)
        self.assertIn("height: 100%;", css)

        # 2. Ausência de spans ocultos (fantasmas) nos rodapés dos KPIs
        self.assertNotIn('id="stat-squad-count-sub"', self.index_html)
        self.assertNotIn('id="stat-preseason-record"', self.index_html)
        self.assertNotIn('id="stat-preseason-sub"', self.index_html)
        self.assertNotIn('id="stat-league-sub"', self.index_html)
        self.assertNotIn('id="stat-total-sub"', self.index_html)
        self.assertNotIn('id="stat-goals-sub"', self.index_html)

        # 3. Consolidação em exatamente 3 itens no 4º card
        self.assertIn('id="stat-wage-bill"', self.index_html)
        self.assertIn('id="stat-squad-averages"', self.index_html)
        self.assertIn('id="stat-squad-age"', self.index_html)

    # -------------------------------------------------------------------------
    # CENÁRIO 56: Polimento de Tabelas, Tipografia Numérica e Segmented Control
    # -------------------------------------------------------------------------
    def test_56_table_stabilization_and_segmented_control(self):
        """Verifica tabular-nums global, colunas estabilizadas, sticky mobile e segmented control."""
        with open(self.css_path, "r", encoding="utf-8") as f:
            css = f.read()

        # 1. font-variant-numeric: tabular-nums global
        self.assertIn("font-variant-numeric: tabular-nums;", css)
        self.assertIn(".rating-badge", css)
        self.assertIn(".ovr-badge", css)

        # 2. Estabilização das larguras das colunas do elenco
        self.assertIn("48px", css)
        self.assertIn("minmax(180px, 1.5fr)", css)
        self.assertIn("64px", css)
        self.assertIn("68px", css)

        # 3. Sticky column no tablet/mobile (<= 1024px)
        self.assertIn("@media (max-width: 1024px)", css)
        self.assertIn("position: sticky;", css)
        self.assertIn("z-index: 5;", css)

        # 4. Segmented Control com borda e border-radius 10px
        self.assertIn("border-radius: 10px;", css)
        self.assertIn("var(--border-color)", css)
        self.assertIn('[aria-selected="true"]', css)


if __name__ == "__main__":
    unittest.main(verbosity=2)
