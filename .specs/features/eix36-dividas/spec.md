# EIX-36 · US04 — Módulo de Dívidas e Parcelamentos (com rollback)

## Problem Statement

O gestor financeiro não tem como registrar um financiamento: hoje cada parcela teria que ser lançada à mão na tela de movimentações (EIX-33), e uma falha no meio deixaria parcelas soltas. Esta task entrega a regra no banco — uma RPC que cria a dívida e as N parcelas de uma vez, tudo ou nada — e a camada de dados que a tela da EIX-50 (Eduardo) vai chamar.

## Goals

- [x] `supabase.rpc('criar_divida', ...)` cria a dívida e as N parcelas `Pendente` numa única transação; qualquer falha não grava nada.
- [x] `supabase.rpc('excluir_divida', ...)` remove as parcelas pendentes, preserva as pagas e desativa a dívida (soft delete).
- [x] `src/features/dividas` expõe o schema Zod do formulário (mensagens em português), a Soma Total e o repositório (criar, listar, detalhar, excluir) para a EIX-50 usar sem escrever SQL.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Telas (Nova Dívida, lista, detalhe), Snackbar e loading | EIX-50 (Eduardo): `src/app/(app)/dividas/**` e `src/features/dividas/components/**` |
| Editar dívida depois de criada | Nenhum AC pede; mudar quantidade/valor exigiria regerar parcelas |
| Pagar parcela | Parcela é `movimentacao`; o pagamento já é a edição da EIX-33 |
| Usar o Valor de Quitação Antecipada em cálculo (quitar, abater parcelas) | O AC só pede o campo; ele é guardado e exibido |
| Edge Function + `postgres.js` | Decidido com o usuário: RPC plpgsql (AD-008) |
| Espelho offline (SQLite) | Financeiro é online (CLAUDE.md §7; AD-006) |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Onde mora a transação | RPC plpgsql `criar_divida` (uma chamada = uma transação no PostgREST) | Decidido com o usuário; a EIX-36/EIX-50 já nomeiam a RPC; roda no harness PGlite; sem cold start | y |
| Forma de pagamento das parcelas | A RPC recebe `forma_pagamento_id`; todas as parcelas usam a mesma | Decidido com o usuário: `movimentacao.forma_pagamento_id` é NOT NULL; a EIX-50 ganha o seletor | y |
| Exclusão com parcelas pagas | Soft delete: nova coluna `divida.ativa`; pendentes são apagadas, pagas continuam ligadas à dívida | Decidido com o usuário: a FK `divida_id` impede apagar a dívida; histórico fica intacto | y |
| Quem escreve em `divida` | Só as RPCs (`security definer` com checagem de perfil Admin/Financeiro); policies de insert/update/delete de `divida` são removidas, select continua | Garante que a dívida nunca exista sem as parcelas e que nunca seja apagada fisicamente | y (decorre das decisões acima) |
| Teto de parcelas | 1 a 120 (10 anos), validado no banco e no Zod | Sem teto, uma chamada pediria milhões de linhas; financiamento de caminhão fica bem abaixo de 120 meses || y |
| Categoria aceita | Categoria existente, ativa e do tipo `Saida` | Dívida é saída de caixa; categoria de entrada inverteria o saldo da EIX-35 || y |
| Forma de pagamento aceita | Forma existente e ativa | Mesmo critério dos seletores da EIX-33 | n |
| Vencimento das parcelas | Parcela *n* (0-based) vence em `data_vencimento_primeira + n meses`, sempre ancorada na 1ª | Ancorar na 1ª faz 31/01 → 28/02 → 31/03, e não 31/01 → 28/02 → 28/03 | n |
| Descrição das parcelas | Igual à descrição da dívida, sem sufixo "1/12" | AC: "mesma descrição"; o número da parcela vem da ordem de vencimento no detalhe | n |
| Dinheiro na RPC | `valor_parcela` e `valor_quitacao_antecipada` em reais (`numeric`); o app converte de centavos na borda | Mesmo padrão do `movimentacoesRepository` (`centavosParaReais`) | n |
| Erros de regra na RPC | Perfil sem acesso → `42501`; categoria/forma inválida → `22023`; dívida inexistente ou já excluída → `P0002`; checks do banco → `23514` | O repositório traduz por código para mensagem em português; nunca mostra texto cru do banco | n |
| Tipos gerados | Após os testes passarem, `npx supabase db push` e `gen types` na nuvem **só com autorização explícita** | Alteração de banco de produção (blast radius) | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Criar dívida com parcelas ⭐ MVP

**User Story**: As a gestor financeiro, I want to register a long-term financing so that the system generates all installments in the cash flow automatically.

**Why P1**: É a US04; a EIX-50 e o vídeo (EIX-55) dependem dela.

**Acceptance Criteria**:

1. WHEN Admin or Financeiro calls `criar_divida` with valid data THEN the system SHALL insert one `divida` row with `ativa = true` and the given `descricao`, `categoria_id`, `quantidade_parcelas`, `valor_parcela`, `data_vencimento_primeira` and `valor_quitacao_antecipada`, and return its `id`.
2. WHEN `criar_divida` succeeds THEN the system SHALL insert exactly `quantidade_parcelas` rows in `movimentacao` with that `divida_id`.
3. The system SHALL create every installment with `status_pagamento = 'Pendente'`, `data_pagamento` null, `valor = valor_parcela`, and the same `descricao`, `categoria_id` and `forma_pagamento_id` given to the call.
4. The system SHALL set installment *n* (0-based) `data_vencimento` = `data_vencimento_primeira` + *n* months.
5. WHEN `data_vencimento_primeira` + *n* months falls on a day that does not exist in that month THEN the system SHALL use the last day of that month (31/01/2026 → 28/02/2026 → 31/03/2026).
6. WHEN `valor_quitacao_antecipada` is omitted THEN the system SHALL store it as null.

**Independent Test**: Chamar a RPC no PGlite com 12, 24 e 48 parcelas e conferir contagem, valores e vencimentos.

---

### P1: Rollback ⭐ MVP

**User Story**: As a gestor financeiro, I want a failed financing registration to leave nothing behind so that the cash flow never shows partial installments.

**Why P1**: AC "rollback obrigatório" da EIX-36.

**Acceptance Criteria**:

1. IF the insert of any installment fails during `criar_divida` THEN the system SHALL persist no `divida` row and no `movimentacao` row from that call.
2. IF `criar_divida` is rejected by validation THEN the system SHALL persist no `divida` row and no `movimentacao` row from that call.

**Independent Test**: Um trigger de teste faz a 7ª parcela falhar; depois da chamada, `divida` e `movimentacao` continuam com a contagem de antes.

---

### P1: Validação no banco ⭐ MVP

**User Story**: As the system, I want invalid financings rejected by the database so that a call that skips the form cannot create bad data (AGENTS.md §2.4).

**Why P1**: O app fala direto com o PostgREST; o banco é a última barreira.

**Acceptance Criteria**:

1. IF `quantidade_parcelas` < 1 or > 120 THEN the system SHALL reject the call with SQLSTATE `23514`.
2. IF `valor_parcela` <= 0 THEN the system SHALL reject the call with SQLSTATE `23514`.
3. IF `valor_quitacao_antecipada` is given and is <= 0 or > `quantidade_parcelas` × `valor_parcela` THEN the system SHALL reject the call with SQLSTATE `23514`.
4. IF the category does not exist, is inactive, or has `tipo` other than `Saida` THEN the system SHALL reject the call with SQLSTATE `22023`.
5. IF the payment method does not exist or is inactive THEN the system SHALL reject the call with SQLSTATE `22023`.

**Independent Test**: Chamar a RPC com cada valor inválido e conferir o SQLSTATE e que nada foi gravado.

---

### P1: Excluir dívida preservando pagas ⭐ MVP

**User Story**: As a gestor financeiro, I want to delete a financing so that its future installments leave the cash flow while paid ones stay in history.

**Why P1**: AC explícito da EIX-36.

**Acceptance Criteria**:

1. WHEN Admin or Financeiro calls `excluir_divida` THEN the system SHALL delete every installment of that debt with `status_pagamento = 'Pendente'`.
2. WHEN `excluir_divida` runs THEN the system SHALL keep every installment with `status_pagamento = 'Pago'`, still linked by `divida_id`.
3. WHEN `excluir_divida` runs THEN the system SHALL set the debt's `ativa` to false and keep the row.
4. WHEN `excluir_divida` succeeds THEN the system SHALL return `{"parcelasRemovidas": <deleted count>, "parcelasPreservadas": <kept count>}`.
5. IF the debt does not exist or is already inactive THEN the system SHALL raise SQLSTATE `P0002`.

**Independent Test**: Dívida de 12 parcelas com 3 pagas → excluir → 3 movimentações restam, dívida com `ativa = false`, retorno `{9, 3}`.

---

### P1: Acesso restrito ⭐ MVP

**User Story**: As the system, I want only financial profiles to write debts so that Motorista and Gestor de Frota never touch financial data (US18).

**Why P1**: RLS/checagem no banco é a única fronteira (CLAUDE.md §3).

**Acceptance Criteria**:

1. IF a user with profile `Motorista` or `Gestor de Frota`, or a user whose status is not `Ativo`, calls `criar_divida` or `excluir_divida` THEN the system SHALL raise SQLSTATE `42501`.
2. IF the `anon` role calls `criar_divida` or `excluir_divida` THEN the system SHALL reject the call with SQLSTATE `42501`.
3. IF an authenticated user runs `insert`, `update` or `delete` directly on `divida` THEN the system SHALL change 0 rows or reject the statement.
4. The system SHALL keep `select` on `divida` for Admin and Financeiro.

**Independent Test**: Chamar as RPCs e escrever direto em `divida` como cada perfil no PGlite.

---

### P1: Camada de dados do app ⭐ MVP

**User Story**: As a developer of EIX-50, I want a typed form schema and repository so that the screens only call functions and show messages.

**Why P1**: A EIX-50 está bloqueada por esta task; sem isso ela reescreveria validação e SQL.

**Acceptance Criteria**:

1. The system SHALL compute Soma Total in cents as `quantidadeParcelas × valorParcelaCentavos` via `somaTotalCentavos`.
2. IF the form has `quantidadeParcelas` < 1 THEN the schema SHALL report "Informe ao menos 1 parcela." on `quantidadeParcelas`.
3. IF the form has `quantidadeParcelas` > 120 THEN the schema SHALL report "O máximo é 120 parcelas." on `quantidadeParcelas`.
4. IF the form has `valorParcelaCentavos` < 1 THEN the schema SHALL report "Informe um valor maior que zero." on `valorParcelaCentavos`.
5. IF the form has `valorQuitacaoCentavos` greater than the Soma Total THEN the schema SHALL report "A quitação não pode passar da soma total." on `valorQuitacaoCentavos`.
6. IF the form has an empty `descricao`, no category, no payment method, or an invalid `dataVencimentoPrimeira` THEN the schema SHALL report, respectively, "Informe a descrição.", "Escolha a categoria.", "Escolha a forma de pagamento." or "Data inválida. Use DD/MM/AAAA.".
7. WHEN `criarDivida` succeeds THEN the repository SHALL call `rpc('criar_divida')` with values in reais and the date in ISO, and return `{ ok: true, data: { id, quantidadeParcelas } }`.
8. IF an RPC or query fails THEN the repository SHALL return `{ ok: false, mensagem }` with a Portuguese message chosen by SQLSTATE (`42501`, `22023`, `23514`, `P0002`) or a generic one, never the database text.
9. WHEN `listarDividas` succeeds THEN the repository SHALL return only active debts, each with `somaTotalCentavos`, `parcelasPagas` and `quantidadeParcelas`.
10. WHEN `buscarDivida` succeeds THEN the repository SHALL return the debt and its installments ordered by `data_vencimento`, each with `numero` (1-based), `dataVencimento`, `valorCentavos` and `status`.
11. WHEN `excluirDivida` succeeds THEN the repository SHALL return `{ parcelasRemovidas, parcelasPreservadas }` from the RPC.

**Independent Test**: Testes Jest do schema e do repositório com o cliente Supabase mockado.

---

## Edge Cases

- WHEN the first due date is 15/12/2026 and there are 3 installments THEN the system SHALL set due dates 15/12/2026, 15/01/2027, 15/02/2027 (virada de ano).
- WHEN `quantidade_parcelas` = 1 THEN the system SHALL create exactly one installment due on `data_vencimento_primeira`.
- WHEN `valor_quitacao_antecipada` equals the Soma Total THEN the system SHALL accept it.
- IF `valor_parcela` has cents (ex.: 3500,10) THEN the repository SHALL return the exact integer cents (350010) and never a float.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| DIV-01 | P1: Criar dívida (AC 1–3, 6) | Execute | Verified |
| DIV-02 | P1: Criar dívida (AC 4–5) + edge cases de vencimento | Execute | Verified |
| DIV-03 | P1: Rollback | Execute | Verified |
| DIV-04 | P1: Validação no banco | Execute | Verified |
| DIV-05 | P1: Excluir dívida preservando pagas | Execute | Verified |
| DIV-06 | P1: Acesso restrito | Execute | Verified |
| DIV-07 | P1: Camada de dados (AC 1–6, schema) | Execute | Verified |
| DIV-08 | P1: Camada de dados (AC 7–11, repositório) + edge case de centavos | Execute | Verified |

**Coverage:** 8 total, 8 mapped to execute steps, 0 unmapped.

---

## Success Criteria

- [x] `npm run test` verde com testes SQL (PGlite) cobrindo DIV-01 a DIV-06 e testes Jest cobrindo DIV-07 e DIV-08.
- [x] `npm run typecheck` e `npm run lint` verdes.
- [x] Migration aplicada na nuvem e `criar_divida`/`excluir_divida` presentes em `src/types/database.ts` gerado (após autorização).
