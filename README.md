# FC Manager — EA SPORTS FC 26 Career Tracker (v3.2)

> **Aplicação desktop-first de análise de desempenho, auditoria e gestão de elenco para carreiras do EA SPORTS FC 26.**  
> Inspirado na linguagem visual de ferramentas de análise esportiva profissional (Wyscout, Transfermarkt Pro, Football Manager).

[![Auditoria de Integridade](https://img.shields.io/badge/Testes-34%2F34%20Aprovados-10b981?style=flat-square)](tests/)
[![Deploy](https://img.shields.io/badge/Deploy-GitHub%20Pages%20Ready-38bdf8?style=flat-square)](https://dbarrosodev.github.io/fc-manager/)
[![Modo](https://img.shields.io/badge/Execução-Estática%20%2B%20Servidor%20Local-1e293b?style=flat-square)](#como-executar-localmente)

---

## 🌟 Visão Geral do Produto

O **FC Manager** é uma ferramenta pessoal de alta precisão desenvolvida para acompanhar carreiras no Modo Carreira do EA SPORTS FC 26. O sistema combina:
- **Engenharia Reversa de Saves Binários:** Descompressão de blocos proprietários do EA FC (Oodle Kraken + bancos relacionais DB1/DB2).
- **Fonte Primária da Verdade:** Estatísticas individuais e minutos calculados a partir dos logs primários de cada partida disputada.
- **Separação Contábil Estrita:** Métricas de competições oficiais (LaLiga 2) isoladas de amistosos e pré-temporada (Champions Trophy).
- **Checklist Técnico Contínuo:** Protocolo automatizado de 9 testes de integridade contábil executado a cada sincronização.
- **Camada Pura de Domínio (`domain.js`):** Regras de negócio puras, determinísticas e testáveis, executáveis tanto no navegador quanto no Node.js.
- **Segurança & Privacidade:** Saves binários pessoais ficam estritamente locais (`.gitignore`), com sanitização de caminhos absolutos do sistema operacional.

---

## 📁 Estrutura do Repositório

```text
fc-manager/
├── .nojekyll                                  # Instrução para GitHub Pages servir assets sem restrições
├── .gitignore                                 # Ignora binários de saves (*.save, saves/*), caches e temporários
├── requirements.txt                           # Dependências Python mínimas (XlsxWriter)
├── iniciar_tracker.bat                        # Inicializador rápido de duplo clique no Windows
├── index.html                                 # Web App desktop-first sem fallbacks hardcoded falsos
│
├── assets/
│   ├── css/
│   │   └── styles.css                         # Design system esportivo: canvas grafite (#0b0f14), números tabulares
│   ├── js/
│   │   ├── domain.js                          # Núcleo puro de regras, normalização canônica, filtros e sanitização
│   │   └── main.js                            # Controlador de UI reativo, gestão de abas, modais acessíveis e toasts
│   └── data/
│       ├── career_data.json                   # Base de dados estruturada auditada para o GitHub Pages
│       ├── career_data.js                     # Bundle JS com fallback offline seguro e sanitizado
│       ├── baseline_snapshot.json             # Snapshot inicial da temporada para aferição de evolução
│       └── careers_archive.json               # Histórico acumulado multi-carreira
│
├── exports/
│   ├── Estatisticas_Jogadores_FC_Andorra_Carreira.xlsx  # Pasta de trabalho com 5 abas e fórmulas nativas do Excel
│   └── Estatisticas_Jogadores_FC_Andorra_Carreira.csv   # Exportação CSV tabular com delimitador padrão
│
├── src/
│   ├── save_parser.py                         # Extrator de binários, consolidador estatístico e validador
│   ├── app.py                                 # Servidor HTTP local (porta 8080) com APIs de sincronização
│   ├── test_mutation_audit.py                 # Protocolo de testes de mutação controlada (minutagem e tetos)
│   ├── schema_meta.json                       # Metadados de esquemas das tabelas binárias do save
│   └── playernames.csv                        # Base de nomes de referência
│
├── saves/
│   └── .gitkeep                               # Pasta mantida no Git sem versionar arquivos binários pessoais
│
├── tests/
│   ├── test_audit_suite.py                    # Suíte oficial de regressão e auditoria (18 cenários completos)
│   ├── test_match_regression.py               # Regressões do último confronto e das cores de resultado (UI real)
│   ├── test_public_data_privacy.py            # Garante que dados publicados não expõem o save pessoal
│   └── ui_harness.js                          # Executa main.js com DOM simulado para testes de renderização
│
└── docs/
    └── plan.md                                # Plano arquitetural e especificações funcionais
```

---

## 🧭 As 5 Abas Principais

1. **Visão Geral:** Hero card do último jogo oficial com atalho para ficha técnica, destaque da premiação e status na competição ativa, além do *Radar de Atenção do Elenco* (top artilheiros, melhores notas consolidadas, atletas sob observação por amostra curta e contratos com vencimento próximo).
2. **Elenco:** Hub completo do elenco com filtros reativos por busca textual, setor tático canônico, hierarquia na escalação e nível de confiança amostral. Cabeçalhos clicáveis com indicadores de ordenação e abertura de ficha individual.
3. **Partidas & Logs:** Calendário com placares e fichas técnicas completas de cada partida, acompanhado da tabela de atuações primárias jogo a jogo com filtro por jogador, competição e partida.
4. **Competições:** Classificação auditada da liga nacional (LaLiga Hypermotion) e tabela de pré-temporada (Champions Trophy) com destaque visual na linha do clube.
5. **Carreira & Auditoria:** Painel de auditoria honesto com contadores reais (Verificados, Parciais, Falhas, Total), tabela detalhada dos 9 testes de integridade, seletor de saves locais e links de exportação.

---

## 🧪 Suíte de Testes Automatizada (34 Cenários)

O projeto conta com validação contínua. A suíte de auditoria original cobre 18 cenários críticos:

```bash
python tests/test_audit_suite.py
```

| # | Cenário de Teste | Validação Executada |
|---|------------------|---------------------|
| 1 | **Carregamento de JSON Válido** | Estrutura correta e garantia de zero vazamento de caminhos de usuário (`C:\Users\`). |
| 2 | **Fallback Estático Válido** | `window.FALLBACK_CAREER_DATA` íntegro e compatível com o schema principal. |
| 3 | **Ausência de Dados** | Resiliência a entradas `null` ou vazias sem lançamento de exceção não tratada. |
| 4 | **JSON Inválido** | Rejeição segura de arquivos corrompidos. |
| 5 | **Tratamento de Data Ausente** | Exibição de `"Data não informada"` sem jamais exibir datas falsas como `01/01/2008`. |
| 6 | **Filtro de Hierarquia Canônico** | Mapeamento correto de rótulos como `"Titular (ZAG)"` e `"Suplente (Banco)"`. |
| 7 | **Busca Textual Flexível** | Localização por nome, sobrenome ou sigla de posição (`MC`, `ZAG`). |
| 8 | **Ordenação Bidirecional** | Classificação ascendente e descendente com tratamento de nulos. |
| 9 | **Valores Zero, Nulos e N/D** | Formatação limpa de notas zeradas (`"-"`) e preservação de assistências `N/D`. |
| 10 | **Separação de Competições** | Isolamento de LaLiga 2 (3J, 8 GP, 2 GC, 7 pts) e Pré-temporada (3J, 6 GP, 1 GC). |
| 11 | **Reconciliação de Gols** | Soma dos gols individuais dos logs rigorosamente igual aos gols da equipe (14 gols). |
| 12 | **Minutagem Primária** | Soma dos minutos dos logs individuais rigorosamente igual à minutagem no elenco. |
| 13 | **Auditoria Transparente** | Relatórios incompletos exibem contagens reais sem fallback fixo `|| 8`. |
| 14 | **Falha de Sincronização Local** | APIs locais respondem com status HTTP adequado e payload de erro JSON. |
| 15 | **Consistência de Exportação** | Linhas e números do CSV e da planilha Excel batem integralmente com o JSON. |
| 16 | **Sanitização XSS** | Escape HTML rigoroso de strings potencialmente maliciosas. |
| 17 | **Navegação Acessível** | Modais com atributos ARIA e suporte a fechamento pela tecla `Escape`. |
| 18 | **Responsividade & Numerais** | Tabelas com scroll horizontal seguro e numerais tabulares esportivos. |

### Regressões da revisão v3.2 (`tests/test_match_regression.py`)

Testes de domínio **e de renderização**: `tests/ui_harness.js` executa o `main.js` real com um DOM simulado (sem navegador) e verifica o texto que a interface escreve na tela.

| # | Cenário de Teste | Validação Executada |
|---|------------------|---------------------|
| 19 | **Último confronto — resumo legado** | `club.ultima_partida` sem mandante/placares é resolvido para o registro completo da partida. |
| 20 | **Último confronto — sem registro** | Resumo isolado é normalizado a partir de `mando`/`placar` (jogo fora inverte mandante/visitante). |
| 21 | **Último confronto — id obsoleto** | Resumo apontando para id inexistente cai para a partida mais recente por data. |
| 22 | **Último confronto — dado publicado** | O resumo publicado aponta para a partida mais recente. |
| 23 | **UI: card do último jogo** | O card nunca exibe `undefined`/`null` e mostra mandante, placar e visitante corretos. |
| 24 | **UI: ficha técnica** | Título e escalação da ficha sem `undefined` (posição, assistências, nota). |
| 25 | **Padronização de resultados** | `V`/`Vitória`/`W`, `E`/`Empate`, `D`/`Derrota` → valores canônicos; derivação pelo placar. |
| 26 | **Contagem com formatos mistos** | `V` e `Vitória` misturados produzem o mesmo total de V/E/D e pontos. |
| 27 | **UI: cores dos resultados** | `Vitória`→verde, `Empate`→empate, `Derrota`→derrota, com texto longo ou sigla. |
| 28 | **UI: cores com dados reais** | A cor de cada card coincide com o placar da partida publicada. |
| 29 | **Guarda estática** | `main.js` não volta a comparar resultado com `"V"`/`"E"` nem usar números fictícios. |

### Privacidade dos dados publicados (`tests/test_public_data_privacy.py`)

| # | Cenário de Teste | Validação Executada |
|---|------------------|---------------------|
| 30 | **Nenhum save versionado** | `saves/` contém apenas `.gitkeep`; nenhum `CmMgr*` rastreado pelo Git. |
| 31 | **Sem identificadores de save** | Dados publicados (JSON, JS, CSV) não contêm nomes reais de saves. |
| 32 | **Sem metadados de save** | `career_data.json` sem `save_path`, `available_saves` ou `ultimo_save`. |
| 33 | **Sanitizador do pipeline** | `sanitize_for_public_export` remove metadados sem alterar a cópia local. |
| 34 | **Cópia local ignorada** | `assets/data/local/` (dados completos para o servidor local) está no `.gitignore`. |

Para rodar todas as suítes (requer Python 3 e Node.js):

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```

---

## 💻 Execução Local com Sincronização em Tempo Real

1. Tenha o **Python 3** instalado em sua máquina.
2. Dê duplo clique no inicializador rápido **`iniciar_tracker.bat`** (ou execute no terminal):
   ```bash
   python src/app.py
   ```
3. O servidor iniciará em `http://127.0.0.1:8080` e abrirá a interface automaticamente no navegador padrão.
4. Para atualizar as estatísticas após novas partidas no EA FC 26:
   - Salve a carreira dentro do jogo.
   - Copie o arquivo gerado para a pasta `saves/`.
   - Clique em **"Sincronizar Save"** na barra superior para reprocessamento instantâneo.

---

## 🚀 Publicação no GitHub Pages

O repositório já está configurado na raiz para publicação imediata no GitHub Pages:
- Repositório oficial: `https://github.com/dbarrosodev/fc-manager.git`
- Acesso à aplicação web publicada: `https://dbarrosodev.github.io/fc-manager/`
