# FC Manager — Plano Arquitetural & Especificação do Sistema (v3.2)

## 1. Visão Geral do Sistema

O **FC Manager** é um aplicativo desktop-first para acompanhamento de carreiras do EA SPORTS FC 26, projetado para operar em dois ambientes complementares:
1. **GitHub Pages (Estático):** Hospedagem estática de alto desempenho consumindo `career_data.json` e bundle `career_data.js`.
2. **Servidor Local Python (`src/app.py`):** Servidor HTTP local com suporte a descompressão Oodle, parsing binário em tempo real e atualização de arquivos de save.

---

## 2. Camadas Arquiteturais

```
┌────────────────────────────────────────────────────────┐
│            Interface Web (index.html)                  │
│   Visão Geral · Elenco · Partidas · Competições · Save │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│          Controlador de UI (assets/js/main.js)         │
│  Gestão de Estado · Eventos · Modais ARIA · Toasts     │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│        Núcleo de Domínio Puro (assets/js/domain.js)    │
│  Normalização Canônica · Filtros · Ordenação · XSS     │
└──────────────────────────┬─────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
┌──────────▼───────────────┐   ┌───────────▼────────────┐
│    GitHub Pages (Web)    │   │  Servidor Local (API)  │
│ assets/data/career_data  │   │ /api/data, /api/reload │
└──────────────────────────┘   └───────────┬────────────┘
                                           │
                               ┌───────────▼────────────┐
                               │ Extrator (save_parser) │
                               │ DB1/DB2 + Oodle + Exps │
                               └────────────────────────┘
```

---

## 3. Modelo de Dados Canônico

Para eliminar inconsistências causadas por strings compostas geradas em versões anteriores da planilha ou do extrator, o sistema introduz quatro campos canônicos normalizados em cada registro de atleta:

1. **`setor_canonico`**: `"goleiro" | "defesa" | "meio" | "ataque"`
2. **`hierarquia_tatica`**: `"titular" | "reserva" | "nao_relacionado"`
3. **`confianca_amostra_canonica`**: `"alta" | "moderada" | "baixa" | "nula"`
   - `alta`: $\ge 4$ jogos e $\ge 270$ minutos.
   - `moderada`: $\ge 3$ jogos e $\ge 150$ minutos.
   - `baixa`: $> 0$ jogos, mas $< 3$ jogos ou $< 150$ minutos (sob observação).
   - `nula`: $0$ minutos disputados.
4. **`utilizacao_canonica`**: `"titular_efetivo" | "rotacao" | "suplente" | "sem_minutos"`

---

## 4. Separação Estrita de Competições

As estatísticas da carreira são divididas explicitamente no objeto `club.competicoes_separadas`:

| Competição | Jogos | V | E | D | GP | GC | Pontos | Observações |
|------------|-------|---|---|---|----|----|--------|-------------|
| **LaLiga Hypermotion (Liga)** | 3 | 2 | 1 | 0 | 8 | 2 | 7 | 2º Lugar na classificação oficial |
| **Champions Trophy (Pré-Temporada)** | 3 | 2 | 1 | 0 | 6 | 1 | — | Campeão Invicto (+€ 1.100.000) |
| **Campanha Total** | 6 | 4 | 2 | 0 | 14 | 3 | — | 14 gols individuais reconciliados |

---

## 5. Protocolo de Auditoria e Integridade Contábil

O checklist de validação executa 9 regras técnicas:
1. **Reconciliação de Gols da Equipe vs Logs Individuais:** Partidas (14 GP) == Logs (14 GP) == Elenco (14 GP).
2. **Consistência de Assistências por Competição:** Relato transparente com classificação `PARCIAL (N/D NO BINÁRIO)` para jogadores com assistências e múltiplos jogos.
3. **Consistência de Minutos e Fonte Única:** Minutos no elenco rigorosamente iguais à soma dos logs de cada atleta.
4. **Respeito ao Teto Físico de Minutagem:** Nenhum atleta ultrapassa o limite de 540 minutos em 6 partidas.
5. **Classificação e Pontuação da Liga:** 3 jogos, 7 pontos, saldo +6.
6. **Classificação da Pré-Temporada:** 3 jogos, 7 pontos, saldo +5, troféu confirmado.
7. **Consistência da Evolução:** `POT >= OVR` para 100% dos atletas.
8. **Validação de Folha e Valores Financeiros:** Folha semanal de € 90.400 e valor de mercado de € 46.250.000 auditados.
9. **Hierarquia Tática vs Minutos:** Distinção explícita entre a escalação tática definida pelo treinador e a minutagem real acumulada.

---

## 6. Cobertura da Suíte de Testes (tests/test_audit_suite.py)

A suíte cobre 18 cenários automatizados:
1. Carregamento de JSON válido e ausência de caminhos de usuário.
2. Fallback estático `career_data.js`.
3. Tratamento de entradas nulas ou vazias.
4. Rejeição segura de JSON inválido.
5. Indicação honesta de datas sem fake `01/01/2008`.
6. Filtragem por hierarquia com status compostos (`Titular (ZAG)`).
7. Busca flexível por nome, sobrenome e posição.
8. Ordenação bidirecional com tratamento de nulos.
9. Tratamento de valores zero, nulos e `N/D`.
10. Separação contábil entre Liga e Pré-Temporada.
11. Reconciliação dos gols por partida.
12. Minutos totais derivados diretamente dos logs.
13. Auditoria sem fallback arbitrário `|| 8`.
14. Respostas adequadas do servidor local a falhas.
15. Consistência entre exportações CSV/Excel e JSON.
16. Sanitização contra injeção de HTML/XSS.
17. Navegação acessível e fechamento de modal via `Escape`.
18. Responsividade de layout e numerais tabulares.
