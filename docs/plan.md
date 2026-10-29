# FC Manager — Plano de Ação & Checklist de Auditoria e Correções (v3.2)

> **Documento de trabalho em formato de checklist ativo para orientar correções, auditoria pós-deploy e validação ponta a ponta.**

---

## 📋 Sumário do Checklist

- [x] [Fase 1: Diagnóstico de Versão e Alinhamento do Deploy](#fase-1-diagnóstico-de-versão-e-alinhamento-do-deploy)
- [x] [Fase 2: Privacidade e Limpeza de Dados Pessoais](#fase-2-privacidade-e-limpeza-de-dados-pessoais)
- [x] [Fase 3: Coerência dos Dados na Interface](#fase-3-coerência-dos-dados-na-interface)
- [x] [Fase 4: Filtros de Hierarquia e Setores](#fase-4-filtros-de-hierarquia-e-setores)
- [x] [Fase 5: Enquadramento da Auditoria e Hierarquia Visual](#fase-5-enquadramento-da-auditoria-e-hierarquia-visual)
- [x] [Fase 6: Verificação de Fluxos Funcionais (Local vs GitHub Pages)](#fase-6-verificação-de-fluxos-funcionais-local-vs-github-pages)
- [x] [Fase 7: Automação Determinística do Deploy (GitHub Actions)](#fase-7-automação-determinística-do-deploy-github-actions)
- [x] [Fase 8: Homologação da Suíte de Testes e Mutação](#fase-8-homologação-da-suíte-de-testes-e-mutação)
- [x] [Fase 9: Validação da Página Publicada & Relatório de Conclusão](#fase-9-validação-da-página-publicada--relatório-de-conclusão)

---

## Fase 1: Diagnóstico de Versão e Alinhamento do Deploy

- [x] **1.1 Mapear descompasso entre local, repositório remoto e GitHub Pages**
  - **Local / HEAD:** Commit `643a2fe` (`fix(deploy): automate GitHub Pages deployment workflow...`).
  - **Remoto (`origin/main`):** Commit `643a2fe` recebido com sucesso.
  - **GitHub Pages (`https://dbarrosodev.github.io/fc-manager/`):** Atualizado e servindo a versão v3.2 via workflow oficial do GitHub Actions.
  - **Causa Raiz Identificada:** O deploy automático via branch do GitHub Pages não disparou nova build para o commit recente por falta de workflow explícito do GitHub Actions.
- [x] **1.2 Configurar workflow de deploy no GitHub Actions**
  - Criado `.github/workflows/deploy.yml` para compilar e publicar o site estático em cada push na branch `main`.
- [x] **1.3 Validar que todos os arquivos estáticos na raiz pertencem à versão v3.2**
  - Conferida consistência entre `index.html`, `assets/css/styles.css`, `assets/js/main.js`, `assets/js/domain.js`, `assets/data/career_data.json` e `assets/data/career_data.js`.

---

## Fase 2: Privacidade e Limpeza de Dados Pessoais

- [x] **2.1 Desindexar arquivos binários pessoais do rastreamento Git**
  - Executado: `git rm --cached saves/CmMgrC20261027114537158`.
  - Criado arquivo sentinela: `saves/.gitkeep`.
- [x] **2.2 Atualizar regras de exclusão no `.gitignore`**
  - Ignorar `saves/*`, `!saves/.gitkeep`, `CmMgr*`, `*.save`, `*.bin`.
- [x] **2.3 Eliminar caminhos absolutos locais do Windows nos JSONs e bundles**
  - Substituída qualquer ocorrência de `C:\Users\Daniel\...` por caminho relativo limpo `saves/CmMgr...`.
  - Sanitizado `save_path` e `available_saves` no motor Python `src/save_parser.py` e em `assets/js/domain.js`.
- [x] **2.4 Documentar presença de dados em commits antigos do histórico Git**
  - Registrado que o commit `ab88d09` ainda possui o arquivo de save em seu snapshot no histórico.
  - Apresentar ao usuário a opção técnica de limpeza destrutiva via `git filter-repo` / rebase interativo (explicando riscos e impactos no hash dos commits).

---

## Fase 3: Coerência dos Dados na Interface

- [x] **3.1 Substituir qualquer fallback de data pela string `"Indisponível"`**
  - Removida qualquer menção residual a `01/01/2008` no HTML, JS e geradores de dados.
  - No HTML inicial: `<strong id="save-date">—</strong>` (em loading) e fallback para `"Indisponível"`.
  - No JavaScript (`domain.js` e `main.js`): Se `club.data_atual` estiver ausente, vazio ou nulo, atribuir explicitamente `"Indisponível"`.
- [x] **3.2 Separação estrita de métricas por competição**
  - **Campanha da Liga (LaLiga Hypermotion):** Exibir exclusivamente dados de liga: `3J: 2V 1E 0D · 8 GP / 2 GC · 7 Pts (2º Lugar)`.
  - **Pré-Temporada (Champions Trophy):** `3J: 2V 1E 0D · 6 GP / 1 GC · Campeão Invicto`.
  - **Total de Partidas:** Rótulo explícito `Todas as Partidas`: `6J: 4V 2E 0D · 14 GP / 3 GC`.
  - **Regra:** Nunca somar os jogos amistosos de pré-temporada sob a etiqueta de "Campanha Oficial".

---

## Fase 4: Filtros de Hierarquia e Setores

- [x] **4.1 Normalização canônica no modelo de dados**
  - Introduzido campo `hierarquia_tatica`: `"titular" | "reserva" | "nao_relacionado"`.
  - Introduzido campo `setor_canonico`: `"goleiro" | "defesa" | "meio" | "ataque"`.
  - Preservado campo descritivo `status_elenco` (`"Titular (ZAG)"`, `"Suplente (Banco)"`) para exibição visual rica.
- [x] **4.2 Teste exaustivo de 100% dos atletas do elenco**
  - Validado que o filtro `"titular"` retorna exatamente os 11 titulares.
  - Validado que o filtro `"reserva"` retorna exclusivamente os 7 reservas do banco.
  - Validado que o filtro `"nao_relacionado"` retorna exclusivamente os 7 atletas fora da convocação.
  - Soma exata das três categorias particiona perfeitamente os 25 atletas (11 + 7 + 7 = 25).
  - Validado que os filtros de setor (`goleiro`: 2, `defesa`: 8, `meio`: 10, `ataque`: 5) totalizam os 25 atletas.

---

## Fase 5: Enquadramento da Auditoria e Hierarquia Visual

- [x] **5.1 Estrutura de 5 abas sem sobreposição de relatório**
  - Aba 1: **Visão Geral** (Resumo executivo do clube, hero card da última partida e radar de atenção).
  - Aba 2: **Elenco** (Tabela interativa de atletas, colunas ordenáveis e ficha individual).
  - Aba 3: **Partidas & Logs** (Calendário, fichas técnicas e atuações primárias jogo a jogo).
  - Aba 4: **Competições** (Classificação oficial de LaLiga 2 e Champions Trophy).
  - Aba 5: **Carreira & Auditoria** (Área dedicada para o checklist técnico de 9 regras e gestão de saves).
- [x] **5.2 Resumo da integridade na Visão Geral sem poluição visual**
  - Mantido mini-badge de integridade na topbar.
  - Mantido o checklist detalhado exclusivamente dentro da aba "Carreira & Auditoria".

---

## Fase 6: Verificação de Fluxos Funcionais (Local vs GitHub Pages)

- [x] **6.1 Comportamento do modo estático (GitHub Pages)**
  - O botão "Sincronizar Save" exibe um toast explicativo claro:
    * `"Modo estático (GitHub Pages): os dados refletem os arquivos do repositório. Para processar saves em tempo real, execute iniciar_tracker.bat localmente!"`
  - Não dispara erros de console (`404` ou `Failed to fetch`) não tratados.
- [x] **6.2 Comportamento do servidor local (`http://127.0.0.1:8080`)**
  - Rota `/api/data` retorna o JSON completo em tempo real.
  - Rota `/api/reload` recarrega e reprocessa o save ativo.
  - Rota `/api/select_save` permite alternar saves da pasta `saves/`.
- [x] **6.3 Interatividade dos Modais e Teclado**
  - Pressionar a tecla `Escape` fecha qualquer modal aberto.
  - Clique fora do modal (backdrop) fecha o diálogo.
  - Foco retorna ao elemento disparador após o fechamento.

---

## Fase 7: Automação Determinística do Deploy (GitHub Actions)

- [x] **7.1 Criar `.github/workflows/deploy.yml`**
  - Disparo em `push` na branch `main`.
  - Configuração de permissões (`pages: write`, `id-token: write`).
  - Utilização das actions oficiais (`actions/checkout@v4`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`).
- [x] **7.2 Commit e push do workflow para o repositório**
  - Workflow executado com sucesso no GitHub Actions (Run ID `40815449533` - status `success`).

---

## Fase 8: Homologação da Suíte de Testes e Mutação

- [x] **8.1 Executar a suíte completa de 18 cenários (`tests/test_audit_suite.py`)**
  - [x] Cenário 1: Carregamento de JSON válido e ausência de caminhos de usuário.
  - [x] Cenário 2: Fallback estático `career_data.js`.
  - [x] Cenário 3: Ausência total de dados / entradas nulas.
  - [x] Cenário 4: Tratamento de JSON inválido.
  - [x] Cenário 5: Tratamento de data ausente (`"Indisponível"`).
  - [x] Cenário 6: Filtro de hierarquia com rótulos compostos (`Titular (ZAG)`).
  - [x] Cenário 7: Busca textual por nome e posição.
  - [x] Cenário 8: Ordenação ascendente e descendente de colunas.
  - [x] Cenário 9: Formatação de notas zero/nulas e assistências `N/D`.
  - [x] Cenário 10: Separação estrita entre Liga e Pré-Temporada.
  - [x] Cenário 11: Reconciliação dos gols por partida (14 gols).
  - [x] Cenário 12: Minutos totais derivados dos logs primários.
  - [x] Cenário 13: Auditoria sem fallback arbitrário `|| 8`.
  - [x] Cenário 14: Tratamento de falhas na sincronização local.
  - [x] Cenário 15: Consistência de exportação (CSV/Excel vs JSON).
  - [x] Cenário 16: Sanitização contra XSS em strings dinâmicas.
  - [x] Cenário 17: Navegação por teclado e acessibilidade dos modais.
  - [x] Cenário 18: Responsividade da tabela e numerais tabulares.
- [x] **8.2 Executar teste de mutação controlada (`src/test_mutation_audit.py`)**
  - Validada detecção imediata de desvio de gols e minutos.

---

## Fase 9: Validação da Página Publicada & Relatório de Conclusão

- [x] **9.1 Testar live via HTTP no domínio do GitHub Pages**
  - URL: `https://dbarrosodev.github.io/fc-manager/`
  - Validado via HTTP 200: HTML servido contém `FC MANAGER` e **não** contém `01/01/2008`.
  - Validado via HTTP 200: `career_data.json` servido não contém caminhos do Windows (`save_path: saves/CmMgr...`).
  - Validado via HTTP 200: `domain.js` servido contém `Indisponível` e `hierarquia_tatica`.
- [x] **9.2 Redigir relatório final de entrega**
  - Documentados arquivos modificados, problemas sanados e status da publicação.
