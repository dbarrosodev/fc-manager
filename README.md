# EA FC 26 Career Tracker — FC Andorra (v3.1)

Aplicativo profissional de gestão e acompanhamento de modo carreira para o **EA FC 26**, inspirado no CMT, com engenharia reversa do arquivo binário de save proprietário, auditoria contínua de integridade dos dados e estrutura pronta para deploy estático no **GitHub Pages** ou execução local com servidor Python.

---

## 📁 Estrutura de Arquivos e Diretórios (GitHub Pages Ready)

O projeto segue estritamente a convenção padrão para hospedagem no GitHub Pages a partir da raiz (`/`):

```text
save/
├── .nojekyll                                  # Instrução para o GitHub Pages servir assets sem restrições
├── .gitignore                                 # Ignora caches Python e arquivos temporários
├── requirements.txt                           # Dependências Python mínimas (XlsxWriter)
├── iniciar_tracker.bat                        # Inicializador rápido de duplo-clique no Windows
├── index.html                                 # Entrada principal do Web App (HTML5 semântico)
│
├── assets/
│   ├── css/
│   │   └── styles.css                         # Design profissional fosco, sem brilho, alto contraste e fontes legíveis
│   ├── js/
│   │   └── main.js                            # Lógica interativa de visualização, filtros, ordenação e modais
│   └── data/
│       ├── career_data.json                   # Dados primários extraídos do save para o GitHub Pages
│       ├── career_data.js                     # Bundle JS com fallback para execução puramente offline
│       ├── baseline_snapshot.json             # Ponto de partida original para cálculo de evolução
│       └── careers_archive.json               # Histórico multi-carreira acumulado
│
├── exports/
│   ├── Estatisticas_Jogadores_FC_Andorra_Carreira.xlsx  # Planilha Excel oficial com 5 abas e fórmulas dinâmicas
│   └── Estatisticas_Jogadores_FC_Andorra_Carreira.csv   # Dados tabulares consolidados para análise externa
│
├── src/
│   ├── save_parser.py                         # Motor de extração binária, descompressão Oodle, DB1/DB2 e auditoria
│   ├── app.py                                 # Servidor HTTP local (porta 8080) com APIs de recarregamento
│   ├── schema_meta.json                       # Metadados de esquemas de tabelas do save do EA FC
│   └── playernames.csv                        # Base de nomes do EA FC para mapeamento de atletas
│
├── saves/
│   └── CmMgrC20261027114537158                # Arquivo binário do save do modo carreira
│
└── docs/
    └── plan.md                                # Plano arquitetural detalhado do sistema
```

---

## 🚀 Como Publicar no GitHub Pages

Para publicar seu Career Tracker online gratuitamente no GitHub Pages:

1. **Crie um repositório no GitHub** (por exemplo, `ea-fc-26-career-tracker`).
2. **Abra o terminal na pasta do projeto** (`C:\Users\Daniel\Downloads\save`) e execute:
   ```bash
   git init
   git add .
   git commit -m "feat: release EA FC 26 Career Tracker v3.1 GitHub Pages ready"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPOSITORIO.git
   git push -u origin main
   ```
3. **No painel do GitHub:**
   - Acesse **Settings** > **Pages**.
   - Em **Build and deployment** > **Source**, selecione **Deploy from a branch**.
   - Escolha a branch **main** e a pasta **/ (root)**.
   - Clique em **Save**.
   - Em cerca de 1 a 2 minutos, o aplicativo estará online no endereço `https://SEU_USUARIO.github.io/NOME_DO_REPOSITORIO/`.

---

## 💻 Como Executar Localmente com o Servidor Python

Se preferir rodar no seu computador com extração e sincronização de novos saves em tempo real:

1. Certifique-se de ter o Python 3 instalado.
2. Dê um duplo clique no arquivo **`iniciar_tracker.bat`** (ou execute via terminal):
   ```bash
   python src/app.py
   ```
3. O servidor subirá na URL `http://127.0.0.1:8080` e abrirá automaticamente no seu navegador.
4. Para atualizar as estatísticas após jogar novas partidas no EA FC:
   - Copie o arquivo de save atualizado da sua pasta do jogo para a pasta `saves/`.
   - Clique no botão **"Sincronizar Save"** na barra superior da interface web ou selecione o save no seletor da aba **"Gestão de Carreira & Saves"**.
   - A planilha `.xlsx`, o arquivo `.csv` e todos os painéis visuais serão recalculados instantaneamente.

---

## 🛡️ As 5 Correções da Auditoria Técnica Implementadas

O aplicativo foi calibrado para atender aos 5 requisitos fundamentais de rigor estatístico e contábil:

1. **Checklist com Distinção Honesta de Validação:**
   - O checklist de integridade distingue checagens 100% verificadas (`OK (VERIFICADO)`) de checagens agregadas por competição (`PARCIAL (NÃO VERIFICADO POR PARTIDA)`).
   - O teste de conciliação de assistências por partida é classificado com transparência técnica como `PARCIAL`, informando que o binário do EA FC não armazena a decomposição por partida quando o atleta possui assistências e mais de uma partida na mesma competição.
2. **Coluna `Assistências na Partida` nos Logs de Jogo:**
   - Tanto na aba web **"Desempenho por Jogo (Logs)"** quanto na planilha Excel, a coluna de assistências exibe o valor exato comprovado (`0` ou número inteiro quando a dedução matemática for unívoca) ou exibe explicitamente `N/D` (nunca assumindo zero).
3. **Ponderação por Amostra e Confiança das Recomendações:**
   - Jogadores com pouca minutagem ($\le 2$ jogos ou $< 150$ minutos) recebem a classificação de **"Amostra insuficiente (XJ / Ym) — Continuar observando"**, evitando conclusões precipitadas com notas isoladas.
   - Há uma métrica explícita de `Confiança da Amostra` (`Alta`, `Moderada`, `Baixa — Amostra Insuficiente`, `Nula`).
4. **Independência Rígida entre Hierarquia, Utilização e Recomendação:**
   - `Hierarquia Escalação`: Derivada da posição do jogador na prancheta tática do treinador (`teamplayerlinks.position`).
   - `Utilização Real`: Calculada objetivamente a partir dos minutos jogados na temporada (Titular Absoluto, Titular Regular, Rotação Ativa, Reserva Pouco Utilizado, etc.).
   - `Recomendação Consultiva`: Sugestão técnica do sistema, sem jamais modificar arbitrariamente o status tático do atleta.
5. **Fonte Única da Verdade (Logs de Partida $\rightarrow$ Elenco):**
   - O sistema gera primeiro a base primária de logs por jogo (`player_match_logs`).
   - Todos os totais da tabela do elenco (jogos, titularidades, minutos, gols, gols de liga/copa e média de notas) são agregados diretamente dessa fonte única primária, eliminando qualquer risco de discrepância contábil.

---

## 📊 Estrutura da Planilha Excel (`exports/`)

A planilha gerada dinamicamente pelo motor conta com 5 abas integradas:

1. **Elenco Completo (Hub):** 43 colunas com dados cadastrais, contratuais, minutagem, gols, assistências, status de hierarquia, utilização e recomendação com nível de confiança.
2. **Desempenho por Jogo (Logs):** 10 colunas registrando cada uma das atuações individuais jogo a jogo, com data, adversário, placar, minutos, gols, assistências (com `N/D` auditado) e notas.
3. **Classificação (Tabelas):** Tabelas da LaLiga Hypermotion e do torneio de pré-temporada Champions Trophy com jogos, vitórias, empates, derrotas, gols pró, gols contra e saldo de gols.
4. **Jogos e Resultados:** Registro consolidado dos 6 confrontos oficiais, placares, mandos, artilheiros e goleiros.
5. **Checklist de Integridade:** Painel de auditoria contínua executando 9 verificações automáticas com fórmulas de conciliação.

---

## 🎨 Diretrizes Visuais Aplicadas

- **Cores Sóbrias e Foscas:** Base escura em tons de grafite/ardósia (`#0e1217`, `#161b22`, `#1f2732`), sem reflexos, neons ou gradientes brilhantes.
- **Alto Contraste:** Textos em branco gelo (`#f3f4f6`) e cinza claro (`#9ca3af`), cumprindo normas de acessibilidade visual.
- **Tipografia Confortável:** Tamanhos de fonte amplos e legíveis (base de 15px, células de tabela em 14px e badges em 12-13px).
- **Design Adaptável:** Estrutura neutra pronta para suportar novas ligas, países, clubes e divisões.
