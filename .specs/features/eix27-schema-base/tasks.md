# EIX-27 — Schema base Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/eix27-schema-base/design.md`
**Status**: Approved
**Linear**: EIX-27 · commits usam `Refs: EIX-27`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md` §2.5 ("toda task entrega teste: render, caminho feliz e validações dos critérios"), `package.json` (jest-expo), `.claude/skills/teste-componente`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Migration SQL (tabelas, constraints, triggers, seeds) | integration (PGlite) | 1:1 com os ACs da spec; todo edge case listado | `supabase/tests/*.test.ts` | `npm test -- supabase/tests` |
| Policies RLS / Storage | integration (PGlite) | Cada AC de RLS/Storage testado por perfil, com caso permitido e negado | `supabase/tests/*.test.ts` | `npm test -- supabase/tests` |
| Harness de teste | integration | Smoke: banco sobe e roda SQL | `supabase/tests/*.test.ts` | `npm test -- supabase/tests` |
| Tipos gerados / config / docs | none | - (build gate only) | - | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Não usado (não há teste unitário nesta feature) | `npm test -- supabase/tests` |
| Full | Tasks com teste de integração | `npm test -- supabase/tests` |
| Build | Fim de fase ou task sem teste | `npm run typecheck && npm run lint && npm test` |

---

## Execution Plan

### Phase 1: Fundação

```
T1 → T2
```

### Phase 2: Schema

```
T3 → T4 → T5 → T6
```

### Phase 3: Acesso

```
T7 → T8
```

### Phase 4: Nuvem e documentação

```
T9 → T10
```

---

## Task Breakdown

### T1: Harness PGlite + config da CLI

**What**: Instalar `@electric-sql/pglite` (devDependency), rodar `npx supabase init` e criar o harness `supabase/tests/helpers/db.ts` com os stubs em `supabase/tests/helpers/supabase-stubs.sql`, provado por um smoke test.
**Where**: `supabase/tests/helpers/db.ts`
**Depends on**: None
**Reuses**: config Jest do `package.json`
**Requirement**: RLS-01 (base de teste)

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] `supabase/config.toml` gerado pela CLI
- [x] `criarBanco()` sobe PGlite, aplica stubs e todas as migrations existentes em ordem de nome
- [x] `comoUsuario()` troca para role `authenticated` com `auth.uid()` do usuário criado
- [x] Smoke test: `select 1` como superuser e `auth.uid()` retorna o id definido
- [x] Gate check passes: `npm test -- supabase/tests`
- [x] Test count: 2 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `test(db): adiciona harness pglite para testar migrations`

---

### T2: ADR do schema base

**What**: Registrar AD-004..AD-006 como ADR 0002 (snake_case, `auth_perfil()`, PGlite, Drizzle adiado) via skill `create-adr`.
**Where**: `docs/adr/0002-schema-base-rls-e-testes-pglite.md`
**Depends on**: T1
**Reuses**: formato de `docs/adr/0001-google-signin-nativo-e-sessao-securestore.md`
**Requirement**: DOC-01

**Tools**:

- MCP: NONE
- Skill: `create-adr`

**Done when**:

- [x] ADR com contexto, decisão, dependências introduzidas e consequências
- [x] Gate check passes: `npm run typecheck && npm run lint && npm test`

**Tests**: none
**Gate**: build

**Commit**: `docs(adr): registra decisões do schema base`

---

### T3: Migration base — perfil, usuario e funções

**What**: Enums, `set_data_atualizacao()`, `perfil` (+ seed dos 4 perfis), `usuario`, `auth_usuario_id()`, `auth_perfil()` e trigger `handle_new_user`.
**Where**: `supabase/migrations/20260924000100_base_perfil_usuario.sql`
**Depends on**: None
**Reuses**: harness de T1
**Requirement**: DB-01, DB-03, SEED-01, RLS-02

**Tools**:

- MCP: NONE
- Skill: `supabase-query`

**Done when**:

- [x] Tabelas `perfil` e `usuario` existem; 4 perfis inseridos, idempotente
- [x] Insert em `auth.users` cria `usuario` com perfil Motorista, nome e `google_subject_id`
- [x] Update em `usuario` altera `data_atualizacao`
- [x] `auth_perfil()` retorna o perfil do usuário logado e nulo sem linha em `usuario`
- [x] Gate check passes: `npm test -- supabase/tests`
- [x] Test count: ≥ 5 novos testes (7 novos)

**Tests**: integration
**Gate**: full

**Commit**: `feat(db): cria perfil, usuario e função auth_perfil`

---

### T4: Migration de catálogos

**What**: `categoria` e `forma_pagamento` com seeds padrão idempotentes.
**Where**: `supabase/migrations/20260924000200_catalogos.sql`
**Depends on**: T3
**Reuses**: `set_data_atualizacao()` de T3
**Requirement**: DB-01, DB-03, SEED-01

**Tools**:

- MCP: NONE
- Skill: `supabase-query`

**Done when**:

- [x] 6 categorias (5 Saida + Frete Entrada) e 4 formas de pagamento, todas ativas
- [x] Reaplicar a migration mantém um registro por nome
- [x] Gate check passes: `npm test -- supabase/tests`
- [x] Test count: ≥ 3 novos testes (3 novos)

**Tests**: integration
**Gate**: full

**Commit**: `feat(db): cria categorias e formas de pagamento com seed`

---

### T5: Migration de frota

**What**: `veiculo`, `rota`, `viagem` e `manutencao` com constraints de placa e hodômetro.
**Where**: `supabase/migrations/20260924000300_frota.sql`
**Depends on**: T4
**Reuses**: `set_data_atualizacao()` de T3
**Requirement**: DB-01, DB-02, DB-05, DB-06, DB-07

**Tools**:

- MCP: NONE
- Skill: `supabase-query`

**Done when**:

- [x] Placa repetida rejeitada; placa em minúscula ou com espaço rejeitada
- [x] `hodometro_final <= inicial` rejeitado; viagem aberta com final nulo aceita
- [x] `Finalizada` sem `hodometro_final` rejeitada
- [x] `manutencao.valor` negativo rejeitado
- [x] FKs obrigatórias de `viagem` e `manutencao` rejeitam nulo
- [x] Gate check passes: `npm test -- supabase/tests`
- [x] Test count: ≥ 7 novos testes (9 novos)

**Tests**: integration
**Gate**: full

**Commit**: `feat(db): cria tabelas de frota com validação de hodômetro`

---

### T6: Migration financeira

**What**: `divida` e `movimentacao` (FKs anuláveis para viagem e dívida) e FK `manutencao.movimentacao_id`.
**Where**: `supabase/migrations/20260924000400_financeiro.sql`
**Depends on**: T5
**Reuses**: `set_data_atualizacao()` de T3
**Requirement**: DB-01, DB-02, DB-03, DB-04, DB-07

**Tools**:

- MCP: NONE
- Skill: `supabase-query`

**Done when**:

- [x] Movimentação sem viagem e sem dívida aceita; com IDs inexistentes rejeitada
- [x] `Pago` sem `data_pagamento` rejeitado; `Pendente` com `data_pagamento` aceito
- [x] `valor` e `valor_parcela` negativos rejeitados
- [x] `data_atualizacao` muda no update
- [x] Todas as 10 tabelas existem em `public`
- [x] Gate check passes: `npm run typecheck && npm run lint && npm test`
- [x] Test count: ≥ 7 novos testes (8 novos)

**Tests**: integration
**Gate**: build

**Commit**: `feat(db): cria dívidas e movimentações com regras de pagamento`

---

### T7: Migration de RLS

**What**: RLS ativo nas 10 tabelas e policies por perfil conforme a tabela de acesso do design.
**Where**: `supabase/migrations/20260924000500_rls.sql`
**Depends on**: None
**Reuses**: `auth_perfil()` de T3
**Requirement**: RLS-01, RLS-03, RLS-04, RLS-05

**Tools**:

- MCP: NONE
- Skill: `security-best-practices`

**Done when**:

- [x] `relrowsecurity` verdadeiro nas 10 tabelas
- [x] Motorista: zero linhas em movimentacao/divida/categoria/forma_pagamento; só as próprias viagens
- [x] Admin/Financeiro leem e gravam financeiro; Admin/Gestor gravam frota
- [x] Autenticado lê veiculo, rota, perfil; anon lê zero linhas
- [x] Não-Admin não grava usuario/perfil; delete em categoria/forma_pagamento/usuario/perfil rejeitado
- [x] Gate check passes: `npm test -- supabase/tests`
- [x] Test count: ≥ 10 novos testes (12 novos)

**Tests**: integration
**Gate**: full

**Commit**: `feat(db): ativa rls com policies por perfil`

---

### T8: Migration do bucket de comprovantes

**What**: Bucket privado `comprovantes` e policies em `storage.objects` para Admin e Financeiro.
**Where**: `supabase/migrations/20260924000600_storage_comprovantes.sql`
**Depends on**: T7
**Reuses**: `auth_perfil()` de T3
**Requirement**: STO-01

**Tools**:

- MCP: NONE
- Skill: `security-best-practices`

**Done when**:

- [ ] Bucket existe com `public = false`
- [ ] Financeiro envia e lê objeto; Motorista e Gestor são rejeitados
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm test`
- [ ] Test count: ≥ 3 novos testes

**Tests**: integration
**Gate**: build

**Commit**: `feat(db): cria bucket privado de comprovantes`

---

### T9: Aplicar na nuvem e gerar tipos

**What**: Usuário roda `npx supabase login`, `link` e `db push` (autorização explícita); agente gera `src/types/database.ts`.
**Where**: `src/types/database.ts`
**Depends on**: None
**Reuses**: -
**Requirement**: TYPE-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `db push` aplicou as 6 migrations sem erro
- [ ] `database.ts` gerado com as 10 tabelas e os 5 enums
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm test`

**Tests**: none
**Gate**: build

**Commit**: `feat(types): gera tipos do banco a partir do schema`

---

### T10: README das migrations

**What**: Seção no README com link da CLI, `db push`, geração de tipos e como rodar os testes; corrige o caminho dos tipos no `.claude/CLAUDE.md`.
**Where**: `README.md`
**Depends on**: T9
**Reuses**: estilo da seção 3 do README
**Requirement**: DOC-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] README descreve login, link, push, gen types e `npm test -- supabase/tests`
- [ ] `.claude/CLAUDE.md` aponta `src/types/database.ts`
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm test`

**Tests**: none
**Gate**: build

**Commit**: `docs(db): documenta migrations e geração de tipos`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 ------→ T2
Phase 2:  T3 ------→ T4 ------→ T5 ------→ T6
Phase 3:  T7 ------→ T8
Phase 4:  T9 ------→ T10
```
