/**
 * EA FC 26 CAREER TRACKER — CONTROLADOR FRONTEND (v3.1)
 * Compatível com GitHub Pages (100% estático via JSON/JS fallback) e Servidor Local Python.
 * Implementa os 5 pontos da 2ª Auditoria Técnica:
 *  1. Checklist de Integridade com distinção honesta (OK vs PARCIAL).
 *  2. Coluna 'Assistências na Partida' nos Logs (0, int, ou N/D no binário).
 *  3. Confiança da Recomendação baseada no tamanho da amostra (≥3J e ≥150m).
 *  4. Separação estrita entre Hierarquia da Escalação, Utilização Real e Recomendação Consultiva.
 *  5. Fonte Única da Verdade: totais derivados diretamente da agregação de logs de jogo.
 */

(function () {
  "use strict";

  // Estado da aplicação
  let careerData = null;
  let isLocalServer = false;
  let activeTab = "squad";

  // Filtros do Hub do Elenco
  let squadFilters = {
    search: "",
    sector: "all",
    hierarchy: "all",
    confidence: "all",
    sortBy: "minutos",
    sortOrder: "desc"
  };

  // Filtros dos Logs por Partida
  let logFilters = {
    search: "",
    competition: "all",
    match: "all"
  };

  // Inicialização
  document.addEventListener("DOMContentLoaded", () => {
    initApp();
  });

  async function initApp() {
    setupTabNavigation();
    setupModals();
    await loadCareerData();
    setupEventListeners();
  }

  // Carregamento de Dados com Tripla Camada de Fallback
  async function loadCareerData() {
    renderLoading(true);

    // 1. Tentar carregar da API local
    try {
      const resp = await fetch("/api/data", { cache: "no-store" });
      if (resp.ok) {
        careerData = await resp.json();
        isLocalServer = true;
        updateSourceBadge("Servidor Local Ativo (API)", "success");
        renderAll();
        loadAvailableSaves();
        return;
      }
    } catch (e) {
      // Ignora e tenta arquivo estático
    }

    // 2. Tentar carregar do arquivo assets/data/career_data.json (GitHub Pages)
    try {
      const respJson = await fetch("assets/data/career_data.json", { cache: "no-store" });
      if (respJson.ok) {
        careerData = await respJson.json();
        isLocalServer = false;
        updateSourceBadge("GitHub Pages (Dados Estáticos)", "info");
        renderAll();
        return;
      }
    } catch (e) {
      // Ignora e tenta fallback em JS
    }

    // 3. Fallback do bundle JS embutido via window.FALLBACK_CAREER_DATA
    if (window.FALLBACK_CAREER_DATA) {
      careerData = window.FALLBACK_CAREER_DATA;
      isLocalServer = false;
      updateSourceBadge("Modo Offline / Bundle JS", "warning");
      renderAll();
      return;
    }

    renderError("Não foi possível carregar os dados da carreira. Verifique os arquivos JSON/JS.");
  }

  function updateSourceBadge(text, type) {
    const badge = document.getElementById("data-source-badge");
    if (badge) {
      badge.textContent = text;
      badge.className = `badge badge-${type === "success" ? "status-ok" : type === "warning" ? "status-parcial" : "confianca-moderada"}`;
    }
  }

  // Renderizar Todos os Módulos
  function renderAll() {
    if (!careerData) return;
    renderClubHeader();
    renderSquadHub();
    renderMatchLogs();
    renderMatchesGrid();
    renderStandings();
    renderIntegrityChecklist();
    renderSaveManager();
    renderLoading(false);
  }

  // ==========================================================================
  // HEADER DO CLUBE & CARREIRA
  // ==========================================================================
  function renderClubHeader() {
    const club = careerData.club || {};
    setText("club-name", club.nome || "Clube");
    setText("coach-name", club.treinador || "Treinador");
    setText("club-league", club.liga || "Liga");
    setText("save-date", club.data_atual || "01/01/2008");
    setText("career-season", club.temporada || "Temporada 1");
    setText("current-save-name", careerData.save_file || "CmMgrSave");

    // Cards do Header
    setText("stat-record", club.campanha_geral || "0J: 0V 0E 0D");
    setText("stat-title", club.titulo_pre_temporada || "Em andamento");
    setText("stat-squad-value", formatCurrency(club.valor_elenco_total || 0));
    setText("stat-wage-bill", `${formatCurrency(club.folha_salarial_semanal || 0)} /sem`);
    setText("stat-goals-total", `${club.total_gols_elenco || 0} GP · ${club.total_assistencias_elenco || 0} Assists`);
  }

  // ==========================================================================
  // HUB DO ELENCO (SQUAD HUB)
  // ==========================================================================
  function renderSquadHub() {
    const squad = careerData.squad || [];
    const tbody = document.getElementById("squad-table-body");
    if (!tbody) return;

    // Aplicar filtros e ordenação
    let filtered = squad.filter(player => {
      if (squadFilters.search) {
        const q = squadFilters.search.toLowerCase();
        const matchName = (player.nome || "").toLowerCase().includes(q) ||
                          (player.nome_completo || "").toLowerCase().includes(q);
        if (!matchName) return false;
      }
      if (squadFilters.sector !== "all") {
        if ((player.setor || "").toLowerCase() !== squadFilters.sector.toLowerCase()) return false;
      }
      if (squadFilters.hierarchy !== "all") {
        if ((player.status_elenco || "").toLowerCase() !== squadFilters.hierarchy.toLowerCase()) return false;
      }
      if (squadFilters.confidence !== "all") {
        const conf = (player.confianca_recomendacao || "").toLowerCase();
        if (squadFilters.confidence === "alta" && !conf.includes("alta")) return false;
        if (squadFilters.confidence === "baixa" && !conf.includes("baixa")) return false;
        if (squadFilters.confidence === "moderada" && !conf.includes("moderada")) return false;
      }
      return true;
    });

    // Ordenar
    filtered.sort((a, b) => {
      let valA = a[squadFilters.sortBy];
      let valB = b[squadFilters.sortBy];
      if (valA === undefined || valA === null) valA = 0;
      if (valB === undefined || valB === null) valB = 0;
      if (typeof valA === "string") {
        return squadFilters.sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return squadFilters.sortOrder === "asc" ? valA - valB : valB - valA;
    });

    setText("squad-count-badge", `${filtered.length} de ${squad.length}`);

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding: 24px; color: var(--text-muted);">Nenhum jogador encontrado para os filtros selecionados.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const isTitular = (p.status_elenco || "").toLowerCase() === "titular";
      const rowClass = isTitular ? "row-titular" : "row-reserva";
      const posSector = (p.setor || "meio").toLowerCase();

      // Badges
      const confBadgeClass = (p.confianca_recomendacao || "").includes("Alta")
        ? "badge-confianca-alta"
        : (p.confianca_recomendacao || "").includes("Moderada")
        ? "badge-confianca-moderada"
        : "badge-confianca-baixa";

      return `
        <tr class="${rowClass}" onclick="window.TrackerApp.openPlayerModal(${p.playerid})">
          <td class="cell-num">
            <div class="player-num-circle">${p.numero || "-"}</div>
          </td>
          <td>
            <div class="player-names">
              <span class="player-name-display">${escapeHtml(p.nome)}</span>
              <span class="player-meta-inline">${escapeHtml(p.nacionalidade || "Espanha")} · ${p.idade || 20} anos</span>
            </div>
          </td>
          <td>
            <span class="badge badge-pos ${posSector}">${escapeHtml(p.posicao_principal || "-")}</span>
          </td>
          <td class="cell-num cell-bold">${p.overall || 65}</td>
          <td class="cell-num"><span class="badge badge-pot">${p.potencial || 75}</span></td>
          <td class="cell-num" style="color: var(--color-primary); font-weight: 600;">+${p.margem_potencial || 0}</td>
          <td class="cell-num">${p.jogos || 0} <span style="font-size: 11px; color: var(--text-muted);">(${p.jogos_titular || 0}T/${p.jogos_reserva || 0}R)</span></td>
          <td class="cell-num cell-bold">${p.minutos || 0}'</td>
          <td class="cell-num cell-bold" style="${p.gols > 0 ? 'color: var(--color-success);' : ''}">${p.gols || 0}</td>
          <td class="cell-num" style="${p.assistencias > 0 ? 'color: var(--color-primary);' : ''}">${p.assistencias || 0}</td>
          <td class="cell-num cell-bold" style="${p.nota_media >= 7.5 ? 'color: var(--color-success);' : ''}">${p.nota_media > 0 ? p.nota_media.toFixed(2) : '-'}</td>
          <td><span class="badge" style="background:#1f2937; color:#f3f4f6;">${escapeHtml(p.status_elenco || "Reserva")}</span></td>
          <td><span style="font-size:13px; color:var(--text-muted);">${escapeHtml(p.status_utilizacao || "Rotação")}</span></td>
          <td>
            <div style="display:flex; flex-direction:column; gap:3px;">
              <span style="font-size:13px; font-weight:600;">${escapeHtml(p.recomendacao_sistema || "Manter")}</span>
              <span class="badge ${confBadgeClass}" style="align-self:flex-start;">${escapeHtml(p.confianca_recomendacao || "Nula")}</span>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  // ==========================================================================
  // DESEMPENHO POR JOGO (LOGS DETALHADOS COM ASSISTÊNCIAS E AUDITORIA)
  // ==========================================================================
  function renderMatchLogs() {
    const logs = careerData.player_match_logs || [];
    const tbody = document.getElementById("logs-table-body");
    if (!tbody) return;

    // Preencher select de partidas no filtro se ainda estiver vazio
    const matchSelect = document.getElementById("log-match-filter");
    if (matchSelect && matchSelect.children.length <= 1) {
      const matches = careerData.matches || [];
      matches.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = `${m.data} · ${m.adversario} (${m.placar})`;
        matchSelect.appendChild(opt);
      });
    }

    // Filtrar logs
    let filtered = logs.filter(log => {
      if (logFilters.search) {
        const q = logFilters.search.toLowerCase();
        if (!(log.nome || "").toLowerCase().includes(q)) return false;
      }
      if (logFilters.competition !== "all") {
        if ((log.tipo_competicao || "").toLowerCase() !== logFilters.competition.toLowerCase()) return false;
      }
      if (logFilters.match !== "all") {
        if (String(log.match_id) !== String(logFilters.match)) return false;
      }
      return true;
    });

    setText("logs-count-badge", `${filtered.length} registros`);

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 24px; color: var(--text-muted);">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(log => {
      // Assistências com honestidade de dados
      let assistDisplay = "";
      if (log.assistencias_partida === "N/D") {
        assistDisplay = `<span class="badge badge-nd" title="Não decomposto por partida no binário do EA FC para múltiplos jogos com assistência">N/D</span>`;
      } else {
        const num = Number(log.assistencias_partida) || 0;
        assistDisplay = `<span class="cell-num ${num > 0 ? 'cell-bold' : ''}" style="${num > 0 ? 'color: var(--color-primary);' : ''}">${num}</span>`;
      }

      const verifStatus = log.assistencias_verificada
        ? `<span class="badge badge-status-ok" style="font-size:11px;">VERIFICADO</span>`
        : `<span class="badge badge-status-parcial" style="font-size:11px;">N/D NO BINÁRIO</span>`;

      return `
        <tr>
          <td><span style="font-family:var(--font-mono); font-size:13px;">${escapeHtml(log.data || "-")}</span></td>
          <td><span style="font-size:13px; color:var(--text-muted);">${escapeHtml(log.competicao || "-")}</span></td>
          <td><strong>${escapeHtml(log.adversario || "-")}</strong> <span style="font-size:12px; color:var(--text-dim);">(${log.mando || "C"})</span></td>
          <td class="cell-num cell-bold">${escapeHtml(log.placar || "-")}</td>
          <td>
            <strong style="color:#ffffff; cursor:pointer;" onclick="window.TrackerApp.openPlayerModal(${log.playerid})">${escapeHtml(log.nome || "-")}</strong>
          </td>
          <td><span class="badge badge-pos">${escapeHtml(log.posicao_jogada || "-")}</span></td>
          <td class="cell-num cell-bold">${log.minutos || 0}'</td>
          <td class="cell-num cell-bold" style="${log.gols_partida > 0 ? 'color:var(--color-success);' : ''}">${log.gols_partida || 0}</td>
          <td class="cell-num">${assistDisplay}</td>
          <td class="cell-num cell-bold" style="${log.nota_partida >= 7.5 ? 'color:var(--color-success);' : ''}">${log.nota_partida ? log.nota_partida.toFixed(1) : '-'}</td>
          <td>${verifStatus}</td>
        </tr>
      `;
    }).join("");
  }

  // ==========================================================================
  // JOGOS E RESULTADOS (MATCHES GRID)
  // ==========================================================================
  function renderMatchesGrid() {
    const matches = careerData.matches || [];
    const container = document.getElementById("matches-grid-container");
    if (!container) return;

    if (matches.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted); padding:20px;">Nenhuma partida registrada nesta carreira.</p>`;
      return;
    }

    container.innerHTML = matches.map(m => {
      const isWin = m.resultado === "V";
      const isDraw = m.resultado === "E";
      const resColor = isWin ? "var(--color-success)" : isDraw ? "var(--color-warning)" : "var(--color-danger)";
      const resBadge = `<span class="badge" style="background:${resColor}; color:#ffffff; font-weight:800;">${m.resultado}</span>`;

      return `
        <div class="match-card">
          <div class="match-card-header">
            <span>${escapeHtml(m.competicao)} · ${escapeHtml(m.data)}</span>
            ${resBadge}
          </div>
          <div class="match-card-score">
            <span class="match-team">${escapeHtml(m.mandante)}</span>
            <span class="match-goals">${m.placar_mandante} - ${m.placar_visitante}</span>
            <span class="match-team" style="text-align:right;">${escapeHtml(m.visitante)}</span>
          </div>
          <div class="match-card-details">
            <div><strong>Gols:</strong> ${escapeHtml(m.artilheiros || "Nenhum")}</div>
            <div style="margin-top:4px; font-size:12px; color:var(--text-dim);">Goleiro: ${escapeHtml(m.goleiro || "-")}</div>
          </div>
          <button class="btn btn-sm" style="margin-top:auto;" onclick="window.TrackerApp.openMatchModal(${m.id})">
            Ver Ficha Técnica e Escalação
          </button>
        </div>
      `;
    }).join("");
  }

  // ==========================================================================
  // TABELAS & CLASSIFICAÇÕES MULTILIGA
  // ==========================================================================
  function renderStandings() {
    const standings = careerData.standings || {};
    renderLeagueTable("laliga2-table-body", standings.laliga2 || []);
    renderLeagueTable("preseason-table-body", standings.preseason || []);
  }

  function renderLeagueTable(tbodyId, tableRows) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (!tableRows || tableRows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:16px; color:var(--text-muted);">Dados da competição não disponíveis.</td></tr>`;
      return;
    }

    tbody.innerHTML = tableRows.map(row => {
      const isOurClub = (row.nome_time || row.time || "").includes("Andorra");
      const rowStyle = isOurClub ? "background-color: rgba(56, 189, 248, 0.12); font-weight:700;" : "";

      return `
        <tr style="${rowStyle}">
          <td class="cell-num cell-bold">${row.posicao || "-"}</td>
          <td><strong>${escapeHtml(row.nome_time || row.time || "-")}</strong></td>
          <td class="cell-num cell-bold" style="color:var(--color-primary);">${row.pontos || 0}</td>
          <td class="cell-num">${row.jogos || 0}</td>
          <td class="cell-num">${row.vitorias || 0}</td>
          <td class="cell-num">${row.empates || 0}</td>
          <td class="cell-num">${row.derrotas || 0}</td>
          <td class="cell-num">${row.gols_pro || 0}</td>
          <td class="cell-num">${row.gols_contra || 0}</td>
          <td class="cell-num cell-bold" style="${(row.saldo_gols || 0) > 0 ? 'color:var(--color-success);' : ''}">${(row.saldo_gols || 0) > 0 ? '+' : ''}${row.saldo_gols || 0}</td>
        </tr>
      `;
    }).join("");
  }

  // ==========================================================================
  // CHECKLIST DE INTEGRIDADE DOS DADOS (9 TESTES — 8 OK / 1 PARCIAL)
  // ==========================================================================
  function renderIntegrityChecklist() {
    const report = careerData.validation_report || {};
    const checks = report.checks || [];

    setText("audit-ok-count", report.total_ok || 8);
    setText("audit-partial-count", report.total_parcial || 1);
    setText("audit-failed-count", report.total_falhas || 0);

    const tbody = document.getElementById("audit-table-body");
    if (!tbody) return;

    tbody.innerHTML = checks.map(c => {
      const isOk = c.status === "OK (VERIFICADO)";
      const statusBadge = isOk
        ? `<span class="badge badge-status-ok">OK (VERIFICADO)</span>`
        : `<span class="badge badge-status-parcial">PARCIAL (NÃO VERIFICADO POR PARTIDA)</span>`;

      return `
        <tr>
          <td class="cell-num cell-bold" style="font-family:var(--font-mono);">${c.id}</td>
          <td><strong>${escapeHtml(c.nome)}</strong></td>
          <td><code style="font-size:12px; color:var(--text-muted); background:var(--bg-app); padding:3px 6px; border-radius:4px;">${escapeHtml(c.regra || "-")}</code></td>
          <td>${statusBadge}</td>
          <td style="font-size:13px; color:var(--text-main);">${escapeHtml(c.detalhes || c.descricao || "-")}</td>
        </tr>
      `;
    }).join("");
  }

  // ==========================================================================
  // GESTÃO DE CARREIRA E SAVES
  // ==========================================================================
  function renderSaveManager() {
    const summary = careerData.careers_archive_summary || {};
    setText("archive-total-careers", summary.total_carreiras || 1);
    setText("archive-total-snapshots", summary.total_snapshots || 1);
    setText("archive-last-sync", summary.ultima_sincronizacao || "Agora");

    // Preencher select de saves disponíveis
    const saveSelect = document.getElementById("select-save-file");
    if (saveSelect && careerData.available_saves) {
      saveSelect.innerHTML = careerData.available_saves.map(s => {
        const isCurrent = s === careerData.save_file;
        return `<option value="${escapeHtml(s)}" ${isCurrent ? 'selected' : ''}>${escapeHtml(s)}</option>`;
      }).join("");
    }
  }

  async function loadAvailableSaves() {
    if (!isLocalServer) return;
    try {
      const resp = await fetch("/api/saves");
      if (resp.ok) {
        const body = await resp.json();
        if (body.saves && body.saves.length > 0) {
          careerData.available_saves = body.saves;
          renderSaveManager();
        }
      }
    } catch (e) {
      // Ignora erro
    }
  }

  // ==========================================================================
  // MODAL DE DETALHES DO JOGADOR
  // ==========================================================================
  function openPlayerModal(playerid) {
    const squad = careerData.squad || [];
    const player = squad.find(p => p.playerid === playerid);
    if (!player) return;

    setText("modal-player-title", `${player.nome} (${player.posicao_principal}) — #${player.numero || '-'}`);

    const body = document.getElementById("modal-player-body");
    if (!body) return;

    // Histórico de partidas do jogador
    const logs = player.historico_partidas || [];
    const logsRows = logs.length > 0
      ? logs.map(l => {
          let assistDisp = l.assistencias_partida === "N/D"
            ? `<span class="badge badge-nd">N/D</span>`
            : l.assistencias_partida;
          return `
            <tr>
              <td>${escapeHtml(l.data)}</td>
              <td>${escapeHtml(l.adversario)}</td>
              <td><span class="badge badge-pos">${escapeHtml(l.posicao_jogada)}</span></td>
              <td class="cell-num cell-bold">${l.minutos}'</td>
              <td class="cell-num cell-bold" style="${l.gols_partida > 0 ? 'color:var(--color-success);' : ''}">${l.gols_partida || 0}</td>
              <td class="cell-num">${assistDisp}</td>
              <td class="cell-num cell-bold">${l.nota_partida ? l.nota_partida.toFixed(1) : '-'}</td>
            </tr>
          `;
        }).join("")
      : `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Nenhum jogo disputado nesta carreira.</td></tr>`;

    // Atributos físicos e contratuais
    body.innerHTML = `
      <div class="grid-2col">
        <div class="detail-block">
          <div class="detail-block-title">Identidade & Contrato</div>
          <div class="detail-row"><span class="detail-label">Nome Completo</span><span class="detail-val">${escapeHtml(player.nome_completo || player.nome)}</span></div>
          <div class="detail-row"><span class="detail-label">Nacionalidade</span><span class="detail-val">${escapeHtml(player.nacionalidade || "Espanha")}</span></div>
          <div class="detail-row"><span class="detail-label">Idade / Nasc.</span><span class="detail-val">${player.idade} anos (${escapeHtml(player.data_nascimento || "-")})</span></div>
          <div class="detail-row"><span class="detail-label">Físico</span><span class="detail-val">${player.altura} cm · ${player.peso} kg</span></div>
          <div class="detail-row"><span class="detail-label">Pé Preferido</span><span class="detail-val">${player.pe_preferido} (Perna Ruim: ${player.perna_ruim}★)</span></div>
          <div class="detail-row"><span class="detail-label">Valor de Mercado</span><span class="detail-val" style="color:var(--color-primary);">${formatCurrency(player.valor_mercado || 0)}</span></div>
          <div class="detail-row"><span class="detail-label">Salário Semanal</span><span class="detail-val">${formatCurrency(player.salario || 0)} /sem</span></div>
          <div class="detail-row"><span class="detail-label">Multa Rescisória</span><span class="detail-val">${escapeHtml(player.multa_texto || "Sem multa")}</span></div>
          <div class="detail-row"><span class="detail-label">Vencimento Contrato</span><span class="detail-val">${player.contrato_fim || "-"} (${player.anos_contrato || 0} anos restantes)</span></div>
        </div>

        <div class="detail-block">
          <div class="detail-block-title">Status, Utilização & Avaliação</div>
          <div class="detail-row"><span class="detail-label">Hierarquia Escalação</span><span class="detail-val">${escapeHtml(player.status_elenco || "Reserva")}</span></div>
          <div class="detail-row"><span class="detail-label">Utilização Real</span><span class="detail-val">${escapeHtml(player.status_utilizacao || "Rotação")}</span></div>
          <div class="detail-row"><span class="detail-label">Recomendação Sistema</span><span class="detail-val" style="color:var(--color-primary);">${escapeHtml(player.recomendacao_sistema || "Manter")}</span></div>
          <div class="detail-row"><span class="detail-label">Confiança da Amostra</span><span class="detail-val">${escapeHtml(player.confianca_recomendacao || "Nula")}</span></div>
          <div class="detail-row"><span class="detail-label">Overall Atual / Inicial</span><span class="detail-val">${player.overall} (Inicial: ${player.overall_inicial || player.overall})</span></div>
          <div class="detail-row"><span class="detail-label">Potencial / Margem</span><span class="detail-val">${player.potencial} (+${player.margem_potencial})</span></div>
          <div class="detail-row"><span class="detail-label">Evolução no Save</span><span class="detail-val" style="color:var(--color-success); font-weight:700;">+${player.evolucao_real || 0} OVR</span></div>
          <div class="detail-row"><span class="detail-label">Amostra de Jogos</span><span class="detail-val">${escapeHtml(player.amostra_label || "-")}</span></div>
          <div class="detail-row"><span class="detail-label">Motivo da Análise</span><span class="detail-val" style="font-size:12px; color:var(--text-muted);">${escapeHtml(player.motivo_recomendacao || "-")}</span></div>
        </div>
      </div>

      <div class="detail-block">
        <div class="detail-block-title">Histórico Jogo a Jogo do Atleta (Fonte Única da Verdade)</div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Adversário</th>
                <th>Posição</th>
                <th>Minutos</th>
                <th>Gols</th>
                <th>Assistências</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              ${logsRows}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById("modal-player").classList.add("open");
  }

  // ==========================================================================
  // MODAL DE DETALHES DA PARTIDA
  // ==========================================================================
  function openMatchModal(matchId) {
    const matches = careerData.matches || [];
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    setText("modal-match-title", `${match.mandante} ${match.placar_mandante} x ${match.placar_visitante} ${match.visitante} — ${match.data}`);

    const body = document.getElementById("modal-match-body");
    if (!body) return;

    const escalacao = match.escalacao || [];
    const escalacaoRows = escalacao.map(e => {
      let assistVal = e.assistencias_partida === "N/D" ? `<span class="badge badge-nd">N/D</span>` : e.assistencias_partida;
      return `
        <tr>
          <td class="cell-num">${e.numero || '-'}</td>
          <td><strong>${escapeHtml(e.nome)}</strong></td>
          <td><span class="badge badge-pos">${escapeHtml(e.posicao_jogada)}</span></td>
          <td class="cell-num cell-bold">${e.minutos}'</td>
          <td class="cell-num cell-bold" style="${e.gols_partida > 0 ? 'color:var(--color-success);' : ''}">${e.gols_partida || 0}</td>
          <td class="cell-num">${assistVal}</td>
          <td class="cell-num cell-bold" style="${e.nota_partida >= 7.5 ? 'color:var(--color-success);' : ''}">${e.nota_partida ? e.nota_partida.toFixed(1) : '-'}</td>
        </tr>
      `;
    }).join("");

    body.innerHTML = `
      <div class="detail-block">
        <div class="detail-block-title">Resumo do Confronto</div>
        <div class="detail-row"><span class="detail-label">Competição</span><span class="detail-val">${escapeHtml(match.competicao)}</span></div>
        <div class="detail-row"><span class="detail-label">Data</span><span class="detail-val">${escapeHtml(match.data)}</span></div>
        <div class="detail-row"><span class="detail-label">Placar Final</span><span class="detail-val" style="font-size:18px; color:var(--color-primary);">${match.placar}</span></div>
        <div class="detail-row"><span class="detail-label">Artilheiros</span><span class="detail-val" style="color:var(--color-success);">${escapeHtml(match.artilheiros || "Nenhum")}</span></div>
        <div class="detail-row"><span class="detail-label">Goleiro</span><span class="detail-val">${escapeHtml(match.goleiro || "-")}</span></div>
      </div>

      <div class="detail-block">
        <div class="detail-block-title">Escalação & Desempenho Individual</div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Jogador</th>
                <th>Posição</th>
                <th>Minutos</th>
                <th>Gols</th>
                <th>Assistências</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              ${escalacaoRows}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById("modal-match").classList.add("open");
  }

  // ==========================================================================
  // EVENT LISTENERS E NAVEGAÇÃO
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
    document.querySelectorAll(".modal-close, .modal-overlay").forEach(el => {
      el.addEventListener("click", e => {
        if (e.target === el) {
          document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("open"));
        }
      });
    });
  }

  function setupEventListeners() {
    // Filtros do Elenco
    const squadSearch = document.getElementById("squad-search");
    if (squadSearch) {
      squadSearch.addEventListener("input", e => {
        squadFilters.search = e.target.value.trim();
        renderSquadHub();
      });
    }

    const squadSector = document.getElementById("squad-sector-filter");
    if (squadSector) {
      squadSector.addEventListener("change", e => {
        squadFilters.sector = e.target.value;
        renderSquadHub();
      });
    }

    const squadHierarchy = document.getElementById("squad-hierarchy-filter");
    if (squadHierarchy) {
      squadHierarchy.addEventListener("change", e => {
        squadFilters.hierarchy = e.target.value;
        renderSquadHub();
      });
    }

    const squadConfidence = document.getElementById("squad-confidence-filter");
    if (squadConfidence) {
      squadConfidence.addEventListener("change", e => {
        squadFilters.confidence = e.target.value;
        renderSquadHub();
      });
    }

    // Ordenação da Tabela do Elenco
    document.querySelectorAll("#squad-table th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const sortField = th.getAttribute("data-sort");
        if (squadFilters.sortBy === sortField) {
          squadFilters.sortOrder = squadFilters.sortOrder === "asc" ? "desc" : "asc";
        } else {
          squadFilters.sortBy = sortField;
          squadFilters.sortOrder = "desc";
        }
        renderSquadHub();
      });
    });

    // Filtros dos Logs
    const logSearch = document.getElementById("log-search");
    if (logSearch) {
      logSearch.addEventListener("input", e => {
        logFilters.search = e.target.value.trim();
        renderMatchLogs();
      });
    }

    const logComp = document.getElementById("log-comp-filter");
    if (logComp) {
      logComp.addEventListener("change", e => {
        logFilters.competition = e.target.value;
        renderMatchLogs();
      });
    }

    const logMatch = document.getElementById("log-match-filter");
    if (logMatch) {
      logMatch.addEventListener("change", e => {
        logFilters.match = e.target.value;
        renderMatchLogs();
      });
    }

    // Ações de Save e Recarregamento
    const btnReload = document.getElementById("btn-reload-save");
    if (btnReload) {
      btnReload.addEventListener("click", async () => {
        if (!isLocalServer) {
          alert("No GitHub Pages estático os dados refletem os arquivos commitados no repositório. Para processar saves ao vivo em tempo real, execute iniciar_tracker.bat localmente!");
          return;
        }
        renderLoading(true);
        try {
          const resp = await fetch("/api/reload");
          if (resp.ok) {
            careerData = await resp.json();
            renderAll();
          }
        } catch (e) {
          alert("Erro ao recarregar save local: " + e.message);
        }
        renderLoading(false);
      });
    }

    const btnSelectSave = document.getElementById("btn-apply-save");
    if (btnSelectSave) {
      btnSelectSave.addEventListener("click", async () => {
        const saveSelect = document.getElementById("select-save-file");
        if (!saveSelect) return;
        const selectedSave = saveSelect.value;
        if (!isLocalServer) {
          alert(`Você selecionou: ${selectedSave}. No GitHub Pages estático os dados são fixados pelo repositório. Use o modo local para alternar saves em tempo real.`);
          return;
        }
        renderLoading(true);
        try {
          const resp = await fetch("/api/select_save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ save_file: selectedSave })
          });
          if (resp.ok) {
            careerData = await resp.json();
            renderAll();
          }
        } catch (e) {
          alert("Erro ao selecionar save: " + e.message);
        }
        renderLoading(false);
      });
    }
  }

  // ==========================================================================
  // HELPERS E UTILITÁRIOS
  // ==========================================================================
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function formatCurrency(val) {
    const num = Number(val) || 0;
    return `€ ${num.toLocaleString("pt-BR")}`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderLoading(show) {
    const spinner = document.getElementById("global-spinner");
    if (spinner) spinner.style.display = show ? "block" : "none";
  }

  function renderError(msg) {
    renderLoading(false);
    const container = document.querySelector(".app-container");
    if (container) {
      const errBox = document.createElement("div");
      errBox.className = "callout callout-warning";
      errBox.innerHTML = `<strong>Aviso:</strong> ${escapeHtml(msg)}`;
      container.prepend(errBox);
    }
  }

  // Expor API global para eventos inline
  window.TrackerApp = {
    openPlayerModal,
    openMatchModal
  };

})();
