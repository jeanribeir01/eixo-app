# EIX-35 · US05 — Motor de Saldo e Previsão de Caixa

## Problem Statement

O gestor financeiro lança movimentações (EIX-33), mas não enxerga quanto dinheiro tem nem como o caixa fica nos próximos meses. A tela de saldo (EIX-51, PR #12) já existe e mostra um mock, porque o cálculo ainda não existe no banco. Esta task entrega esse cálculo como RPC no Postgres. O RNF06 proíbe agregar no cliente.

## Goals

- [ ] Uma chamada `supabase.rpc('resumo_caixa')` devolve saldo atual, projeção mensal e pendências sem data, no formato do contrato Zod provisório da EIX-51 (`src/features/caixa/components/resumoCaixa.ts` no PR #12).
- [ ] Só Admin e Financeiro obtêm o resumo; qualquer outro perfil ou anônimo recebe erro de permissão.
- [ ] Todo o cálculo roda no Postgres; o app só exibe.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Tela, alerta de mês negativo, formatação R$ e cores | EIX-51 (Diogo, PR #12) já entrega; os ACs visuais da EIX-35 são cobertos lá |
| Função de leitura no app (`src/features/caixa/**`) | Decidido com o usuário: evita conflito com o PR #12; o Diogo troca o mock por `supabase.rpc('resumo_caixa')` |
| Parcelas de dívida | EIX-36; parcelas já são `movimentacao` e entram no cálculo sem tratamento especial |
| Filtro por período, por categoria ou por viagem | Nenhum AC pede |
| Espelho offline (SQLite) | Financeiro é online (CLAUDE.md §7; AD-006) |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| View ou RPC | RPC `resumo_caixa(referencia date default null)` devolvendo um `jsonb` | Uma chamada devolve o objeto inteiro no formato do contrato da EIX-51; view devolveria linhas que o app teria que montar | y |
| Pendente atrasada (vencimento antes do mês atual) | Soma no mês atual da projeção | Decidido com o usuário: o dinheiro ainda vai entrar/sair; meses passados não aparecem na lista | y |
| "Mês atual" | Mês de `referencia`; sem `referencia`, a data de hoje no fuso `America/Sao_Paulo` | O app é usado no Brasil; 22h de 31/10 ainda é outubro. O parâmetro torna o teste determinístico | y |
| Status "Pago/Recebido" | Enum `Pago` | O enum só tem `Pendente` e `Pago` (EIX-33) | y |
| Entrada ou Saída | `categoria.tipo` | Não há coluna de tipo em `movimentacao` | y |
| Categoria inativa | Entra no cálculo normalmente | Soft delete esconde do seletor, não apaga o dinheiro histórico | y |
| Meses sem pendência | Não aparecem na projeção | Contrato da EIX-51 lista só meses com dado; o saldo acumulado continua correto | y |
| Formato do dinheiro | Centavos inteiros (`bigint` no JSON) | CLAUDE.md §5 e contrato Zod `z.number().int()` | y |
| Saídas na resposta | Valores positivos (`saidasPendentesCentavos`, `saidasCentavos`) | Contrato da EIX-51: a tela aplica o sinal | y |
| Pago com `data_pagamento` futura | Entra no saldo atual | Status é a fonte de verdade; o AC fala só em status | y |
| Perfil sem acesso | Função lança `42501` (insufficient_privilege) | Devolver resumo vazio a um Motorista mentiria "sem movimentações"; o RLS continua valendo por baixo (`security invoker`) | y |
| Tipos gerados | Agente roda `npx supabase db push` e `gen types` na nuvem após os testes passarem | Autorizado pelo usuário (AD-003: sem Docker, tipos só saem do projeto linkado) | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Saldo atual ⭐ MVP

**User Story**: As a gestor financeiro, I want to see the consolidated balance so that I know how much money the company has now.

**Why P1**: É o número principal da tela da EIX-51.

**Acceptance Criteria**:

1. WHEN Admin or Financeiro calls `resumo_caixa()` THEN the system SHALL return `saldoAtualCentavos` = (sum of `valor` of `Pago` rows with category `Entrada` − sum of `valor` of `Pago` rows with category `Saida`) × 100.
2. The system SHALL exclude `Pendente` rows from `saldoAtualCentavos`.
3. WHEN there are no movimentações THEN the system SHALL return `saldoAtualCentavos` = 0, `quantidadeMovimentacoes` = 0, `projecao` = [] and `semVencimento` = {quantidade 0, entradasCentavos 0, saidasCentavos 0}.
4. The system SHALL return `quantidadeMovimentacoes` = total count of rows in `movimentacao` (Pago and Pendente).

**Independent Test**: Inserir entradas e saídas pagas e pendentes no PGlite e conferir `saldoAtualCentavos`.

---

### P1: Projeção mensal ⭐ MVP

**User Story**: As a gestor financeiro, I want to see the projected balance month by month so that I can anticipate a negative month.

**Why P1**: É a "previsão" da US05; o alerta de mês negativo da EIX-51 depende dela.

**Acceptance Criteria**:

1. WHEN there are `Pendente` rows with `data_vencimento` THEN the system SHALL return one `projecao` item per month `AAAA-MM` that has at least one such row, in ascending order.
2. The system SHALL set each item's `entradasPendentesCentavos` and `saidasPendentesCentavos` to the sum × 100 of that month's `Pendente` rows of type `Entrada` and `Saida`, both as non-negative numbers.
3. The system SHALL set each item's `saldoProjetadoCentavos` = `saldoAtualCentavos` + cumulative (entradas − saídas) of all projected months up to and including that month.
4. WHEN a `Pendente` row has `data_vencimento` before the first day of the reference month THEN the system SHALL count it in the reference month's item.
5. WHEN `referencia` is omitted THEN the system SHALL use today's date in `America/Sao_Paulo` as the reference.
6. WHEN the cumulative balance of a month is below zero THEN the system SHALL return that month's `saldoProjetadoCentavos` as a negative number.

**Independent Test**: Com `referencia = '2026-10-15'`, pendências em 09/2026, 10/2026 e 12/2026 geram itens `2026-10` (com a de setembro somada) e `2026-12`, com saldo acumulado.

---

### P1: Pendentes sem vencimento ⭐ MVP

**User Story**: As a gestor financeiro, I want pending movements without due date shown apart so that money without date is not lost.

**Why P1**: AC explícito da EIX-35.

**Acceptance Criteria**:

1. The system SHALL exclude `Pendente` rows with `data_vencimento` null from `projecao`.
2. The system SHALL return `semVencimento.quantidade` = count of `Pendente` rows with `data_vencimento` null, and `entradasCentavos` / `saidasCentavos` = their sums × 100 by type, as non-negative numbers.

**Independent Test**: Uma entrada e uma saída pendentes sem vencimento aparecem só em `semVencimento`.

---

### P1: Acesso restrito ⭐ MVP

**User Story**: As the system, I want only financial profiles to read the balance so that Motorista never sees financial data (US17/US18).

**Why P1**: RLS é a única fronteira de autorização (CLAUDE.md §3).

**Acceptance Criteria**:

1. IF a user with profile `Motorista` or `Gestor de Frota` calls `resumo_caixa()` THEN the system SHALL raise SQLSTATE `42501`.
2. IF a user without active profile (status `AguardandoAprovacao` or `Bloqueado`) calls `resumo_caixa()` THEN the system SHALL raise SQLSTATE `42501`.
3. IF the `anon` role calls `resumo_caixa()` THEN the system SHALL reject the call with SQLSTATE `42501`.
4. The system SHALL run `resumo_caixa()` as `security invoker`, so the RLS policies of `movimentacao` and `categoria` apply to the rows it reads.

**Independent Test**: Chamar a RPC como cada perfil no PGlite e conferir o SQLSTATE.

---

## Edge Cases

- IF `valor` sums have cents (ex.: 0,01 + 0,02) THEN the system SHALL return exact integer cents (3), never a float.
- WHEN all pendências of the reference month are overdue from earlier months THEN the system SHALL still return a single item for the reference month.
- WHEN a pending row is due in a future year THEN the system SHALL order it after months of the current year (`2026-12` before `2027-01`).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| SALDO-01 | P1: Saldo atual (AC 1–2) | Execute | Implementing |
| SALDO-02 | P1: Saldo atual (AC 3–4, base vazia e contagem) | Execute | Implementing |
| SALDO-03 | P1: Projeção mensal (AC 1–3, 6) | Execute | Implementing |
| SALDO-04 | P1: Projeção mensal (AC 4–5, atrasadas e referência) | Execute | Implementing |
| SALDO-05 | P1: Pendentes sem vencimento | Execute | Implementing |
| SALDO-06 | P1: Acesso restrito | Execute | Implementing |
| SALDO-07 | Edge cases (centavos exatos, virada de ano) | Execute | Implementing |

**Coverage:** 7 total, 7 mapped to execute steps, 0 unmapped.

---

## Success Criteria

- [ ] `npm run test` verde com testes SQL cobrindo SALDO-01 a SALDO-07 no PGlite.
- [ ] `resumo_caixa` aplicada na nuvem e presente em `src/types/database.ts` gerado.
- [ ] O retorno passa no `resumoCaixaSchema` do PR #12 sem adaptação.
