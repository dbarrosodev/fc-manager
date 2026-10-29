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
  let activeTab = "overview";
  let squadViewMode = "performance"; // "performance" | "contracts"
  let matchesVenueFilter = "all"; // "all" | "home" | "away"

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

    // 1. Tentar API do servidor Python local
    try {
      const resp = await fetch("/api/data", { cache: "no-store" });
      if (resp.ok) {
        const json = await resp.json();
        if (json && typeof json === "object") {
          rawData = json;
          isLocalServer = true;
          updateSourceBadge("Servidor Local Ativo", "win");
          processAndRender();
          loadAvailableSaves();
          return;
        }
      }
    } catch (e) {
      // Ignora e tenta o próximo fallback
    }

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

    if (loadingBanner) loadingBanner.style.display = state === APP_STATE.LOADING ? "flex" : "none";
    if (errorBanner) {
      errorBanner.style.display = state === APP_STATE.ERROR ? "flex" : "none";
      if (errorMessageEl && errorMessage) errorMessageEl.textContent = errorMessage;
    }
    if (appContent) appContent.style.display = state === APP_STATE.LOADED ? "block" : "none";
  }

  function processAndRender() {
    try {
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
        compSet.add(m.competicao.trim());
      }
    });
    logs.forEach(l => {
      if (l.competicao && typeof l.competicao === "string") {
        compSet.add(l.competicao.trim());
      }
    });

    const uniqueComps = Array.from(compSet).sort();

    // 1. Dropdown de Partidas
    const matchesSelect = document.getElementById("matches-comp-filter");
    if (matchesSelect) {
      const currentVal = matchesCompFilter || "all";
      matchesSelect.innerHTML = `<option value="all">Todas as Competições</option>` +
        uniqueComps.map(c => `<option value="${Domain.escapeHtml(c)}" ${c === currentVal ? "selected" : ""}>${Domain.escapeHtml(c)}</option>`).join("");
    }

    // 2. Dropdown de Logs de Atuação
    const logsSelect = document.getElementById("log-comp-filter");
    if (logsSelect) {
      const currentVal = logFilters.competition || "all";
      logsSelect.innerHTML = `<option value="all">Todas as Competições</option>` +
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
    const squad = normalizedData.squad || [];

    setText("club-crest", getInitials(club.nome));
    if (club.logoUrl) {
      const crestEl = document.getElementById("club-crest");
      if (crestEl) {
        crestEl.innerHTML = `<img src="${Domain.escapeHtml(club.logoUrl)}" alt="${Domain.escapeHtml(club.nome || "Clube")}" class="club-crest-img">`;
      }
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
    setText("stat-goals-total", `${club.total_gols_elenco || 0} GP · ${club.total_assistencias_elenco || 0} Assists`);
    const topScorer = [...squad].sort((a, b) => (b.gols || 0) - (a.gols || 0))[0];
    const topAssister = [...squad].sort((a, b) => (b.assistencias || 0) - (a.assistencias || 0))[0];
    setText("stat-top-scorer", topScorer && (topScorer.gols || 0) > 0 ? `${topScorer.nome} (${topScorer.gols})` : "—");
    setText("stat-top-assister", topAssister && (topAssister.assistencias || 0) > 0 ? `${topAssister.nome} (${topAssister.assistencias})` : "—");
    setText("stat-goals-sub", `${club.total_gols_elenco || 0} Gols Marcados`);

    // 4. KPI Finanças & Grupo
    setText("stat-squad-value", Domain.formatCurrency(club.valor_elenco_total || 0));
    setText("stat-wage-bill", `${Domain.formatCurrency(club.folha_salarial_semanal || 0)} /sem`);
    const avgOvrVal = squad.length > 0 ? (squad.reduce((a, p) => a + (p.overall || 0), 0) / squad.length).toFixed(1) : "—";
    const avgAgeVal = squad.length > 0 ? (squad.reduce((a, p) => a + (p.idade || 0), 0) / squad.length).toFixed(1) : "—";
    setText("stat-squad-averages", `${avgOvrVal} OVR · ${avgAgeVal} anos`);
    setText("stat-squad-count-sub", `${squad.length} Jogadores no Elenco`);

    setText("stat-preseason-record", pre.titulo || "Concluída");
    setText("stat-preseason-sub", `${pre.nome_torneio || pre.titulo || "Torneio"} (Campeão)`);

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
    const squad = normalizedData.squad || [];

    // 1. Card de Última Partida — sempre o registro completo resolvido pelo domínio
    const lastMatch = club.ultima_partida || null;
    if (lastMatch) {
      setText("hero-match-date-comp", `${lastMatch.competicao || "-"} · ${lastMatch.data || "-"}`);
      setText("hero-match-home", lastMatch.mandante);
      setText("hero-match-score", formatScore(lastMatch, " - "));
      setText("hero-match-away", lastMatch.visitante);
      setText("hero-match-scorers", lastMatch.artilheiros || "Nenhum gol registrado");

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
            <span class="player-display-name" onclick="window.TrackerApp.openPlayerModal(${p.playerid})">${Domain.escapeHtml(p.nome)} <small style="color:var(--text-muted); font-weight:normal;">(${p.posicao_principal})</small></span>
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
            <span class="player-display-name" onclick="window.TrackerApp.openPlayerModal(${p.playerid})">${Domain.escapeHtml(p.nome)} <small style="color:var(--text-muted); font-weight:normal;">(${p.posicao_principal})</small></span>
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
            <span class="player-display-name" onclick="window.TrackerApp.openPlayerModal(${p.playerid})">${Domain.escapeHtml(p.nome)} <small style="color:var(--text-muted); font-weight:normal;">(${p.posicao_principal})</small></span>
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
              <span class="player-display-name" onclick="window.TrackerApp.openPlayerModal(${p.playerid})">${Domain.escapeHtml(p.nome)}</span>
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

    const squad = normalizedData.squad || [];
    let starters = squad.filter(p => p.hierarquia_tatica === "titular");

    // Fallback: se não houver 11 titulares marcados, seleciona os 11 com mais minutos
    if (starters.length === 0) {
      starters = [...squad].sort((a, b) => b.minutos - a.minutos).slice(0, 11);
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

    const formationStr = `${defenders.length}-${midfielders.length}-${attackers.length}`;
    setText("tactical-formation", formationStr);
    setText("tactical-avg-ovr", avgOvr);
    setText("tactical-avg-age", `${avgAge} anos`);
    setText("tactical-starter-val", Domain.formatCurrency(starterVal));

    // Ordenação lateral tática das linhas
    const defOrder = { "LE": 1, "LBE": 2, "ZAG": 3, "DC": 4, "LBD": 5, "LD": 6 };
    defenders.sort((a, b) => (defOrder[a.posicao_principal] || 3) - (defOrder[b.posicao_principal] || 3));

    const midOrder = { "ME": 1, "VOL": 2, "MC": 3, "MCO": 4, "MD": 5 };
    midfielders.sort((a, b) => (midOrder[a.posicao_principal] || 3) - (midOrder[b.posicao_principal] || 3));

    const attOrder = { "PE": 1, "PTE": 2, "SA": 3, "CA": 4, "ATA": 5, "PTD": 6, "PD": 7 };
    attackers.sort((a, b) => (attOrder[a.posicao_principal] || 4) - (attOrder[b.posicao_principal] || 4));

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

    layoutRow(goalkeepers, 88);
    layoutRow(defenders, 68);
    layoutRow(midfielders, 46);
    layoutRow(attackers, 20);

    pitch.innerHTML = tokens.map(({ player, x, y }) => {
      const sector = player.setor_canonico || "meio";
      const isHigh = player.overall >= 70;
      const ratingClass = Domain.getRatingBadgeClass(player.nota_media);
      let statBadges = "";
      if (player.gols > 0) statBadges += `<span class="pitch-stat-icon" title="${player.gols} gol(s)">⚽${player.gols}</span>`;
      if (player.assistencias > 0) statBadges += `<span class="pitch-stat-icon" title="${player.assistencias} assistência(s)">👟${player.assistencias}</span>`;

      return `
        <div class="pitch-player-token ${sector}" style="top: ${y}%; left: ${x}%;" onclick="window.TrackerApp.openPlayerModal(${player.playerid})" title="${Domain.escapeHtml(player.nome)} (${Domain.escapeHtml(player.posicao_principal)})">
          <div class="pitch-token-badge">
            <span>${player.numero || "-"}</span>
            <span class="pitch-token-pos">${Domain.escapeHtml(player.posicao_principal)}</span>
          </div>
          <div class="pitch-token-card">
            <span class="pitch-token-name">${Domain.escapeHtml(player.nome)}</span>
            <span class="pitch-token-rating ${isHigh ? 'high' : ''}">${player.overall}</span>
            <span class="rating-badge ${ratingClass}" style="font-size:9.5px; padding:1px 3px;" title="Nota Média">${Domain.formatRating(player.nota_media)}</span>
            ${statBadges}
          </div>
        </div>
      `;
    }).join("");
  }

  // ==========================================================================
  // ABA 2: ELENCO (SQUAD HUB)
  // ==========================================================================
  function renderSquadTab() {
    const squad = normalizedData.squad || [];
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
            <th class="cell-num">Nº</th>
            <th>Jogador</th>
            <th>Pos</th>
            <th class="cell-num sortable" data-sort="idade" title="Ordenar por Idade">Idade <span class="sort-indicator"></span></th>
            <th class="cell-num sortable" data-sort="overall" title="Ordenar por Overall">OVR <span class="sort-indicator"></span></th>
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
            <th class="cell-num">Nº</th>
            <th>Jogador</th>
            <th>Pos</th>
            <th class="cell-num sortable" data-sort="idade" title="Ordenar por Idade">Idade <span class="sort-indicator"></span></th>
            <th class="cell-num sortable" data-sort="overall" title="Ordenar por Overall">OVR <span class="sort-indicator"></span></th>
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

        return `
          <tr tabindex="0" role="button" aria-label="Ver ficha de ${Domain.escapeHtml(p.nome)}" onclick="window.TrackerApp.openPlayerModal(${p.playerid})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.TrackerApp.openPlayerModal(${p.playerid});}">
            <td class="cell-num"><span class="player-num-circle">${p.numero || "-"}</span></td>
            <td>
              <div class="player-names-cell">
                <div>
                  <span class="player-display-name">${Domain.escapeHtml(p.nome)}</span>
                  <div class="player-meta-inline">${Domain.escapeHtml(p.nacionalidade || "")}</div>
                </div>
              </div>
            </td>
            <td><span class="badge badge-pos ${posSector}">${Domain.escapeHtml(p.posicao_principal)}</span></td>
            <td class="cell-num">${p.idade}</td>
            <td class="cell-num cell-bold">${p.overall}</td>
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
            <td class="cell-num"><span class="player-num-circle">${p.numero || "-"}</span></td>
            <td>
              <div class="player-names-cell">
                <div>
                  <span class="player-display-name">${Domain.escapeHtml(p.nome)}</span>
                  ${secPosBadge}
                  <div class="player-meta-inline">${Domain.escapeHtml(p.nacionalidade || "")}</div>
                </div>
              </div>
            </td>
            <td><span class="badge badge-pos ${posSector}">${Domain.escapeHtml(p.posicao_principal)}</span></td>
            <td class="cell-num">${p.idade}</td>
            <td class="cell-num cell-bold">${p.overall} ${evolBadge}</td>
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
        const c = (m.competicao || "").toLowerCase().trim();
        const f = matchesCompFilter.toLowerCase().trim();
        return c.includes(f) || f.includes(c);
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

    if (filtered.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted); padding:16px;">Nenhuma partida encontrada para os filtros selecionados.</p>`;
      return;
    }

    container.innerHTML = filtered.map(m => {
      const resClass = m.resultado_css || Domain.getResultMeta(m.resultado_canonico).css;
      const motm = Domain.getManOfTheMatch(m);
      const motmHtml = motm ? `
        <div class="match-motm">
          <span class="motm-label">★ Melhor em Campo:</span>
          <span class="player-display-name" onclick="event.stopPropagation(); window.TrackerApp.openPlayerModal(${motm.playerid})">${Domain.escapeHtml(motm.nome)}</span>
          <span class="rating-badge ${Domain.getRatingBadgeClass(motm.nota)}">${Domain.formatRating(motm.nota)}</span>
        </div>
      ` : "";

      return `
        <div class="match-card" tabindex="0" role="button" aria-label="Ver ficha da partida ${Domain.escapeHtml(m.mandante)} contra ${Domain.escapeHtml(m.visitante)}" onclick="window.TrackerApp.openMatchModal(${m.id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.TrackerApp.openMatchModal(${m.id});}">
          <div class="match-card-top">
            <span>${Domain.escapeHtml(m.competicao)} · ${Domain.escapeHtml(m.data)}</span>
            <span class="badge badge-result ${resClass}">${Domain.escapeHtml(m.resultado)}</span>
          </div>
          <div class="match-card-teams">
            <span class="match-team-name">${Domain.escapeHtml(m.mandante)}</span>
            <span class="match-score-pill">${Domain.escapeHtml(formatScore(m, " - "))}</span>
            <span class="match-team-name away">${Domain.escapeHtml(m.visitante)}</span>
          </div>
          <div class="match-card-info">
            <div><strong>Artilheiro(s):</strong> ${Domain.escapeHtml(m.artilheiros || "Nenhum")}</div>
            <div style="color:var(--text-muted);">Goleiro: ${Domain.escapeHtml(m.goleiro || "—")}</div>
          </div>
          ${motmHtml}
          <button class="btn btn-sm" style="margin-top:auto;" onclick="event.stopPropagation(); window.TrackerApp.openMatchModal(${m.id})">
            Ver Ficha Técnica
          </button>
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
    renderStandingsTable("preseason-table-body", standings.preseason || []);
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

    tbody.innerHTML = tableRows.map(row => {
      const rowName = (row.nome_time || row.time || "").toLowerCase();
      const isOurClub = Boolean(clubKey && rowName.includes(clubKey));
      const rowStyle = isOurClub ? "background-color: var(--brand-cyan-muted); font-weight:700;" : "";

      return `
        <tr style="${rowStyle}">
          <td class="cell-num cell-bold">${row.posicao || "-"}</td>
          <td><strong>${Domain.escapeHtml(row.nome_time || row.time || "-")}</strong></td>
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
        footerStatus.style.color = "var(--sports-loss)";
      }
    } else {
      if (statusBadge) {
        statusBadge.textContent = "Status: Dados Sincronizados";
        statusBadge.className = "badge badge-status-synced";
      }
      if (footerStatus) {
        footerStatus.textContent = "Status: Dados Sincronizados";
        footerStatus.style.color = "var(--sports-win)";
      }
    }
  }

  async function loadAvailableSaves() {
    if (!isLocalServer) return;
    try {
      const resp = await fetch("/api/saves");
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
          if (saveWrap) saveWrap.style.display = "flex";
        }
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

    body.innerHTML = `
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
        <span class="detail-label" style="color:#f59e0b;">★ Melhor em Campo</span>
        <span class="detail-val">
          <strong class="player-display-name" onclick="window.TrackerApp.openPlayerModal(${motm.playerid})">${Domain.escapeHtml(motm.nome)}</strong>
          <span class="rating-badge ${Domain.getRatingBadgeClass(motm.nota)}" style="margin-left:6px;">${Domain.formatRating(motm.nota)}</span>
        </span>
      </div>
    ` : "";

    body.innerHTML = `
      <div class="detail-block">
        <div class="detail-block-title">Resumo do Confronto</div>
        <div class="detail-row"><span class="detail-label">Competição</span><span class="detail-val">${Domain.escapeHtml(match.competicao)}</span></div>
        <div class="detail-row"><span class="detail-label">Data</span><span class="detail-val">${Domain.escapeHtml(match.data)}</span></div>
        <div class="detail-row"><span class="detail-label">Placar Oficial</span><span class="detail-val" style="font-size:18px; color:var(--brand-cyan);">${Domain.escapeHtml(match.placar)}</span></div>
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
  // EVENT LISTENERS & INTERATIVIDADE
  // ==========================================================================
  function setupTabNavigation() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const targetTab = btn.getAttribute("data-tab");
        if (!targetTab) return;

        tabButtons.forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

        btn.classList.add("active");
        const targetPane = document.getElementById(`tab-${targetTab}`);
        if (targetPane) targetPane.classList.add("active");
        activeTab = targetTab;
      });
    });
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

    const squadConfidence = document.getElementById("squad-confidence-filter");
    if (squadConfidence) {
      squadConfidence.addEventListener("change", e => {
        squadFilters.confidence = e.target.value;
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

    const logSearch = document.getElementById("log-search");
    if (logSearch) {
      logSearch.addEventListener("input", e => {
        logFilters.search = e.target.value.trim();
        renderMatchLogsTable();
      });
    }

    const logComp = document.getElementById("log-comp-filter");
    if (logComp) {
      logComp.addEventListener("change", e => {
        logFilters.competition = e.target.value;
        renderMatchLogsTable();
      });
    }

    const logMatch = document.getElementById("log-match-filter");
    if (logMatch) {
      logMatch.addEventListener("change", e => {
        logFilters.match = e.target.value;
        renderMatchLogsTable();
      });
    }

    // Ação: Sincronizar Save
    const btnReload = document.getElementById("btn-reload-save");
    if (btnReload) {
      btnReload.addEventListener("click", async () => {
        if (!isLocalServer) {
          showToast("Ambiente estático (GitHub Pages): dados pré-compilados do repositório. Para sincronização ao vivo com o EA FC 26, execute localmente!", "warning");
          return;
        }

        setAppState(APP_STATE.LOADING);
        try {
          const resp = await fetch("/api/reload");
          if (resp.ok) {
            rawData = await resp.json();
            processAndRender();
            showToast("Dados do save sincronizados com sucesso!", "success");
          } else {
            throw new Error(`Falha no servidor (${resp.status})`);
          }
        } catch (e) {
          showToast("Erro ao sincronizar save local: " + e.message, "error");
          setAppState(APP_STATE.LOADED);
        }
      });
    }

    // Ação: Alternar Save Local
    const btnApplySave = document.getElementById("btn-apply-save");
    if (btnApplySave) {
      btnApplySave.addEventListener("click", async () => {
        const select = document.getElementById("select-save-file");
        if (!select) return;
        const selected = select.value;

        if (!isLocalServer) {
          showToast(`No GitHub Pages o save ativo é fixo. Execute localmente para alternar para ${selected}.`, "warning");
          return;
        }

        setAppState(APP_STATE.LOADING);
        try {
          const resp = await fetch("/api/select_save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ save_file: selected })
          });
          if (resp.ok) {
            rawData = await resp.json();
            processAndRender();
            showToast(`Save alterado para ${selected}!`, "success");
          } else {
            throw new Error(`Falha ao selecionar save (${resp.status})`);
          }
        } catch (e) {
          showToast("Erro ao carregar save: " + e.message, "error");
          setAppState(APP_STATE.LOADED);
        }
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

  // Expor API global
  window.TrackerApp = {
    openPlayerModal,
    openMatchModal,
    closeModal,
    showToast,
    getAppState: () => currentState,
    getNormalizedData: () => normalizedData,
    exportSquadToCsvClientSide,
    renderSquadTab,
    setSquadViewMode: mode => {
      squadViewMode = mode;
      renderSquadTab();
    }
  };

})(window, document);
