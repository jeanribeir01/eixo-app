# EIX-42 · US09 — Ponte de módulos — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/eix42-ponte-viagem/spec.md`
**Design**: inline (sem `design.md`): segue o molde da AD-013 (RPC `security definer`) e da EIX-33 (form montado por `camposMovimentacao`)
**Status**: In Progress

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec. Guidelines found: `AGENTS.md` §2.5 ("render do componente, caminho feliz e as validações citadas nos critérios de aceite"), `.claude/skills/teste-componente`, `jest.config.js` (projetos `app` e `supabase`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Migration / RPC / trigger (SQL) | integration (PGlite) | Toda regra do banco da spec: aceita, recusa com o SQLSTATE certo, perfis, grants (L-006) | `supabase/tests/*.test.ts` | `node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects supabase <arquivo>` |
| Primitivo de UI (`src/ui`) | unit (Testing Library) | Cada prop nova: comportamento e acessibilidade; props antigas sem regressão | `src/ui/__tests__/*.test.tsx` | `npx jest --selectProjects app <arquivo>` |
| Schema Zod | unit | Cada regra de validação da spec, com a mensagem exata | `src/features/*/__tests__/schema.test.ts` | `npx jest --selectProjects app <arquivo>` |
| Repositório (supabase-js) | unit com mock do client | Consulta/escrita enviada, mapeamento da resposta, tradução de erro | `src/features/*/__tests__/*Repository.test.ts` | `npx jest --selectProjects app <arquivo>` |
| Tela (View) | unit (Testing Library) | Render, caminho feliz, validações e estados carregando/vazio/erro da spec | `src/features/*/__tests__/*View.test.tsx` | `npx jest --selectProjects app <arquivo>` |
| Rota (`app/`) e tipos gerados | none | build gate | - | build gate |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tarefa só com testes do projeto `app` | `npx jest --selectProjects app <arquivos da tarefa>` |
| Full | Tarefa com teste no PGlite | `node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects supabase <arquivo>` |
| Build | Fim de fase ou tarefa sem teste | `npm run typecheck && npm run lint && npm run test` |

---

## Execution Plan

### Phase 1: Banco

```
T1 → T2
```

### Phase 2: Contratos do app

```
T2 → T3 → T4 → T5
```

### Phase 3: Telas

```
T5 → T6 → T7 → T8
```

---

## Task Breakdown

### T1: Migration da ponte (litros + RPCs de viagem)

**What**: Migration nova com `movimentacao.litros numeric(8,2)` (check `> 0`), trigger `valida_litros_movimentacao` (`23514`), e as RPCs `listar_viagens_vinculaveis()` e `buscar_viagem_vinculavel(uuid)` (`security definer`, Admin e Financeiro, revoke/grant), com os testes no PGlite.
**Where**: `supabase/migrations/20261111000100_ponte_viagem.sql`
**Depends on**: None
**Reuses**: `20261018000200_formas_pagamento_ativas.sql` (molde), `supabase/tests/formasPagamentoAtivas.test.ts` e `supabase/tests/helpers`
**Requirement**: LITROS-05, LITROS-06, ACESSO-01, ACESSO-02, ACESSO-03, ACESSO-04, ACESSO-05, PONTE-02

**Done when**:

- [x] Litros fora de Combustível, Combustível vinculado sem litros e `litros <= 0` recusados com `23514`; Combustível sem viagem sem litros aceito
- [x] RPCs devolvem as colunas e a janela da spec para Admin e Financeiro; `42501` para Gestor, Motorista e não aprovado
- [x] `has_function_privilege` prova anon sem execute e authenticated com execute
- [x] Financeiro continua lendo 0 linhas de `viagem`
- [x] Gate full passa

**Tests**: integration
**Gate**: full
**Commit**: `feat(db): litros em movimentacao e RPCs de viagem vinculavel (EIX-42)`

---

### T2: Aplicar a migration na nuvem e regerar os tipos

**What**: `npx supabase db push --remote` (com dry-run mostrado e aprovado pelo usuário) e `npx supabase gen types typescript --linked --schema public > src/types/database.ts`.
**Where**: `src/types/database.ts`
**Depends on**: T1
**Reuses**: fluxo da memória `supabase-cli-remote`
**Requirement**: ACESSO-01, ACESSO-02, LITROS-01

**Done when**:

- [x] Usuário aprovou o dry-run com `--remote`
- [x] `database.ts` tem `litros` em `movimentacao` e as duas funções, sem edição à mão
- [x] Build gate passa

**Tests**: none
**Gate**: build
**Commit**: `chore(types): regera tipos do banco com litros e RPCs de viagem (EIX-42)`

---

### T3: `Select` com busca e opção de limpar

**What**: Props opcionais `searchable` (campo "Buscar" no modal, filtra rótulo e descrição sem maiúsculas e acentos, mensagem `noResultsMessage`) e `clearLabel` + `onClear` (primeira linha da lista).
**Where**: `src/ui/Select.tsx`
**Depends on**: T2
**Reuses**: `Input`, `ListItem` de `src/ui`
**Requirement**: PONTE-01, PONTE-03, PONTE-05

**Done when**:

- [x] Busca filtra por texto parcial, ignorando maiúsculas e acentos, e mostra a mensagem sem resultado
- [x] Linha "Sem viagem" chama `onClear` e fecha o modal
- [x] Testes antigos do `Select` continuam passando
- [x] Gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): busca e opcao de limpar no Select (EIX-42)`

---

### T4: Repositório da ponte

**What**: `listarViagensVinculaveis`, `buscarViagemVinculavel`, `listarLancamentosDaViagem`, `desvincularLancamento` e `rotuloViagem`, com tradução de erro em português.
**Where**: `src/features/ponte-viagem/ponteRepository.ts`
**Depends on**: T3
**Reuses**: `movimentacoesRepository.ts` (padrão `Resultado`, Zod na resposta, `reaisParaCentavos`)
**Requirement**: PONTE-02, PONTE-07, DETALHE-03, DETALHE-04, DETALHE-05

**Done when**:

- [x] Chamadas `rpc` e `from('movimentacao')` com os filtros certos; resposta validada com Zod; valor em centavos
- [x] Rótulo "PLACA · Origem/UF → Destino/UF"
- [x] `42501` vira a mensagem de acesso negado; falha do desvínculo vira "Não foi possível desvincular. Tente novamente."
- [x] Gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ponte-viagem): repositorio de viagens vinculaveis e lancamentos da viagem (EIX-42)`

---

### T5: Schema e repositório de movimentação com viagem e litros

**What**: `viagemId` e `litros` no schema Zod (regras LITROS-02/03/04) e no repositório de movimentação (colunas lidas e gravadas, `23503` com a mensagem nova).
**Where**: `src/features/movimentacoes/schema.ts`
**Depends on**: T4
**Reuses**: `movimentacaoSchema` atual
**Requirement**: PONTE-04, PONTE-05, PONTE-06, LITROS-02, LITROS-03, LITROS-04

**Done when**:

- [x] Litros vazio em Combustível vinculado: "Informe a quantidade em litros."; fora do limite: mensagem de LITROS-04
- [x] Categoria que não é Combustível grava `litros = null`
- [x] Repositório grava e lê `viagem_id` e `litros`
- [x] Gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(movimentacoes): viagem e litros no schema e no repositorio (EIX-42)`

---

### T6: Formulário com "Vincular à viagem" e litros

**What**: Campos `viagem` (Select pesquisável com "Sem viagem") e `litros` (só em Combustível) no formulário e parâmetro `viagemId` na rota de criação. O botão "Ver viagem" (DETALHE-09) foi para a T7: o `href` tipado só aceita a rota depois que ela existe.
**Where**: `src/features/movimentacoes/MovimentacaoFormView.tsx`
**Depends on**: T5
**Reuses**: `camposMovimentacao.ts`
**Requirement**: PONTE-01, PONTE-02, PONTE-04, PONTE-05, PONTE-06, PONTE-07, PONTE-08, PONTE-09, LITROS-01, LITROS-02, LITROS-03, LITROS-04

**Done when**:

- [x] Vínculo, desvínculo e lançamento sem viagem gravam o `viagemId` certo
- [x] Litros aparece só em Combustível e bloqueia o salvar sem litros quando vinculado
- [x] Falha na lista de viagens mostra o erro de carga
- [x] Gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(movimentacoes): vincular lancamento a viagem e litros no formulario (EIX-42)`

---

### T7: Detalhe da viagem com lançamentos

**What**: `ViagemLancamentosView` (cartão da viagem, seções Entradas e Saídas, Desvincular, estados) e a rota `app/(app)/viagens/[id]/index.tsx` com título no layout.
**Where**: `src/features/ponte-viagem/ViagemLancamentosView.tsx`
**Depends on**: T6
**Reuses**: `Screen`, `Card`, `ListSection`, `ListItem`, `EmptyState`, `Snackbar`
**Requirement**: DETALHE-02, DETALHE-03, DETALHE-04, DETALHE-05, DETALHE-06, DETALHE-07, DETALHE-08, DETALHE-09

**Done when**:

- [ ] Entradas e Saídas separadas, valor com `+`/`−`
- [ ] Desvincular tira a linha e mostra "Lançamento desvinculado."; falha mantém a linha
- [ ] Vazio, carregando e erro com "Tentar novamente"
- [ ] Formulário de lançamento vinculado mostra "Ver viagem", que abre `/viagens/<id>`
- [ ] Gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ponte-viagem): detalhe da viagem com lancamentos vinculados (EIX-42)`

---

### T8: Lista "Lançamentos por viagem" e entrada no hub

**What**: `ViagensLancamentosListView`, rota `app/(app)/viagens/lancamentos.tsx` com título no layout e item no hub Financeiro.
**Where**: `src/features/ponte-viagem/ViagensLancamentosListView.tsx`
**Depends on**: T7
**Reuses**: `FinanceiroHubView.tsx`, `ListItem`, `EmptyState`
**Requirement**: DETALHE-01

**Done when**:

- [ ] Lista as viagens vinculáveis e o toque abre `/viagens/<id>`
- [ ] Hub Financeiro mostra "Lançamentos por viagem"
- [ ] Vazio, carregando e erro tratados
- [ ] Build gate passa

**Tests**: unit
**Gate**: build
**Commit**: `feat(ponte-viagem): lista de lancamentos por viagem no hub Financeiro (EIX-42)`

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | início da fase 1 | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T4 | T4 → T5 | ✅ |
| T6 | T5 | T5 → T6 | ✅ |
| T7 | T6 | T6 → T7 | ✅ |
| T8 | T7 | T7 → T8 | ✅ |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Migration / RPC | integration | integration | ✅ |
| T2 | Tipos gerados | none | none | ✅ |
| T3 | Primitivo de UI | unit | unit | ✅ |
| T4 | Repositório | unit | unit | ✅ |
| T5 | Schema + repositório | unit | unit | ✅ |
| T6 | Tela | unit | unit | ✅ |
| T7 | Tela + rota | unit | unit | ✅ |
| T8 | Tela + rota + hub | unit | unit | ✅ |
