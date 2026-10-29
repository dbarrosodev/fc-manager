# Plano do Projeto (v2.0) — Universal Career Mode Tracker (Multi-Carreiras, Multi-Ligas & Histórico Completo)

Este plano expande o escopo do sistema para torná-lo uma **plataforma universal de acompanhamento do Modo Carreira (EA FC 25 / FC 26)**, 100% adaptável a **qualquer carreira, qualquer clube, qualquer país e qualquer divisão/competição**, com histórico permanente de classificações e um sistema completo de filtros e organização.

---

## 1. Arquitetura Universal Multi-Carreiras, Multi-Times e Multi-Países

- **Detecção 100% Automática:** Extrai `clubteamid` de `career_managerinfo`, cruza com os **842 clubes** (`teams`), **53 ligas** (`leagues` e `leagueteamlinks`) e o mapa global de países (`COUNTRY_MAP`).
- **Estatísticas Individuais Reais por Competição (`stndgs` no bloco `mlop`):** Decodifica os 24.000 registros binários de 73 bytes da tabela `stndgs` (`teamid`, `playerid`, `compobjid`, `mins`, `gols`, `assistências`, `jogos`, `clean sheets`, `cartões` e gols por partida), garantindo que a soma de gols individuais bata **exatamente** com os gols da equipe em cada competição (14 gols em 6 jogos: 6 na Pré-Temporada + 8 na LaLiga Hypermotion).
- **Resolução Universal de Nomes de Jogadores:** Combina `editedplayernames` (jogadores da base/editados), `dcplayernames` (5.617 nomes dinâmicos no save) e o dicionário global de atletas.
- **Gerenciador de Múltiplas Carreiras:** Permite alternar entre diferentes saves/carreiras (tanto da pasta local quanto da pasta oficial `AppData\Local\EA SPORTS FC 26\settings`) sem perder o histórico das anteriores.

---

## 2. Histórico Completo de Classificações (Todas as Ligas e Torneios)

1. **Todas as Competições do Clube do Usuário (Atuais e Passadas):** Qualquer divisão nacional, torneio de pré-temporada ou competição continental disputada pelo clube.
2. **Explorador de Todas as Ligas do Mundo (Radar Global do Save):** Permite consultar a tabela de classificação de todas as ligas e copas simuladas no save (LaLiga 1ª e 2ª Divisão, Premier League, Championship, Serie A, Bundesliga, Ligue 1, Liga Portugal, Champions League, Europa League, Conference League, etc.).
3. **Arquivo Histórico Temporada a Temporada (`careers_archive.json`):** Salva snapshots históricos por temporada e decodifica `career_managerhistory` (campanha anual, troféus e maiores transferências).

---

## 3. Sistema Avançado de Filtros, Busca e Organização

- **Elenco & Estatísticas:** Filtros combinados por Setor, Posição Exata, Status no Elenco, Faixa de Idade, Faixa de Overall/Potencial, Situação Contratual, Produção em Campo e Competição (*Temporada Completa*, *Apenas Liga Nacional*, *Apenas Pré-Temporada/Copas*), dando foco a Minutos, Gols, Assistências, Notas, Overall, Potencial, Idade e Posições.
- **Jogos & Adversários:** Filtros por Competição, Mando de Campo, Resultado e Busca por Adversário, exibindo o retrospecto consolidado do filtro ativo e os autores dos gols em cada partida.
- **Classificações & Ligas do Mundo:** Filtros por Escopo (*Competições do Meu Clube*, *Ligas e Copas do Mundo*, *Histórico de Temporadas*), País/Região e Turno/Mando (*Geral*, *Casa*, *Fora*).
