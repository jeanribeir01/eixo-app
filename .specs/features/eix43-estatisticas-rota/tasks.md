# EIX-43 · US10 Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/eix43-estatisticas-rota/spec.md`
**Design**: inline (sem `design.md`): view interna `estatistica_viagem` + três RPCs `security definer` no molde de `kpis_dashboard` e `ponte_viagem`; `src/features/bi/` no molde de `ponteRepository.ts`.
**Status**: In Progress

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec. Guidelines found: `AGENTS.md` §2.5 ("toda task entrega teste: render, caminho feliz e as validações dos critérios de aceite"), `.specs/STATE.md` AD-006 (migrations testadas no PGlite), lições L-001, L-005 e L-006.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Migration SQL (view, RPC, índice, grants) | integration (PGlite) | 1:1 com BI-01..BI-18; cada fórmula, divisão por zero, viagem sem lançamento, 42501, 22023, grants via `has_function_privilege`/`has_table_privilege` | `supabase/tests/*.test.ts` | `node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects supabase supabase/tests/bi.test.ts` |
| Repositório / consultas (`src/features/bi/queries.ts`) | unit (client mockado) | Caminho feliz de cada função + 42501 + 22023 + erro genérico + dado fora do schema | `src/features/<feature>/__tests__/*.test.ts` | `npx jest --selectProjects app src/features/bi` |
| Formatação (`src/features/bi/formatar.ts`) | unit | Nulo → `—` e cada unidade (BI-23) | `src/features/<feature>/__tests__/*.test.ts` | `npx jest --selectProjects app src/features/bi` |
| Tipos gerados (`src/types/database.ts`) | none | build gate (typecheck) | - | `npm run typecheck` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tarefas só com teste unitário do app | `npx jest --selectProjects app src/features/bi` |
| Full | Tarefas de migration | `node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects supabase` |
| Build | Fim de fase e tarefas sem teste | `npm run typecheck && npm run lint && npm run test` |

---

## Execution Plan

### Phase 1: Banco

```
T1 → T2 → T3
```

### Phase 2: App

```
T4 → T5 → T6
```

---

## Task Breakdown

### T1: View `estatistica_viagem`, índices e RPC `estatisticas_viagens` ✅

**What**: Migration com os índices `viagem(rota_id)` e `viagem(veiculo_id)`, a view interna (KM, receita, despesa, litros por viagem não cancelada, sem `select` para `anon`/`authenticated`) e a RPC por viagem com checagem de perfil e de período.
**Where**: `supabase/migrations/20261113000100_bi.sql` (teste em `supabase/tests/bi.test.ts`)
**Depends on**: None
**Reuses**: `supabase/migrations/20261109000100_kpis_dashboard.sql` (período, 42501), `supabase/migrations/20261111000100_ponte_viagem.sql` (definer, grants)
**Requirement**: BI-01, BI-02, BI-03, BI-04, BI-05, BI-06, BI-07, BI-08, BI-15, BI-16, BI-17, BI-18

**Tools**:

- MCP: NONE
- Skill: `supabase-query`

**Done when**:

- [x] Rentabilidade 366543, R$/KM 133 e KM/L 3,33 no cenário do Independent Test
- [x] KM, R$/KM e KM/L nulos sem hodômetro final; litros e KM/L nulos sem litros; zeros sem lançamento
- [x] Cancelada e viagem fora do período (inclusive 23h30 no fuso do Brasil) tratadas
- [x] 42501 para Motorista, 22023 para os três casos de período, grants e índices conferidos no catálogo
- [x] Gate check passes: Full

**Tests**: integration
**Gate**: full

**Commit**: `feat(bi): view estatistica_viagem e RPC estatisticas_viagens (EIX-43)`

---

### T2: RPC `estatisticas_rotas`

**What**: Consolidação por rota sobre as viagens finalizadas, com ordem e as flags `mais_lucrativa` e `maior_custo`.
**Where**: `supabase/migrations/20261113000100_bi.sql` (modify; teste em `supabase/tests/bi.test.ts`)
**Depends on**: T1
**Reuses**: view `estatistica_viagem` (T1)
**Requirement**: BI-09, BI-10, BI-11, BI-12, BI-15, BI-16, BI-17

**Tools**:

- MCP: NONE
- Skill: `supabase-query`

**Done when**:

- [ ] Rota com só viagem em andamento fica fora; somas só das finalizadas
- [ ] Ordem e empates conforme BI-10; uma flag de cada, nas rotas certas (BI-11, BI-12); lista vazia sem flag
- [ ] 42501, 22023 e grants da função
- [ ] Gate check passes: Full

**Tests**: integration
**Gate**: full

**Commit**: `feat(bi): RPC estatisticas_rotas com rota mais lucrativa e de maior custo (EIX-43)`

---

### T3: RPC `estatisticas_veiculos`

**What**: Custo por KM acumulado por veículo sobre as viagens finalizadas, ordenado para o ranking.
**Where**: `supabase/migrations/20261113000100_bi.sql` (modify; teste em `supabase/tests/bi.test.ts`)
**Depends on**: T2
**Reuses**: view `estatistica_viagem` (T1)
**Requirement**: BI-13, BI-14, BI-15, BI-16, BI-17

**Tools**:

- MCP: NONE
- Skill: `supabase-query`

**Done when**:

- [ ] R$/KM do veículo é a razão das somas (200), não a média das razões
- [ ] Ordem e empates conforme BI-14
- [ ] 42501, 22023 e grants da função
- [ ] Gate check passes: Build (fim da fase)

**Tests**: integration
**Gate**: build

**Commit**: `feat(bi): RPC estatisticas_veiculos com custo por KM acumulado (EIX-43)`

---

### T4: Regerar os tipos do banco

**What**: Aplicar a migration na nuvem (com autorização do usuário) e regerar `src/types/database.ts` com as três RPCs.
**Where**: `src/types/database.ts`
**Depends on**: None (fase 2 começa depois da fase 1)
**Reuses**: comando da seção 11 do `.claude/CLAUDE.md`
**Requirement**: BI-19

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `estatisticas_viagens`, `estatisticas_rotas` e `estatisticas_veiculos` aparecem em `Functions`
- [ ] Gate check passes: Build

**Tests**: none
**Gate**: build

**Commit**: `chore(types): regera database.ts com as RPCs de BI (EIX-43)`

---

### T5: Consultas tipadas `src/features/bi/queries.ts`

**What**: `listarEstatisticasViagens`, `listarEstatisticasRotas` e `listarEstatisticasVeiculos`, com Zod, centavos inteiros e tradução de erro, documentadas em JSDoc.
**Where**: `src/features/bi/queries.ts` (teste em `src/features/bi/__tests__/queries.test.ts`)
**Depends on**: T4
**Reuses**: `src/features/ponte-viagem/ponteRepository.ts`, `src/lib/errors.ts`
**Requirement**: BI-19, BI-20, BI-21, BI-22

**Tools**:

- MCP: NONE
- Skill: `supabase-query`, `teste-componente`

**Done when**:

- [ ] Cada função chama a RPC certa com `data_inicial`/`data_final` e devolve os campos validados
- [ ] 42501 → `MENSAGEM_ACESSO_NEGADO`; 22023 → "Período inválido. Confira as datas do filtro."; outro erro ou schema inválido → mensagem genérica
- [ ] Gate check passes: Quick

**Tests**: unit
**Gate**: quick

**Commit**: `feat(bi): consultas tipadas das estatísticas de viagem, rota e veículo (EIX-43)`

---

### T6: `formatarIndicador`

**What**: Formata moeda, R$/KM e KM/L no padrão brasileiro e devolve `—` para nulo.
**Where**: `src/features/bi/formatar.ts` (teste em `src/features/bi/__tests__/formatar.test.ts`)
**Depends on**: T5
**Reuses**: `src/lib/money.ts` (`formatarMoeda`)
**Requirement**: BI-23

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [ ] Nulo → `—` nas três unidades; `R$ 1,33/km`; `3,33 km/L`; moeda igual a `formatarMoeda`
- [ ] Gate check passes: Build (fim da fase)

**Tests**: unit
**Gate**: build

**Commit**: `feat(bi): formatarIndicador com travessão para divisão por zero (EIX-43)`

---

## Phase Execution Map

```
Phase 1 → Phase 2

Phase 1:  T1 ------→ T2 ------→ T3
Phase 2:  T4 ------→ T5 ------→ T6
```

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | início da fase 1 | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | None | início da fase 2 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Migration SQL | integration | integration | ✅ OK |
| T2 | Migration SQL | integration | integration | ✅ OK |
| T3 | Migration SQL | integration | integration | ✅ OK |
| T4 | Tipos gerados | none | none | ✅ OK |
| T5 | Consultas | unit | unit | ✅ OK |
| T6 | Formatação | unit | unit | ✅ OK |
