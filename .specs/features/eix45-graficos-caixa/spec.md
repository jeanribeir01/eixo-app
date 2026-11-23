# EIX-45 · US12 — Gráficos de fluxo de caixa mensal

## Problem Statement

A aba Dashboards só mostra o ranking da US13. O gestor financeiro vê o saldo do período nos KPIs (US11), mas não vê como Entradas e Saídas evoluíram mês a mês nem para onde vai o dinheiro gasto. Falta um gráfico de barras com Entradas e Saídas por mês e uma rosca com a divisão das despesas por categoria. Como no resto do BI, a soma é feita no banco (RNF06).

## Goals

- [ ] Admin e Financeiro veem, na aba Dashboards, as Entradas e Saídas pagas de cada mês, com horizonte de 3 meses, 6 meses, 1 ano, 2 anos ou o histórico inteiro.
- [ ] Admin e Financeiro veem a divisão percentual das despesas pagas por categoria no período do `FiltroPeriodo`.
- [ ] Tocar numa barra ou numa fatia mostra o valor exato. Nenhuma soma é feita no app.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Biblioteca de gráficos (gifted-charts, victory-native) | Decidido com o usuário em 22/11/2026: barras e rosca desenhadas com `react-native-svg` e `View`, sem dependência nova nem ADR |
| Lançamentos pendentes ou previstos nos gráficos | Decidido com o usuário em 22/11/2026: regime de caixa, só o que foi pago. A previsão já existe no Caixa (US05) |
| Gráficos para o Gestor de Frota | O Gestor não lê `movimentacao` (RLS). Ele continua vendo só o ranking na aba |
| Exportar o gráfico (CSV/PDF) | É a US14 (EIX-47) |
| Novo filtro de período | O AC manda reutilizar o `FiltroPeriodo` da EIX-44 |
| Novos tokens em `src/ui/tokens.ts` | `src/ui/` é área compartilhada (AGENTS.md §4). As medidas do gráfico derivam dos tokens existentes dentro da feature |
| Offline dos gráficos | O offline obrigatório (RNF01) é viagem e hodômetro. Dashboard é leitura online, como os KPIs |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Como desenhar | Barras com `View` (retângulos com altura proporcional) e rosca com `Path` do `react-native-svg` (já instalado) | Decidido com o usuário em 22/11/2026 | y |
| Regime | Só movimentações `Pago`, no mês da `data_pagamento`. `Pendente` com `data_pagamento` (agendado) não entra | Decidido com o usuário em 22/11/2026. Bate com o saldo atual dos KPIs (pagos por `data_pagamento`) | y |
| Horizonte das barras | Abas próprias "3 meses", "6 meses", "1 ano", "2 anos", "Máximo", padrão "6 meses". Os meses terminam no mês final do `FiltroPeriodo` | Decidido com o usuário em 22/11/2026. O `FiltroPeriodo` tem teto de 366 dias e não cobre 2 anos nem o histórico inteiro | y |
| Período da rosca | O período do `FiltroPeriodo` (mesma regra de 366 dias e mesmas mensagens das RPCs de KPI) | Decidido com o usuário em 22/11/2026 | y |
| Mês final das barras no futuro | Se o mês da data final do filtro é depois do mês atual (ex.: aba "Ano" de 2026 termina em dezembro), as barras terminam no mês atual | Mês futuro não tem nada pago: mostrar barras vazias de meses que ainda não aconteceram confunde | n |
| "Máximo" | Do mês do primeiro pagamento registrado até o mês final. Sem nenhum pagamento até o mês final, a lista vem vazia | Agrupado por mês, o histórico inteiro tem poucas linhas e cabe no RNF06 (< 2s) | n |
| Mês sem movimento dentro do horizonte | Aparece com Entradas e Saídas iguais a 0 | Pular o mês faria a barra de abril encostar na de junho e esconder o mês parado | n |
| Fatias da rosca | As 5 categorias de Saída com maior total, em ordem decrescente (empate: título em ordem alfabética), e as demais somadas numa fatia "Outras". O banco faz a soma e o percentual (1 casa) | Mais de 6 fatias não se distinguem com a paleta stone + cyan. Somar "Outras" no app seria agregação no cliente (RNF06) | n |
| Categoria inativa | Entra nos gráficos com o título dela | Soft delete: o lançamento histórico continua valendo (CLAUDE.md §5) | n |
| Cores | Entradas `accent`, Saídas `inverted`. Fatias na ordem `accent`, `inverted`, `textBody`, `accentWash`, `borderMuted`, `textMuted` ("Outras"). Legenda com rótulo e valor ao lado de cada cor | DESIGN_CYAN §1: stone + um cyan; verde e vermelho só no valor. Cor nunca é o único indicador | n |
| Interação | Tocar numa coluna de mês mostra o mês, as Entradas e as Saídas acima do gráfico. Tocar numa fatia ou na linha da legenda mostra categoria, valor e percentual no centro da rosca | AC "tocar exibe o valor exato". A legenda dá alvo de 44pt mesmo para fatia pequena | n |
| Muitos meses em tela pequena | Cada coluna de mês tem no mínimo 44pt de largura; se não couber, o gráfico rola na horizontal | Alvo de toque mínimo (DESIGN_CYAN §6) e RNF02 | n |
| Quem vê | Admin e Financeiro. As RPCs devolvem `42501` para os outros perfis, e a tela nem mostra a seção para o Gestor de Frota | Mesma regra do `kpis_financeiros` e do `canSeeFinanceiro` | n |
| Acesso no banco | RPCs `security invoker` (o RLS de `movimentacao` e `categoria` vale), com checagem de `auth_perfil()` no início, `revoke` de `public, anon` e `grant` a `authenticated` | Mesmo molde do `kpis_financeiros` (20261109000100_kpis_dashboard.sql) | n |
| Onde fica a seção | Na aba Dashboards, entre o `FiltroPeriodo` e o ranking, sob o mesmo filtro | Comentário da `RankingView` (EIX-46): "Quando a US12 trouxer os gráficos, eles entram nesta mesma aba, sob o mesmo filtro" | n |

**Open questions:** none - all resolved or logged above.

### Implicit-requirement dimensions

| Dimension | Resolution |
| --- | --- |
| Input validation & bounds | GRAF-04, GRAF-11: horizonte só 3, 6, 12, 24 ou nulo; período da rosca com as regras de 366 dias |
| Failure / partial-failure states | GRAF-15, GRAF-16: cada gráfico tem seu próprio erro com "Tentar novamente"; um falhar não apaga o outro |
| Idempotency / retry / duplicate handling | N/A because as RPCs só leem; repetir a chamada devolve o mesmo resultado |
| Auth boundaries & rate limits | GRAF-05, GRAF-12, GRAF-17: `42501` fora de Admin e Financeiro; seção escondida para o Gestor |
| Concurrency / ordering | GRAF-08: ordem das fatias determinística. Respostas fora de ordem já são descartadas pelo `useDadosDaTela` |
| Data lifecycle / expiry | N/A because a feature não grava nem apaga dados |
| Observability | N/A because o app não tem camada de log ou métrica; erros viram mensagem na tela |
| External-dependency failure | GRAF-15: falha do Supabase vira estado de erro em português |
| State-transition integrity | N/A because a feature não muda estado de nenhuma entidade |

---

## User Stories

### P1: Entradas vs Saídas por mês ⭐ MVP

**User Story**: As a gestor financeiro (Admin ou Financeiro), I want bars comparing paid Entradas and Saídas month by month so that I see how the business is evolving.

**Why P1**: É o gráfico que dá nome à US12.

**Acceptance Criteria**:

1. WHEN `fluxo_caixa_mensal(mes_final, meses)` is called with `meses` in 3, 6, 12 or 24 THEN the database SHALL return exactly `meses` rows, one per month ending at the month of `mes_final`, in ascending order, each with `mes` ('AAAA-MM'), `entradas_centavos` and `saidas_centavos`. (GRAF-01)
2. The database SHALL sum into each month only movimentações with `status_pagamento = 'Pago'` whose `data_pagamento` falls inside that month, converting reais to integer cents without floating point. (GRAF-02)
3. WHEN `fluxo_caixa_mensal` is called with `meses` null THEN the database SHALL return one row per month from the month of the earliest `data_pagamento` of a paid movimentação up to the month of `mes_final`, and no rows when there is no paid movimentação up to that month. (GRAF-03)
4. IF `mes_final` is null or `meses` is not null and not in 3, 6, 12, 24 THEN the database SHALL raise SQLSTATE `22023`. (GRAF-04)
5. IF the caller's profile is not Admin or Financeiro THEN `fluxo_caixa_mensal` SHALL raise SQLSTATE `42501`. (GRAF-05)
6. WHEN the Dashboards tab opens for Admin or Financeiro THEN the app SHALL show the horizon tabs "3 meses", "6 meses", "1 ano", "2 anos", "Máximo" with "6 meses" selected, and bars for the months returned. (GRAF-06)
7. WHEN the user taps a month column THEN the app SHALL show that month's name with Entradas as "+ R$ X" and Saídas as "− R$ Y", formatted in pt-BR. (GRAF-07)

**Independent Test**: Com lançamentos pagos em três meses, abrir Dashboards como Financeiro, trocar para "3 meses" e tocar num mês: aparecem os valores exatos daquele mês.

---

### P1: Despesas por categoria ⭐ MVP

**User Story**: As a gestor financeiro, I want a donut with the share of each expense category so that I know where the money goes.

**Why P1**: Está nos critérios de aceite da US12.

**Acceptance Criteria**:

1. WHEN `despesas_por_categoria(data_inicial, data_final)` is called THEN the database SHALL return the Saída categories with paid movimentações whose `data_pagamento` is inside the period, at most 5 named rows ordered by total descending then título ascending, plus one row "Outras" (`categoria_id` null) summing the remaining categories when there are more than 5. (GRAF-08)
2. The database SHALL return in each row `total_centavos` as integer cents and `percentual` as the row's share of all paid Saídas of the period, rounded to 1 decimal place. (GRAF-09)
3. IF the period has no paid Saída THEN `despesas_por_categoria` SHALL return no rows. (GRAF-10)
4. IF `data_inicial` or `data_final` is null, `data_final` is before `data_inicial`, or the period has more than 366 days THEN `despesas_por_categoria` SHALL raise SQLSTATE `22023`. (GRAF-11)
5. IF the caller's profile is not Admin or Financeiro THEN `despesas_por_categoria` SHALL raise SQLSTATE `42501`. (GRAF-12)
6. WHEN the user taps a slice or its legend row THEN the app SHALL show in the center of the donut the category title, the value "R$ X" and the percentage "N,N%". (GRAF-13)

**Independent Test**: Com despesas pagas em duas categorias no mês, abrir Dashboards e tocar na fatia maior: o centro mostra categoria, valor e percentual.

---

### P1: Filtro, estados e acesso ⭐ MVP

**User Story**: As a gestor financeiro, I want the charts to follow the dashboard filter and to tell me when there is nothing to show or something failed.

**Why P1**: Estados de carregando, vazio e erro são obrigatórios em toda tela de dados (AGENTS.md §2.1).

**Acceptance Criteria**:

1. WHEN the `FiltroPeriodo` period changes THEN the app SHALL query the donut with the new period and the bars ending at the new final month (capped at the current month). (GRAF-14)
2. WHILE a chart's query is pending without data on screen THE app SHALL show a skeleton in that chart's place. (GRAF-15)
3. IF a chart's query fails THEN the app SHALL show that chart's error state with the message in Portuguese and the action "Tentar novamente", keeping the other chart on screen. (GRAF-16)
4. IF the bars return no month with value above zero, or the donut returns no rows, THEN the app SHALL show that chart's empty state titled "Nada pago nesses meses" (bars) or "Nenhuma despesa paga no período" (donut). (GRAF-17)
5. WHERE the user is a Gestor de Frota THE app SHALL not render the charts section nor call the chart RPCs. (GRAF-18)
6. The charts SHALL take their colors only from `src/ui/tokens.ts` and SHALL keep each month column at least 44pt wide, scrolling horizontally when the columns do not fit the width. (GRAF-19)

**Independent Test**: Trocar o mês no filtro para um mês sem pagamentos: as duas áreas mostram o estado vazio. Entrar como Gestor de Frota: só o ranking aparece.

---

## Edge Cases

- IF a movimentação is `Pendente` with `data_pagamento` filled (pagamento agendado) THEN the database SHALL not count it. (GRAF-02)
- WHEN `mes_final` is any day of a month THEN the database SHALL treat it as that whole month. (GRAF-01)
- WHEN there is a single category in the donut (100%) THEN the app SHALL draw a full ring. (GRAF-13)
- IF a value is 1,13 (not exact in binary floating point) THEN the cents SHALL be 113. (GRAF-02, GRAF-09)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| GRAF-01 | P1: Entradas vs Saídas | Validate | Verified |
| GRAF-02 | P1: Entradas vs Saídas | Validate | Verified |
| GRAF-03 | P1: Entradas vs Saídas | Validate | Verified |
| GRAF-04 | P1: Entradas vs Saídas | Validate | Verified |
| GRAF-05 | P1: Entradas vs Saídas | Validate | Verified |
| GRAF-06 | P1: Entradas vs Saídas | Validate | Verified |
| GRAF-07 | P1: Entradas vs Saídas | Validate | Verified |
| GRAF-08 | P1: Despesas por categoria | Validate | Verified |
| GRAF-09 | P1: Despesas por categoria | Validate | Verified |
| GRAF-10 | P1: Despesas por categoria | Validate | Verified |
| GRAF-11 | P1: Despesas por categoria | Validate | Verified |
| GRAF-12 | P1: Despesas por categoria | Validate | Verified |
| GRAF-13 | P1: Despesas por categoria | Validate | Verified |
| GRAF-14 | P1: Filtro, estados e acesso | Validate | Verified |
| GRAF-15 | P1: Filtro, estados e acesso | Validate | Verified |
| GRAF-16 | P1: Filtro, estados e acesso | Validate | Verified |
| GRAF-17 | P1: Filtro, estados e acesso | Validate | Verified |
| GRAF-18 | P1: Filtro, estados e acesso | Validate | Verified |
| GRAF-19 | P1: Filtro, estados e acesso | Validate | Verified |

**Coverage:** 19 total, 19 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] Com o seed de simulação de 3 meses, Admin vê barras de 6 meses e a rosca do mês atual sem erro.
- [ ] O valor exibido ao tocar uma barra é igual à soma dos pagos daquele mês no banco (teste de RPC + teste de tela).
- [ ] `npm run typecheck`, `npm run lint` e `npm run test` passam.
