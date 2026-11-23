# EIX-45 · US12 — Validação

## Validation: eix45-graficos-caixa - PASS ✅

**Data**: 2026-11-22
**Spec**: `.specs/features/eix45-graficos-caixa/spec.md`
**Diff range**: `main..473ece8` (32fc118..473ece8, 9 commits; iteração 2 = commit 473ece8, só testes e spec)
**Verifier**: sub-agente independente (autor ≠ verificador)

Iteração 2: PASS. Os 19 requisitos e os 4 edge cases têm evidência que bate com o spec, o gate passa e os 20 mutantes morrem. Na iteração 1 o veredito foi FAIL: M19 (erro da rosca, GRAF-16) e M20 (rolagem horizontal, GRAF-19) sobreviviam. O commit 473ece8 acrescentou os dois testes que faltavam e fixou no spec os títulos do vazio (GRAF-17). Nenhum código de produção mudou.

---

## Conclusão das tasks

| Task | Status | Observação |
| --- | --- | --- |
| T1 Migration + RPCs | ✅ Feita | 32 testes PGlite |
| T2 db push + tipos | ✅ Feita | `fluxo_caixa_mensal` e `despesas_por_categoria` em `src/types/database.ts`; typecheck passa |
| T3 Repositório | ✅ Feita | 11 testes |
| T4 Geometria | ✅ Feita | 16 testes |
| T5 GraficoBarras | ✅ Feita | 7 testes (iteração 2: rolagem horizontal com 24 meses) |
| T6 GraficoRosca | ✅ Feita | 7 testes |
| T7 GraficosCaixa | ✅ Feita | 13 testes (iteração 2: erro da rosca) |
| T8 RankingView | ✅ Feita | 3 testes novos |

---

## Checagem dos critérios de aceite contra o spec

Arquivos de teste abreviados: `DB` = `supabase/tests/graficos_caixa.test.ts`, `Q` = `src/features/dashboard/graficos/__tests__/queries.test.ts`, `GEO` = `.../__tests__/geometria.test.ts`, `BAR` = `.../__tests__/GraficoBarras.test.tsx`, `ROS` = `.../__tests__/GraficoRosca.test.tsx`, `CX` = `.../__tests__/GraficosCaixa.test.tsx`, `RV` = `src/features/dashboard/ranking/__tests__/RankingView.test.tsx`.

| Requisito | Resultado definido no spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| GRAF-01 | Exatamente `meses` linhas, terminando no mês de `mes_final`, em ordem crescente, `mes` 'AAAA-MM' | `DB:104` `expect(linhas.map((l) => l.mes)).toEqual(['2026-09','2026-10','2026-11'])`; `DB:114-116` `toHaveLength(meses)`, primeiro e último mês para 6/12/24 | ✅ PASS |
| GRAF-02 | Só `Pago`, no mês da `data_pagamento`, em centavos exatos | `DB:132-136` `toEqual([{mes:'2026-09',0,0},{mes:'2026-10',entradas_centavos:100163,saidas_centavos:20025},{mes:'2026-11',0,113}])` (Pendente agendado e pago fora do horizonte excluídos); `DB:144` pago depois do mês final não soma | ✅ PASS |
| GRAF-03 | `meses` nulo: do mês do 1º pagamento até o mês final; nenhuma linha sem pagamento | `DB:157-162` `toEqual([...'2026-07'..'2026-10'])` (Pendente antigo não puxa o início); `DB:168` `toEqual([])` | ✅ PASS |
| GRAF-04 | `22023` para `mes_final` nulo ou `meses` fora de 3/6/12/24 | `DB:171-179` `expect(await codigoDoErro(fluxo(mesFinal, meses))).toBe('22023')` para null/6, 0, 1, 7, 36 | ✅ PASS |
| GRAF-05 | `42501` fora de Admin/Financeiro | `DB:189-191` `.toBe('42501')` para Gestor e Motorista; `DB:186` Admin lê | ✅ PASS |
| GRAF-06 | Abas "3 meses", "6 meses", "1 ano", "2 anos", "Máximo", "6 meses" selecionada; barras dos meses devolvidos | `GEO:18` `toEqual(['3 meses','6 meses','1 ano','2 anos','Máximo'])`; `CX:65` `getByRole('tab',{name:'6 meses'})).toBeSelected()`; `CX:66` `toHaveBeenLastCalledWith('2025-10-31', 6)`; `CX:76-83` cada aba chama com 3/12/24/null; `BAR:23` `getAllByRole('button')).toHaveLength(3)` | ✅ PASS |
| GRAF-07 | Toque no mês mostra o nome do mês, "+ R$ X" e "− R$ Y" pt-BR | `BAR:35-37` `getByText('Outubro de 2026')`, `getByText('+ R$ 1.001,63')`, `getByText('− R$ 200,25')` | ✅ PASS |
| GRAF-08 | Até 5 categorias por total desc, título asc; "Outras" (`categoria_id` nulo) no fim | `DB:232-239` `toEqual([['Seguro',7000],['Pedágio',6000],['Manutenção',5000],['Aluguel',4000],['Salário',4000],['Outras',4000]])`; `DB:240` `fatias[5].categoria_id).toBeNull()`; `DB:255-256` sem "Outras" com 5 | ✅ PASS |
| GRAF-09 | `total_centavos` inteiro; `percentual` com 1 casa | `DB:210-213` `{Combustível,60113,60.1},{Pedágio,39887,39.9}`; `DB:241` `toEqual([23.3,20,16.7,13.3,13.3,13.3])`; `DB:262` `[100]` | ✅ PASS |
| GRAF-10 | Sem Saída paga, nenhuma linha | `DB:271` `expect(await despesas()).toEqual([])` | ✅ PASS |
| GRAF-11 | `22023` para nulo, final < inicial, > 366 dias | `DB:274-282` `.toBe('22023')` para 4 casos (367 dias incluso); `DB:285` 366 dias aceito | ✅ PASS |
| GRAF-12 | `42501` fora de Admin/Financeiro | `DB:294-296` `.toBe('42501')`; `DB:291` Admin lê | ✅ PASS |
| GRAF-13 | Toque na fatia ou na legenda mostra título, "R$ X" e "N,N%" no centro | `ROS:35-38` após `press(fatia-1)`: `getByText('R$ 298,87')`, `getAllByText('29,9%')).toHaveLength(2)`, `getAllByText('Pedágio')).toHaveLength(2)`; `ROS:46-49` legenda "Outras" → `'R$ 100,00'`, `'10,0%'` x2 | ✅ PASS |
| GRAF-14 | Troca de período consulta rosca no novo período e barras até o novo mês final (limitado ao mês atual) | `CX:93-94` `toHaveBeenLastCalledWith('2025-09-30', 6)` e `({dataInicial:'2025-09-01',dataFinal:'2025-09-30'})`; `CX:101` `toHaveBeenLastCalledWith(hojeISO(), 6)`; `GEO:33,37`; `RV:334,338` stub recebe o período novo | ✅ PASS |
| GRAF-15 | Skeleton no lugar de cada gráfico enquanto carrega | `CX:110-111` `getByLabelText('Carregando gráfico de entradas e saídas')` e `('Carregando despesas por categoria')` | ✅ PASS |
| GRAF-16 | Erro do gráfico com mensagem em português e "Tentar novamente", o outro fica | Barras com erro: `CX:119` `findByText('Não foi possível carregar o gráfico. Tente novamente.')`, `CX:120` rosca na tela, `CX:124` volta após "Tentar novamente". Rosca com erro (iteração 2): `CX:132` mesma mensagem, `CX:133` `getByText('+ R$ 1.001,63')` (barras ficam), `CX:137` após "Tentar novamente" `findByRole('button',{name:/^Combustível/})`. Tradução: `Q:48-56`, `Q:82-90` | ✅ PASS |
| GRAF-17 | Vazio com título "Nada pago nesses meses" (barras) ou "Nenhuma despesa paga no período" (rosca) — fixado em `spec.md:117` no 473ece8 | `CX:146` `findByText('Nada pago nesses meses')`, `CX:147` `findByText('Nenhuma despesa paga no período')`; `CX:155` lista vazia do "Máximo" | ✅ PASS (spec-precision gap da iteração 1 resolvido) |
| GRAF-18 | Gestor de Frota não vê a seção nem chama as RPCs | `RV:349` `queryByText(/^Gráficos /)).not.toBeOnTheScreen()` (o componente que faz as chamadas não monta) | ✅ PASS |
| GRAF-19 | Cores só de tokens; coluna ≥ 44pt; rolagem horizontal quando não cabe | `GEO:101-112` cores e `LARGURA_MIN_COLUNA).toBe(44)`; `BAR:60` `width).toBeGreaterThanOrEqual(44)`; `BAR:66-68` cores ⊂ `colors`; `ROS:70` cores das fatias. Iteração 2, 24 meses em 320pt: `BAR:82` `UNSAFE_getByType(ScrollView).props.horizontal).toBe(true)`, `BAR:84-85` 24 colunas, todas `largura >= 44` | ✅ PASS |

**Status**: ✅ 19/19 com evidência que bate com o spec. Nenhum spec-precision gap aberto.

---

## Edge cases

- [x] Pendente com `data_pagamento` (agendado) não conta: `DB:125-126`, `DB:151-152`, `DB:202-203`
- [x] `mes_final` em qualquer dia vale pelo mês inteiro: `DB:102-104` (`'2026-11-17'`), `DB:132` (`'2026-11-01'`)
- [x] Uma categoria só (100%) desenha o anel inteiro: `ROS:77` `match(/M /g)).toHaveLength(2)`; `GEO:92-95` caminho exato de dois círculos
- [x] 1,13 vira 113 centavos: `DB:135` (`saidas_centavos: 113`), `DB:211` (`60113`)

Suposições do spec também cobertas: categoria inativa entra com o título (`DB:233`), mês sem movimento = 0 (`DB:133`), mês final futuro limitado a hoje (`GEO:37`, `CX:101`), grants só para `authenticated` (`DB:311`, `DB:319`).

---

## Sensor de discriminação

Executado num `git worktree` descartável em HEAD (ff42137), com `node_modules` por junction. Baseline do `git status --porcelain` vazio antes e depois; worktree removido.

| # | Arquivo:linha | Mutação | Resultado |
| --- | --- | --- | --- |
| M1 | `supabase/migrations/20261122000100_graficos_caixa.sql:71` | Remove `status_pagamento = 'Pago'` do CTE `pagos` | ✅ Morto (1 falha) |
| M2 | `...graficos_caixa.sql:63` | `meses - 1` → `meses` | ✅ Morto (6) |
| M3 | `...graficos_caixa.sql:137-138` | "Outras" a partir da 7ª (`<= 5` → `<= 6`) | ✅ Morto (1) |
| M4 | `...graficos_caixa.sql:132` | Desempate `pc.titulo` → `pc.titulo desc` | ✅ Morto (1) |
| M5 | `...graficos_caixa.sql:144` | Percentual com 0 casas | ✅ Morto (2) |
| M6 | `...graficos_caixa.sql:56` | "Máximo" considera Pendente no primeiro mês | ✅ Morto (1) |
| M7 | `...graficos_caixa.sql:126` | Rosca inclui categorias de Entrada | ✅ Morto (2) |
| M8 | `...graficos_caixa.sql:117` | Teto de 366 → 367 dias | ✅ Morto (1) |
| M9 | `src/features/dashboard/graficos/geometria.ts:58` | `mesFinalDoGrafico` devolve sempre a data final do filtro | ✅ Morto (2) |
| M10 | `geometria.ts:45` | `horizonteDaOpcao('max')` → 6 | ✅ Morto (2) |
| M11 | `GraficosCaixa.tsx:77` | Meses todos zerados não viram vazio | ✅ Morto (2) |
| M12 | `RankingView.tsx:173` | Seção renderizada para qualquer perfil | ✅ Morto (1) |
| M13 | `GraficoRosca.tsx:85` | Linha da legenda não seleciona a fatia | ✅ Morto (1) |
| M14 | `GraficoBarras.tsx:29` | Saídas com "+" em vez de "−" | ✅ Morto (3) |
| M15 | `geometria.ts:100` | `>= 360` → `> 360` (100% não vira anel) | ✅ Morto (2) |
| M16 | `GraficosCaixa.tsx:38` | "Tentar novamente" não recarrega | ✅ Morto (1) |
| M17 | `GraficosCaixa.tsx:96` | Rosca sem linhas não mostra vazio | ✅ Morto (1) |
| M18 | `GraficoBarras.tsx:81` | Coluna sem mínimo de 44pt | ✅ Morto (1) |
| M19 | `GraficosCaixa.tsx:94` | Erro da rosca vira `null` (sem mensagem nem "Tentar novamente") | Iteração 1: ❌ sobreviveu (71/71). Iteração 2: ✅ morto (1 falha em 73) |
| M20 | `GraficoBarras.tsx:69` | `<ScrollView horizontal ...>` → `<ScrollView>` | Iteração 1: ❌ sobreviveu (71/71). Iteração 2: ✅ morto (1 falha em 73) |

**Profundidade**: ampliada (P1 de dados financeiros; ≥ 5 mutantes por camada).
**Resultado**: 20/20 mortos (iteração 2) — ✅ PASS. M19 e M20 rodaram de novo num worktree descartável em 473ece8; junction e worktree removidos, e `git status --porcelain` voltou ao baseline (só `validation.md` não rastreado).

---

## Qualidade de código

| Princípio | Status |
| --- | --- |
| Código mínimo | ✅ |
| Mudanças cirúrgicas (só `RankingView` fora da pasta nova, no ponto previsto pelo comentário da EIX-46) | ✅ |
| Sem escopo extra | ✅ |
| Segue os padrões (molde do `kpis_financeiros`, `useDadosDaTela`, primitivos de `src/ui`) | ✅ |
| Valores asseridos batem com o spec | ✅ |
| Cobertura por camada: SQL 1:1 com os ACs; telas com feliz + vazio + erro + carregando | ✅ (erro dos dois gráficos testado) |
| Todo teste mapeia para AC, edge case ou Done-when | ✅ (teste do leitor de tela em `BAR:50`/`ROS:52` cobre a suposição "cor nunca é o único indicador") |
| Diretrizes do projeto: `AGENTS.md` §2.1/§2.5, `CLAUDE.md` §3 e §8 | ✅ sem hex solto; `borderBottomWidth: 1` segue o hairline dos primitivos (`src/ui/Card.tsx:41`) |

---

## Gate

- **Comando**: `npm run typecheck && npm run lint && npm run test`
- **typecheck**: exit 0. **lint**: exit 0.
- **app (Jest)**: 126 suítes, 1583 testes, 0 falhas (iteração 2; eram 1581). typecheck e lint de novo com exit 0.
- **supabase (PGlite)**: 25 suítes, 459 testes, 0 falhas. Na primeira rodada `rls.test.ts` e `harness.test.ts` estouraram tempo porque o sensor rodava em paralelo; rodadas isoladas (19/19) e a suíte inteira de novo (459/459) passaram.
- **Testes novos**: +89 (32 PGlite + 57 app). O supabase não mudou no 473ece8 e não precisou rodar de novo. Nenhum teste removido; o diff de `RankingView.test.tsx` só acrescenta.
- **Ignorados**: nenhum.

---

## Planos de correção (aplicados no 473ece8)

### Fix 1: erro da rosca sem teste (GRAF-16) — Major

- **Causa**: `GraficosCaixa.test.tsx:114-125` só faz as barras falharem. O ramo `rosca.status === 'erro'` em `GraficosCaixa.tsx:94` não é exercitado.
- **Task**: em `GraficosCaixa.test.tsx`, novo teste com `mockDespesas.mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar o gráfico. Tente novamente.' })`. Asserir a mensagem, o botão "Tentar novamente", `getByText('+ R$ 1.001,63')` (barras continuam) e, após o toque, `findAllByText('Combustível')`.
- **Done when**: M19 morre. ✅ Feito (`CX:127-138`).

### Fix 2: rolagem horizontal sem teste (GRAF-19) — Minor

- **Causa**: nenhum teste olha a `ScrollView` de `GraficoBarras.tsx:69`.
- **Task**: em `GraficoBarras.test.tsx`, com 24 meses, asserir `screen.UNSAFE_getByType(ScrollView).props.horizontal).toBe(true)` e cada coluna com `width >= 44` (soma maior que a largura medida após `fireEvent(view, 'layout', { nativeEvent: { layout: { width: 320 } } })`).
- **Done when**: M20 morre. ✅ Feito (`BAR:71-86`).

### Fix 3: fixar o texto do vazio no spec (GRAF-17) — ✅ feito em `spec.md:117`

- Copiar para o GRAF-17 os títulos "Nada pago nesses meses" e "Nenhuma despesa paga no período", que os testes já prendem.

---

## Rastreabilidade

| Requisito | Antes | Agora |
| --- | --- | --- |
| GRAF-01..19 | Implementing | ✅ Verified (GRAF-16 e GRAF-19 após o 473ece8) |

---

## Resumo

**Geral**: ✅ Pronto para revisão humana e UAT.

**Checagem contra o spec**: 19/19 com evidência; nenhum spec-precision gap aberto.
**Sensor**: 20/20 mortos (M19 e M20 morreram na iteração 2).
**Gate**: app 1583 e supabase 459, 0 falhas; typecheck e lint limpos.

**O que funciona**: as duas RPCs (regime de caixa, centavos exatos, "Outras", desempate, 366 dias, 42501, grants), a tradução de erros, as abas de horizonte, o limite do mês final em hoje, os estados de carregando/vazio/erro dos dois gráficos, a seleção por fatia e por legenda, o anel de 100%, a rolagem horizontal com colunas de 44pt e o bloqueio para o Gestor de Frota.

**Próximo passo**: UAT manual da aba Dashboards (Admin/Financeiro e Gestor de Frota) e abrir o PR.
