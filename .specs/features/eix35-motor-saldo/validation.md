# EIX-35 · Motor de Saldo: validação (re-verificação 2)

## Validation: eix35-motor-saldo - PASS ✅

**Data**: 2026-10-05
**Spec**: `.specs/features/eix35-motor-saldo/spec.md`
**Diff range**: `f10ae6a..bdc8775` (`b2cd11e`, `9819aa3`, `f10142c`, `bdc8775`)
**Verifier**: sub-agente independente (autor ≠ verificador)
**Iteração**: 2 de 3 (fix → re-verificação)

Todos os ACs têm evidência com o valor que a spec define. Todos os mutantes que rodei morreram: 26 ao longo das três rodadas, 9 deles nesta. A RPC não mudou desde `b2cd11e`; os dois fixes foram só de teste. Resta um limite conhecido e documentado (AD-007): o fuso é protegido por um teste estrutural, não de comportamento.

---

## Critérios de aceite contra a spec

Testes em `supabase/tests/resumo_caixa.test.ts`. Migration em `supabase/migrations/20261005000100_resumo_caixa.sql`. Por padrão, os testes chamam como Financeiro com `referencia = '2026-10-15'`.

| Critério | Resultado definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| SALDO-01 AC1: saldo = (Entrada Pago − Saída Pago) × 100 | (1000,50 − 200,25) × 100 = 80025 | `supabase/tests/resumo_caixa.test.ts:104` - `toBe(80025)` | ✅ PASS |
| SALDO-01 AC1: Admin acessa | 1000 | `supabase/tests/resumo_caixa.test.ts:119` - `toBe(1000)` | ✅ PASS |
| SALDO-01 AC2: Pendente fora do saldo | 80025 com 2 pendentes no cenário | `supabase/tests/resumo_caixa.test.ts:104` | ✅ PASS |
| SALDO-01 (premissa): categoria inativa conta | 20000 | `supabase/tests/resumo_caixa.test.ts:113` - `toBe(20000)` | ✅ PASS |
| SALDO-02 AC3: base vazia | `{0, 0, [], {0,0,0}}` | `supabase/tests/resumo_caixa.test.ts:125` - `toEqual({...})` | ✅ PASS |
| SALDO-02 AC4: conta Pago e Pendente | 4 | `supabase/tests/resumo_caixa.test.ts:141` - `toBe(4)` | ✅ PASS |
| SALDO-03 AC1: um item por mês, ordem crescente | `2026-10, 2026-11, 2026-12, 2027-01` | `supabase/tests/resumo_caixa.test.ts:156` - `toEqual([...])` | ✅ PASS |
| SALDO-03 AC2: somas por tipo, não negativas | out 50000/20000 · nov 0/200000 · dez 30000/0 · jan 10000/0 | `supabase/tests/resumo_caixa.test.ts:156` | ✅ PASS |
| SALDO-03 AC3: acumulado a partir do saldo atual | 130000 · −70000 · −40000 · −30000 | `supabase/tests/resumo_caixa.test.ts:156` | ✅ PASS |
| SALDO-03 AC6: mês negativo vem negativo | −70000 | `supabase/tests/resumo_caixa.test.ts:156` (item `2026-11`) | ✅ PASS |
| SALDO-03 (implícito): Pago com vencimento fora | `[]` | `supabase/tests/resumo_caixa.test.ts:169` - `toEqual([])` | ✅ PASS |
| SALDO-04 AC4: atrasada soma no mês de referência | out 6000/10000/−4000 · nov 0/500/−4500 | `supabase/tests/resumo_caixa.test.ts:182` | ✅ PASS |
| SALDO-04 (premissa): mês atual = mês de `referencia` | `2025-03` (−1000), `2025-04` (2000) | `supabase/tests/resumo_caixa.test.ts:206` - `toEqual([...])` | ✅ PASS |
| SALDO-04 AC5: sem `referencia`, hoje em `America/Sao_Paulo` | mês de hoje no fuso SP | `supabase/tests/resumo_caixa.test.ts:223` - `toEqual([mes])` e `:233` - `toContain("now() at time zone 'America/Sao_Paulo'")` | ✅ PASS (estrutural, ver AD-007) |
| SALDO-05 AC1: sem vencimento fora da projeção | `[]` | `supabase/tests/resumo_caixa.test.ts:247` - `toEqual([])` | ✅ PASS |
| SALDO-05 AC2: `semVencimento` por tipo, só Pendente | `{2, 1000, 2050}` | `supabase/tests/resumo_caixa.test.ts:248` - `toEqual({...})` | ✅ PASS |
| SALDO-06 AC1: Motorista e Gestor de Frota → 42501 | `'42501'` | `supabase/tests/resumo_caixa.test.ts:261` - `toBe('42501')` | ✅ PASS |
| SALDO-06 AC2: AguardandoAprovacao e Bloqueado → 42501 | `'42501'` | `supabase/tests/resumo_caixa.test.ts:272` - `toBe('42501')` | ✅ PASS |
| SALDO-06 AC3: anon → 42501 | `'42501'`; anon sem `execute` | `supabase/tests/resumo_caixa.test.ts:278` e `:287` - `toEqual([{ anon: false, authenticated: true }])` | ✅ PASS |
| SALDO-06 AC4: `security invoker` | `prosecdef = false` | `supabase/tests/resumo_caixa.test.ts:293` | ✅ PASS |
| SALDO-07: 0,01 + 0,02 = 3 | 3, 30, 33 | `supabase/tests/resumo_caixa.test.ts:307-309` | ✅ PASS |
| SALDO-07: nunca float, nos 6 campos de dinheiro | 113 · `{29, 28, 114}` · `{2, 7, 115}` | `supabase/tests/resumo_caixa.test.ts:324-328` | ✅ PASS |
| SALDO-07: virada de ano | `2026-12` antes de `2027-01` | `supabase/tests/resumo_caixa.test.ts:156` | ✅ PASS |
| Edge: só atrasadas geram um item no mês de referência | `[{2026-10, 0, 10000, −10000}]` | `supabase/tests/resumo_caixa.test.ts:194` | ✅ PASS |

**Contrato EIX-51**: as chaves e os tipos batem com `resumoCaixaSchema` (commit `300434e`). Conferi só por leitura, porque o schema ainda não está na `main`.

---

## Sensor de discriminação

O sensor rodou no próprio arquivo da migration, com backup byte a byte no scratchpad, restauração conferida com `cmp` a cada mutante e só `resumo_caixa.test.ts` rodando (22 testes). Não usei `git stash`.

| # | Linha (migration) | Mutação | R0 | R1 | R2 |
| --- | --- | --- | --- | --- | --- |
| M01 | `:38` | saldo conta `Pendente` | ✅ | ✅ | - |
| M02 | `:43` | sem `greatest()` | ✅ | ✅ | - |
| M03 | `:55` | projeção não acumulada | ✅ | ✅ | - |
| M04 | `:66` | saídas negativas | ✅ | - | - |
| M05 | `:47` | sem `data_vencimento is not null` | ✅ | - | - |
| M06 | `:78` | `semVencimento` conta `Pago` | ✅ | - | - |
| M07 | `:27` | sem checagem de perfil | ✅ | ✅ | - |
| M08 | `:26` | libera `Gestor de Frota` | ✅ | - | - |
| M09 | `:16` | `security definer` | ✅ | ✅ | - |
| M10 | `:87` | `grant execute ... to anon` | ❌ | ✅ | ✅ |
| M11 | `:60` | sem `* 100` | ✅ | ✅ | - |
| M12 | `:60` | saldo atual em `float8` | ❌ | ✅ | ✅ |
| M13 | `:68` | `jsonb_agg order by mes desc` | ✅ | - | - |
| M14 | `:21` | fuso `UTC` | ❌ | ⚠️ | ✅ (teste estrutural `:233`) |
| M15 | `:21` | ignora `referencia` | ❌ | ✅ | ✅ |
| M16 | `:59` | contagem só `Pago` | ✅ | - | - |
| M17 | `:55` | janela `order by mes desc` | ✅ | - | - |
| M18 | `:26` | perfil nulo passa | ✅ | - | - |
| M19 | `:36` | sinal do saldo invertido | ✅ | - | - |
| M20 | `:74` | troca entradas por saídas em `semVencimento` | ✅ | - | - |
| M21 | `:67` | saldo projetado em `float8` | ❌ | ❌ | ✅ |
| M22 | `:43` | mês `MM/YYYY` | ✅ | - | - |
| M23 | `:65` | entradas pendentes em `float8` | - | ✅ | ✅ |
| M24 | `:66` | saídas pendentes em `float8` | - | ❌ | ✅ |
| M25 | `:75` | `semVencimento.saidasCentavos` em `float8` | - | ❌ | ✅ |
| M26 | `:74` | `semVencimento.entradasCentavos` em `float8` | - | ❌ | ✅ |

Mutantes que morreram e cujos testes não mudaram não foram rodados de novo. Os fixes só acrescentaram ou trocaram os testes de float e de fuso.

**Profundidade**: P0, completa (26 mutantes).
**Resultado**: 9/9 mortos na rodada 2 e 26/26 no acumulado. ✅ PASS.

**Isolamento**: `git status --porcelain` igual ao baseline da rodada, e `git diff HEAD -- supabase/` vazio.

### Limite residual (AD-007)

O teste `:233` é estrutural. Ele barra a troca do fuso (o M14 morre), mas não um erro de lógica em volta da expressão. O teste de comportamento `:223` só distingue SP de UTC das 21h às 24h do último dia do mês. Isso está registrado no trade-off do AD-007 em `.specs/STATE.md`, e concordo com o registro. Não é gap aberto.

---

## Qualidade do código

| Princípio | Status |
| --- | --- |
| Código mínimo, sem escopo extra | ✅ Uma RPC e os grants. Nada em `src/features/caixa`. |
| Mudanças cirúrgicas | ✅ migration, testes, tipo gerado, spec e STATE.md |
| Segue os padrões | ✅ `auth_perfil()`, harness PGlite e comentários com o porquê |
| Valores asseridos batem com a spec | ✅ |
| Todo teste mapeia a AC ou edge case | ✅ |
| Guias seguidos | `CLAUDE.md` §3 (RLS, invoker), §5 (centavos, numeric) e RNF06 |

---

## Gate

- `npm run typecheck`: exit 0
- `npm run lint`: exit 0
- `npm run test`: exit 0. App: 49 suítes e 394 testes. Supabase: 10 suítes e 99 testes.
- Testes SQL: 77 antes da feature, 99 depois. Delta: +22, todos em `resumo_caixa.test.ts`. Nenhum pulado, nenhuma falha.

---

## Rastreabilidade (recomendação para o `spec.md`)

O verificador não edita a spec. Recomendo atualizar a tabela de rastreabilidade assim:

| Requisito | Antes | Recomendado |
| --- | --- | --- |
| SALDO-01 | Implementing | Verified |
| SALDO-02 | Implementing | Verified |
| SALDO-03 | Implementing | Verified |
| SALDO-04 | Implementing | Verified (AC5 coberto de forma estrutural, AD-007) |
| SALDO-05 | Implementing | Verified |
| SALDO-06 | Implementing | Verified |
| SALDO-07 | Implementing | Verified |

Os critérios de sucesso da spec estão assim:

- "`npm run test` verde cobrindo SALDO-01 a 07": ✅
- "presente em `src/types/database.ts`": ✅ (`resumo_caixa: { Args: { referencia?: string }; Returns: Json }`)
- "passa no `resumoCaixaSchema` do PR #12": conferido só por leitura. Validar quando o PR #12 trocar o mock pela RPC.

---

## Resumo

**Geral**: ✅ Pronto.
**Spec**: 24 linhas de AC/edge com evidência e valor correto.
**Sensor**: 26/26 mortos (o M14 por teste estrutural, AD-007).
**Gate**: verde (394 + 99).
**Revisão manual antes do PR**: confirmar que o AD-007 é aceitável para a banca e, quando o PR #12 integrar, validar o retorno real contra o `resumoCaixaSchema`.
