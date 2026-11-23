# EIX-45 · US12 — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline (sem `design.md`): segue o molde do `kpis_financeiros` (banco) e da `RankingView` (tela). Decisões no `spec.md`.
**Status**: Done (aguardando Verifier)

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec. Guidelines found: `AGENTS.md` §2.5 ("render do componente, caminho feliz e as validações citadas nos critérios de aceite"), `package.json` (jest projects `app` e `supabase`), `.claude/skills/teste-componente`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Migration / RPC SQL | integration (PGlite) | Every GRAF AC do banco: happy, bordas, 22023, 42501, grants | `supabase/tests/*.test.ts` | `node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects supabase` |
| Repositório (queries) | unit (supabase mockado) | Caminho feliz, tradução de 42501/22023/erro genérico, Zod recusa formato errado | `src/features/**/__tests__/*.test.ts` | `npx jest --selectProjects app` |
| Funções puras (geometria) | unit | Todos os ramos; bordas do spec (100% numa fatia, mês futuro) | `src/features/**/__tests__/*.test.ts` | `npx jest --selectProjects app` |
| Componente / tela | unit (Testing Library) | Render com dados, vazio, erro, carregando, toque, troca de filtro | `src/features/**/__tests__/*.test.tsx` | `npx jest --selectProjects app` |
| Tipos gerados | none | build gate only | - | `npm run typecheck` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks with unit tests only | `npx jest --selectProjects app <pasta>` |
| Full | Tasks with integration tests | `node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects supabase supabase/tests/graficos_caixa.test.ts` |
| Build | End of phase / no-test tasks | `npm run typecheck && npm run lint && npm run test` |

---

## Execution Plan

### Phase 1: Banco

```
T1 → T2
```

### Phase 2: Dados e geometria no app

```
T2 → T3 → T4
```

### Phase 3: Componentes e tela

```
T4 → T5 → T6 → T7 → T8
```

---

## Task Breakdown

### T1: ✅ Migration com as RPCs `fluxo_caixa_mensal` e `despesas_por_categoria`

**What**: Migration nova com as duas RPCs (security invoker, checagem de perfil, validação, grants) e o teste PGlite delas.
**Where**: `supabase/migrations/20261122000100_graficos_caixa.sql`
**Depends on**: None
**Reuses**: `supabase/migrations/20261109000100_kpis_dashboard.sql`, `supabase/tests/kpis_dashboard.test.ts`
**Requirement**: GRAF-01, GRAF-02, GRAF-03, GRAF-04, GRAF-05, GRAF-08, GRAF-09, GRAF-10, GRAF-11, GRAF-12

**Tools**:

- MCP: NONE
- Skill: `supabase-query`

**Done when**:

- [x] Teste `supabase/tests/graficos_caixa.test.ts` cobre cada AC listado e as bordas do spec (agendado não conta, 1,13 → 113, mês sem movimento = 0, "Outras", empate por título, `has_function_privilege`)
- [x] Gate full passa (32 testes)

**Tests**: integration
**Gate**: full

---

### T2: ✅ Aplicar a migration na nuvem e regerar os tipos

**What**: `db push --remote` (com dry-run aprovado pelo usuário) e `gen types` em `src/types/database.ts`.
**Where**: `src/types/database.ts`
**Depends on**: T1
**Reuses**: fluxo da memória `supabase-cli-remote`
**Requirement**: GRAF-01, GRAF-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Usuário aprovou o dry-run (22/11/2026)
- [x] `database.ts` tem `fluxo_caixa_mensal` e `despesas_por_categoria`
- [x] `npm run typecheck` passa

**Tests**: none (matrix: Tipos gerados = none)
**Gate**: build

---

### T3: ✅ Repositório dos gráficos

**What**: `buscarFluxoMensal` e `buscarDespesasPorCategoria`, com Zod na resposta e tradução de erro.
**Where**: `src/features/dashboard/graficos/queries.ts`
**Depends on**: T2
**Reuses**: `src/features/bi/queries.ts`
**Requirement**: GRAF-01, GRAF-08, GRAF-16

**Tools**:

- MCP: NONE
- Skill: `supabase-query`, `teste-componente`

**Done when**:

- [x] Testes em `graficos/__tests__/queries.test.ts` passam (11)
- [x] Gate quick passa

**Tests**: unit
**Gate**: quick

---

### T4: ✅ Geometria e medidas dos gráficos

**What**: Funções puras: opções de horizonte, mês final limitado ao mês atual, altura proporcional da barra, ângulos e `Path` do setor da rosca, cores das fatias; medidas derivadas dos tokens.
**Where**: `src/features/dashboard/graficos/geometria.ts`
**Depends on**: T3
**Reuses**: `src/ui/tokens.ts`, `src/lib/datas.ts`
**Requirement**: GRAF-06, GRAF-13, GRAF-14, GRAF-19

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] Testes em `graficos/__tests__/geometria.test.ts` passam (16, inclui fatia de 100% e mês futuro)
- [x] Gate build passa (fim da fase)

**Tests**: unit
**Gate**: build

---

### T5: ✅ Gráfico de barras Entradas vs Saídas

**What**: Componente `GraficoBarras` (colunas de mês ≥ 44pt, rolagem horizontal, toque mostra o mês com "+ R$" e "− R$", legenda).
**Where**: `src/features/dashboard/graficos/GraficoBarras.tsx`
**Depends on**: T4
**Reuses**: `src/ui` (`Text`, `Column`), `src/lib/money.ts`
**Requirement**: GRAF-06, GRAF-07, GRAF-19

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [x] Testes em `graficos/__tests__/GraficoBarras.test.tsx` passam (6)
- [x] Gate quick passa

**Tests**: unit
**Gate**: quick

---

### T6: ✅ Gráfico de rosca das despesas

**What**: Componente `GraficoRosca` (SVG, centro com total ou fatia selecionada, legenda tocável).
**Where**: `src/features/dashboard/graficos/GraficoRosca.tsx`
**Depends on**: T5
**Reuses**: `react-native-svg`, `src/ui`
**Requirement**: GRAF-13, GRAF-19

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [x] Testes em `graficos/__tests__/GraficoRosca.test.tsx` passam (7)
- [x] Gate quick passa

**Tests**: unit
**Gate**: quick

---

### T7: ✅ Seção de gráficos com consultas e estados

**What**: `GraficosCaixa`: abas de horizonte, duas consultas independentes, carregando, vazio e erro por gráfico.
**Where**: `src/features/dashboard/graficos/GraficosCaixa.tsx`
**Depends on**: T6
**Reuses**: `src/lib/useDadosDaTela.ts`, `RankingView` (estados)
**Requirement**: GRAF-06, GRAF-14, GRAF-15, GRAF-16, GRAF-17

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [x] Testes em `graficos/__tests__/GraficosCaixa.test.tsx` passam (12)
- [x] Gate quick passa

**Tests**: unit
**Gate**: quick

---

### T8: ✅ Gráficos na aba Dashboards

**What**: `RankingView` renderiza `GraficosCaixa` entre o filtro e o ranking só para Admin e Financeiro.
**Where**: `src/features/dashboard/ranking/RankingView.tsx`
**Depends on**: T7
**Reuses**: `canSeeFinanceiro` via `useMenu`
**Requirement**: GRAF-14, GRAF-18

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] `RankingView.test.tsx` cobre Admin/Financeiro com gráficos e Gestor sem gráficos (3 testes novos)
- [x] Gate build passa (app 1581, supabase 459)

**Tests**: unit
**Gate**: build

---

## Validation tables

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | start of Phase 1 | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | Phase 1 → Phase 2 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T4 | Phase 2 → Phase 3 | ✅ |
| T6 | T5 | T5 → T6 | ✅ |
| T7 | T6 | T6 → T7 | ✅ |
| T8 | T7 | T7 → T8 | ✅ |

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Migration / RPC | integration | integration | ✅ |
| T2 | Tipos gerados | none | none | ✅ |
| T3 | Repositório | unit | unit | ✅ |
| T4 | Funções puras | unit | unit | ✅ |
| T5 | Componente | unit | unit | ✅ |
| T6 | Componente | unit | unit | ✅ |
| T7 | Componente / tela | unit | unit | ✅ |
| T8 | Tela | unit | unit | ✅ |
