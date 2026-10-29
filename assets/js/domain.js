/**
 * FC MANAGER — NÚCLEO DE DOMÍNIO E REGRAS DE NEGÓCIO (v3.2)
 * Funções puras, determinísticas e sem dependência de DOM.
 * Compatível com execução no navegador (window.FCManagerDomain) e Node.js (module.exports).
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FCManagerDomain = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ==========================================================================
  // NORMALIZAÇÃO DE DADOS (JOGADOR E CARREIRA)
  // ==========================================================================

  /**
   * Normaliza os campos canônicos de um jogador para evitar bugs de strings compostas.
   * Ex: "Titular (ZAG)" -> hierarquia_tatica = "titular"
   */
  function normalizePlayerData(player) {
    if (!player || typeof player !== "object") return null;

    const p = Object.assign({}, player);

    // 1. Posição principal e número
    p.numero = Number(p.numero) || 0;
    p.posicao_principal = String(p.posicao_principal || "MC").trim().toUpperCase();
    p.posicoes_secundarias = String(p.posicoes_secundarias || "—").trim();
    p.nome = String(p.nome || `Atleta #${p.playerid || 0}`).trim();
    p.nome_completo = String(p.nome_completo || p.nome).trim();
    p.nacionalidade = String(p.nacionalidade || "Espanha").trim();
    p.idade = Number(p.idade) || 20;

    // 2. Setor Canônico (goleiro, defesa, meio, ataque)
    if (p.setor_canonico) {
      p.setor_canonico = String(p.setor_canonico).toLowerCase().trim();
    } else {
      const pos = p.posicao_principal;
      const rawSetor = String(p.setor || "").toLowerCase();
      if (pos === "GOL" || rawSetor.startsWith("gol")) {
        p.setor_canonico = "goleiro";
      } else if (["ZAG", "LD", "LE", "CB", "RB", "LB", "LWB", "RWB"].includes(pos) || rawSetor.startsWith("def")) {
        p.setor_canonico = "defesa";
      } else if (["VOL", "MC", "MEI", "MD", "ME", "CDM", "CM", "CAM", "RM", "LM"].includes(pos) || rawSetor.startsWith("mei")) {
        p.setor_canonico = "meio";
      } else {
        p.setor_canonico = "ataque";
      }
    }
    p.setor_display = p.setor_canonico === "goleiro" ? "Goleiro" :
                      p.setor_canonico === "defesa" ? "Defesa" :
                      p.setor_canonico === "meio" ? "Meio-Campo" : "Ataque";

    // 3. Hierarquia Tática Canônica (titular, reserva, nao_relacionado)
    if (p.hierarquia_tatica) {
      p.hierarquia_tatica = String(p.hierarquia_tatica).toLowerCase().trim();
    } else {
      const statusElencoLower = String(p.status_elenco || "").toLowerCase();
      const statusCurtoLower = String(p.status_curto || "").toLowerCase();
      if (statusElencoLower.startsWith("titular") || statusCurtoLower === "titular") {
        p.hierarquia_tatica = "titular";
      } else if (statusElencoLower.includes("banco") || statusElencoLower.includes("suplente") || statusCurtoLower === "banco") {
        p.hierarquia_tatica = "reserva";
      } else {
        p.hierarquia_tatica = "nao_relacionado";
      }
    }

    // 4. Métricas Numéricas Garantidas
    p.overall = Number(p.overall) || 60;
    p.overall_inicial = Number(p.overall_inicial) || p.overall;
    p.potencial = Number(p.potencial) || p.overall;
    p.margem_potencial = Math.max(0, p.potencial - p.overall);
    p.evolucao_real = typeof p.evolucao_real === "number" ? p.evolucao_real : (p.overall - p.overall_inicial);

    p.jogos = Number(p.jogos) || 0;
    p.jogos_titular = Number(p.jogos_titular) || 0;
    p.jogos_reserva = Number(p.jogos_reserva) || 0;
    p.minutos = Number(p.minutos) || 0;
    p.gols = Number(p.gols) || 0;
    p.assistencias = Number(p.assistencias) || 0;
    p.participacoes_gol = typeof p.participacoes_gol === "number" ? p.participacoes_gol : (p.gols + p.assistencias);
    p.nota_media = Number(p.nota_media) || 0.0;
    p.pct_minutos = Number(p.pct_minutos) || (p.minutos > 0 ? (p.minutos / 540) * 100 : 0.0);

    // 5. Confiança da Amostra Canônica (alta, moderada, baixa, nula)
    if (p.confianca_amostra_canonica) {
      p.confianca_amostra_canonica = String(p.confianca_amostra_canonica).toLowerCase().trim();
    } else {
      if (p.jogos >= 4 && p.minutos >= 270) {
        p.confianca_amostra_canonica = "alta";
      } else if (p.jogos >= 3 && p.minutos >= 150) {
        p.confianca_amostra_canonica = "moderada";
      } else if (p.jogos > 0) {
        p.confianca_amostra_canonica = "baixa";
      } else {
        p.confianca_amostra_canonica = "nula";
      }
    }

    // 6. Utilização Canônica (titular_efetivo, rotacao, suplente, sem_minutos)
    if (p.utilizacao_canonica) {
      p.utilizacao_canonica = String(p.utilizacao_canonica).toLowerCase().trim();
    } else {
      if (p.minutos >= 350) {
        p.utilizacao_canonica = "titular_efetivo";
      } else if (p.minutos >= 180) {
        p.utilizacao_canonica = "rotacao";
      } else if (p.minutos > 0) {
        p.utilizacao_canonica = "suplente";
      } else {
        p.utilizacao_canonica = "sem_minutos";
      }
    }

    p.valor_mercado = Number(p.valor_mercado) || 0;
    p.salario = Number(p.salario) || 0;
    p.multa_texto = String(p.multa_texto || "Sem multa rescisória").trim();
    p.contrato_fim = Number(p.contrato_fim) || 2026;
    p.anos_contrato = Number(p.anos_contrato) || 1;
    p.alerta_contrato = String(p.alerta_contrato || "Normal").trim();

    // Rótulos de exibição padronizados
    p.recomendacao_sistema = String(p.recomendacao_sistema || "Manter na Rotação").trim();
    p.motivo_recomendacao = String(p.motivo_recomendacao || "").trim();
    p.confianca_recomendacao = String(p.confianca_recomendacao || (
      p.confianca_amostra_canonica === "alta" ? "Alta (≥4J e ≥270m)" :
      p.confianca_amostra_canonica === "moderada" ? "Moderada (≥3J e ≥150m)" :
      p.confianca_amostra_canonica === "baixa" ? `Baixa — Amostra Insuficiente (${p.jogos}J / ${p.minutos}m)` : "Nula (Sem jogos)"
    )).trim();

    return p;
  }

  /**
   * Normaliza a estrutura completa da carreira garantindo separação das competições.
   */
  function normalizeCareerData(rawData) {
    const safeRaw = (rawData && typeof rawData === "object") ? rawData : {};
    const data = Object.assign({}, safeRaw);

    // Sanitizar caminhos do save (remover caminhos absolutos do Windows)
    data.save_file = String(data.save_file || "CmMgrSave").replace(/^.*[\\\/]/, "");
    data.save_path = data.save_file ? `saves/${data.save_file}` : "saves/CmMgrSave";
    data.updated_at = String(data.updated_at || "").trim();

    // Normalizar elenco
    const rawSquad = Array.isArray(data.squad) ? data.squad : [];
    data.squad = rawSquad.map(normalizePlayerData).filter(Boolean);

    // Normalizar partidas
    data.matches = Array.isArray(data.matches) ? data.matches : [];
    data.player_match_logs = Array.isArray(data.player_match_logs) ? data.player_match_logs : [];

    // Normalizar clube e separação de competições
    const c = Object.assign({}, data.club || {});
    c.nome = String(c.nome || "Clube Indefinido").trim();
    c.treinador = String(c.treinador || "Treinador").trim();
    c.data_atual = (c.data_atual && String(c.data_atual).trim() !== "") ? String(c.data_atual).trim() : "Indisponível";
    c.temporada = String(c.temporada || "Temporada 1").trim();
    c.liga = String(c.liga || "Liga").trim();
    c.pais = String(c.pais || "Espanha").trim();

    // Separar estritamente Liga vs Pré-Temporada
    const matches = data.matches;
    const ligaMatches = matches.filter(m => m.tipo_competicao === "Liga Nacional" || (m.competicao && m.competicao.includes("Liga")));
    const copaMatches = matches.filter(m => m.tipo_competicao !== "Liga Nacional" && !(m.competicao && m.competicao.includes("Liga")));

    const wLiga = ligaMatches.filter(m => m.resultado === "Vitória" || m.resultado === "V").length;
    const dLiga = ligaMatches.filter(m => m.resultado === "Empate" || m.resultado === "E").length;
    const lLiga = ligaMatches.filter(m => m.resultado === "Derrota" || m.resultado === "D").length;
    const gpLiga = ligaMatches.reduce((acc, m) => acc + (Number(m.gols_pro) || 0), 0);
    const gcLiga = ligaMatches.reduce((acc, m) => acc + (Number(m.gols_contra) || 0), 0);

    const wCopa = copaMatches.filter(m => m.resultado === "Vitória" || m.resultado === "V").length;
    const dCopa = copaMatches.filter(m => m.resultado === "Empate" || m.resultado === "E").length;
    const lCopa = copaMatches.filter(m => m.resultado === "Derrota" || m.resultado === "D").length;
    const gpCopa = copaMatches.reduce((acc, m) => acc + (Number(m.gols_pro) || 0), 0);
    const gcCopa = copaMatches.reduce((acc, m) => acc + (Number(m.gols_contra) || 0), 0);

    c.competicoes_separadas = {
      liga: {
        nome: c.liga,
        categoria: "Liga Nacional",
        posicao: Number(c.posicao_liga) || 1,
        pontos: Number(c.pontos_liga) || (wLiga * 3 + dLiga),
        jogos: ligaMatches.length,
        vitorias: wLiga,
        empates: dLiga,
        derrotas: lLiga,
        gols_pro: gpLiga,
        gols_contra: gcLiga,
        saldo: gpLiga - gcLiga,
        aproveitamento_pct: ligaMatches.length > 0 ? Math.round(((wLiga * 3 + dLiga) / (ligaMatches.length * 3)) * 1000) / 10 : 0
      },
      pre_temporada: {
        nome: "Champions Trophy",
        categoria: "Pré-Temporada",
        titulo: String(c.titulo_pre_temporada || "Participação"),
        jogos: copaMatches.length,
        vitorias: wCopa,
        empates: dCopa,
        derrotas: lCopa,
        gols_pro: gpCopa,
        gols_contra: gcCopa,
        saldo: gpCopa - gcCopa,
        pontos: wCopa * 3 + dCopa
      },
      total_temporada: {
        jogos: matches.length,
        vitorias: wLiga + wCopa,
        empates: dLiga + dCopa,
        derrotas: lLiga + lCopa,
        gols_pro: gpLiga + gpCopa,
        gols_contra: gcLiga + gcCopa,
        saldo: (gpLiga + gpCopa) - (gcLiga + gcCopa),
        invicto: (lLiga + lCopa === 0 && matches.length > 0)
      }
    };

    // Última partida disputada
    if (!c.ultima_partida && matches.length > 0) {
      const sortedMatches = matches.slice().sort((a, b) => (Number(a.date_int) || 0) - (Number(b.date_int) || 0));
      const last = sortedMatches[sortedMatches.length - 1];
      c.ultima_partida = {
        id: last.id,
        data: last.data,
        competicao: last.competicao,
        adversario: last.adversario,
        mando: last.mando,
        placar: last.placar,
        resultado: last.resultado,
        artilheiros: last.artilheiros || "—"
      };
    }

    data.club = c;

    // Normalizar auditoria
    data.validation_report = normalizeValidationReport(data.validation_report);

    return data;
  }

  /**
   * Normaliza o relatório de auditoria calculando indicadores reais sem nenhum fallback fictício.
   */
  function normalizeValidationReport(rawReport) {
    if (!rawReport || typeof rawReport !== "object" || !Array.isArray(rawReport.checks)) {
      return {
        status_geral: "nao_executado",
        total_verificados: 0,
        total_parciais: 0,
        total_falhas: 0,
        total_nao_executados: 0,
        total_testes: 0,
        summary_badge: "Auditoria Não Executada",
        checks: []
      };
    }

    const checks = rawReport.checks.map(chk => {
      const c = Object.assign({}, chk);
      c.id = Number(c.id) || 0;
      c.titulo = String(c.titulo || c.nome || "Teste").trim();
      c.resumo = String(c.resumo || c.detalhes || "").trim();
      c.regra = String(c.regra || "").trim();

      const stUpper = String(c.status || "").toUpperCase();
      if (stUpper.startsWith("OK") || stUpper.includes("VERIFICADO")) {
        c.status_canonico = "verificado";
        c.status_label = "VERIFICADO";
      } else if (stUpper.startsWith("PARCIAL") || stUpper.includes("PARCIAL")) {
        c.status_canonico = "parcial";
        c.status_label = "PARCIAL";
      } else if (stUpper.includes("ERRO") || stUpper.includes("FALHA") || stUpper.includes("DIVERGÊNCIA") || stUpper.includes("DIVERGENCIA")) {
        c.status_canonico = "falhou";
        c.status_label = "FALHOU";
      } else if (stUpper.includes("NÃO EXECUTADO") || stUpper.includes("NAO EXECUTADO")) {
        c.status_canonico = "nao_executado";
        c.status_label = "NÃO EXECUTADO";
      } else {
        c.status_canonico = "nao_verificavel";
        c.status_label = "NÃO VERIFICÁVEL";
      }
      return c;
    });

    const totalVerificados = checks.filter(c => c.status_canonico === "verificado").length;
    const totalParciais = checks.filter(c => c.status_canonico === "parcial").length;
    const totalFalhas = checks.filter(c => c.status_canonico === "falhou").length;
    const totalNaoExecutados = checks.filter(c => c.status_canonico === "nao_executado").length;
    const totalTestes = checks.length;

    let statusGeral = "aprovado";
    if (totalFalhas > 0) {
      statusGeral = "reprovado";
    } else if (totalParciais > 0 || totalNaoExecutados > 0) {
      statusGeral = "aprovado_com_ressalvas";
    }

    return {
      status_geral: statusGeral,
      total_verificados: totalVerificados,
      total_parciais: totalParciais,
      total_falhas: totalFalhas,
      total_nao_executados: totalNaoExecutados,
      total_testes: totalTestes,
      summary_badge: totalFalhas > 0 ? `${totalFalhas} Falhas Detectadas` : `${totalVerificados} Verificados · ${totalParciais} Parcial`,
      checks: checks
    };
  }

  // ==========================================================================
  // FILTRAGEM E ORDENAÇÃO DE ELENCO
  // ==========================================================================

  /**
   * Filtra o elenco usando valores canônicos (sem falhas de 'Titular (ZAG)' vs 'titular').
   */
  function filterSquad(squad, filters) {
    if (!Array.isArray(squad)) return [];
    if (!filters || typeof filters !== "object") return squad.slice();

    const search = String(filters.search || "").trim().toLowerCase();
    const sector = String(filters.sector || "all").toLowerCase();
    const hierarchy = String(filters.hierarchy || "all").toLowerCase();
    const confidence = String(filters.confidence || "all").toLowerCase();
    const utilization = String(filters.utilization || "all").toLowerCase();

    return squad.filter(player => {
      // 1. Busca textual (nome, nome completo, posição principal, posições secundárias)
      if (search) {
        const nameMatch = (player.nome || "").toLowerCase().includes(search) ||
                          (player.nome_completo || "").toLowerCase().includes(search) ||
                          (player.posicao_principal || "").toLowerCase().includes(search) ||
                          (player.posicoes_secundarias || "").toLowerCase().includes(search);
        if (!nameMatch) return false;
      }

      // 2. Filtro de setor canônico
      if (sector !== "all") {
        if (player.setor_canonico !== sector) return false;
      }

      // 3. Filtro de hierarquia tática canônica
      if (hierarchy !== "all") {
        if (hierarchy === "titular") {
          if (player.hierarquia_tatica !== "titular") return false;
        } else if (hierarchy === "reserva" || hierarchy === "banco") {
          if (player.hierarquia_tatica !== "reserva") return false;
        } else if (hierarchy === "nao_relacionado") {
          if (player.hierarquia_tatica !== "nao_relacionado") return false;
        }
      }

      // 4. Filtro de confiança de amostra canônica
      if (confidence !== "all") {
        if (player.confianca_amostra_canonica !== confidence) return false;
      }

      // 5. Filtro de utilização canônica
      if (utilization !== "all") {
        if (player.utilizacao_canonica !== utilization) return false;
      }

      return true;
    });
  }

  /**
   * Ordena o elenco de forma segura por campo e direção.
   */
  function sortSquad(squad, sortBy, sortOrder) {
    if (!Array.isArray(squad)) return [];
    const list = squad.slice();
    const field = sortBy || "minutos";
    const isAsc = String(sortOrder).toLowerCase() === "asc";

    return list.sort((a, b) => {
      let valA = a[field];
      let valB = b[field];

      // Tratar nulls e undefineds: sempre jogados para o final
      if (valA === undefined || valA === null || valA === "N/D" || valA === "S/N") valA = -Infinity;
      if (valB === undefined || valB === null || valB === "N/D" || valB === "S/N") valB = -Infinity;

      if (typeof valA === "string" && typeof valB === "string") {
        return isAsc ? valA.localeCompare(valB, "pt-BR") : valB.localeCompare(valA, "pt-BR");
      }

      valA = Number(valA);
      valB = Number(valB);
      if (isNaN(valA)) valA = -Infinity;
      if (isNaN(valB)) valB = -Infinity;

      return isAsc ? valA - valB : valB - valA;
    });
  }

  /**
   * Filtra os logs individuais de partida.
   */
  function filterMatchLogs(logs, filters) {
    if (!Array.isArray(logs)) return [];
    if (!filters || typeof filters !== "object") return logs.slice();

    const search = String(filters.search || "").trim().toLowerCase();
    const comp = String(filters.competition || "all").toLowerCase();
    const matchId = String(filters.matchId || "all");

    return logs.filter(log => {
      if (search) {
        const nameMatch = (log.nome || "").toLowerCase().includes(search) ||
                          (log.posicao_jogada || "").toLowerCase().includes(search);
        if (!nameMatch) return false;
      }

      if (comp !== "all") {
        const tipoComp = String(log.tipo_competicao || "").toLowerCase();
        const compName = String(log.competicao || "").toLowerCase();
        if (comp === "liga" && !tipoComp.includes("liga") && !compName.includes("liga")) return false;
        if ((comp === "copa" || comp === "pretemporada") && (tipoComp.includes("liga") || compName.includes("liga"))) return false;
      }

      if (matchId !== "all") {
        if (String(log.match_id) !== matchId) return false;
      }

      return true;
    });
  }

  // ==========================================================================
  // FORMATAÇÃO E ESCAPE SEGURO
  // ==========================================================================

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatCurrency(val) {
    const num = Number(val);
    if (isNaN(num)) return "€ 0";
    return `€ ${num.toLocaleString("pt-BR")}`;
  }

  function formatNumber(val, decimals) {
    const num = Number(val);
    if (isNaN(num)) return "0";
    if (typeof decimals === "number") {
      return num.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    return num.toLocaleString("pt-BR");
  }

  function formatPercent(val) {
    const num = Number(val);
    if (isNaN(num)) return "0,0%";
    return `${num.toFixed(1).replace(".", ",")}%`;
  }

  function formatRating(val) {
    const num = Number(val);
    if (isNaN(num) || num <= 0) return "-";
    return num.toFixed(2);
  }

  return {
    normalizePlayerData: normalizePlayerData,
    normalizeCareerData: normalizeCareerData,
    normalizeValidationReport: normalizeValidationReport,
    filterSquad: filterSquad,
    sortSquad: sortSquad,
    filterMatchLogs: filterMatchLogs,
    escapeHtml: escapeHtml,
    formatCurrency: formatCurrency,
    formatNumber: formatNumber,
    formatPercent: formatPercent,
    formatRating: formatRating
  };
});
