# EIX-36 · US04 Dívidas e Parcelamentos: validação (re-verificação 1)

## Validation: eix36-dividas - PASS ✅

**Data**: 2026-10-05
**Spec**: `.specs/features/eix36-dividas/spec.md`
**Diff range**: `91d23ac..6735364` (`a907d8f`, `64adb89`, `bb0c6ac`, `7b13638`, `6735364`)
**Verifier**: sub-agente independente (autor ≠ verificador)
**Iteração**: 2 de 3 (fix → re-verificação)

Todos os ACs e casos de borda têm evidência `file:line`, e o valor asserido bate com o da spec. O sensor matou 34 dos 35 mutantes. O único que sobrevive (S12) é equivalente.

O fix `6735364` só mexeu em teste: `dividasRepository.test.ts` e `divida.test.ts`. A migration, o schema e o repositório são os mesmos da rodada 1 (`git diff 7b13638..6735364 -- src supabase/migrations` vazio fora dos testes). Os três gaps da rodada 1 foram fechados:

| Gap da rodada 1 | Fix | Prova |
| --- | --- | --- |
| A10: centavos não pegavam float | fixtures `19.99`, `1.13` e `1999` centavos | A10, A15 e A16 morrem |
| S18: status ≠ `Ativo` só testado em `criar_divida` | o `it.each` também chama `excluir_divida` e confere as 12 parcelas | S18 morre (2 testes) |
| S11/S19: revoke de anon sem teste | `has_function_privilege` nas duas assinaturas | S11 e S19 morrem |

---

## Conclusão das tasks

Não existe `tasks.md` nesta feature. Conferi pelos commits:

| Commit | Entrega | Status |
| --- | --- | --- |
| `a907d8f` | migration `20261005000200_divida.sql` + `supabase/tests/divida.test.ts` | ✅ |
| `64adb89` | `schema.ts` + `schema.test.ts` | ✅ |
| `bb0c6ac` | `src/types/database.ts` regerado (`criar_divida`, `excluir_divida`, `divida.ativa`, `valor_quitacao_antecipada`) | ✅ |
| `7b13638` | `types.ts`, `dividasRepository.ts` + `dividasRepository.test.ts` | ✅ |
| `6735364` | fixes de teste do Verifier (float, status no excluir, grants) | ✅ |

---

## Critérios de aceite contra a spec

Testes SQL em `supabase/tests/divida.test.ts` (PGlite). Por padrão, chamam como Financeiro com 12 parcelas de 3500.00, 1ª em `2026-01-15`, categoria `Financiamento` (Saida) e forma `Boleto`. Testes do app em `src/features/dividas/__tests__/`.

| Critério | Resultado definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| DIV-01 AC1: grava a dívida ativa com os dados e devolve o id | linha com os 6 campos + `ativa: true` | `supabase/tests/divida.test.ts:145` - `expect(divida.rows).toEqual([{ ..., valor_quitacao_antecipada: '38000.00', ativa: true }])` | ✅ PASS |
| DIV-01 AC2: exatamente N parcelas com o `divida_id` | 12, 24, 48 | `supabase/tests/divida.test.ts:162-163` - `toHaveLength(quantidade)` e `contagens().movimentacoes toBe(quantidade)` | ✅ PASS |
| DIV-01 AC3: parcela `Pendente`, sem pagamento, mesmo valor/descrição/categoria/forma | `{valor '3500.10', descricao, categoria_id, forma_pagamento_id, data_pagamento null, 'Pendente'}` | `supabase/tests/divida.test.ts:178` - `expect(parcelas).toEqual([...])` | ✅ PASS |
| DIV-01 AC6: quitação omitida = null | `null` | `supabase/tests/divida.test.ts:192` - `toBeNull()` | ✅ PASS |
| DIV-02 AC4: parcela *n* = 1ª + *n* meses | `2026-03-10` … `2027-02-10` (12) | `supabase/tests/divida.test.ts:208` - `toEqual([...])` | ✅ PASS |
| DIV-02 AC5: dia inexistente = último dia, ancorado na 1ª | `31/01 → 28/02 → 31/03 → 30/04` | `supabase/tests/divida.test.ts:228` - `toEqual(['2026-01-31','2026-02-28','2026-03-31','2026-04-30'])` | ✅ PASS |
| DIV-02 (extra): 29/02 bissexto | `2028-03-29`, `2029-02-28` | `supabase/tests/divida.test.ts:235-236` | ✅ PASS |
| DIV-02 (extra): 48 parcelas sem pular mês | `2026-10-05` … `2030-09-05`, 48 meses distintos | `supabase/tests/divida.test.ts:250-252` | ✅ PASS |
| DIV-03 AC1: falha em qualquer parcela não deixa nada | contagens iguais às de antes; erro `P0001` do trigger | `supabase/tests/divida.test.ts:282-283` - `toBe('P0001')` e `toEqual(antes)` | ✅ PASS |
| DIV-03 AC2: rejeição por validação não deixa nada | contagens iguais às de antes | `supabase/tests/divida.test.ts:295` - `toEqual(antes)` | ✅ PASS |
| DIV-04 AC1: parcelas < 1 ou > 120 → 23514 | `'23514'` e nada gravado (0 e 121); 120 aceito | `supabase/tests/divida.test.ts:305-306` e `:312` | ✅ PASS |
| DIV-04 AC2: `valor_parcela` <= 0 → 23514 | `'23514'` (0 e −100) | `supabase/tests/divida.test.ts:318` - `toBe('23514')` | ✅ PASS |
| DIV-04 AC3: quitação <= 0 ou > soma → 23514 | `'23514'` (42000.01, 0, −1) | `supabase/tests/divida.test.ts:331` - `toBe('23514')` | ✅ PASS |
| DIV-04 AC4: categoria inexistente/inativa/não `Saida` → 22023 | `'22023'` nas três, nada gravado | `supabase/tests/divida.test.ts:343-345` | ✅ PASS |
| DIV-04 AC5: forma inexistente/inativa → 22023 | `'22023'` nas duas, nada gravado | `supabase/tests/divida.test.ts:351-353` | ✅ PASS |
| DIV-05 AC1: apaga as pendentes | 9 removidas | `supabase/tests/divida.test.ts:381` - `toEqual({ parcelasRemovidas: 9, parcelasPreservadas: 3 })` | ✅ PASS |
| DIV-05 AC2: preserva as pagas ligadas à dívida | 3 restantes, todas `Pago`, jan–mar | `supabase/tests/divida.test.ts:383-385` | ✅ PASS |
| DIV-05 AC3: `ativa = false`, linha mantida | `[{ ativa: false }]` | `supabase/tests/divida.test.ts:394` - `toEqual([{ ativa: false }])` | ✅ PASS |
| DIV-05 AC4: retorno `{parcelasRemovidas, parcelasPreservadas}` | `{9, 3}` | `supabase/tests/divida.test.ts:381` | ✅ PASS |
| DIV-05 AC5: inexistente ou já excluída → P0002 | `'P0002'` nos dois casos | `supabase/tests/divida.test.ts:415-416` | ✅ PASS |
| DIV-05 (extra): não mexe em outra dívida | 5 parcelas da outra | `supabase/tests/divida.test.ts:403` | ✅ PASS |
| DIV-06 AC1: Motorista e Gestor de Frota → 42501 nas duas RPCs | `'42501'` + nada apagado | `supabase/tests/divida.test.ts:432-434` | ✅ PASS |
| DIV-06 AC1: status ≠ `Ativo` → 42501 nas duas RPCs | `'42501'` em `criar_divida` e `excluir_divida`; 12 parcelas intactas | `supabase/tests/divida.test.ts:449-451` - `expect(criar).toBe('42501')`, `expect(excluir).toBe('42501')`, `toHaveLength(12)` | ✅ PASS |
| DIV-06 AC2: anon → 42501 nas duas RPCs | `'42501'`; anon sem `execute`, authenticated com | `supabase/tests/divida.test.ts:476-477` e `:464-467` - `toEqual([{ anon: false, authenticated: true }, { anon: false, authenticated: true }])` | ✅ PASS |
| DIV-06 AC3: insert/update/delete direto em `divida` → 0 linhas ou rejeição | insert `'42501'`; update e delete 0 linhas; linha intacta | `supabase/tests/divida.test.ts:497-504` (como Admin) | ✅ PASS |
| DIV-06 AC4: select continua para Admin e Financeiro | `[id]` para os dois | `supabase/tests/divida.test.ts:512` | ✅ PASS |
| DIV-07 AC1: Soma Total = quantidade × valor | `4200000`, `16800480` | `src/features/dividas/__tests__/schema.test.ts:23-24` | ✅ PASS |
| DIV-07 AC2: < 1 parcela | `['Informe ao menos 1 parcela.']` | `src/features/dividas/__tests__/schema.test.ts:42` | ✅ PASS |
| DIV-07 AC3: > 120 parcelas | `['O máximo é 120 parcelas.']`; 120 aceito | `src/features/dividas/__tests__/schema.test.ts:46-47` | ✅ PASS |
| DIV-07 AC4: valor < 1 centavo | `['Informe um valor maior que zero.']` | `src/features/dividas/__tests__/schema.test.ts:51` | ✅ PASS |
| DIV-07 AC5: quitação > soma | `['A quitação não pode passar da soma total.']`; igual aceita | `src/features/dividas/__tests__/schema.test.ts:58-61` | ✅ PASS |
| DIV-07 AC6: descrição, categoria, forma, data | as 4 mensagens exatas da spec | `src/features/dividas/__tests__/schema.test.ts:73-76` | ✅ PASS |
| DIV-08 AC7: `criar_divida` com reais e data ISO; retorno `{ok, {id, quantidadeParcelas}}` | `valor_parcela: 19.99`, `valor_quitacao_antecipada: 1.13`, `'2026-01-15'`; `{ id: 'div-nova', quantidadeParcelas: 12 }` | `src/features/dividas/__tests__/dividasRepository.test.ts:86` e `:95` | ✅ PASS |
| DIV-08 AC7 (extra): quitação nula não é enviada | sem a chave | `src/features/dividas/__tests__/dividasRepository.test.ts:103` | ✅ PASS |
| DIV-08 AC8: SQLSTATE → mensagem em português, nunca o texto do banco | 42501, 22023, 23514, genérica (criar); P0002 (excluir); genérica (listar) | `src/features/dividas/__tests__/dividasRepository.test.ts:114`, `:148`, `:190` | ✅ PASS |
| DIV-08 AC9: lista só ativas, com soma, pagas e quantidade | `.eq('ativa', true)`; `valorParcelaCentavos 1999`, `somaTotalCentavos 5997`, `parcelasPagas 1`, `quantidadeParcelas 3` | `src/features/dividas/__tests__/dividasRepository.test.ts:125-126` | ✅ PASS |
| DIV-08 AC10: parcelas por vencimento, `numero` a partir de 1 | `p-1/1`, `p-2/2`, `p-3/3` a partir de uma entrada fora de ordem | `src/features/dividas/__tests__/dividasRepository.test.ts:163` | ✅ PASS |
| DIV-08 AC11: excluir devolve as contagens da RPC | `{ parcelasRemovidas: 9, parcelasPreservadas: 3 }` | `src/features/dividas/__tests__/dividasRepository.test.ts:183-184` | ✅ PASS |

**Status**: ✅ Todos os ACs cobertos, sem gap de precisão da spec.

---

## Casos de borda

- [x] Virada de ano, 15/12/2026 × 3: `supabase/tests/divida.test.ts:243` - `toEqual(['2026-12-15','2027-01-15','2027-02-15'])`
- [x] 1 parcela vence na 1ª data: `supabase/tests/divida.test.ts:199` - `toEqual(['2026-11-20'])`
- [x] Quitação igual à Soma Total aceita: banco em `supabase/tests/divida.test.ts:337`, form em `src/features/dividas/__tests__/schema.test.ts:61`
- [x] Centavos exatos, nunca float: `src/features/dividas/__tests__/dividasRepository.test.ts:134-135`, `:162` e `:164-166` asserem `1999`, `5997` e `113`. Os valores de entrada `19.99` e `1.13` não são exatos em binário (`19.99 * 100 = 1998.9999999999998`). A10, A15 e A16 morrem.

A spec usa `3500,10` como exemplo. O teste usa `19.99`, que respeita a regra ("centavos exatos, nunca float") com um valor que discrimina de verdade. O `3500.10` continua coberto no SQL, em `supabase/tests/divida.test.ts:178`.

---

## Sensor de discriminação

O sensor rodou num `git worktree` temporário (`HEAD` = `6735364`), com junction para `node_modules`. Cada mutante foi aplicado por substituição exata, testado e revertido. Os SQL rodaram com `divida.test.ts` (37 testes) e os do app com `src/features/dividas` (19 testes). Como os arquivos de teste mudaram, rodei de novo o conjunto inteiro, não só uma amostra. Não usei `git stash`. Depois de remover o worktree, o `git status --porcelain` da árvore real ficou igual ao baseline da rodada.

| # | `file:line` | Mutação | R1 | R2 |
| --- | --- | --- | --- | --- |
| S01 | `supabase/migrations/20261005000200_divida.sql:62` | sem `c.tipo = 'Saida'` | ✅ | ✅ |
| S02 | `supabase/migrations/20261005000200_divida.sql:69` | sem `f.ativa` | ✅ | ✅ |
| S03 | `supabase/migrations/20261005000200_divida.sql:96` | vencimento encadeado na anterior (CTE recursiva + 1 mês) | ✅ | ✅ |
| S04 | `supabase/migrations/20261005000200_divida.sql:98` | `generate_series(0, n - 3)` (N − 2 parcelas) | ✅ | ✅ |
| S05 | `supabase/migrations/20261005000200_divida.sql:116` | sem checagem de perfil em `excluir_divida` | ✅ | ✅ |
| S06 | `supabase/migrations/20261005000200_divida.sql:127` | `excluir_divida` apaga também as `Pago` | ✅ | ✅ |
| S07 | `supabase/migrations/20261005000200_divida.sql:132` | sem `update divida set ativa = false` | ✅ | ✅ |
| S08 | `supabase/migrations/20261005000200_divida.sql:34` | mantém a policy `divida_delete` | ✅ | ✅ |
| S09 | `supabase/migrations/20261005000200_divida.sql:26` | quitação `<=` → `<` | ✅ | ✅ |
| S10 | `supabase/migrations/20261005000200_divida.sql:121` | sem `d.ativa` na busca (exclui de novo) | ✅ | ✅ |
| S11 | `supabase/migrations/20261005000200_divida.sql:139` | sem `revoke ... from public, anon` em `criar_divida` | ❌ | ✅ |
| S12 | `supabase/migrations/20261005000200_divida.sql:22` | check `valor_parcela > 0` → `>= 0` | ➖ | ➖ |
| S13 | `supabase/migrations/20261005000200_divida.sql:55` | libera `Gestor de Frota` em `criar_divida` | ✅ | ✅ |
| S14 | `supabase/migrations/20261005000200_divida.sql:95` | descrição fixa `'Parcela'` | ✅ | ✅ |
| S15 | `supabase/migrations/20261005000200_divida.sql:130` | `parcelasPreservadas` conta só as `Pendente` | ✅ | ✅ |
| S16 | `supabase/migrations/20261005000200_divida.sql:33` | mantém a policy `divida_update` | ✅ | ✅ |
| S17 | `supabase/migrations/20261005000200_divida.sql:18` | teto `between 1 and 121` | ✅ | ✅ |
| S18 | `supabase/migrations/20261005000200_divida.sql:116` | `excluir_divida` busca o perfil sem filtrar `status = 'Ativo'` | ❌ | ✅ |
| S19 | `supabase/migrations/20261005000200_divida.sql:141` | sem `revoke ... from public, anon` em `excluir_divida` | ❌ | ✅ |
| A01 | `src/features/dividas/dividasRepository.ts:65` | `valorCentavos` = valor cru em reais | ✅ | ✅ |
| A02 | `src/features/dividas/dividasRepository.ts:60` | parcelas em ordem decrescente | ✅ | ✅ |
| A03 | `src/features/dividas/dividasRepository.ts:123` | sem `.eq('ativa', true)` | ✅ | ✅ |
| A04 | `src/features/dividas/dividasRepository.ts:49` | 22023 cai na mensagem genérica | ✅ | ✅ |
| A05 | `src/features/dividas/schema.ts:33` | `.max(121)` | ✅ | ✅ |
| A06 | `src/features/dividas/dividasRepository.ts:98` | envia centavos no lugar de reais | ✅ | ✅ |
| A07 | `src/features/dividas/schema.ts:47` | quitação `>` → `>=` | ✅ | ✅ |
| A08 | `src/features/dividas/dividasRepository.ts:63` | `numero` a partir de 0 | ✅ | ✅ |
| A09 | `src/features/dividas/dividasRepository.ts:80` | `parcelasPagas` conta as `Pendente` | ✅ | ✅ |
| A10 | `src/features/dividas/dividasRepository.ts:57` | `linha.valor_parcela * 100` (float) | ❌ | ✅ |
| A11 | `src/features/dividas/dividasRepository.ts:52` | sem tradução de P0002 | ✅ | ✅ |
| A12 | `src/features/dividas/dividasRepository.ts:107` | devolve `error.message` do banco | ✅ | ✅ |
| A13 | `src/features/dividas/dividasRepository.ts:114` | `quantidadeParcelas: 0` no retorno | ✅ | ✅ |
| A14 | `src/features/dividas/schema.ts:32` | `.min(0)` | ✅ | ✅ |
| A15 | `src/features/dividas/dividasRepository.ts:65` | `parcela.valor * 100` (float) | - | ✅ |
| A16 | `src/features/dividas/dividasRepository.ts:78` | `linha.valor_quitacao_antecipada * 100` (float) | - | ✅ |

**S12 (equivalente)**: com a check da dívida em `>= 0`, o valor 0 ainda é barrado com o mesmo 23514 pela check `movimentacao_valor_positivo` da EIX-33, na 1ª parcela. Não há insert direto em `divida` (DIV-06 AC3). Como nenhum resultado observável muda, não há fix.

**Profundidade**: P0 completa (integridade de dados e autorização), com 35 mutantes.
**Resultado**: 34/34 não equivalentes mortos na rodada 2. ✅ PASS.

---

## Qualidade do código

| Princípio | Status |
| --- | --- |
| Código mínimo, sem escopo extra | ✅ Duas RPCs, schema, tipos e repositório. Nenhuma tela (EIX-50). |
| Mudanças cirúrgicas | ✅ O fix `6735364` só toca os dois arquivos de teste |
| Segue os padrões | ✅ `auth_perfil()`, harness PGlite, `Resultado<T>`, `centavosParaReais`/`reaisParaCentavos` e `has_function_privilege` no molde de `resumo_caixa.test.ts` |
| Valores asseridos batem com a spec | ✅ |
| Todo teste mapeia a AC ou caso de borda | ✅ |
| Guias seguidos | `AGENTS.md` §2.4 (regra no banco, transação/RPC, RLS) e `.claude/CLAUDE.md` §5 (centavos, numeric, soft delete). Divergência do §3 (Edge Function) registrada em AD-008. |

---

## Gate

- `npm run typecheck`: exit 0
- `npm run lint`: exit 0
- `npm run test`: exit 0. App: 55 suítes e 441 testes. Supabase: 11 suítes e 136 testes. Nenhum pulado, nenhuma falha.
- Delta da feature (contra `91d23ac`): +19 no app (`schema.test.ts` 7, `dividasRepository.test.ts` 12) e +37 SQL (`divida.test.ts`). Nenhum teste existente foi removido nem enfraquecido. Na rodada 2, o teste de status ganhou a chamada a `excluir_divida` e entrou um teste novo de grants.

---

## Rastreabilidade (recomendação para o `spec.md`)

O verificador não edita a spec. A recomendação para a tabela de rastreabilidade:

| Requisito | Antes | Recomendado |
| --- | --- | --- |
| DIV-01 | Implementing | Verified |
| DIV-02 | Implementing | Verified |
| DIV-03 | Implementing | Verified |
| DIV-04 | Implementing | Verified |
| DIV-05 | Implementing | Verified |
| DIV-06 | Implementing | Verified |
| DIV-07 | Implementing | Verified |
| DIV-08 | Implementing | Verified |

Critérios de sucesso da spec:

- "`npm run test` verde com testes SQL cobrindo DIV-01 a 06 e Jest cobrindo DIV-07 e 08": ✅
- "`typecheck` e `lint` verdes": ✅
- "`criar_divida`/`excluir_divida` presentes em `src/types/database.ts`": ✅ (`src/types/database.ts:436` e `:448`). Não verifiquei se a migration está aplicada na nuvem, porque o verificador não acessa o Supabase remoto.

---

## Resumo

**Geral**: ✅ Pronto.
**Spec**: 38 linhas de AC e 4 casos de borda, todos com evidência e valor correto.
**Sensor**: 34/34 não equivalentes mortos (S12 é equivalente). Os 4 sobreviventes da rodada 1 (A10, S18, S11, S19) morrem.
**Gate**: verde (441 + 136).
**Revisão manual antes do PR**: antes do `db push`, rodar na nuvem a query de pré-checagem do cabeçalho da migration (`valor_parcela <= 0 or quantidade_parcelas > 120` deve dar 0). Depois, conferir que os tipos gerados da nuvem batem com `src/types/database.ts`.
