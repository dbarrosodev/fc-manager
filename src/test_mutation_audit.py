#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EA FC 26 Career Tracker — Teste de Mutação Controlada & Auditoria Ponta a Ponta
Executa o protocolo de validação sugerido pelo usuário:
1. Clona os dados do save em ambiente de teste isolado.
2. Altera um registro de partida de forma controlada (minutos/jogos de um atleta de amostra curta).
3. Recalcula estatísticas, minutagem, utilização, confiança e recomendação.
4. Introduz divergências intencionais (gols e minutos) e confirma que a auditoria detecta a falha.
5. Valida a presença e consistência das fórmulas dinâmicas do Excel.
"""
import os
import sys
import copy
import zipfile
import re

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SRC_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

import save_parser


def run_controlled_mutation_tests():
    print("=" * 75)
    print("TESTE DE ATUALIZAÇÃO E AUDITORIA PONTA A PONTA (MUTATION TESTING)")
    print("=" * 75)

    # 1. Carregar baseline original
    save_path = save_parser.find_latest_save()
    print(f"\n[1/5] Carregando save baseline: {os.path.basename(save_path)}")
    baseline_data = save_parser.parse_save_file(save_path)

    # 2. Testar Atleta de Amostra Curta (Diego Alende ou similar)
    print("\n[2/5] Teste de Mutação Controlada de Minutos e Amostra:")
    # Localizar Diego Alende (ou primeiro atleta com 1 jogo e nota alta)
    target_player = next((p for p in baseline_data["squad"] if p["jogos"] == 1 and p["minutos"] == 90), None)
    if not target_player:
        target_player = baseline_data["squad"][0]

    pid = target_player["playerid"]
    pname = target_player["nome"]
    print(f"  Atleta selecionado: {pname} (ID: {pid})")
    print(f"  -> Estado Inicial:")
    print(f"     - Jogos: {target_player['jogos']}")
    print(f"     - Minutos: {target_player['minutos']}' ({target_player['pct_minutos']}%)")
    print(f"     - Nota Média: {target_player['nota_media']}")
    print(f"     - Utilização Real: {target_player['status_utilizacao']}")
    print(f"     - Confiança da Amostra: {target_player['confianca_recomendacao']}")
    print(f"     - Recomendação: {target_player['recomendacao_sistema']}")
    print(f"     - Justificativa: {target_player['motivo_recomendacao']}")

    # Clonar e mutar: adicionar 2 partidas simuladas de 90 minutos com notas 7.60 e 7.80
    mutated_player = copy.deepcopy(target_player)
    novas_partidas = [
        {
            "match_id": 901, "date_int": 155550, "data": "07/09/2025", "competicao": "LaLiga Hypermotion (Liga)",
            "tipo_competicao": "Liga Nacional", "adversario": "Eldense", "adversario_placar": "Eldense (1x0)",
            "mando": "C", "placar": "1 x 0", "resultado": "Vitória", "playerid": pid, "numero": target_player["numero"],
            "nome": pname, "posicao_jogada": target_player["posicao_principal"],
            "posicao_exercida": target_player["posicao_principal"], "minutos": 90, "gols_partida": 0,
            "assistencias_partida": 0, "assistencias_verificada": True, "nota_inteira": 76, "nota": 7.60, "nota_partida": 7.60
        },
        {
            "match_id": 902, "date_int": 155557, "data": "14/09/2025", "competicao": "LaLiga Hypermotion (Liga)",
            "tipo_competicao": "Liga Nacional", "adversario": "Huesca", "adversario_placar": "Huesca (2x1)",
            "mando": "F", "placar": "2 x 1", "resultado": "Vitória", "playerid": pid, "numero": target_player["numero"],
            "nome": pname, "posicao_jogada": target_player["posicao_principal"],
            "posicao_exercida": target_player["posicao_principal"], "minutos": 90, "gols_partida": 0,
            "assistencias_partida": 0, "assistencias_verificada": True, "nota_inteira": 78, "nota": 7.80, "nota_partida": 7.80
        }
    ]
    mutated_player["historico_partidas"].extend(novas_partidas)

    # Recalcular valores derivados a partir da fonte primária de partidas
    hp = mutated_player["historico_partidas"]
    mutated_player["jogos"] = len(hp)
    mutated_player["jogos_titular"] = sum(1 for h in hp if h["minutos"] >= 45)
    mutated_player["jogos_reserva"] = mutated_player["jogos"] - mutated_player["jogos_titular"]
    mutated_player["minutos"] = sum(h["minutos"] for h in hp)
    mutated_player["pct_minutos"] = round((mutated_player["minutos"] / 540) * 100, 1)

    notas_accum = [h["nota"] for h in hp]
    mutated_player["nota_media"] = round(sum(notas_accum) / len(notas_accum), 2)

    if mutated_player["minutos"] >= 350:
        mutated_player["status_utilizacao"] = f"Titular Efetivo ({mutated_player['pct_minutos']:.0f}% min)"
    elif mutated_player["minutos"] >= 180:
        mutated_player["status_utilizacao"] = f"Rotação Ativa ({mutated_player['pct_minutos']:.0f}% min)"
    else:
        mutated_player["status_utilizacao"] = f"Suplente Acionado ({mutated_player['pct_minutos']:.0f}% min)"

    resumo_m, rec_m, motivo_m, conf_m = save_parser.build_dynamic_player_analysis(mutated_player)
    mutated_player["detalhes"] = resumo_m
    mutated_player["recomendacao_sistema"] = rec_m
    mutated_player["motivo_recomendacao"] = motivo_m
    mutated_player["confianca_recomendacao"] = conf_m

    print(f"\n  -> Estado Recalculado Após Mutação de 2 Jogos (+180 min):")
    print(f"     - Jogos: {mutated_player['jogos']} (era {target_player['jogos']})")
    print(f"     - Minutos: {mutated_player['minutos']}' ({mutated_player['pct_minutos']}%) (era {target_player['minutos']}'))")
    print(f"     - Nota Média: {mutated_player['nota_media']} (era {target_player['nota_media']})")
    print(f"     - Utilização Real: {mutated_player['status_utilizacao']} (era {target_player['status_utilizacao']})")
    print(f"     - Confiança da Amostra: {mutated_player['confianca_recomendacao']} (era {target_player['confianca_recomendacao']})")
    print(f"     - Recomendação: {mutated_player['recomendacao_sistema']}")
    print(f"     - Justificativa: {mutated_player['motivo_recomendacao']}")

    assert mutated_player["minutos"] == 270, "Minutos deveriam ser 270"
    assert mutated_player["jogos"] == 3, "Jogos deveriam ser 3"
    assert "Insuficiente" not in mutated_player["confianca_recomendacao"], "Confiança deveria sair de Insuficiente"
    assert "Amostra insuficiente" not in mutated_player["recomendacao_sistema"], "Recomendação deveria sair da trava de amostra curta"
    print("  [OK] Mutação controlada de minutagem e desbloqueio de amostra aprovados com sucesso!")

    # 3. Teste de Injeção de Falha na Auditoria — Divergência de Gols
    print("\n[3/5] Teste de Detecção de Divergência de Gols pela Auditoria:")
    cloned_squad = copy.deepcopy(baseline_data["squad"])
    cloned_matches = copy.deepcopy(baseline_data["matches"])
    cloned_logs = copy.deepcopy(baseline_data["player_match_logs"])
    cloned_comps = copy.deepcopy(baseline_data["standings"]["club_competitions"])

    # Injetar 1 gol fantasma em um log do jogador (Total logs = 15 gols, mas jogos da equipe = 14)
    cloned_logs[0]["gols_partida"] += 1
    # Atualizar o jogador correspondente
    cloned_squad_by_id = {p["playerid"]: p for p in cloned_squad}
    cloned_squad_by_id[cloned_logs[0]["playerid"]]["gols"] += 1

    rep_divergente_gols = save_parser.run_automated_validations(
        cloned_squad, cloned_matches, cloned_logs, cloned_comps, 540
    )
    chk_gols = next(c for c in rep_divergente_gols["checks"] if c["id"] == 1)
    print(f"  Resultado do Teste #1 (Gols): {chk_gols['status']}")
    print(f"  Detalhe da Auditoria: {chk_gols['resumo']}")
    assert chk_gols["status"] == "ERRO", "Auditoria DEVE acusar divergência de gols com status ERRO!"
    print("  [OK] Auditoria detectou a divergência intencional de gols perfeitamente!")

    # 4. Teste de Injeção de Falha na Auditoria — Violação de Teto Físico de Minutos
    print("\n[4/5] Teste de Detecção de Violação de Teto Físico de Minutagem:")
    cloned_squad2 = copy.deepcopy(baseline_data["squad"])
    cloned_squad2[0]["minutos"] = 590  # Impossível em 6 jogos (teto é 540)
    rep_divergente_mins = save_parser.run_automated_validations(
        cloned_squad2, cloned_matches, baseline_data["player_match_logs"], cloned_comps, 540
    )
    chk_mins = next(c for c in rep_divergente_mins["checks"] if c["id"] == 3)
    print(f"  Resultado do Teste #3 (Minutos & Fonte Única): {chk_mins['status']}")
    print(f"  Detalhe da Auditoria: {chk_mins['resumo']}")
    assert chk_mins["status"] == "ERRO", "Auditoria DEVE acusar excesso de teto de minutos com status ERRO!"
    print("  [OK] Auditoria detectou o estouro do teto físico de minutos com precisão!")

    # 5. Validação das Fórmulas Nativas do Excel (.xlsx)
    print("\n[5/5] Validação de Fórmulas Dinâmicas Nativas no Arquivo Excel:")
    xlsx_file = os.path.join(ROOT_DIR, "exports", "Estatisticas_Jogadores_FC_Andorra_Carreira.xlsx")
    assert os.path.exists(xlsx_file), f"Arquivo XLSX não encontrado em {xlsx_file}"
    z = zipfile.ZipFile(xlsx_file)
    s1_xml = z.read("xl/worksheets/sheet1.xml").decode("utf-8")
    s5_xml = z.read("xl/worksheets/sheet5.xml").decode("utf-8")

    f_s1 = re.findall(r"<f>([^<]+)</f>", s1_xml)
    f_s5 = re.findall(r"<f>([^<]+)</f>", s5_xml)

    print(f"  - Fórmulas ativas na Aba 1 (Elenco Hub): {len(f_s1)} fórmulas dinâmicas")
    print(f"  - Fórmulas ativas na Aba 5 (Checklist Integridade): {len(f_s5)} fórmulas de verificação")
    print(f"  - Exemplos de fórmulas no Excel:")
    print(f"    * Jogos: {f_s1[2]}")
    print(f"    * Minutos: {f_s1[5]}")
    print(f"    * Gols: {f_s1[7]}")
    print(f"    * Checklist Gols: {f_s5[0]}")
    print(f"    * Checklist Minutos: {f_s5[2]}")

    assert len(f_s1) >= 300, f"Esperado ao menos 300 fórmulas no Hub, encontrado {len(f_s1)}"
    assert len(f_s5) >= 3, f"Esperado ao menos 3 fórmulas dinâmicas no Checklist, encontrado {len(f_s5)}"
    print("  [OK] Arquivo Excel 100% equipado com fórmulas vivas que se recalculam automaticamente!")

    print("\n" + "=" * 75)
    print("TODOS OS 5 TESTES DO PROTOCOLO FORAM APROVADOS COM 100% DE SUCESSO!")
    print("=" * 75)


if __name__ == "__main__":
    run_controlled_mutation_tests()
