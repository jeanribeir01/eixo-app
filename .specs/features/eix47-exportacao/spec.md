# EIX-47 · US14 — Exportação de relatório (CSV/PDF) com Share Sheet

## Problem Statement

O gestor financeiro vê o caixa do período na aba Dashboards, mas não tem como mandar esses lançamentos para a contabilidade externa. Hoje ele copiaria linha por linha. Falta um botão que gere um arquivo com as transações do período escolhido, em planilha (CSV que o Excel em português abre direto) ou em PDF, e o entregue pelo compartilhamento nativo do Android/iOS (WhatsApp, e-mail, Drive).

## Goals

- [ ] Admin e Financeiro exportam, da aba Dashboards, as transações do período do `FiltroPeriodo` em CSV ou PDF.
- [ ] O CSV abre no Excel em português com acentos e colunas corretos, sem passar pelo assistente de importação.
- [ ] O PDF traz cabeçalho (empresa e período), todas as linhas, quebrando página quando precisa, e os totais no fim.
- [ ] O arquivo sai pelo Share Sheet do sistema, com o período no nome.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Exportar os gráficos ou o ranking | O AC fala de transações. Gráfico e ranking são agregados que já estão na tela |
| Exportar para o Gestor de Frota ou Motorista | Eles não leem `movimentacao` (RLS). A seção nem aparece para eles |
| Escolher colunas, filtrar por categoria ou status | Fora dos ACs. O arquivo tem as 5 colunas pedidas |
| Exportar offline | O offline obrigatório (RNF01) é viagem e hodômetro. A exportação lê online, como os dashboards |
| Nova RPC ou migration | A leitura é um `select` comum em `movimentacao`, protegido pelo RLS existente. Somar o rodapé de um arquivo é montar o documento, não dashboard (RNF06 fala de BI na tela) |
| Novo primitivo ou token em `src/ui/` | Área compartilhada (AGENTS.md §4). `Button`, `Text` e `Column` bastam |
| Download pelo navegador / versão web | O AC pede a API nativa do SO. O app é só Android nesta fase (AD-003) |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Bibliotecas | `expo-print` (HTML → PDF) e `expo-sharing` (Share Sheet), versões do SDK 57, com ADR `docs/adr/0006-exportacao-relatorios.md`. O CSV é gravado com `expo-file-system` (já instalado) | Decidido com o usuário em 23/11/2026 | y |
| Nome da empresa no PDF | `EXPO_PUBLIC_NOME_EMPRESA` no `.env`; vazio ou ausente = "Eixo Certo" | Decidido com o usuário em 23/11/2026. O app não guarda o nome em lugar nenhum | y |
| Onde fica o botão | Aba Dashboards, logo abaixo do `FiltroPeriodo`, só para Admin e Financeiro (`podeVerCategorias`, a mesma regra dos gráficos da US12). É o `Button` primário da tela | A "tela de relatórios financeiros" do AC é a aba Dashboards: é onde está o filtro de período e o caixa. A aba não tem outra ação primária, então o cyan é dele | n |
| Escolha do formato | Tocar em "Exportar" abre um alerta nativo "Exportar relatório" com "Planilha (CSV)", "PDF" e "Cancelar" | Mesmo padrão do `AnexoComprovante` ("De onde vem a imagem?"). O Android aceita até 3 botões no alerta | n |
| Período | O período em uso no `FiltroPeriodo` (mês, ano ou customizado de até 366 dias) | O AC diz "período selecionado"; o filtro já existe e já limita o tamanho | n |
| Quais transações entram | Todas as movimentações (Pendente e Pago) cuja data de referência cai no período. Data de referência = vencimento; sem vencimento, o dia local da inclusão. Ordem: data de referência crescente, empate por descrição | É a regra da lista de Movimentações (`dataDeReferencia`). O arquivo bate com o que o gestor vê no app. A coluna Status diz o que já foi pago | n |
| Coluna Data | A data de referência, em DD/MM/AAAA | Mesma data que posiciona o lançamento no período | n |
| Coluna Valor | Número com vírgula decimal e sem separador de milhar; saída com sinal "-" (ex.: `-1234,56`). No PDF, `+ R$ 1.234,56` / `− R$ 1.234,56` | Sem "R$" e sem ponto de milhar o Excel pt-BR lê como número e deixa somar. O sinal diz o tipo, já que o AC fixa 5 colunas | n |
| Coluna Status | "Pendente", "Pago" (saída) ou "Recebido" (entrada), como `rotuloStatus` | Mesmo texto do app (AC da EIX-33) | n |
| Formato do CSV | BOM UTF-8, separador `;`, quebra de linha CRLF, cabeçalho `Data;Descrição;Categoria;Valor;Status`. Campo com `;`, aspas ou quebra de linha vai entre aspas, com aspas dobradas | AC do CSV + RFC 4180, que o Excel segue | n |
| Fórmula no CSV | Descrição ou categoria que começa com `=`, `+`, `-`, `@`, tab ou CR ganha um apóstrofo na frente | A descrição é digitada pelo usuário; sem isso o Excel executa `=HYPERLINK(...)` ao abrir (CSV injection) | n |
| Totalizadores do PDF | No fim do documento: "Total de entradas", "Total de saídas" e "Saldo do período" (entradas − saídas), somando todas as linhas do arquivo, pendentes e pagas | O AC pede totalizadores no rodapé; o saldo é o que a contabilidade confere | n |
| Paginação do PDF | Página A4 (595 × 842 pt). O cabeçalho da tabela repete em toda página e nenhuma linha é cortada ao meio | Padrão de papel no Brasil. Com centenas de linhas o PDF quebra em várias páginas | n |
| Nome do arquivo | Mês: `eixo-certo-2026-11.csv`. Ano: `eixo-certo-2026.csv`. Customizado: `eixo-certo-2026-11-01-a-2026-11-15.csv`. Mesma regra com `.pdf` | O AC dá o exemplo do mês; os outros modos seguem o mesmo padrão sem caractere inválido em nome de arquivo | n |
| Período vazio | Antes de gerar, alerta "Nenhuma transação no período" com "Cancelar" e "Gerar mesmo assim". Gerar mesmo assim produz o arquivo só com cabeçalho (e totais zerados no PDF) | O AC diz "avisa antes de gerar arquivo vazio": avisar, não proibir | n |
| Feedback | Botão em loading da busca até o Share Sheet fechar. Ao fechar, Snackbar "Relatório gerado." Em erro, Snackbar de erro em português | AGENTS.md §2.1. O `shareAsync` não diz se o usuário enviou ou cancelou, então a mensagem fala da geração | n |
| Muitas linhas | A busca pagina de 1000 em 1000 (`range`, ordenada por `id`) até vir uma página incompleta | O PostgREST corta em 1000 linhas por padrão (max-rows); um ano de lançamentos pode passar disso, e cortar em silêncio daria um relatório errado | n |
| Onde mora o código | `src/features/relatorios/export/`. A `RankingView` só ganha o componente e o Snackbar dele | "Arquivos desta task" da EIX-47 | n |

**Open questions:** none - all resolved or logged above.

### Implicit-requirement dimensions

| Dimension | Resolution |
| --- | --- |
| Input validation & bounds | EXP-01: o período vem do `FiltroPeriodo`, que já valida datas e o teto de 366 dias |
| Failure / partial-failure states | EXP-17, EXP-18, EXP-19: falha na busca, na gravação ou no compartilhamento vira Snackbar de erro; nada fica pela metade na tela |
| Idempotency / retry / duplicate handling | EXP-16: o botão fica desabilitado durante a geração (sem duplo toque). Gerar de novo sobrescreve o arquivo de mesmo nome no cache |
| Auth boundaries & rate limits | EXP-02: seção só para Admin e Financeiro; o RLS de `movimentacao` decide no banco; `42501` vira a mensagem de acesso negado |
| Concurrency / ordering | EXP-05: ordem das linhas determinística; paginação ordenada por `id` |
| Data lifecycle / expiry | O arquivo fica no cache do app (o sistema limpa); a exportação não grava nem apaga dados no banco |
| Observability | N/A because o app não tem camada de log ou métrica; erros viram mensagem na tela |
| External-dependency failure | EXP-17, EXP-19: Supabase fora ou Share Sheet indisponível viram mensagem em português |
| State-transition integrity | N/A because a feature só lê |

---

## User Stories

### P1: Exportar as transações do período ⭐ MVP

**User Story**: Como gestor (Admin ou Financeiro), quero exportar as transações do período escolhido em CSV ou PDF, para enviar à contabilidade externa.

**Why P1**: É a US inteira.

**Acceptance Criteria**:

1. EXP-01: WHERE o usuário é Admin ou Financeiro the Dashboards tab SHALL show a primary "Exportar" button below the `FiltroPeriodo`, which exports the period in use.
2. EXP-02: WHERE o usuário é Gestor de Frota the Dashboards tab SHALL NOT show the "Exportar" button.
3. EXP-03: WHEN o usuário toca em "Exportar" THEN the app SHALL open a native alert titled "Exportar relatório" with the options "Planilha (CSV)", "PDF" and "Cancelar", and SHALL NOT query anything before a format is chosen.
4. EXP-04: WHEN um formato é escolhido THEN the app SHALL load every `movimentacao` whose reference date (vencimento, or the local day of `data_inclusao` when there is no vencimento) is inside the period, Pendente and Pago, paging by 1000 rows until a page comes back short.
5. EXP-05: The export SHALL list the rows by reference date ascending, ties by description, with the columns Data (DD/MM/AAAA), Descrição, Categoria, Valor and Status ("Pendente", "Pago" for Saída, "Recebido" for Entrada).
6. EXP-06: The CSV SHALL start with the UTF-8 BOM, use `;` as separator and CRLF line breaks, and start with the header line `Data;Descrição;Categoria;Valor;Status`, keeping accented characters as typed.
7. EXP-07: The CSV Valor column SHALL be the amount with comma decimal, no thousands separator, and a leading `-` for Saída (R$ 1.234,56 Saída → `-1234,56`; Entrada → `1234,56`).
8. EXP-08: IF a CSV field contains `;`, `"`, CR or LF THEN the export SHALL wrap it in double quotes and double any inner quote.
9. EXP-09: IF a Descrição or Categoria starts with `=`, `+`, `-`, `@`, tab or CR THEN the CSV SHALL prefix it with an apostrophe.
10. EXP-10: The PDF SHALL show a header with the company name (`EXPO_PUBLIC_NOME_EMPRESA`, or "Eixo Certo" when empty or missing) and the period label of the `FiltroPeriodo`.
11. EXP-11: The PDF SHALL end with "Total de entradas", "Total de saídas" and "Saldo do período" (entradas − saídas) summing every exported row, shown once, after the last row.
12. EXP-12: The PDF SHALL be A4 (595 × 842), repeat the table header on every page and keep each row whole on one page, so a period with hundreds of rows spans several pages without losing rows.
13. EXP-13: The PDF SHALL escape `&`, `<`, `>`, `"` and `'` of every text field before building the HTML.
14. EXP-14: The file name SHALL carry the period: month `eixo-certo-AAAA-MM`, year `eixo-certo-AAAA`, custom `eixo-certo-AAAA-MM-DD-a-AAAA-MM-DD`, with the extension `.csv` or `.pdf`.
15. EXP-15: WHEN o arquivo está pronto THEN the app SHALL open the OS share sheet (`expo-sharing`) with the file, mime type `text/csv` or `application/pdf`, and SHALL show the Snackbar "Relatório gerado." after the share sheet closes.
16. EXP-16: WHILE a exportação está em andamento the "Exportar" button SHALL show loading and ignore taps.
17. EXP-17: IF the query fails THEN the app SHALL show an error Snackbar in Portuguese ("Não foi possível gerar o relatório. Tente novamente.", or the access-denied message for `42501`) and SHALL NOT open the share sheet.
18. EXP-18: IF writing the CSV or generating the PDF throws THEN the app SHALL show the error Snackbar "Não foi possível gerar o relatório. Tente novamente.".
19. EXP-19: IF sharing is not available on the device THEN the app SHALL show the error Snackbar "O compartilhamento não está disponível neste aparelho." and SHALL NOT call `shareAsync`.

**Independent Test**: No aparelho, como Financeiro, abrir Dashboards em novembro de 2026, tocar em Exportar → Planilha (CSV), escolher o Drive no Share Sheet e abrir `eixo-certo-2026-11.csv` no Excel: acentos certos, 5 colunas, valores somáveis.

---

### P1: Aviso de período vazio ⭐ MVP

**User Story**: Como gestor, quero ser avisado quando o período não tem transações, para não mandar um arquivo vazio para a contabilidade sem querer.

**Why P1**: É AC explícito da task.

**Acceptance Criteria**:

1. EXP-20: IF the period has no transactions THEN the app SHALL show the alert "Nenhuma transação no período" with "Cancelar" and "Gerar mesmo assim" before creating any file.
2. EXP-21: WHEN o usuário toca em "Cancelar" no aviso de período vazio THEN the app SHALL create no file, open no share sheet and leave the button enabled.
3. EXP-22: WHEN o usuário toca em "Gerar mesmo assim" THEN the app SHALL generate the file with only the header (and zeroed totals in the PDF) and share it.

**Independent Test**: Escolher um mês sem lançamentos, tocar em Exportar → PDF: aparece o aviso; Cancelar não abre o Share Sheet.

---

## Edge Cases

- IF a descrição tem acento, `;` ou aspas THEN the CSV SHALL keep the text readable in Excel (EXP-06, EXP-08).
- IF a categoria está inativa THEN the export SHALL still show its title (soft delete: o histórico vale).
- WHEN o período tem mais de 1000 transações THEN the export SHALL include all of them (EXP-04).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| EXP-01 | P1: Exportar | T6 | Verified |
| EXP-02 | P1: Exportar | T6 | Verified |
| EXP-03 | P1: Exportar | T5 | Verified |
| EXP-04 | P1: Exportar | T3 | Verified |
| EXP-05 | P1: Exportar | T2, T3 | Verified |
| EXP-06 | P1: Exportar | T2 | Verified |
| EXP-07 | P1: Exportar | T2 | Verified |
| EXP-08 | P1: Exportar | T2 | Verified |
| EXP-09 | P1: Exportar | T2 | Verified |
| EXP-10 | P1: Exportar | T2 | Verified |
| EXP-11 | P1: Exportar | T2 | Verified |
| EXP-12 | P1: Exportar | T2 | Verified |
| EXP-13 | P1: Exportar | T2 | Verified |
| EXP-14 | P1: Exportar | T2 | Verified |
| EXP-15 | P1: Exportar | T4, T5 | Verified |
| EXP-16 | P1: Exportar | T5 | Verified |
| EXP-17 | P1: Exportar | T3, T5 | Verified |
| EXP-18 | P1: Exportar | T4, T5 | Verified |
| EXP-19 | P1: Exportar | T4, T5 | Verified |
| EXP-20 | P1: Período vazio | T5 | Verified |
| EXP-21 | P1: Período vazio | T5 | Verified |
| EXP-22 | P1: Período vazio | T5 | Verified |

**Coverage:** 22 total, 22 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] O CSV de um mês abre no Excel em português com acentos e as 5 colunas certas, sem importação manual.
- [ ] Um PDF com 300 linhas sai com várias páginas, cabeçalho repetido e os três totais no fim.
- [ ] Nenhum caminho de erro deixa o botão travado em loading.
