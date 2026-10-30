/**
 * FC MANAGER — SPORTS ANALYTICS & CAREER TRACKER
 * Controlador Principal do Frontend Desktop-First
 * Consome o núcleo puro FCManagerDomain (assets/js/domain.js)
 * Compatível com GitHub Pages (Estático) e Servidor Local Python (/api/data)
 */

(function (window, document) {
  "use strict";

  // Dependência do domínio puro
  const Domain = window.FCManagerDomain;
  if (!Domain) {
    console.error("FCManagerDomain não foi carregado. Verifique assets/js/domain.js.");
  }

  // Estado da Aplicação
  const APP_STATE = {
    LOADING: "loading",
    LOADED: "loaded",
    ERROR: "error"
  };

  let currentState = APP_STATE.LOADING;
  let rawData = null;
  let normalizedData = null;
  let isLocalServer = false;
  let localApiBase = "";
  let activeTab = "overview";
  let squadViewMode = "performance"; // "performance" | "contracts"
  let matchesVenueFilter = "all"; // "all" | "home" | "away"
  let matchesResultFilter = "all"; // "all" | "win" | "draw" | "loss"
  let selectedPitchFormation = "auto";

  // Mapeamento de Roteamento por Hash (#visao-geral, #elenco, #partidas, #competicoes)
  const TAB_HASH_MAP = {
    "#visao-geral": "overview",
    "#overview": "overview",
    "#elenco": "squad",
    "#squad": "squad",
    "#partidas": "matches",
    "#matches": "matches",
    "#competicoes": "competitions",
    "#competitions": "competitions"
  };

  const TAB_TO_HASH = {
    overview: "#visao-geral",
    squad: "#elenco",
    matches: "#partidas",
    competitions: "#competicoes"
  };

  // Filtros de Elenco
  const squadFilters = {
    search: "",
    sector: "all",
    hierarchy: "all",
    confidence: "all",
    minMinutesOnly: false,
    sortBy: "minutos",
    sortOrder: "desc"
  };

  // Filtros de Partidas e Atuações
  let matchesCompFilter = "all";
  const logFilters = {
    search: "",
    competition: "all",
    match: "all"
  };

  // Último elemento focado antes de abrir modal (para acessibilidade)
  let lastFocusedElement = null;

  // ==========================================================================
  // INICIALIZAÇÃO
  // ==========================================================================
  document.addEventListener("DOMContentLoaded", () => {
    initApp();
  });

  async function initApp() {
    setupTabNavigation();
    setupModals();
    setupEventListeners();
    await loadCareerData();
  }

  // ==========================================================================
  // CARREGAMENTO DE DADOS (API LOCAL -> JSON ESTÁTICO -> BUNDLE JS)
  // ==========================================================================
  async function loadCareerData() {
    setAppState(APP_STATE.LOADING);

    // 1. Tentar API do servidor Python local (mesma origem ou localhost:8080)
    for (const base of ["", "http://127.0.0.1:8080"]) {
      try {
        const resp = await fetch(`${base}/api/data`, { cache: "no-store" });
        if (resp.ok) {
          const json = await resp.json();
          if (json && typeof json === "object") {
            rawData = json;
            isLocalServer = true;
            localApiBase = base;
            updateSourceBadge("Servidor Local Ativo", "win");
            processAndRender();
            loadAvailableSaves();
            return;
          }
        }
      } catch (e) {
        // Ignora e tenta o próximo fallback
      }
    }

    // 1.5. Verificar save customizado persistido no localStorage (Web / GitHub Pages)
    try {
      const customSaved = localStorage.getItem("fc_custom_career_data");
      if (customSaved) {
        const parsedCustom = JSON.parse(customSaved);
        if (parsedCustom && typeof parsedCustom === "object" && parsedCustom.squad) {
          rawData = parsedCustom;
          isLocalServer = false;
          updateSourceBadge("Dados Personalizados (Storage)", "info");
          processAndRender();
          return;
        }
      }
    } catch (e) {}

    // 2. Tentar carregar assets/data/career_data.json (GitHub Pages)
    try {
      const resp = await fetch("assets/data/career_data.json", { cache: "no-store" });
      if (resp.ok) {
        const json = await resp.json();
        if (json && typeof json === "object") {
          rawData = json;
          isLocalServer = false;
          updateSourceBadge("Dados Sincronizados", "info");
          processAndRender();
          return;
        }
      }
    } catch (e) {
      // Ignora e tenta fallback offline
    }

    // 3. Fallback do bundle JS embutido via window.FALLBACK_CAREER_DATA
    if (window.FALLBACK_CAREER_DATA && typeof window.FALLBACK_CAREER_DATA === "object") {
      rawData = window.FALLBACK_CAREER_DATA;
      isLocalServer = false;
      updateSourceBadge("Modo Offline", "draw");
      processAndRender();
      return;
    }

    // Se todas as fontes falharem
    setAppState(APP_STATE.ERROR, "Não foi possível carregar os dados da carreira. Verifique os arquivos career_data.json e career_data.js.");
  }

  function setAppState(state, errorMessage = "") {
    currentState = state;
    const loadingBanner = document.getElementById("state-loading");
    const errorBanner = document.getElementById("state-error");
    const errorMessageEl = document.getElementById("state-error-message");
    const appContent = document.getElementById("app-content");

    if (loadingBanner && loadingBanner.style) loadingBanner.style.display = state === APP_STATE.LOADING ? "flex" : "none";
    if (errorBanner && errorBanner.style) {
      errorBanner.style.display = state === APP_STATE.ERROR ? "flex" : "none";
      if (errorMessageEl && errorMessage) errorMessageEl.textContent = errorMessage;
    }
    if (appContent && appContent.style) appContent.style.display = state === APP_STATE.LOADED ? "block" : "none";
  }

  function processAndRender() {
    try {
      // Aplicar overrides de partidas persistidos no localStorage (se houver)
      try {
        const overridesStr = localStorage.getItem("fc_match_overrides");
        if (overridesStr && rawData && Array.isArray(rawData.matches)) {
          const overrides = JSON.parse(overridesStr);
          rawData.matches.forEach(m => {
            const dateInt = m.date_int;
            if (dateInt && overrides[dateInt]) {
              Object.assign(m, overrides[dateInt]);
            }
          });
        }
      } catch (ovErr) {
        console.warn("Aviso ao aplicar overrides de partidas:", ovErr);
      }

      normalizedData = Domain.normalizeCareerData(rawData);
      renderAll();
      setAppState(APP_STATE.LOADED);
    } catch (err) {
      console.error("Erro no processamento dos dados esportivos:", err);
      setAppState(APP_STATE.ERROR, "Erro ao processar dados da carreira: " + err.message);
    }
  }

  function updateSourceBadge(text, type) {
    const badge = document.getElementById("data-source-badge");
    if (!badge) return;
    badge.textContent = text;
    if (type === "win") {
      badge.className = "badge badge-status-synced";
    } else if (type === "draw") {
      badge.className = "badge badge-conf-baixa";
    } else {
      badge.className = "badge badge-conf-moderada";
    }
  }

  // ==========================================================================
  // RENDERIZAÇÃO COMPLETA
  // ==========================================================================
  function renderAll() {
    if (!normalizedData) return;
    renderClubHeader();
    populateCompetitionFilters();
    setupDynamicExports();
    renderOverviewTab();
    renderSquadTab();
    renderTacticalPitch();
    renderMatchesTab();
    renderCompetitionsTab();
    validateDataIntegritySilently();
  }

  // ==========================================================================
  // FILTROS DINÂMICOS DE COMPETIÇÃO
  // ==========================================================================
  function populateCompetitionFilters() {
    const matches = normalizedData.matches || [];
    const logs = normalizedData.player_match_logs || [];

    // Coletar nomes únicos de competições do payload do save
    const compSet = new Set();
    matches.forEach(m => {
      if (m.competicao && typeof m.competicao === "string") {
        compSet.add(Domain.normalizeCompetitionName(m.competicao.trim()));
      }
    });
    logs.forEach(l => {
      if (l.competicao && typeof l.competicao === "string") {
        compSet.add(Domain.normalizeCompetitionName(l.competicao.trim()));
      }
    });

    const uniqueComps = Array.from(compSet).sort();

    // Dropdown de Partidas
    const matchesSelect = document.getElementById("matches-comp-filter");
    if (matchesSelect) {
      const currentVal = matchesCompFilter || "all";
      matchesSelect.innerHTML = `<option value="all">Todas as Competições</option>` +
        uniqueComps.map(c => `<option value="${Domain.escapeHtml(c)}" ${c === currentVal ? "selected" : ""}>${Domain.escapeHtml(c)}</option>`).join("");
    }
  }

  // ==========================================================================
  // EXPORTAÇÃO DINÂMICA DE DADOS (CSV / XLSX)
  // ==========================================================================
  function setupDynamicExports() {
    const club = normalizedData.club || {};
    const clubSlug = (club.nome || "Clube").replace(/[^a-zA-Z0-9_-]/g, "_");

    // Configurar botão Excel (.xlsx) com metadados do clube
    const btnXlsx = document.getElementById("btn-export-xlsx");
    if (btnXlsx) {
      btnXlsx.download = `Estatisticas_${clubSlug}_Carreira.xlsx`;
      btnXlsx.title = `Exportar Planilha Excel (${club.nome || "Carreira"})`;
      // Link dinâmico para a exportação correspondente
      btnXlsx.href = "exports/Estatisticas_Jogadores_FC_Andorra_Carreira.xlsx";
    }

    // Configurar botão CSV para geração client-side dinâmica via Blob
    const btnCsv = document.getElementById("btn-export-csv");
    if (btnCsv && !btnCsv._hasDynamicExportListener) {
      btnCsv._hasDynamicExportListener = true;
      btnCsv.addEventListener("click", e => {
        e.preventDefault();
        exportSquadToCsvClientSide();
      });
    }
  }

  function exportSquadToCsvClientSide() {
    if (!normalizedData || !normalizedData.squad) return;
    const club = normalizedData.club || {};
    const clubSlug = (club.nome || "Clube").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Estatisticas_${clubSlug}_Carreira.csv`;

    const headers = [
      "ID", "Nº", "Jogador", "Posição", "Setor", "Idade", "Nacionalidade",
      "Overall", "Potencial", "Evolução", "Jogos", "Titular", "Reserva",
      "Minutos", "Gols", "Assistências", "Nota Média", "Valor de Mercado",
      "Salário Semanal", "Hierarquia", "Utilização", "Situação Tática"
    ];

    const rows = normalizedData.squad.map(p => [
      p.playerid || "",
      p.numero || "",
      `"${String(p.nome || "").replace(/"/g, '""')}"`,
      p.posicao_principal || "",
      p.setor_canonico || "",
      p.idade || "",
      `"${String(p.nacionalidade || "").replace(/"/g, '""')}"`,
      p.overall || "",
      p.potencial || "",
      p.evolucao_real || 0,
      p.jogos || 0,
      p.jogos_titular || 0,
      p.jogos_reserva || 0,
      p.minutos || 0,
      p.gols || 0,
      p.assistencias || 0,
      Domain.formatRating(p.nota_media),
      p.valor_mercado || 0,
      p.salario || 0,
      `"${String(p.status_elenco || "").replace(/"/g, '""')}"`,
      `"${String(p.status_utilizacao || "").replace(/"/g, '""')}"`,
      `"${String(p.recomendacao_sistema || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\r\n");

    try {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveOrOpenBlob(blob, fileName);
        return;
      }
      const url = URL.createObjectURL(blob);
      const tempLink = document.createElement("a");
      tempLink.href = url;
      tempLink.download = fileName;
      tempLink.style.display = "none";
      document.body.appendChild(tempLink);
      tempLink.click();
      setTimeout(() => {
        document.body.removeChild(tempLink);
        URL.revokeObjectURL(url);
      }, 200);
      showToast(`Exportação concluída: ${fileName}`, "success");
    } catch (err) {
      console.error("Erro ao gerar CSV dinâmico:", err);
      showToast("Não foi possível gerar a exportação CSV.", "error");
    }
  }

  // ==========================================================================
  // CABEÇALHO DO CLUBE & RESUMO DA TEMPORADA
  // ==========================================================================
  function getInitials(name) {
    if (!name) return "FC";
    const words = name.trim().split(/\s+/).filter(w => w.length > 0 && !["de", "da", "do", "la", "el", "cf", "fc", "cd"].includes(w.toLowerCase()));
    if (words.length === 0) return name.slice(0, 3).toUpperCase();
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.map(w => w[0]).slice(0, 3).join("").toUpperCase();
  }

  function renderFormGuide() {
    const container = document.getElementById("form-guide-pills");
    if (!container) return;
    const matches = normalizedData.matches || [];
    if (matches.length === 0) {
      container.innerHTML = `<span style="font-size:11px; color:var(--text-muted);">Sem partidas</span>`;
      return;
    }
    // As 5 partidas mais recentes (ordenadas por date_int asc para fluxo temporal da esquerda p/ direita)
    const sorted = [...matches].sort((a, b) => (a.date_int || 0) - (b.date_int || 0));
    const recent = sorted.slice(-5);
    container.innerHTML = recent.map(m => {
      const resMeta = Domain.getResultMeta(m.resultado_canonico);
      const resLetter = resMeta.sigla || "E"; // 'V', 'E', 'D'
      const pillClass = resMeta.css === "win" ? "form-pill-win" : resMeta.css === "loss" ? "form-pill-loss" : "form-pill-draw";
      const opponent = m.adversario || (m.mando === "Casa" ? m.visitante : m.mandante) || "Adversário";
      const tooltip = `${Domain.escapeHtml(opponent)} (${Domain.escapeHtml(formatScore(m, " x "))}) · ${Domain.escapeHtml(m.competicao || "")}`;
      return `<span class="form-pill ${pillClass}" title="${tooltip}">${resLetter}</span>`;
    }).join("");
  }

  function renderClubHeader() {
    const club = normalizedData.club || {};
    const comps = club.competicoes_separadas || {};
    const liga = comps.liga || {};
    const pre = comps.pre_temporada || {};
    const tot = comps.total_temporada || {};
    const squad = (normalizedData && normalizedData.squad) || [];

    setText("club-crest", getInitials(club.nome));
    const crestEl = document.getElementById("club-crest");
    if (crestEl) {
      crestEl.innerHTML = Domain.renderTeamCrest(club.nome, club.id || club.teamid, "lg");
    }

    setText("club-name", club.nome || "Clube");
    setText("coach-name", club.treinador || "Treinador");
    setText("club-league", club.liga || "Liga Nacional");
    setText("save-date", club.data_atual || "Indisponível");
    setText("career-season", club.temporada || "Temporada 1");
    setText("current-save-name", normalizedData.save_file || "Carreira Ativa");

    // Forma Recente do Clube
    renderFormGuide();

    // 1. KPI Liga
    setText("strip-league-name", club.liga || "Liga Nacional");
    setText("stat-league-pos", liga.posicao ? `${liga.posicao}º Lugar` : "1º Lugar");
    setText("stat-league-record", `${liga.jogos || 0}J: ${liga.vitorias || 0}V ${liga.empates || 0}E ${liga.derrotas || 0}D`);
    setText("stat-league-pts", String(liga.pontos || 0));
    const maxPts = (liga.jogos || 0) * 3;
    const leaguePct = maxPts > 0 ? ((liga.pontos / maxPts) * 100).toFixed(1) + "%" : "0.0%";
    setText("stat-league-pct", leaguePct);
    setText("stat-league-sub", `${liga.jogos || 0} Jogos · ${liga.pontos || 0} Pontos${liga.posicao ? ` (${liga.posicao}º Lugar)` : ''}`);

    // 2. KPI Balanço Geral
    setText("stat-total-record", `${tot.jogos || 0}J: ${tot.vitorias || 0}V ${tot.empates || 0}E ${tot.derrotas || 0}D${tot.invicto ? " (Invicto)" : ""}`);
    const matchesList = normalizedData.matches || [];
    const totalGp = club.total_gols_temporada || tot.gols_pro || matchesList.reduce((acc, m) => acc + (m.gols_pro || 0), 0);
    const totalGc = club.total_gols_contra || tot.gols_contra || matchesList.reduce((acc, m) => acc + (m.gols_contra || 0), 0);
    const saldo = totalGp - totalGc;
    const saldoStr = (saldo >= 0 ? "+" : "") + saldo + " SG";
    const gPerGame = (tot.jogos || 0) > 0 ? (totalGp / tot.jogos).toFixed(2) : "0.00";
    setText("stat-total-goals", `${totalGp} GP`);
    setText("stat-total-conceded", `${totalGc} GC`);
    setText("stat-total-sg", saldoStr);
    setText("stat-goals-per-game", `${gPerGame} /j`);
    setText("stat-total-sub", `${tot.jogos || 0} Jogos Disputados`);

    // 3. KPI Poder de Fogo (Ataque)
    const squadGoalsSum = squad.reduce((sum, p) => sum + (Number(p.gols) || 0), 0);
    const goalsCount = squadGoalsSum > 0 ? squadGoalsSum : (club.total_gols_elenco || club.gols_pro_temporada || 0);
    const squadAstSum = squad.reduce((sum, p) => sum + (Number(p.assistencias) || 0), 0);
    const assistsCount = squadAstSum > 0 ? squadAstSum : (club.total_assistencias_elenco || 0);

    setText("stat-goals-total", `${goalsCount} GP · ${assistsCount} Assists`);
    const topScorer = [...squad].sort((a, b) => (b.gols || 0) - (a.gols || 0))[0];
    const topAssister = [...squad].sort((a, b) => (b.assistencias || 0) - (a.assistencias || 0))[0];
    setText("stat-top-scorer", topScorer && (topScorer.gols || 0) > 0 ? `${topScorer.nome} (${topScorer.gols})` : "—");
    setText("stat-top-assister", topAssister && (topAssister.assistencias || 0) > 0 ? `${topAssister.nome} (${topAssister.assistencias})` : "—");
    setText("stat-goals-sub", `${goalsCount} Gols Marcados`);

    // 4. KPI Finanças & Grupo
    setText("stat-squad-value", Domain.formatCurrency(club.valor_elenco_total || 0));
    setText("stat-wage-bill", `${Domain.formatCurrency(club.folha_salarial_semanal || 0)}/sem`);
    const avgOvrVal = squad.length > 0 ? (squad.reduce((a, p) => a + (p.overall || 0), 0) / squad.length).toFixed(1) : "—";
    const avgAgeVal = squad.length > 0 ? (squad.reduce((a, p) => a + (p.idade || 0), 0) / squad.length).toFixed(1) : "—";
    setText("stat-squad-averages", `${avgOvrVal} OVR`);
    setText("stat-squad-age", `${avgAgeVal} anos`);

    // Atualizar rodapé dinamicamente com nome do clube e treinador
    setText("footer-club-info", `${club.nome || "Clube"} (${club.treinador || "Treinador"})`);
  }

  // ==========================================================================
  // ABA 1: VISÃO GERAL (OVERVIEW)
  // ==========================================================================
  function renderOverviewTab() {
    const club = normalizedData.club || {};
    const comps = club.competicoes_separadas || {};
    const liga = comps.liga || {};
    const pre = comps.pre_temporada || {};
    const squad = (normalizedData && normalizedData.squad) || [];

    // 1. Card de Última Partida — sempre o registro completo resolvido pelo domínio
    const lastMatch = club.ultima_partida || null;
    if (lastMatch) {
      setText("hero-match-date-comp", `${lastMatch.competicao || "-"} · ${lastMatch.data || "-"}`);
      setText("hero-match-home", lastMatch.mandante);
      setText("hero-match-score", formatScore(lastMatch, " - "));
      setText("hero-match-away", lastMatch.visitante);
      setText("hero-match-scorers", lastMatch.artilheiros || "Nenhum gol registrado");

      const homeCrestEl = document.getElementById("hero-match-home-crest");
      if (homeCrestEl) {
        homeCrestEl.innerHTML = Domain.renderTeamCrest(lastMatch.mandante, lastMatch.mandante_id, "md");
      }
      const awayCrestEl = document.getElementById("hero-match-away-crest");
      if (awayCrestEl) {
        awayCrestEl.innerHTML = Domain.renderTeamCrest(lastMatch.visitante, lastMatch.visitante_id, "md");
      }

      const heroBtn = document.getElementById("hero-match-btn");
      if (heroBtn) {
        heroBtn.onclick = () => openMatchModal(lastMatch.id);
      }
    }

    // 2. Card de Premiação & Objetivos (Dinâmico a partir do save)
    const preTitle = pre.nome || pre.nome_torneio || pre.titulo || "Torneio de Pré-Temporada";
    const preStatus = pre.titulo ? (pre.titulo.includes("Campeão") ? "★ Campeão Invicto" : `★ ${pre.titulo}`) : (pre.jogos ? `${pre.jogos} jogos disputados` : "—");
    let prePrize = "—";
    if (pre.premiacao) {
      prePrize = `+${Domain.formatCurrency(pre.premiacao)}`;
    } else if (pre.titulo) {
      const matchPrize = String(pre.titulo).match(/€\s*[\d\.,]+/);
      if (matchPrize) prePrize = `+${matchPrize[0]}`;
    }
    const leagueStanding = liga.posicao ? `${liga.posicao}º Lugar (Zona de Acesso)` : (liga.pontos ? `${liga.pontos} Pontos` : "—");

    setText("card-preseason-title", preTitle);
    setText("card-preseason-status", preStatus);
    setText("card-preseason-prize", prePrize);
    setText("card-league-standing", leagueStanding);

    // 3. Radar do Elenco (4 Colunas)
    // a) Top Artilheiros
    const topScorers = [...squad]
      .filter(p => p.gols > 0)
      .sort((a, b) => b.gols - a.gols || (b.minutos || 0) - (a.minutos || 0))
      .slice(0, 5);

    const scorersList = document.getElementById("radar-top-scorers");
    if (scorersList) {
      if (topScorers.length === 0) {
        scorersList.innerHTML = `<li class="radar-item" style="color:var(--text-muted);">Nenhum gol na temporada</li>`;
      } else {
        scorersList.innerHTML = topScorers.map(p => `
          <li class="radar-item">
            <div class="radar-player-left">
              ${Domain.renderPlayerFace(p, "sm")}
              <span class="player-display-name" onclick="window.TrackerApp.openPlayerModal(${p.playerid})">${Domain.escapeHtml(p.nome)} <small style="color:var(--text-muted); font-weight:normal;">(${p.posicao_principal})</small></span>
            </div>
            <strong style="color:var(--sports-win); font-family:var(--font-mono);">${p.gols} gols</strong>
          </li>
        `).join("");
      }
    }

    // b) Líderes em Assistências
    const topAssists = [...squad]
      .filter(p => (p.assistencias || 0) > 0)
      .sort((a, b) => (b.assistencias || 0) - (a.assistencias || 0) || (b.minutos || 0) - (a.minutos || 0))
      .slice(0, 5);

    const assistsList = document.getElementById("radar-top-assists");
    if (assistsList) {
      if (topAssists.length === 0) {
        assistsList.innerHTML = `<li class="radar-item" style="color:var(--text-muted);">Nenhuma assistência registrada</li>`;
      } else {
        assistsList.innerHTML = topAssists.map(p => `
          <li class="radar-item">
            <div class="radar-player-left">
              ${Domain.renderPlayerFace(p, "sm")}
              <span class="player-display-name" onclick="window.TrackerApp.openPlayerModal(${p.playerid})">${Domain.escapeHtml(p.nome)} <small style="color:var(--text-muted); font-weight:normal;">(${p.posicao_principal})</small></span>
            </div>
            <strong style="color:var(--brand-cyan); font-family:var(--font-mono);">${p.assistencias} assists</strong>
          </li>
        `).join("");
      }
    }

    // c) Maiores Notas Médias (mín. 150 min)
    const topRatings = [...squad]
      .filter(p => (p.minutos || 0) >= 150 && p.nota_media > 0)
      .sort((a, b) => b.nota_media - a.nota_media)
      .slice(0, 5);

    const ratingsList = document.getElementById("radar-top-ratings");
    if (ratingsList) {
      if (topRatings.length === 0) {
        ratingsList.innerHTML = `<li class="radar-item" style="color:var(--text-muted);">Amostra insuficiente</li>`;
      } else {
        ratingsList.innerHTML = topRatings.map(p => `
          <li class="radar-item">
            <div class="radar-player-left">
              ${Domain.renderPlayerFace(p, "sm")}
              <span class="player-display-name" onclick="window.TrackerApp.openPlayerModal(${p.playerid})">${Domain.escapeHtml(p.nome)} <small style="color:var(--text-muted); font-weight:normal;">(${p.posicao_principal})</small></span>
            </div>
            <span class="rating-badge ${Domain.getRatingBadgeClass(p.nota_media)}">${Domain.formatRating(p.nota_media)}</span>
          </li>
        `).join("");
      }
    }

    // d) Alertas Contratuais & Evolução (+OVR)
    const alerts = [...squad]
      .filter(p => (p.anos_contrato !== undefined && p.anos_contrato <= 1) || (p.evolucao_real || 0) > 0)
      .sort((a, b) => (b.evolucao_real || 0) - (a.evolucao_real || 0) || (a.anos_contrato || 0) - (b.anos_contrato || 0))
      .slice(0, 5);

    const expiringList = document.getElementById("radar-expiring-contracts");
    if (expiringList) {
      if (alerts.length === 0) {
        expiringList.innerHTML = `<li class="radar-item" style="color:var(--text-muted);">Nenhum alerta</li>`;
      } else {
        expiringList.innerHTML = alerts.map(p => {
          let badge = "";
          if (p.anos_contrato !== undefined && p.anos_contrato <= 1) {
            badge = `<span class="badge-contract-alert">${p.contrato_fim || "1 ano"}</span>`;
          } else {
            badge = `<span class="badge-evol">+${p.evolucao_real} OVR</span>`;
          }
          return `
            <li class="radar-item">
              <div class="radar-player-left">
                ${Domain.renderPlayerFace(p, "sm")}
                <span class="player-display-name" onclick="window.TrackerApp.openPlayerModal(${p.playerid})">${Domain.escapeHtml(p.nome)}</span>
              </div>
              ${badge}
            </li>
          `;
        }).join("");
      }
    }

    // Renderizar campo tático da Visão Geral
    renderTacticalPitch();
  }

  // ==========================================================================
  // PRANCHETA TÁTICA DO XI TITULAR (INTERACTIVE PITCH BOARD)
  // ==========================================================================
  function renderTacticalPitch() {
    const pitch = document.getElementById("tactical-pitch");
    if (!pitch) return;

    const squad = (normalizedData && normalizedData.squad) || [];
    let starters = squad.filter(p => p.hierarquia_tatica === "titular");

    // Fallback: se não houver 11 titulares marcados, seleciona os 11 com mais minutos
    if (starters.length === 0) {
      starters = [...squad].sort((a, b) => b.minutos - a.minutos).slice(0, 11);
    }

    // Seletor de esquema tático interativo
    const formationSelect = document.getElementById("select-pitch-formation");
    if (formationSelect) {
      selectedPitchFormation = formationSelect.value || "auto";
      if (!formationSelect._listenerBound) {
        formationSelect._listenerBound = true;
        if (typeof formationSelect.addEventListener === "function") {
          formationSelect.addEventListener("change", (e) => {
            selectedPitchFormation = e.target.value;
            renderTacticalPitch();
          });
        }
      }
    }

    // Métricas da prancheta
    const avgOvr = starters.length ? (starters.reduce((acc, p) => acc + (p.overall || 0), 0) / starters.length).toFixed(1) : "—";
    const avgAge = starters.length ? (starters.reduce((acc, p) => acc + (p.idade || 0), 0) / starters.length).toFixed(1) : "—";
    const starterVal = starters.reduce((acc, p) => acc + (p.valor_mercado || 0), 0);

    // Agrupar por setor canônico
    const goalkeepers = starters.filter(p => p.setor_canonico === "goleiro");
    const defenders = starters.filter(p => p.setor_canonico === "defesa");
    const midfielders = starters.filter(p => p.setor_canonico === "meio");
    const attackers = starters.filter(p => p.setor_canonico === "ataque");

    // Ordenação lateral tática das linhas
    const defOrder = { "LE": 1, "LBE": 2, "ZAG": 3, "DC": 4, "LBD": 5, "LD": 6 };
    defenders.sort((a, b) => (defOrder[a.posicao_principal] || 3) - (defOrder[b.posicao_principal] || 3));

    const midOrder = { "ME": 1, "VOL": 2, "MC": 3, "MCO": 4, "MD": 5 };
    midfielders.sort((a, b) => (midOrder[a.posicao_principal] || 3) - (midOrder[b.posicao_principal] || 3));

    const attOrder = { "PE": 1, "PTE": 2, "SA": 3, "CA": 4, "ATA": 5, "PTD": 6, "PD": 7 };
    attackers.sort((a, b) => (attOrder[a.posicao_principal] || 4) - (attOrder[b.posicao_principal] || 4));

    const autoFormationStr = `${defenders.length}-${midfielders.length}-${attackers.length}`;
    const activeFormation = selectedPitchFormation === "auto" ? autoFormationStr : selectedPitchFormation;

    if (formationSelect) {
      const autoOption = formationSelect.querySelector('option[value="auto"]');
      if (autoOption) {
        autoOption.textContent = `Auto (${autoFormationStr})`;
      }
    }

    setText("tactical-formation", activeFormation);
    setText("xi-formation", activeFormation);
    setText("tactical-avg-ovr", avgOvr);
    setText("tactical-avg-age", `${avgAge} anos`);
    setText("tactical-starter-val", Domain.formatCurrency(starterVal));

    // Distribuição no campo vertical (GOL embaixo -> ATA em cima)
    const tokens = [];

    function layoutRow(players, yPercent) {
      const count = players.length;
      if (count === 1) {
        tokens.push({ player: players[0], x: 50, y: yPercent });
      } else if (count > 1) {
        const leftMargin = count === 2 ? 30 : count === 3 ? 20 : 16;
        const rightMargin = 100 - leftMargin;
        const step = (rightMargin - leftMargin) / (count - 1);
        players.forEach((p, idx) => {
          tokens.push({ player: p, x: Math.round(leftMargin + idx * step), y: yPercent });
        });
      }
    }

    const outfielders = [...defenders, ...midfielders, ...attackers];
    const gk = goalkeepers[0] || starters[0];
    if (gk) {
      tokens.push({ player: gk, x: 50, y: 88 });
    }

    if (selectedPitchFormation === "4-3-3" && outfielders.length >= 10) {
      layoutRow(outfielders.slice(0, 4), 68);
      layoutRow(outfielders.slice(4, 7), 46);
      layoutRow(outfielders.slice(7, 10), 20);
    } else if (selectedPitchFormation === "4-2-3-1" && outfielders.length >= 10) {
      layoutRow(outfielders.slice(0, 4), 70);
      layoutRow(outfielders.slice(4, 6), 54);
      layoutRow(outfielders.slice(6, 9), 36);
      layoutRow(outfielders.slice(9, 10), 18);
    } else if (selectedPitchFormation === "4-4-2" && outfielders.length >= 10) {
      layoutRow(outfielders.slice(0, 4), 70);
      layoutRow(outfielders.slice(4, 8), 46);
      layoutRow(outfielders.slice(8, 10), 20);
    } else if (selectedPitchFormation === "3-5-2" && outfielders.length >= 10) {
      layoutRow(outfielders.slice(0, 3), 72);
      layoutRow(outfielders.slice(3, 8), 46);
      layoutRow(outfielders.slice(8, 10), 20);
    } else {
      // Auto / esquema natural
      tokens.length = 0; // reset to avoid duplicate gk
      layoutRow(goalkeepers, 88);
      layoutRow(defenders, 68);
      layoutRow(midfielders, 46);
      layoutRow(attackers, 20);
    }

    pitch.innerHTML = tokens.map(({ player, x, y }) => {
      const sector = player.setor_canonico || "meio";
      const ratingClass = Domain.getRatingBadgeClass(player.nota_media);
      let statBadges = "";
      if (player.gols > 0) statBadges += `<span class="pitch-stat-icon" title="${player.gols} gol(s)"><i class="ph-fill ph-soccer-ball"></i> ${player.gols}</span>`;
      if (player.assistencias > 0) statBadges += `<span class="pitch-stat-icon" title="${player.assistencias} assistência(s)"><i class="ph-fill ph-sneaker-move"></i> ${player.assistencias}</span>`;

      return `
        <div class="pitch-player pitch-player-token ${sector}" style="top: ${y}%; left: ${x}%;" onclick="window.TrackerApp.openPlayerModal(${player.playerid})" title="${Domain.escapeHtml(player.nome)} (${Domain.escapeHtml(player.posicao_principal)})" tabindex="0" role="button" aria-label="Ver perfil de ${Domain.escapeHtml(player.nome)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.TrackerApp.openPlayerModal(${player.playerid});}">
          <div class="pitch-avatar-wrap">
            <span class="pitch-ovr-badge" title="Overall">${player.overall || "—"}</span>
            <div class="pitch-avatar">
              ${Domain.renderPlayerFace(player, "pitch")}
            </div>
            <span class="pitch-rating-badge rating-badge ${ratingClass}" title="Nota Média">${Domain.formatRating(player.nota_media)}</span>
          </div>
          <div class="pitch-name-pill">
            <span class="pitch-player-name">${Domain.escapeHtml(player.nome)}</span>
            ${statBadges ? `<span class="pitch-pill-stats">${statBadges}</span>` : ""}
          </div>
        </div>
      `;
    }).join("");
  }

  // ==========================================================================
  // ABA 2: ELENCO (SQUAD HUB)
  // ==========================================================================
  function renderSquadTab() {
    const squad = (normalizedData && normalizedData.squad) || [];
    const tbody = document.getElementById("squad-table-body");
    const thead = document.getElementById("squad-table-head");
    if (!tbody) return;

    // Aplicar filtros e ordenação via FCManagerDomain
    const filtered = Domain.filterSquad(squad, squadFilters);
    const sorted = Domain.sortSquad(filtered, squadFilters.sortBy, squadFilters.sortOrder);

    setText("squad-count-badge", `${sorted.length} / ${squad.length}`);

    // Renderizar cabeçalho da tabela conforme squadViewMode
    if (thead) {
      if (squadViewMode === "contracts") {
        thead.innerHTML = `
          <tr>
            <th class="cell-num col-num">Nº</th>
            <th class="col-player">Jogador</th>
            <th class="col-pos">Pos</th>
            <th class="cell-num sortable col-age" data-sort="idade" title="Ordenar por Idade">Idade <span class="sort-indicator"></span></th>
            <th class="cell-num sortable col-ovr" data-sort="overall" title="Ordenar por Overall">OVR <span class="sort-indicator"></span></th>
            <th class="cell-num sortable" data-sort="potencial" title="Ordenar por Potencial">POT <span class="sort-indicator"></span></th>
            <th class="cell-num sortable" data-sort="margem_potencial" title="Ordenar por Margem">Margem <span class="sort-indicator"></span></th>
            <th class="cell-num sortable" data-sort="valor_mercado" title="Ordenar por Valor">Valor de Mercado <span class="sort-indicator"></span></th>
            <th class="cell-num sortable" data-sort="salario" title="Ordenar por Salário">Salário Semanal <span class="sort-indicator"></span></th>
            <th class="cell-num sortable" data-sort="contrato_fim" title="Ordenar por Fim de Contrato">Fim de Contrato <span class="sort-indicator"></span></th>
          </tr>
        `;
      } else {
        thead.innerHTML = `
          <tr>
            <th class="cell-num col-num">Nº</th>
            <th class="col-player">Jogador</th>
            <th class="col-pos">Pos</th>
            <th class="cell-num sortable col-age" data-sort="idade" title="Ordenar por Idade">Idade <span class="sort-indicator"></span></th>
            <th class="cell-num sortable col-ovr" data-sort="overall" title="Ordenar por Overall">OVR <span class="sort-indicator"></span></th>
            <th class="cell-num sortable" data-sort="jogos" title="Ordenar por Jogos">J (Tit/Sub) <span class="sort-indicator"></span></th>
            <th class="cell-num sortable" data-sort="minutos" title="Ordenar por Minutos">Min <span class="sort-indicator"></span></th>
            <th class="cell-num sortable" data-sort="pct_minutos" title="Ordenar por % Min">% Min <span class="sort-indicator"></span></th>
            <th class="cell-num sortable" data-sort="gols" title="Ordenar por Gols">Gols <span class="sort-indicator"></span></th>
            <th class="cell-num sortable" data-sort="assistencias" title="Ordenar por Assistências">Assists <span class="sort-indicator"></span></th>
            <th class="cell-num sortable" data-sort="ga_por_90" title="Ordenar por G+A/90">G+A/90 <span class="sort-indicator"></span></th>
            <th class="cell-num sortable" data-sort="nota_media" title="Ordenar por Nota">Nota <span class="sort-indicator"></span></th>
            <th>Status Tático</th>
          </tr>
        `;
      }

      // Conectar listeners de ordenação
      thead.querySelectorAll("th.sortable").forEach(th => {
        const field = th.getAttribute("data-sort");
        const indicator = th.querySelector(".sort-indicator");
        if (indicator) {
          if (squadFilters.sortBy === field) {
            indicator.textContent = squadFilters.sortOrder === "asc" ? "▲" : "▼";
          } else {
            indicator.textContent = "";
          }
        }
        th.style.cursor = "pointer";
        th.onclick = () => {
          if (squadFilters.sortBy === field) {
            squadFilters.sortOrder = squadFilters.sortOrder === "asc" ? "desc" : "asc";
          } else {
            squadFilters.sortBy = field;
            squadFilters.sortOrder = (field === "idade" || field === "numero") ? "asc" : "desc";
          }
          renderSquadTab();
        };
      });
    }

    if (sorted.length === 0) {
      const colSpan = squadViewMode === "contracts" ? 10 : 13;
      tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center; padding: 28px; color: var(--text-muted);">Nenhum jogador encontrado para os critérios selecionados.</td></tr>`;
      return;
    }

    if (squadViewMode === "contracts") {
      tbody.innerHTML = sorted.map(p => {
        const posSector = p.setor_canonico || "meio";
        const margin = p.margem_potencial !== undefined ? p.margem_potencial : ((p.potencial || 0) - (p.overall || 0));
        const isExpiring = p.anos_contrato !== undefined && p.anos_contrato <= 1;
        const contractBadge = isExpiring ? `<span class="badge-contract-alert">Último Ano</span>` : "";
        const isCompared = comparedPlayerIds.includes(p.playerid);

        return `
          <tr tabindex="0" role="button" aria-label="Ver ficha de ${Domain.escapeHtml(p.nome)}" onclick="window.TrackerApp.openPlayerModal(${p.playerid})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.TrackerApp.openPlayerModal(${p.playerid});}">
            <td class="cell-num col-num"><span class="player-num-circle">${p.numero || "-"}</span></td>
            <td class="col-player">
              <div class="player-names-cell">
                ${Domain.renderPlayerFace(p, "md")}
                <div class="player-names-info">
                  <span class="player-display-name">${Domain.escapeHtml(p.nome)}</span>
                  <div class="player-meta-inline">${Domain.escapeHtml(p.nacionalidade || "")}</div>
                </div>
                <button type="button" class="btn-compare-player ${isCompared ? 'active' : ''}" data-playerid="${p.playerid}" title="${isCompared ? 'Remover da comparação' : 'Comparar jogador (Head-to-Head)'}" aria-label="Comparar ${Domain.escapeHtml(p.nome)}" onclick="event.stopPropagation(); window.TrackerApp.toggleComparePlayer(${p.playerid});">⇄</button>
              </div>
            </td>
            <td class="col-pos"><span class="badge badge-pos ${posSector}">${Domain.escapeHtml(p.posicao_principal)}</span></td>
            <td class="cell-num col-age">${p.idade}</td>
            <td class="cell-num cell-bold col-ovr">${p.overall}</td>
            <td class="cell-num"><span class="badge badge-pot">${p.potencial}</span></td>
            <td class="cell-num cell-bold" style="color:var(--brand-cyan);">+${margin}</td>
            <td class="cell-num cell-bold" style="color:var(--brand-cyan);">${Domain.formatCurrency(p.valor_mercado || 0)}</td>
            <td class="cell-num">${Domain.formatCurrency(p.salario || 0)} /sem</td>
            <td>${Domain.escapeHtml(String(p.contrato_fim || "-"))} ${contractBadge}</td>
          </tr>
        `;
      }).join("");
    } else {
      tbody.innerHTML = sorted.map(p => {
        const posSector = p.setor_canonico || "meio";
        const evolBadge = p.evolucao_real > 0 ? `<span class="badge-evol">+${p.evolucao_real}</span>` : "";
        const secPosBadge = p.posicoes_secundarias && p.posicoes_secundarias !== "—" && p.posicoes_secundarias !== "-"
          ? `<span class="badge-sec-pos">${Domain.escapeHtml(p.posicoes_secundarias)}</span>` : "";
        const isCompared = comparedPlayerIds.includes(p.playerid);

        let statusClass = "reserve";
        let statusLabel = "Reserva";
        if (p.hierarquia_tatica === "titular" || p.jogos_titular >= 2 || (p.minutos || 0) >= 200) {
          statusClass = "starter";
          statusLabel = "Titular";
        } else if ((p.minutos || 0) >= 80 || (p.jogos_reserva || 0) > 0) {
          statusClass = "rotation";
          statusLabel = "Rotação";
        } else if ((p.minutos || 0) === 0) {
          statusClass = "unplayed";
          statusLabel = "Sem Minutos";
        }

        const ratingClass = Domain.getRatingBadgeClass(p.nota_media);
        const ga90 = p.ga_por_90 !== undefined ? p.ga_por_90 : (p.minutos > 0 ? (((p.gols || 0) + (p.assistencias || 0)) * 90 / p.minutos) : 0);

        return `
          <tr tabindex="0" role="button" aria-label="Ver ficha de ${Domain.escapeHtml(p.nome)}" onclick="window.TrackerApp.openPlayerModal(${p.playerid})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.TrackerApp.openPlayerModal(${p.playerid});}">
            <td class="cell-num col-num"><span class="player-num-circle">${p.numero || "-"}</span></td>
            <td class="col-player">
              <div class="player-names-cell">
                ${Domain.renderPlayerFace(p, "md")}
                <div class="player-names-info">
                  <span class="player-display-name">${Domain.escapeHtml(p.nome)}</span>
                  ${secPosBadge}
                  <div class="player-meta-inline">${Domain.escapeHtml(p.nacionalidade || "")}</div>
                </div>
                <button type="button" class="btn-compare-player ${isCompared ? 'active' : ''}" data-playerid="${p.playerid}" title="${isCompared ? 'Remover da comparação' : 'Comparar jogador (Head-to-Head)'}" aria-label="Comparar ${Domain.escapeHtml(p.nome)}" onclick="event.stopPropagation(); window.TrackerApp.toggleComparePlayer(${p.playerid});">⇄</button>
              </div>
            </td>
            <td class="col-pos"><span class="badge badge-pos ${posSector}">${Domain.escapeHtml(p.posicao_principal)}</span></td>
            <td class="cell-num col-age">${p.idade}</td>
            <td class="cell-num cell-bold col-ovr">${p.overall} ${evolBadge}</td>
            <td class="cell-num">${p.jogos} <small style="color:var(--text-muted);">(${p.jogos_titular}T/${p.jogos_reserva}R)</small></td>
            <td class="cell-num cell-bold">${p.minutos}'</td>
            <td class="cell-num">${p.pct_minutos || 0}%</td>
            <td class="cell-num cell-bold" style="${p.gols > 0 ? 'color: var(--sports-win);' : ''}">${p.gols}</td>
            <td class="cell-num" style="${p.assistencias > 0 ? 'color: var(--brand-cyan);' : ''}">${p.assistencias}</td>
            <td class="cell-num">${Domain.formatNumber(ga90)}</td>
            <td class="cell-num"><span class="rating-badge ${ratingClass}">${Domain.formatRating(p.nota_media)}</span></td>
            <td><span class="badge-status-tactical ${statusClass}">${statusLabel}</span></td>
          </tr>
        `;
      }).join("");
    }
  }

  // ==========================================================================
  // ABA 3: PARTIDAS & ATUAÇÕES
  // ==========================================================================
  function renderMatchesTab() {
    renderMatchesGrid();
    renderMatchLogsTable();
  }

  function renderMatchesGrid() {
    const matches = normalizedData.matches || [];
    const container = document.getElementById("matches-grid-container");
    if (!container) return;

    let filtered = matches;
    if (matchesCompFilter !== "all") {
      filtered = filtered.filter(m => {
        const c = Domain.normalizeCompetitionName(m.competicao || "").toLowerCase().trim();
        const f = Domain.normalizeCompetitionName(matchesCompFilter).toLowerCase().trim();
        return c === f || c.includes(f) || f.includes(c);
      });
    }

    if (matchesVenueFilter !== "all") {
      filtered = filtered.filter(m => {
        const mando = (m.mando || "").toLowerCase().trim();
        if (matchesVenueFilter === "home") return mando === "casa" || mando === "home";
        if (matchesVenueFilter === "away") return mando === "fora" || mando === "away";
        return true;
      });
    }

    if (matchesResultFilter !== "all") {
      filtered = filtered.filter(m => {
        const meta = Domain.getResultMeta(m.resultado_canonico);
        return meta.css === matchesResultFilter;
      });
    }

    // Recalcular métricas para a barra de resumo analítico
    const totalFiltered = filtered.length;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let gp = 0;
    let gc = 0;

    filtered.forEach(m => {
      const meta = Domain.getResultMeta(m.resultado_canonico);
      if (meta.css === "win") wins++;
      else if (meta.css === "loss") losses++;
      else draws++;

      gp += Number(m.gols_pro || 0);
      gc += Number(m.gols_contra || 0);
    });

    const sg = gp - gc;
    const sgStr = (sg >= 0 ? "+" : "") + sg;
    const maxPts = totalFiltered * 3;
    const pts = wins * 3 + draws * 1;
    const pct = maxPts > 0 ? ((pts / maxPts) * 100).toFixed(1) + "%" : "0.0%";

    setText("summary-filtered-count", String(totalFiltered));
    setText("summary-filtered-record", `${wins}V · ${draws}E · ${losses}D`);
    setText("summary-filtered-goals", `${gp} GP / ${gc} GC (${sgStr} SG)`);
    setText("summary-filtered-pct", pct);

    if (filtered.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted); padding:16px;">Nenhuma partida encontrada para os filtros selecionados.</p>`;
      return;
    }

    container.innerHTML = filtered.map(m => {
      const resClass = m.resultado_css || Domain.getResultMeta(m.resultado_canonico).css;
      const motm = Domain.getManOfTheMatch(m);
      const motmHtml = motm ? `
        <div class="match-motm">
          <span class="motm-label"><i class="ph-fill ph-star"></i> Melhor em Campo:</span>
          <span class="player-display-name" onclick="event.stopPropagation(); window.TrackerApp.openPlayerModal(${motm.playerid})">${Domain.escapeHtml(motm.nome)}</span>
          <span class="rating-badge ${Domain.getRatingBadgeClass(motm.nota)}">${Domain.formatRating(motm.nota)}</span>
        </div>
      ` : "";

      const origemBadge = m.placar_origem === 'histórico anterior' 
        ? ' <span style="font-size:10.5px; color:var(--text-muted);" title="Placar recuperado do histórico anterior consolidado (partida rotacionada do buffer recente da EA)">· Histórico</span>'
        : (m.placar_origem === 'indisponível' ? ' <span style="font-size:10.5px; color:var(--sports-loss);">· Placar Indisponível</span>' : '');

      const isPending = m.placar_origem === 'indisponível' || 
                        m.placar === '-' || 
                        m.placar === 'Indisponível' || 
                        m.adversario === 'Dados indisponíveis' || 
                        m.adversario === 'Adversário';

      const actionButtons = isPending ? `
        <div style="display:flex; gap:0.5rem; margin-top:auto;">
          <button class="btn btn-sm" style="flex:1;" onclick="event.stopPropagation(); window.TrackerApp.openMatchModal(${m.id})">
            Ver Ficha
          </button>
          <button class="btn btn-sm btn-primary" style="flex:1; display:inline-flex; align-items:center; justify-content:center; gap:0.25rem;" onclick="event.stopPropagation(); window.TrackerApp.openCompleteMatchModal(${m.id})">
            <i class="ph-bold ph-pencil-simple"></i> Completar Placar
          </button>
        </div>
      ` : `
        <button class="btn btn-sm" style="margin-top:auto;" onclick="event.stopPropagation(); window.TrackerApp.openMatchModal(${m.id})">
          Ver Ficha Técnica
        </button>
      `;

      return `
        <div class="match-card" tabindex="0" role="button" aria-label="Ver ficha da partida ${Domain.escapeHtml(m.mandante)} contra ${Domain.escapeHtml(m.visitante)}" onclick="window.TrackerApp.openMatchModal(${m.id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.TrackerApp.openMatchModal(${m.id});}">
          <div class="match-card-top match-card-header">
            <span class="match-card-comp-date">${Domain.escapeHtml(m.competicao)} · ${Domain.escapeHtml(m.data)}${origemBadge}</span>
            <span class="badge badge-result ${resClass} result-badge">${Domain.escapeHtml(m.resultado)}</span>
          </div>
          <div class="match-card-teams match-teams-row">
            <div class="match-team-col home">
              ${Domain.renderTeamCrest(m.mandante, m.mandante_id, 'sm')}
              <span class="match-team-name">${Domain.escapeHtml(m.mandante)}</span>
            </div>
            <span class="match-score-pill">${Domain.escapeHtml(formatScore(m, " - "))}</span>
            <div class="match-team-col away">
              <span class="match-team-name away">${Domain.escapeHtml(m.visitante)}</span>
              ${Domain.renderTeamCrest(m.visitante, m.visitante_id, 'sm')}
            </div>
          </div>
          <div class="match-card-info">
            <div><strong>Artilheiro(s):</strong> ${Domain.escapeHtml(m.artilheiros || "Nenhum")}</div>
            <div style="color:var(--text-muted);">Goleiro: ${Domain.escapeHtml(m.goleiro || "—")}</div>
          </div>
          ${motmHtml}
          ${actionButtons}
        </div>
      `;
    }).join("");
  }

  function renderMatchLogsTable() {
    const logs = normalizedData.player_match_logs || [];
    const tbody = document.getElementById("logs-table-body");
    if (!tbody) return;

    // Preencher dropdown de partidas no filtro se necessário
    const matchSelect = document.getElementById("log-match-filter");
    if (matchSelect && matchSelect.children.length <= 1) {
      const matches = normalizedData.matches || [];
      matches.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = `${m.data} · ${m.adversario} (${m.placar})`;
        matchSelect.appendChild(opt);
      });
    }

    // Filtrar via Domain
    const filtered = Domain.filterMatchLogs(logs, logFilters);

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:24px; color:var(--text-muted);">Nenhum log encontrado para os filtros selecionados.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(log => {
      let assistDisplay = "";
      if (log.assistencias_partida === "N/D") {
        assistDisplay = `<span class="badge badge-nd" title="Não decomposto individualmente na base do save">N/D</span>`;
      } else {
        const n = Number(log.assistencias_partida) || 0;
        assistDisplay = `<span class="cell-num ${n > 0 ? 'cell-bold' : ''}" style="${n > 0 ? 'color: var(--brand-cyan);' : ''}">${n}</span>`;
      }

      return `
        <tr>
          <td><span style="font-family:var(--font-mono); font-size:12px;">${Domain.escapeHtml(log.data)}</span></td>
          <td><span style="font-size:12px; color:var(--text-secondary);">${Domain.escapeHtml(log.competicao)}</span></td>
          <td><strong>${Domain.escapeHtml(log.adversario)}</strong> <span style="font-size:11px; color:var(--text-muted);">(${log.mando || "C"})</span></td>
          <td class="cell-num cell-bold">${Domain.escapeHtml(log.placar)}</td>
          <td>
            <strong class="player-display-name" onclick="window.TrackerApp.openPlayerModal(${log.playerid})">${Domain.escapeHtml(log.nome)}</strong>
          </td>
          <td><span class="badge badge-pos">${Domain.escapeHtml(log.posicao_jogada)}</span></td>
          <td class="cell-num cell-bold">${log.minutos}'</td>
          <td class="cell-num cell-bold" style="${log.gols_partida > 0 ? 'color:var(--sports-win);' : ''}">${log.gols_partida}</td>
          <td class="cell-num">${assistDisplay}</td>
          <td class="cell-num cell-bold" style="${log.nota_partida >= 7.5 ? 'color:var(--sports-win);' : ''}">${Domain.formatRating(log.nota_partida)}</td>
        </tr>
      `;
    }).join("");
  }

  // ==========================================================================
  // ABA 4: COMPETIÇÕES & CLASSIFICAÇÕES
  // ==========================================================================
  function renderCompetitionsTab() {
    const club = normalizedData.club || {};
    const comps = club.competicoes_separadas || {};
    const liga = comps.liga || {};
    const pre = comps.pre_temporada || {};
    const standings = normalizedData.standings || {};

    const leagueTitle = club.liga || liga.nome || "Liga Nacional";
    const preTitle = pre.nome || pre.nome_torneio || pre.titulo || "Torneio de Pré-Temporada";

    setText("comp-league-title", `${leagueTitle} (Classificação Oficial)`);
    setText("comp-preseason-title", `${preTitle} (Fase Final)`);

    renderStandingsTable("laliga2-table-body", standings.laliga2 || []);

    const preseasonCard = document.getElementById("comp-preseason-card");
    const preseasonRows = standings.preseason || [];
    if (preseasonCard) {
      if (preseasonRows.length === 0) {
        preseasonCard.hidden = true;
        if (preseasonCard.style) preseasonCard.style.display = "none";
      } else {
        preseasonCard.hidden = false;
        if (preseasonCard.style) preseasonCard.style.display = "";
        renderStandingsTable("preseason-table-body", preseasonRows);
      }
    } else {
      renderStandingsTable("preseason-table-body", preseasonRows);
    }

    // Suporte a competições extras dinâmicas (ex: Copa Nacional, Torneios Continentais)
    const extraContainer = document.getElementById("extra-competitions-container");
    if (extraContainer) {
      const knownKeys = new Set(["laliga2", "preseason"]);
      const extraKeys = Object.keys(standings).filter(k => !knownKeys.has(k) && !k.startsWith("_") && Array.isArray(standings[k]) && standings[k].length > 0);
      if (extraKeys.length > 0) {
        extraContainer.innerHTML = extraKeys.map(k => {
          const title = k.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
          const tbodyId = `extra-comp-${k}-tbody`;
          return `
            <div class="card" style="margin-top: 20px;">
              <div class="card-header">
                <h2 class="card-title">${Domain.escapeHtml(title)}</h2>
              </div>
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th class="cell-num">Pos</th>
                      <th>Clube</th>
                      <th class="cell-num">PTS</th>
                      <th class="cell-num">J</th>
                      <th class="cell-num">V</th>
                      <th class="cell-num">E</th>
                      <th class="cell-num">D</th>
                      <th class="cell-num">GP</th>
                      <th class="cell-num">GC</th>
                      <th class="cell-num">SG</th>
                    </tr>
                  </thead>
                  <tbody id="${tbodyId}"></tbody>
                </table>
              </div>
            </div>
          `;
        }).join("");

        extraKeys.forEach(k => {
          renderStandingsTable(`extra-comp-${k}-tbody`, standings[k]);
        });
      } else {
        extraContainer.innerHTML = "";
      }
    }
  }

  function renderStandingsTable(tbodyId, tableRows) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (!tableRows || tableRows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:18px; color:var(--text-muted);">Dados da tabela não disponíveis.</td></tr>`;
      return;
    }

    const club = normalizedData.club || {};
    const clubKey = (club.nome || "").toLowerCase().split(" ")[0];
    const total = tableRows.length;

    tbody.innerHTML = tableRows.map((row, idx) => {
      const rowName = (row.nome_time || row.time || "").toLowerCase();
      const isOurClub = Boolean(clubKey && rowName.includes(clubKey));
      const rowClass = isOurClub ? "row-active-club" : "";
      const pos = Number(row.posicao || row.pos || (idx + 1));

      let zoneClass = "";
      if (pos <= 2) {
        zoneClass = "zone-promotion";
      } else if (pos >= 3 && pos <= 6) {
        zoneClass = "zone-playoffs";
      } else if (total > 6 && pos > total - 4) {
        zoneClass = "zone-relegation";
      }

      return `
        <tr class="${rowClass}">
          <td class="cell-num"><span class="pos-badge ${zoneClass}">${pos}</span></td>
          <td class="standings-club-cell">
            ${Domain.renderTeamCrest(row.nome_time || row.time, row.teamid || row.id, "sm")}
            <strong>${Domain.escapeHtml(row.nome_time || row.time || "-")}</strong>
          </td>
          <td class="cell-num cell-bold" style="color:var(--brand-cyan);">${row.pontos || 0}</td>
          <td class="cell-num">${row.jogos || 0}</td>
          <td class="cell-num">${row.vitorias || 0}</td>
          <td class="cell-num">${row.empates || 0}</td>
          <td class="cell-num">${row.derrotas || 0}</td>
          <td class="cell-num">${row.gols_pro || 0}</td>
          <td class="cell-num">${row.gols_contra || 0}</td>
          <td class="cell-num cell-bold" style="${(row.saldo_gols || 0) > 0 ? 'color:var(--sports-win);' : ''}">${(row.saldo_gols || 0) > 0 ? '+' : ''}${row.saldo_gols || 0}</td>
        </tr>
      `;
    }).join("");
  }

  // ==========================================================================
  // VALIDAÇÃO SILENCIOSA DE INTEGRIDADE (SILENT DATA HEALTH CHECK)
  // ==========================================================================
  function validateDataIntegritySilently() {
    const report = normalizedData.validation_report || {};
    const failedCount = report.total_falhas || 0;
    const statusBadge = document.getElementById("data-source-badge");
    const footerStatus = document.getElementById("footer-sync-status");

    if (failedCount > 0) {
      console.warn(`[FC Manager] Divergência(s) encontrada(s) no carregamento (${failedCount}):`, report.checks ? report.checks.filter(c => c.status_canonico === "falhou") : []);
      if (statusBadge) {
        statusBadge.textContent = `Atenção: ${failedCount} Divergência(s)`;
        statusBadge.className = "badge badge-result loss";
      }
      if (footerStatus) {
        footerStatus.textContent = `Status: ${failedCount} Inconsistência(s) Detectada(s)`;
        if (footerStatus.style) footerStatus.style.color = "var(--sports-loss)";
      }
    } else {
      if (statusBadge) {
        statusBadge.textContent = "Status: Dados Sincronizados";
        statusBadge.className = "badge badge-status-synced";
      }
      if (footerStatus) {
        footerStatus.textContent = "Status: Dados Sincronizados";
        if (footerStatus.style) footerStatus.style.color = "var(--sports-win)";
      }
    }
  }

  async function loadAvailableSaves() {
    try {
      const endpoints = localApiBase ? [`${localApiBase}/api/saves`] : ["/api/saves", "http://127.0.0.1:8080/api/saves"];
      for (const ep of endpoints) {
        try {
          const resp = await fetch(ep);
          if (resp.ok) {
            const body = await resp.json();
            if (body.saves && Array.isArray(body.saves)) {
              const names = body.saves.map(s => (typeof s === "string" ? s : s.filename || s.path));
              normalizedData.available_saves = names;
              const saveSelect = document.getElementById("select-save-file");
              if (saveSelect) {
                saveSelect.innerHTML = names.map(n => {
                  const isCurrent = n === normalizedData.save_file;
                  return `<option value="${Domain.escapeHtml(n)}" ${isCurrent ? 'selected' : ''}>${Domain.escapeHtml(n)}</option>`;
                }).join("");
              }
              const saveWrap = document.getElementById("save-selector-wrap");
              if (saveWrap && saveWrap.style) saveWrap.style.display = "flex";
              return;
            }
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn("Não foi possível carregar lista de saves remota:", e);
    }
  }

  // ==========================================================================
  // MODAL DE DETALHES DO JOGADOR (DRILL-DOWN SPORTS ANALYTICS)
  // ==========================================================================
  function openPlayerModal(playerid) {
    if (!normalizedData || !normalizedData.squad) return;
    const player = normalizedData.squad.find(p => p.playerid === playerid);
    if (!player) return;

    lastFocusedElement = document.activeElement;

    setText("modal-player-title", `${player.nome} (#${player.numero || '-'}) — ${player.posicao_principal}`);

    const body = document.getElementById("modal-player-body");
    if (!body) return;

    const logs = player.historico_partidas || [];
    const logsHtml = logs.length > 0
      ? logs.map(l => {
          let assistDisp = l.assistencias_partida === "N/D"
            ? `<span class="badge badge-nd">N/D</span>`
            : (l.assistencias_partida || 0);
          const ratingClass = Domain.getRatingBadgeClass(l.nota_partida);
          return `
            <tr>
              <td>${Domain.escapeHtml(l.data)}</td>
              <td>${Domain.escapeHtml(l.competicao || "-")}</td>
              <td>${Domain.escapeHtml(l.adversario)}</td>
              <td class="cell-num">${Domain.escapeHtml(l.placar || "-")}</td>
              <td class="cell-num cell-bold">${l.minutos}'</td>
              <td class="cell-num cell-bold" style="${l.gols_partida > 0 ? 'color:var(--sports-win);' : ''}">${l.gols_partida || 0}</td>
              <td class="cell-num">${assistDisp}</td>
              <td class="cell-num"><span class="rating-badge ${ratingClass}">${Domain.formatRating(l.nota_partida)}</span></td>
            </tr>
          `;
        }).join("")
      : `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:16px;">Atleta ainda não atuou em partidas nesta temporada.</td></tr>`;

    const per90Gols = Domain.formatNumber(player.gols_por_90 || 0);
    const calculatedAssists90 = player.assistencias_por_90 !== undefined
      ? player.assistencias_por_90
      : (player.minutos > 0 ? (player.assistencias * 90 / player.minutos) : 0);
    const per90Assists = Domain.formatNumber(calculatedAssists90);
    const per90GA = Domain.formatNumber(player.ga_por_90 || 0);
    const pctMin = player.pct_minutos || 0;
    const isCompared = comparedPlayerIds.includes(player.playerid);

    body.innerHTML = `
      <div class="player-modal-profile">
        ${Domain.renderPlayerFace(player, "lg")}
        <div class="player-modal-profile-info">
          <div class="player-modal-name">${Domain.escapeHtml(player.nome_completo || player.nome)}</div>
          <div class="player-modal-tags">
            <span class="badge badge-pos ${player.setor_canonico || 'meio'}">${Domain.escapeHtml(player.posicao_principal)}</span>
            <span class="badge-ovr-pill">${player.overall} OVR</span>
            <span class="player-modal-num">Camisa #${player.numero || '-'}</span>
            <span class="player-modal-country">${Domain.escapeHtml(player.nacionalidade || "")}</span>
          </div>
        </div>
        <button type="button" class="btn-compare-action ${isCompared ? 'active' : ''}" data-playerid="${player.playerid}" onclick="window.TrackerApp.toggleComparePlayer(${player.playerid});">
          ⇄ ${isCompared ? 'Remover da Comparação' : 'Comparar Atleta'}
        </button>
      </div>
      <div class="metrics-per90-grid">
        <div class="metric-per90-box">
          <div class="metric-per90-val">${per90Gols}</div>
          <div class="metric-per90-label">Gols / 90</div>
        </div>
        <div class="metric-per90-box">
          <div class="metric-per90-val">${per90Assists}</div>
          <div class="metric-per90-label">Assists / 90</div>
        </div>
        <div class="metric-per90-box">
          <div class="metric-per90-val">${per90GA}</div>
          <div class="metric-per90-label">G+A / 90</div>
        </div>
        <div class="metric-per90-box">
          <div class="metric-per90-val">${pctMin}%</div>
          <div class="metric-per90-label">% Minutos Jogados</div>
        </div>
      </div>

      <div class="grid-2col">
        <div class="detail-block">
          <div class="detail-block-title">Identidade & Contrato</div>
          <div class="detail-row"><span class="detail-label">Nome Completo</span><span class="detail-val">${Domain.escapeHtml(player.nome_completo || player.nome)}</span></div>
          <div class="detail-row"><span class="detail-label">Nacionalidade</span><span class="detail-val">${Domain.escapeHtml(player.nacionalidade || "-")}</span></div>
          <div class="detail-row"><span class="detail-label">Idade / Nasc.</span><span class="detail-val">${player.idade} anos (${Domain.escapeHtml(player.data_nascimento || "-")})</span></div>
          <div class="detail-row"><span class="detail-label">Físico</span><span class="detail-val">${player.altura} cm · ${player.peso} kg</span></div>
          <div class="detail-row"><span class="detail-label">Pé Preferido</span><span class="detail-val">${Domain.escapeHtml(player.pe_preferido || "-")} (Perna Ruim: ${player.perna_ruim || "-"}★)</span></div>
          <div class="detail-row"><span class="detail-label">Valor de Mercado</span><span class="detail-val" style="color:var(--brand-cyan);">${Domain.formatCurrency(player.valor_mercado || 0)}</span></div>
          <div class="detail-row"><span class="detail-label">Salário Semanal</span><span class="detail-val">${Domain.formatCurrency(player.salario || 0)} /sem</span></div>
          <div class="detail-row"><span class="detail-label">Multa Rescisória</span><span class="detail-val">${Domain.escapeHtml(player.multa_texto || "Sem multa")}</span></div>
          <div class="detail-row"><span class="detail-label">Vencimento Contrato</span><span class="detail-val">${Domain.escapeHtml(String(player.contrato_fim || "-"))} (${player.anos_contrato || 0} ano(s) restantes)</span></div>
        </div>

        <div class="detail-block">
          <div class="detail-block-title">Status Técnico & Atributos</div>
          <div class="detail-row"><span class="detail-label">Posição Principal</span><span class="detail-val"><span class="badge badge-pos ${player.setor_canonico || 'meio'}">${Domain.escapeHtml(player.posicao_principal)}</span></span></div>
          <div class="detail-row"><span class="detail-label">Posições Secundárias</span><span class="detail-val">${Domain.escapeHtml(player.posicoes_secundarias || "—")}</span></div>
          <div class="detail-row"><span class="detail-label">Overall Atual / Inicial</span><span class="detail-val">${player.overall} (Inicial: ${player.overall_inicial || player.overall})</span></div>
          <div class="detail-row"><span class="detail-label">Potencial / Margem</span><span class="detail-val">${player.potencial} (+${player.margem_potencial || 0})</span></div>
          <div class="detail-row"><span class="detail-label">Evolução Real na Carreira</span><span class="detail-val" style="color:var(--sports-win); font-weight:700;">+${player.evolucao_real || 0} OVR</span></div>
          <div class="detail-row"><span class="detail-label">Jogos na Temporada</span><span class="detail-val">${player.jogos || 0} (${player.jogos_titular || 0} Titular / ${player.jogos_reserva || 0} Reserva)</span></div>
          <div class="detail-row"><span class="detail-label">Minutos Totais</span><span class="detail-val">${player.minutos || 0}'</span></div>
          <div class="detail-row"><span class="detail-label">Participações em Gols</span><span class="detail-val" style="color:var(--brand-cyan);">${player.gols || 0} Gols · ${player.assistencias || 0} Assists</span></div>
          <div class="detail-row"><span class="detail-label">Nota Média</span><span class="detail-val"><span class="rating-badge ${Domain.getRatingBadgeClass(player.nota_media)}">${Domain.formatRating(player.nota_media)}</span></span></div>
        </div>
      </div>

      <div class="detail-block">
        <div class="detail-block-title">Histórico de Partidas do Atleta</div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Competição</th>
                <th>Adversário</th>
                <th class="cell-num">Placar</th>
                <th class="cell-num">Minutos</th>
                <th class="cell-num">Gols</th>
                <th class="cell-num">Assists</th>
                <th class="cell-num">Nota</th>
              </tr>
            </thead>
            <tbody>
              ${logsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const modal = document.getElementById("modal-player");
    if (modal) {
      modal.classList.add("open");
      const closeBtn = modal.querySelector(".modal-close");
      if (closeBtn) closeBtn.focus();
    }
  }

  // ==========================================================================
  // MODAL DE DETALHES DA PARTIDA
  // ==========================================================================
  function openMatchModal(matchId) {
    if (!normalizedData || !normalizedData.matches) return;
    const match = normalizedData.matches.find(m => m.id === matchId);
    if (!match) return;

    lastFocusedElement = document.activeElement;

    setText("modal-match-title", `${match.mandante} ${formatScore(match, " x ")} ${match.visitante} — ${match.data}`);

    const body = document.getElementById("modal-match-body");
    if (!body) return;

    const escalacao = match.escalacao || [];
    const starters = escalacao.filter(e => {
      const pos = String(e.posicao_jogada || e.posicao || "").toUpperCase();
      return !pos.includes("(SUB)");
    });
    const substitutes = escalacao.filter(e => {
      const pos = String(e.posicao_jogada || e.posicao || "").toUpperCase();
      return pos.includes("(SUB)");
    });

    function renderLineupTable(list) {
      if (!list || list.length === 0) {
        return `<p style="color:var(--text-muted); font-size:12px; padding:8px;">Nenhum atleta nesta categoria.</p>`;
      }
      return `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th class="cell-num">Nº</th>
                <th>Jogador</th>
                <th>Posição</th>
                <th class="cell-num">Minutos</th>
                <th class="cell-num">Gols</th>
                <th class="cell-num">Assists</th>
                <th class="cell-num">Nota</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(e => {
                const assistVal = e.assistencias_partida === "N/D" ? `<span class="badge badge-nd">N/D</span>` : (e.assistencias_partida || 0);
                const posClean = String(e.posicao_jogada || e.posicao || "").replace(/\(SUB\)/g, "").trim();
                const ratingClass = Domain.getRatingBadgeClass(e.nota_partida);
                return `
                  <tr>
                    <td class="cell-num">${e.numero || '-'}</td>
                    <td><strong class="player-display-name" onclick="window.TrackerApp.openPlayerModal(${e.playerid})">${Domain.escapeHtml(e.nome)}</strong></td>
                    <td><span class="badge badge-pos">${Domain.escapeHtml(posClean)}</span></td>
                    <td class="cell-num cell-bold">${e.minutos}'</td>
                    <td class="cell-num cell-bold" style="${e.gols_partida > 0 ? 'color:var(--sports-win);' : ''}">${e.gols_partida || 0}</td>
                    <td class="cell-num">${assistVal}</td>
                    <td class="cell-num"><span class="rating-badge ${ratingClass}">${Domain.formatRating(e.nota_partida)}</span></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    const motm = Domain.getManOfTheMatch(match);
    const motmHighlight = motm ? `
      <div class="detail-row">
        <span class="detail-label" style="color:#f59e0b;"><i class="ph-fill ph-star"></i> Melhor em Campo</span>
        <span class="detail-val">
          <strong class="player-display-name" onclick="window.TrackerApp.openPlayerModal(${motm.playerid})">${Domain.escapeHtml(motm.nome)}</strong>
          <span class="rating-badge ${Domain.getRatingBadgeClass(motm.nota)}" style="margin-left:6px;">${Domain.formatRating(motm.nota)}</span>
        </span>
      </div>
    ` : "";

    const isPending = match.placar_origem === 'indisponível' || 
                      match.placar === '-' || 
                      match.placar === 'Indisponível' || 
                      match.adversario === 'Dados indisponíveis' || 
                      match.adversario === 'Adversário';

    const completeBanner = isPending ? `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239, 68, 68, 0.3); border-radius:8px; padding:0.75rem 1rem; margin-bottom:1rem;">
        <span style="font-size:0.85rem; color:var(--text-secondary);"><i class="ph-bold ph-warning-circle" style="color:var(--sports-loss);"></i> Esta partida está com adversário ou placar pendente.</span>
        <button class="btn btn-sm btn-primary" onclick="window.TrackerApp.openCompleteMatchModal(${match.id});">
          <i class="ph-bold ph-pencil-simple"></i> Completar Placar
        </button>
      </div>
    ` : `
      <div style="display:flex; justify-content:flex-end; margin-bottom:0.75rem;">
        <button class="btn btn-sm btn-ghost" style="font-size:11.5px; color:var(--text-muted);" onclick="window.TrackerApp.openCompleteMatchModal(${match.id});">
          <i class="ph-bold ph-pencil-simple"></i> Editar Placar / Adversário
        </button>
      </div>
    `;

    body.innerHTML = `
      ${completeBanner}
      <div class="detail-block">
        <div class="detail-block-title">Resumo do Confronto</div>
        <div class="detail-row"><span class="detail-label">Competição</span><span class="detail-val">${Domain.escapeHtml(match.competicao)}</span></div>
        <div class="detail-row"><span class="detail-label">Data</span><span class="detail-val">${Domain.escapeHtml(match.data)}</span></div>
        <div class="detail-row"><span class="detail-label">Placar Oficial</span><span class="detail-val" style="font-size:18px; color:var(--brand-cyan);">${Domain.escapeHtml(match.placar)}</span></div>
        <div class="detail-row"><span class="detail-label">Origem do Placar</span><span class="detail-val" style="font-size:12px; color:var(--text-muted);">${match.placar_origem === 'save' ? 'Save Atual (Buffer Recente EA)' : (match.placar_origem === 'histórico anterior' ? 'Histórico Anterior Consolidado' : 'Dados Indisponíveis no Save')}</span></div>
        <div class="detail-row"><span class="detail-label">Artilheiros</span><span class="detail-val" style="color:var(--sports-win);">${Domain.escapeHtml(match.artilheiros || "Nenhum")}</span></div>
        <div class="detail-row"><span class="detail-label">Goleiro</span><span class="detail-val">${Domain.escapeHtml(match.goleiro || "-")}</span></div>
        ${motmHighlight}
      </div>

      <div class="detail-block">
        <div class="lineup-section-title">
          <span>Titulares (${starters.length})</span>
        </div>
        ${renderLineupTable(starters)}
      </div>

      <div class="detail-block">
        <div class="lineup-section-title">
          <span>Reservas Utilizados (${substitutes.length})</span>
        </div>
        ${substitutes.length > 0 ? renderLineupTable(substitutes) : '<p style="color:var(--text-muted); padding:10px 0; font-size:12.5px;">Nenhuma substituição realizada nesta partida.</p>'}
      </div>
    `;

    const modal = document.getElementById("modal-match");
    if (modal) {
      modal.classList.add("open");
      const closeBtn = modal.querySelector(".modal-close");
      if (closeBtn) closeBtn.focus();
    }
  }

  function closeModal(modalEl) {
    if (!modalEl) {
      document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("open"));
    } else {
      modalEl.classList.remove("open");
    }
    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }

  // ==========================================================================
  // MODAL PARA COMPLETAR / EDITAR PLACAR E ADVERSÁRIO DA PARTIDA
  // ==========================================================================
  function openCompleteMatchModal(matchId) {
    if (!normalizedData || !normalizedData.matches) return;
    const match = normalizedData.matches.find(m => m.id === matchId);
    if (!match) return;

    lastFocusedElement = document.activeElement;

    // Se o modal da ficha técnica estiver aberto, fecha
    const matchModal = document.getElementById("modal-match");
    if (matchModal && matchModal.classList.contains("open")) {
      matchModal.classList.remove("open");
    }

    const modal = document.getElementById("modal-complete-match");
    if (!modal) return;

    const idInput = document.getElementById("edit-match-id");
    const dateIntInput = document.getElementById("edit-match-date-int");
    const dateInput = document.getElementById("edit-match-date");
    const compInput = document.getElementById("edit-match-competition");
    const oppSelect = document.getElementById("edit-match-opponent");
    const venueSelect = document.getElementById("edit-match-venue");
    const scoreHome = document.getElementById("edit-score-home");
    const scoreAway = document.getElementById("edit-score-away");
    const lblHome = document.getElementById("lbl-score-home");
    const lblAway = document.getElementById("lbl-score-away");

    if (idInput) idInput.value = match.id;
    if (dateIntInput) dateIntInput.value = match.date_int || "";
    if (dateInput) dateInput.value = match.data || "";
    const compName = match.competicao || "LaLiga Hypermotion";
    if (compInput) compInput.value = compName;

    // Coletar clubes da competição para popular o dropdown de adversários
    if (oppSelect) {
      const clubId = (normalizedData.club && normalizedData.club.id) || 114554;
      const teamMap = new Map();

      // De standings
      if (normalizedData.standings) {
        Object.values(normalizedData.standings).forEach(val => {
          if (Array.isArray(val)) {
            val.forEach(row => {
              const tid = row.teamid || row.team_id;
              const tname = row.time || row.nome;
              if (tid && tname && tid !== clubId) {
                teamMap.set(tid, tname);
              }
            });
          }
        });
      }

      // De club_competitions se disponível
      if (normalizedData.club_competitions && Array.isArray(normalizedData.club_competitions)) {
        normalizedData.club_competitions.forEach(c => {
          if (c.tabela && Array.isArray(c.tabela)) {
            c.tabela.forEach(row => {
              const tid = row.teamid || row.team_id;
              const tname = row.time || row.nome;
              if (tid && tname && tid !== clubId) {
                teamMap.set(tid, tname);
              }
            });
          }
        });
      }

      // De matches conhecidas
      if (normalizedData.matches) {
        normalizedData.matches.forEach(m => {
          if (m.adversario && m.adversario !== "Adversário" && m.adversario !== "Dados indisponíveis" && m.adversario !== "-") {
            const oppId = m.opp_id || (m.mandante === normalizedData.club.nome ? m.visitante_id : m.mandante_id);
            if (oppId && oppId !== clubId) {
              teamMap.set(oppId, m.adversario);
            }
          }
        });
      }

      const sortedTeams = Array.from(teamMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
      oppSelect.innerHTML = `<option value="">Selecione o adversário...</option>` +
        sortedTeams.map(([tid, tname]) => {
          const isSelected = (match.opp_id && match.opp_id === tid) || (match.adversario && match.adversario.toLowerCase() === tname.toLowerCase());
          return `<option value="${tid}" data-name="${Domain.escapeHtml(tname)}" ${isSelected ? "selected" : ""}>${Domain.escapeHtml(tname)}</option>`;
        }).join("");
    }

    // Mando de campo
    const isAway = (match.mando || "").toLowerCase().includes("fora") || match.visitante === (normalizedData.club && normalizedData.club.nome);
    if (venueSelect) {
      venueSelect.value = isAway ? "Fora" : "Casa";
    }

    // Calcular gols do clube a partir dos logs / escalação
    let clubGoals = 0;
    if (match.escalacao && match.escalacao.length > 0) {
      clubGoals = match.escalacao.reduce((sum, p) => sum + (Number(p.gols_partida) || Number(p.gols) || 0), 0);
    }
    if (match.gols_pro !== null && match.gols_pro !== undefined && match.gols_pro > 0) {
      clubGoals = match.gols_pro;
    }

    function updateScoreLabels() {
      const curMando = venueSelect ? venueSelect.value : (isAway ? "Fora" : "Casa");
      const clubName = (normalizedData.club && normalizedData.club.nome) || "FC Andorra";
      const oppOption = oppSelect && oppSelect.selectedOptions && oppSelect.selectedOptions[0];
      const oppName = (oppOption && oppOption.getAttribute("data-name")) || match.adversario || "Adversário";

      if (curMando === "Casa") {
        if (lblHome) lblHome.textContent = `${clubName} (Mandante)`;
        if (lblAway) lblAway.textContent = `${oppName} (Visitante)`;
        if (scoreHome) scoreHome.value = clubGoals;
        if (scoreAway && (scoreAway.value === "" || scoreAway.value == null)) {
          scoreAway.value = (match.gols_contra !== null && match.gols_contra !== undefined) ? match.gols_contra : 0;
        }
      } else {
        if (lblHome) lblHome.textContent = `${oppName} (Mandante)`;
        if (lblAway) lblAway.textContent = `${clubName} (Visitante)`;
        if (scoreAway) scoreAway.value = clubGoals;
        if (scoreHome && (scoreHome.value === "" || scoreHome.value == null)) {
          scoreHome.value = (match.gols_contra !== null && match.gols_contra !== undefined) ? match.gols_contra : 0;
        }
      }
    }

    updateScoreLabels();

    if (venueSelect && !venueSelect._listenerBound) {
      venueSelect._listenerBound = true;
      venueSelect.addEventListener("change", updateScoreLabels);
    }
    if (oppSelect && !oppSelect._listenerBound) {
      oppSelect._listenerBound = true;
      oppSelect.addEventListener("change", updateScoreLabels);
    }

    modal.classList.add("open");
    const firstField = oppSelect || scoreHome;
    if (firstField) firstField.focus();
  }

  async function saveCompleteMatch() {
    const idInput = document.getElementById("edit-match-id");
    const dateIntInput = document.getElementById("edit-match-date-int");
    const dateInput = document.getElementById("edit-match-date");
    const oppSelect = document.getElementById("edit-match-opponent");
    const venueSelect = document.getElementById("edit-match-venue");
    const scoreHome = document.getElementById("edit-score-home");
    const scoreAway = document.getElementById("edit-score-away");
    const compInput = document.getElementById("edit-match-competition");

    if (!oppSelect || !oppSelect.value) {
      showToast("Por favor, selecione o clube adversário.", "warning");
      return;
    }

    const matchId = Number(idInput ? idInput.value : 0);
    const dateInt = Number(dateIntInput ? dateIntInput.value : 0);
    const oppId = Number(oppSelect.value);
    const oppOption = oppSelect.selectedOptions && oppSelect.selectedOptions[0];
    const oppName = oppOption ? (oppOption.getAttribute("data-name") || oppOption.textContent) : "Adversário";
    const mando = venueSelect ? venueSelect.value : "Casa";
    const homeScore = Number(scoreHome ? scoreHome.value : 0);
    const awayScore = Number(scoreAway ? scoreAway.value : 0);
    const comp = (compInput ? compInput.value : "") || "LaLiga Hypermotion";
    const dateStr = (dateInput ? dateInput.value : "") || "";

    const isHome = (mando === "Casa");
    const clubName = (normalizedData.club && normalizedData.club.nome) || "FC Andorra";
    const gp = isHome ? homeScore : awayScore;
    const gc = isHome ? awayScore : homeScore;
    const resultado = gp > gc ? "Vitória" : (gp === gc ? "Empate" : "Derrota");

    const payload = {
      match_id: matchId,
      date_int: dateInt,
      data: dateStr,
      club_id: (normalizedData.club && normalizedData.club.id) || 114554,
      club_name: clubName,
      opp_id: oppId,
      opp_name: oppName,
      mando: mando,
      placar_mandante: homeScore,
      placar_visitante: awayScore,
      competicao: comp,
      tipo_competicao: comp.includes("Liga") ? "Liga Nacional" : "Pré-Temporada / Copa",
      rodada: `Rodada ${matchId}`
    };

    // 1. Tentar salvar no servidor local Python (/api/match_update)
    let savedOnServer = false;
    const endpoints = localApiBase ? [`${localApiBase}/api/match_update`] : ["/api/match_update", "http://127.0.0.1:8080/api/match_update"];
    for (const ep of endpoints) {
      try {
        const resp = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (resp.ok) {
          const res = await resp.json();
          if (res.career_data) {
            rawData = res.career_data;
            isLocalServer = true;
            processAndRender();
            savedOnServer = true;
            showToast(`Placar contra o ${oppName} (${homeScore} x ${awayScore}) salvo e consolidado com sucesso no ledger!`, "success");
            break;
          }
        }
      } catch (e) {}
    }

    // 2. Se estiver no GitHub Pages ou offline: salvar no localStorage e atualizar a tela
    if (!savedOnServer) {
      try {
        const overridesStr = localStorage.getItem("fc_match_overrides") || "{}";
        const overrides = JSON.parse(overridesStr);
        overrides[dateInt] = {
          opp_id: oppId,
          opp_name: oppName,
          adversario: oppName,
          mando: mando,
          mandante: isHome ? clubName : oppName,
          visitante: isHome ? oppName : clubName,
          placar_mandante: homeScore,
          placar_visitante: awayScore,
          placar: `${homeScore} x ${awayScore}`,
          gols_pro: gp,
          gols_contra: gc,
          resultado: resultado,
          placar_origem: "manual"
        };
        localStorage.setItem("fc_match_overrides", JSON.stringify(overrides));

        // Aplicar imediatamente nos dados ativos
        if (rawData && Array.isArray(rawData.matches)) {
          const target = rawData.matches.find(m => m.id === matchId || m.date_int === dateInt);
          if (target) {
            Object.assign(target, overrides[dateInt]);
          }
        }
        processAndRender();
        showToast(`Placar contra o ${oppName} salvo localmente! Você pode exportar o arquivo JSON atualizado.`, "success");
      } catch (err) {
        console.error("Erro ao salvar override:", err);
        showToast("Erro ao salvar dados localmente.", "error");
      }
    }

    const modal = document.getElementById("modal-complete-match");
    if (modal) closeModal(modal);
  }

  // ==========================================================================
  // COMPARADOR DE ATLETAS (HEAD-TO-HEAD)
  // ==========================================================================
  let comparedPlayerIds = [];

  function toggleComparePlayer(playerId) {
    playerId = Number(playerId);
    const squad = (normalizedData && normalizedData.squad) || [];
    const player = squad.find(p => p.playerid === playerId);
    if (!player) return;

    const idx = comparedPlayerIds.indexOf(playerId);
    if (idx >= 0) {
      comparedPlayerIds.splice(idx, 1);
      showToast(`${player.nome} removido da comparação.`, "info");
    } else {
      if (comparedPlayerIds.length >= 2) {
        comparedPlayerIds = [comparedPlayerIds[1], playerId];
      } else {
        comparedPlayerIds.push(playerId);
      }
      showToast(`${player.nome} selecionado para comparação (${comparedPlayerIds.length}/2).`, "info");
    }

    updateCompareUI();

    if (comparedPlayerIds.length === 2) {
      openCompareModal(comparedPlayerIds[0], comparedPlayerIds[1]);
    }
  }

  function clearCompare() {
    comparedPlayerIds = [];
    updateCompareUI();
    const modal = document.getElementById("modal-compare");
    if (modal && modal.classList.contains("open")) {
      closeModal(modal);
    }
    showToast("Seleção de comparação limpa.", "info");
  }

  function updateCompareUI() {
    const squad = (normalizedData && normalizedData.squad) || [];

    // Atualizar botões nas linhas da tabela
    document.querySelectorAll(".btn-compare-player").forEach(btn => {
      const pid = Number(btn.getAttribute("data-playerid"));
      if (comparedPlayerIds.includes(pid)) {
        btn.classList.add("active");
        btn.setAttribute("title", "Remover da comparação");
      } else {
        btn.classList.remove("active");
        btn.setAttribute("title", "Comparar jogador (Head-to-Head)");
      }
    });

    // Atualizar botões no modal de atleta
    document.querySelectorAll(".btn-compare-action").forEach(btn => {
      const pid = Number(btn.getAttribute("data-playerid"));
      if (comparedPlayerIds.includes(pid)) {
        btn.classList.add("active");
        btn.textContent = "Remover da Comparação";
      } else {
        btn.classList.remove("active");
        btn.textContent = "Comparar Atleta (Head-to-Head)";
      }
    });

    // Atualizar bandeja flutuante
    const tray = document.getElementById("compare-floating-tray");
    const trayText = document.getElementById("compare-tray-text");
    if (tray && trayText) {
      if (comparedPlayerIds.length === 0) {
        tray.style.display = "none";
      } else if (comparedPlayerIds.length === 1) {
        tray.style.display = "flex";
        const p1 = squad.find(p => p.playerid === comparedPlayerIds[0]);
        const name1 = p1 ? Domain.escapeHtml(p1.nome) : "Atleta";
        trayText.innerHTML = `1/2 Selecionado: <strong>${name1}</strong> (Selecione o 2º atleta na tabela)`;
      } else if (comparedPlayerIds.length === 2) {
        tray.style.display = "flex";
        const p1 = squad.find(p => p.playerid === comparedPlayerIds[0]);
        const p2 = squad.find(p => p.playerid === comparedPlayerIds[1]);
        const name1 = p1 ? Domain.escapeHtml(p1.nome) : "Atleta 1";
        const name2 = p2 ? Domain.escapeHtml(p2.nome) : "Atleta 2";
        trayText.innerHTML = `Comparando: <strong>${name1}</strong> vs <strong>${name2}</strong>`;
      }
    }
  }

  function openCompareModal(p1Id, p2Id) {
    if (!p1Id && !p2Id) {
      if (comparedPlayerIds.length < 2) {
        showToast("Selecione 2 jogadores para abrir o comparativo Head-to-Head.", "info");
        return;
      }
      p1Id = comparedPlayerIds[0];
      p2Id = comparedPlayerIds[1];
    } else if (p1Id && !p2Id) {
      if (comparedPlayerIds.length === 2) {
        p2Id = comparedPlayerIds.find(id => id !== p1Id);
      } else {
        showToast("Selecione outro atleta para comparar.", "info");
        return;
      }
    }

    const squad = (normalizedData && normalizedData.squad) || [];
    const p1 = squad.find(p => p.playerid === Number(p1Id));
    const p2 = squad.find(p => p.playerid === Number(p2Id));
    if (!p1 || !p2) return;

    lastFocusedElement = document.activeElement;

    const modal = document.getElementById("modal-compare");
    const body = document.getElementById("modal-compare-body");
    if (!modal || !body) return;

    function renderAttrBox(label, v1, v2, disp1, disp2, highlightHigher = true) {
      const num1 = Number(v1) || 0;
      const num2 = Number(v2) || 0;
      const win1 = highlightHigher && num1 > num2;
      const win2 = highlightHigher && num2 > num1;
      return `
        <div class="compare-attr-box">
          <div class="compare-attr-title">${label}</div>
          <div class="compare-attr-values">
            <span class="compare-val ${win1 ? 'winner' : ''}">${disp1}</span>
            <span class="compare-val-divider">vs</span>
            <span class="compare-val ${win2 ? 'winner' : ''}">${disp2}</span>
          </div>
        </div>
      `;
    }

    function renderBarRow(label, v1, v2, disp1, disp2) {
      const num1 = Number(v1) || 0;
      const num2 = Number(v2) || 0;
      const maxVal = Math.max(num1, num2, 0.0001);
      const pct1 = Math.min(100, Math.round((num1 / maxVal) * 100));
      const pct2 = Math.min(100, Math.round((num2 / maxVal) * 100));
      const win1 = num1 > num2;
      const win2 = num2 > num1;

      return `
        <div class="compare-bar-row">
          <div class="compare-bar-meta">
            <span class="compare-bar-val ${win1 ? 'winner' : ''}">${disp1}</span>
            <span class="compare-bar-title">${label}</span>
            <span class="compare-bar-val ${win2 ? 'winner' : ''}">${disp2}</span>
          </div>
          <div class="compare-bar-track-wrap">
            <div class="compare-track-left">
              <div class="compare-bar-fill ${win1 ? 'winner' : ''}" style="width: ${pct1}%;"></div>
            </div>
            <div class="compare-track-divider"></div>
            <div class="compare-track-right">
              <div class="compare-bar-fill ${win2 ? 'winner' : ''}" style="width: ${pct2}%;"></div>
            </div>
          </div>
        </div>
      `;
    }

    const ga90_1 = p1.ga_por_90 !== undefined ? p1.ga_por_90 : (p1.minutos > 0 ? (((p1.gols || 0) + (p1.assistencias || 0)) * 90 / p1.minutos) : 0);
    const ga90_2 = p2.ga_por_90 !== undefined ? p2.ga_por_90 : (p2.minutos > 0 ? (((p2.gols || 0) + (p2.assistencias || 0)) * 90 / p2.minutos) : 0);

    body.innerHTML = `
      <div class="compare-header">
        <div class="compare-card-player left">
          ${Domain.renderPlayerFace(p1, "lg")}
          <div>
            <div class="compare-player-name">${Domain.escapeHtml(p1.nome)}</div>
            <div class="compare-player-meta">
              <span class="badge badge-pos ${p1.setor_canonico || 'meio'}">${Domain.escapeHtml(p1.posicao_principal)}</span>
              <span>${Domain.escapeHtml(p1.nacionalidade || "")}</span>
            </div>
          </div>
        </div>

        <div class="compare-vs-pill">VS</div>

        <div class="compare-card-player right">
          ${Domain.renderPlayerFace(p2, "lg")}
          <div>
            <div class="compare-player-name">${Domain.escapeHtml(p2.nome)}</div>
            <div class="compare-player-meta">
              <span class="badge badge-pos ${p2.setor_canonico || 'meio'}">${Domain.escapeHtml(p2.posicao_principal)}</span>
              <span>${Domain.escapeHtml(p2.nacionalidade || "")}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Grid de Atributos Básicos -->
      <div class="compare-attr-grid">
        ${renderAttrBox("Overall (OVR)", p1.overall, p2.overall, p1.overall, p2.overall)}
        ${renderAttrBox("Potencial (POT)", p1.potencial, p2.potencial, p1.potencial, p2.potencial)}
        ${renderAttrBox("Idade", p1.idade, p2.idade, `${p1.idade}a`, `${p2.idade}a`, false)}
        ${renderAttrBox("Valor Mercado", p1.valor_mercado, p2.valor_mercado, Domain.formatCurrency(p1.valor_mercado || 0), Domain.formatCurrency(p2.valor_mercado || 0))}
        ${renderAttrBox("Salário Semanal", p1.salario, p2.salario, `${Domain.formatCurrency(p1.salario || 0)}/sem`, `${Domain.formatCurrency(p2.salario || 0)}/sem`)}
      </div>

      <!-- Barras Horizontais Comparativas -->
      <div class="compare-bars-section">
        <div class="detail-block-title" style="margin-bottom: 0.5rem;">Desempenho Comparativo em Campo</div>
        ${renderBarRow("Minutos Jogados", p1.minutos, p2.minutos, `${p1.minutos || 0}'`, `${p2.minutos || 0}'`)}
        ${renderBarRow("Gols", p1.gols, p2.gols, p1.gols || 0, p2.gols || 0)}
        ${renderBarRow("Assistências", p1.assistencias, p2.assistencias, p1.assistencias || 0, p2.assistencias || 0)}
        ${renderBarRow("G+A por 90'", ga90_1, ga90_2, Domain.formatNumber(ga90_1), Domain.formatNumber(ga90_2))}
        ${renderBarRow("Nota Média", p1.nota_media, p2.nota_media, Domain.formatRating(p1.nota_media), Domain.formatRating(p2.nota_media))}
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 1.5rem;">
        <button type="button" class="btn btn-sm btn-ghost" onclick="window.TrackerApp.clearCompare();">Limpar Comparação</button>
        <button type="button" class="btn btn-sm btn-primary" onclick="window.TrackerApp.closeModal();">Fechar</button>
      </div>
    `;

    modal.classList.add("open");
    const closeBtn = modal.querySelector(".modal-close");
    if (closeBtn) closeBtn.focus();
  }

  // ==========================================================================
  // EVENT LISTENERS & INTERATIVIDADE
  // ==========================================================================
  function switchTab(targetTab, updateHash = true) {
    if (!targetTab) return;
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabPanes = document.querySelectorAll(".tab-pane");

    tabButtons.forEach(b => {
      if (b.getAttribute("data-tab") === targetTab) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });

    tabPanes.forEach(p => {
      if (p.id === `tab-${targetTab}`) {
        p.classList.add("active");
      } else {
        p.classList.remove("active");
      }
    });

    activeTab = targetTab;

    if (updateHash) {
      const targetHash = TAB_TO_HASH[targetTab] || `#${targetTab}`;
      if (window.location.hash !== targetHash) {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", targetHash);
        } else {
          window.location.hash = targetHash;
        }
      }
    }
  }

  function setupTabNavigation() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const targetTab = btn.getAttribute("data-tab");
        if (targetTab) {
          switchTab(targetTab, true);
        }
      });
    });

    // Hash routing: escutar mudanças de hash no navegador (#visao-geral, #elenco, etc.)
    if (typeof window.addEventListener === "function") {
      window.addEventListener("hashchange", () => {
        const currentHash = (window.location.hash || "").toLowerCase();
        const mappedTab = TAB_HASH_MAP[currentHash];
        if (mappedTab && mappedTab !== activeTab) {
          switchTab(mappedTab, false);
        }
      });
    }

    // Verificar hash inicial ao carregar a página
    const initialHash = (window.location && window.location.hash ? window.location.hash : "").toLowerCase();
    if (initialHash && TAB_HASH_MAP[initialHash]) {
      switchTab(TAB_HASH_MAP[initialHash], false);
    }
  }

  function setupModals() {
    // Fechar ao clicar no X ou fora da caixa de diálogo
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
      overlay.addEventListener("click", e => {
        if (e.target === overlay || e.target.closest(".modal-close")) {
          closeModal(overlay);
        }
      });
    });

    // Tecla Escape fecha qualquer modal aberto
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        const openModal = document.querySelector(".modal-overlay.open");
        if (openModal) {
          closeModal(openModal);
        }
      }
    });
  }

  function setupEventListeners() {
    // Alternador de Visão da Tabela (Desempenho vs Contratos)
    const btnPerf = document.getElementById("btn-view-performance");
    const btnContr = document.getElementById("btn-view-contracts");
    if (btnPerf && btnContr) {
      btnPerf.addEventListener("click", () => {
        squadViewMode = "performance";
        btnPerf.classList.add("active");
        btnPerf.setAttribute("aria-selected", "true");
        btnContr.classList.remove("active");
        btnContr.setAttribute("aria-selected", "false");
        renderSquadTab();
      });
      btnContr.addEventListener("click", () => {
        squadViewMode = "contracts";
        btnContr.classList.add("active");
        btnContr.setAttribute("aria-selected", "true");
        btnPerf.classList.remove("active");
        btnPerf.setAttribute("aria-selected", "false");
        renderSquadTab();
      });
    }

    // Filtro Rápido de Minutagem Relevante (>= 150 min)
    const minMinToggle = document.getElementById("squad-min-minutes-toggle");
    if (minMinToggle) {
      minMinToggle.addEventListener("change", e => {
        squadFilters.minMinutesOnly = e.target.checked;
        renderSquadTab();
      });
    }

    // Filtros do Elenco
    const squadSearch = document.getElementById("squad-search");
    if (squadSearch) {
      squadSearch.addEventListener("input", e => {
        squadFilters.search = e.target.value.trim();
        renderSquadTab();
      });
    }

    const squadSector = document.getElementById("squad-sector-filter");
    if (squadSector) {
      squadSector.addEventListener("change", e => {
        squadFilters.sector = e.target.value;
        renderSquadTab();
      });
    }

    const squadHierarchy = document.getElementById("squad-hierarchy-filter");
    if (squadHierarchy) {
      squadHierarchy.addEventListener("change", e => {
        squadFilters.hierarchy = e.target.value;
        renderSquadTab();
      });
    }

    // Ordenação clicável nos cabeçalhos da tabela do elenco
    document.querySelectorAll("#squad-table th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const sortField = th.getAttribute("data-sort");
        if (squadFilters.sortBy === sortField) {
          squadFilters.sortOrder = squadFilters.sortOrder === "asc" ? "desc" : "asc";
        } else {
          squadFilters.sortBy = sortField;
          squadFilters.sortOrder = "desc";
        }
        renderSquadTab();
      });
    });

    // Filtros de Partidas e Atuações
    const matchesComp = document.getElementById("matches-comp-filter");
    if (matchesComp) {
      matchesComp.addEventListener("change", e => {
        matchesCompFilter = e.target.value;
        renderMatchesGrid();
      });
    }

    const matchesVenue = document.getElementById("matches-venue-filter");
    if (matchesVenue) {
      matchesVenue.addEventListener("change", e => {
        matchesVenueFilter = e.target.value;
        renderMatchesGrid();
      });
    }

    const matchesResult = document.getElementById("matches-result-filter");
    if (matchesResult) {
      matchesResult.addEventListener("change", e => {
        matchesResultFilter = e.target.value;
        renderMatchesGrid();
      });
    }

    // Ação: Enviar Arquivo de Save para Análise
    const inputUpload = document.getElementById("input-save-upload");
    if (inputUpload) {
      inputUpload.addEventListener("change", e => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          handleSaveFileUpload(file);
          inputUpload.value = "";
        }
      });
    }

    // Suporte a Arrastar e Soltar (Drag & Drop) do arquivo de save diretamente na página
    if (typeof window.addEventListener === "function") {
      window.addEventListener("dragover", e => {
        if (e && e.preventDefault) e.preventDefault();
      });
      window.addEventListener("drop", e => {
        if (e && e.preventDefault) e.preventDefault();
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) {
          handleSaveFileUpload(file);
        }
      });
    }

    // Ação: Sincronizar Save
    const btnReload = document.getElementById("btn-reload-save");
    if (btnReload) {
      btnReload.addEventListener("click", async () => {
        setAppState(APP_STATE.LOADING);
        const endpoints = localApiBase ? [`${localApiBase}/api/reload`] : ["/api/reload", "http://127.0.0.1:8080/api/reload"];
        for (const ep of endpoints) {
          try {
            const resp = await fetch(ep);
            if (resp.ok) {
              rawData = await resp.json();
              isLocalServer = true;
              localApiBase = ep.includes("8080") ? "http://127.0.0.1:8080" : "";
              processAndRender();
              showToast("Dados do save sincronizados com sucesso!", "success");
              return;
            }
          } catch (e) {}
        }
        showToast("Ambiente estático (GitHub Pages): dados pré-compilados do repositório. Para sincronização ao vivo com o EA FC 26, execute 'iniciar_tracker.bat'!", "warning");
        setAppState(APP_STATE.LOADED);
      });
    }

    // Ação: Alternar Save Local
    const btnApplySave = document.getElementById("btn-apply-save");
    if (btnApplySave) {
      btnApplySave.addEventListener("click", async () => {
        const select = document.getElementById("select-save-file");
        if (!select) return;
        const selected = select.value;

        setAppState(APP_STATE.LOADING);
        const endpoints = localApiBase ? [`${localApiBase}/api/select_save`] : ["/api/select_save", "http://127.0.0.1:8080/api/select_save"];
        for (const ep of endpoints) {
          try {
            const resp = await fetch(ep, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ save_file: selected })
            });
            if (resp.ok) {
              rawData = await resp.json();
              isLocalServer = true;
              processAndRender();
              showToast(`Save alterado para ${selected}!`, "success");
              return;
            }
          } catch (e) {}
        }
        showToast(`No GitHub Pages o save ativo é fixo. Execute "iniciar_tracker.bat" para alternar para ${selected}.`, "warning");
        setAppState(APP_STATE.LOADED);
      });
    }
  }

  // ==========================================================================
  // HELPERS DE UI E TOASTS
  // ==========================================================================
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text !== undefined && text !== null ? text : "—";
  }

  /** Placar "M sep V" de uma partida normalizada; nunca produz "undefined". */
  function formatScore(match, sep) {
    const pm = match ? match.placar_mandante : null;
    const pv = match ? match.placar_visitante : null;
    if (pm === null || pm === undefined || pv === null || pv === undefined) return "-";
    return `${pm}${sep || " - "}${pv}`;
  }

  function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) {
      alert(message);
      return;
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(20px)";
      toast.style.transition = "all 0.25s ease";
      setTimeout(() => toast.remove(), 250);
    }, 4500);
  }

  // ==========================================================================
  // PROCESSAMENTO DE UPLOAD DE SAVE (CLIENT-SIDE & SERVIDOR LOCAL)
  // ==========================================================================
  let pyodideInstance = null;
  let pyodideLoadingPromise = null;

  async function getPyodide() {
    if (pyodideInstance) return pyodideInstance;
    if (pyodideLoadingPromise) return pyodideLoadingPromise;

    pyodideLoadingPromise = (async () => {
      if (typeof loadPyodide !== "function") {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
          s.onload = resolve;
          s.onerror = () => reject(new Error("Falha ao carregar motor Pyodide"));
          document.head.appendChild(s);
        });
      }

      const py = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
      });

      try {
        py.FS.mkdirTree("/src");
      } catch (e) {}

      const [parserPy, schemaMeta, playernames] = await Promise.all([
        fetch("src/save_parser.py").then(r => r.text()),
        fetch("src/schema_meta.json").then(r => r.text()),
        fetch("src/playernames.csv").then(r => r.text())
      ]);

      py.FS.writeFile("/src/save_parser.py", parserPy);
      py.FS.writeFile("/src/schema_meta.json", schemaMeta);
      py.FS.writeFile("/src/playernames.csv", playernames);

      pyodideInstance = py;
      return py;
    })();

    return pyodideLoadingPromise;
  }

  async function parseCmMgrInBrowser(file) {
    showToast("Decodificando save CmMgr no navegador via WebAssembly...", "info");
    const py = await getPyodide();
    const arrayBuffer = await file.arrayBuffer();
    py.FS.writeFile("/src/current_save", new Uint8Array(arrayBuffer));

    const jsonStr = py.runPython(`
import sys
if "/src" not in sys.path:
    sys.path.insert(0, "/src")
import save_parser
career_data = save_parser.parse_save_file("/src/current_save")
career_data["save_file"] = "${file.name}"
import json
json.dumps(career_data)
    `);

    return JSON.parse(jsonStr);
  }

  async function handleSaveFileUpload(file) {
    if (!file) return;

    const fileName = file.name || "";
    const fileNameLower = fileName.toLowerCase();
    const isJsonOrJs = fileNameLower.endsWith(".json") || fileNameLower.endsWith(".js") || (file.type && (file.type.includes("json") || file.type.includes("javascript")));

    if (isJsonOrJs) {
      // Processamento em tempo real de JSON/JS exportado
      try {
        showToast(`Analisando arquivo "${fileName}"...`, "info");
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const text = event.target.result;
            let parsed = null;
            if (fileNameLower.endsWith(".js") || text.includes("FALLBACK_CAREER_DATA")) {
              const match = text.match(/window\.FALLBACK_CAREER_DATA\s*=\s*(\{[\s\S]*\});?/);
              if (match) {
                parsed = JSON.parse(match[1]);
              } else {
                parsed = JSON.parse(text);
              }
            } else {
              parsed = JSON.parse(text);
            }

            if (!parsed || typeof parsed !== "object") {
              throw new Error("Conteúdo JSON vazio ou inválido.");
            }

            rawData = parsed;
            try {
              localStorage.setItem("fc_custom_career_data", JSON.stringify(parsed));
            } catch (e) {
              console.warn("Não foi possível persistir no localStorage:", e);
            }
            processAndRender();
            setText("current-save-name", fileName);
            showToast(`Save "${fileName}" analisado e carregado com sucesso!`, "success");
          } catch (parseErr) {
            console.error("Erro ao analisar arquivo:", parseErr);
            showToast("Estrutura do arquivo inválida. Forneça um save JSON válido.", "error");
          }
        };
        reader.readAsText(file);
      } catch (err) {
        console.error("Erro na leitura do arquivo:", err);
        showToast("Erro ao abrir arquivo de save.", "error");
      }
    } else {
      // Arquivo binário de save do EA FC 26 (CmMgr...)
      showToast(`Processando save CmMgr "${fileName}"...`, "info");

      // 1. Tentar decodificar via servidor local Python (/api/upload ou localhost:8080)
      let parsedData = null;
      const endpoints = localApiBase ? [`${localApiBase}/api/upload`] : ["/api/upload", "http://127.0.0.1:8080/api/upload"];
      for (const ep of endpoints) {
        try {
          const resp = await fetch(ep, {
            method: "POST",
            headers: {
              "X-Filename": fileName,
              "Content-Type": "application/octet-stream"
            },
            body: file
          });
          if (resp.ok) {
            parsedData = await resp.json();
            isLocalServer = true;
            localApiBase = ep.includes("8080") ? "http://127.0.0.1:8080" : "";
            break;
          }
        } catch (e) {
          // Tenta o próximo endpoint
        }
      }

      if (parsedData && typeof parsedData === "object" && !parsedData.error) {
        rawData = parsedData;
        processAndRender();
        loadAvailableSaves();
        setText("current-save-name", fileName);
        showToast(`Save CmMgr "${fileName}" lido e analisado com sucesso!`, "success");
        return;
      }

      // 2. Se o servidor local não responder, decodificar no navegador via WebAssembly (Pyodide)
      try {
        const wasmData = await parseCmMgrInBrowser(file);
        if (wasmData && typeof wasmData === "object") {
          rawData = wasmData;
          processAndRender();
          setText("current-save-name", fileName);
          showToast(`Save CmMgr "${fileName}" decodificado com sucesso no navegador!`, "success");
          return;
        }
      } catch (wasmErr) {
        console.warn("Tentativa de decodificação WebAssembly não concluída:", wasmErr);
      }

      // 3. Fallback informativo
      showToast("Para processar arquivos binários brutos (CmMgr), inicie o servidor local (python src/app.py) ou importe o arquivo .json exportado.", "warning");
    }
  }

  // Expor API global
  window.TrackerApp = {
    openPlayerModal,
    openMatchModal,
    openCompleteMatchModal,
    saveCompleteMatch,
    closeModal,
    showToast,
    getAppState: () => currentState,
    getNormalizedData: () => normalizedData,
    exportSquadToCsvClientSide,
    renderSquadTab,
    setSquadViewMode: mode => {
      squadViewMode = mode;
      renderSquadTab();
    },
    switchTab,
    handleSaveFileUpload,
    setPitchFormation: form => {
      selectedPitchFormation = form;
      renderTacticalPitch();
    },
    setMatchesResultFilter: filter => {
      matchesResultFilter = filter;
      renderMatchesGrid();
    },
    toggleComparePlayer,
    openCompareModal,
    clearCompare,
    getComparedPlayerIds: () => comparedPlayerIds
  };

})(window, document);
