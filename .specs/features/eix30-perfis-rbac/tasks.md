# EIX-30 — US16 Perfis RBAC Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline (sem design.md — segue os padrões de `src/features/categorias` e `supabase/tests`)
**Status**: In Progress
**Linear**: EIX-30 · commits usam `Refs: EIX-30`

Decisões de design (inline):

- Migration nova `20261002000100_usuario_status.sql`: enum `status_usuario`, coluna `usuario.status`, backfill de `usuario`, `create or replace` de `auth_perfil()` e `handle_new_user()`, trigger `usuario_impedir_auto_alteracao`, `viagem_select` recriada exigindo perfil. Migrations aplicadas não são editadas.
- `src/types/database.ts`: atualizado no formato exato do `supabase gen types` (sem CLI linkada — AD-003); regenerar após `db push` deve dar diff vazio.
- App: `src/features/auth/permissions.ts` (funções puras), `src/features/auth/profileStore.ts` (Zustand + `useProfile()`), `app/_layout.tsx` com guards sessão → perfil carregado → aprovado. Tela de usuários em `src/features/usuarios/`, rota em `app/(app)/usuarios/` protegida por `isAdmin`.

---

## Test Coverage Matrix

> Guidelines: `AGENTS.md` §2.5, `.claude/skills/teste-componente`, padrão de `supabase/tests` (PGlite).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Migration SQL (status, triggers, policies) | integration (PGlite) | 1:1 com ACs de banco; caso permitido e negado | `supabase/tests/*.test.ts` | `npm test` |
| Helpers puros / store | unit | 1:1 com ACs; matriz perfil × status | `src/features/auth/__tests__/` | `npx jest --selectProjects app` |
| Repositório (queries) | unit (mock do client) | sucesso, erro do Supabase, resposta inválida | `src/features/usuarios/__tests__/` | `npx jest --selectProjects app` |
| Telas | unit (Testing Library) | render, caminho feliz, carregando/vazio/erro, feedback | `src/features/*/__tests__/` | `npx jest --selectProjects app` |
| Tipos gerados | none | build gate only | - | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tasks com teste unitário do app | `npx jest --selectProjects app` |
| Full | Tasks com teste PGlite | `npm test` |
| Build | Fim de fase ou task sem teste | `npm run typecheck && npm run lint && npm test` |

---

## Execution Plan

### Phase 1: Banco

```
T1 → T2
```

### Phase 2: Perfil no app

```
T3 → T4 → T5
```

### Phase 3: Tela de usuários

```
T6 → T7 → T8
```

---

## Task Breakdown

### T1: Migration de status do usuário e travas de auto-alteração

**What**: Criar `20261002000100_usuario_status.sql` e os testes PGlite; ajustar o harness para aprovar usuários de teste por padrão.
**Where**: `supabase/migrations/20261002000100_usuario_status.sql`, `supabase/tests/usuario_status.test.ts`, `supabase/tests/helpers/db.ts`
**Depends on**: None
**Reuses**: `supabase/tests/helpers/db.ts`
**Requirement**: RBAC-01, RBAC-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Conta nova nasce `AguardandoAprovacao`; `auth_perfil()` é `null` fora de `Aprovado`
- [x] Não aprovado não lê `viagem` própria
- [x] Backfill cria linha faltante e marca existentes como `AguardandoAprovacao`
- [x] Auto-alteração de perfil/status rejeitada com 42501; sem `auth.uid()` é aceita
- [x] Testes PGlite existentes continuam verdes

**Tests**: integration
**Gate**: full

---

### T2: Tipos do banco com `status_usuario`

**What**: Atualizar `src/types/database.ts` com a coluna `status` e o enum `status_usuario`, no formato do gerador.
**Where**: `src/types/database.ts`
**Depends on**: T1
**Reuses**: formato atual do arquivo
**Requirement**: RBAC-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `Tables<'usuario'>` tem `status`; `Constants.public.Enums.status_usuario` existe
- [x] Build gate verde

**Tests**: none
**Gate**: build

---

### T3: Helpers de permissão

**What**: `permissions.ts` com `isAdmin`, `canSeeFinanceiro`, `canSeeFrota`, `isAprovado` e rótulos de perfil/status.
**Where**: `src/features/auth/permissions.ts`, `src/features/auth/__tests__/permissions.test.ts`
**Depends on**: None (Phase 1 concluída)
**Reuses**: `Enums` de `@/types/database`
**Requirement**: RBAC-07

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] Matriz 4 perfis × 3 status + usuário nulo coberta
- [x] Gate quick verde

**Tests**: unit
**Gate**: quick

---

### T4: `profileStore` e `useProfile()`

**What**: Store Zustand que carrega a linha do usuário logado (Zod), limpa no logout e o hook `useProfile()`.
**Where**: `src/features/auth/profileStore.ts`, `src/features/auth/__tests__/profileStore.test.ts`
**Depends on**: T3
**Reuses**: `sessionStore.ts`, `@/supabase/client`
**Requirement**: RBAC-08

**Tools**:

- MCP: NONE
- Skill: `supabase-query`, `teste-componente`

**Done when**:

- [x] Sucesso, sem linha (não aprovado), erro e resposta inválida cobertos
- [x] `useProfile()` expõe os campos do AC5
- [x] Gate quick verde

**Tests**: unit
**Gate**: quick

---

### T5: Tela "Aguardando liberação" e guards do layout raiz

**What**: `AguardandoLiberacaoView`, tela de erro de perfil, grupo `(pendente)` e guards em `app/_layout.tsx`.
**Where**: `src/features/auth/AguardandoLiberacaoView.tsx`, `src/features/auth/__tests__/AguardandoLiberacaoView.test.tsx`, `app/_layout.tsx`, `app/(pendente)/_layout.tsx`, `app/(pendente)/aguardando.tsx`
**Depends on**: T4
**Reuses**: `Screen`, `Text`, `Button`, `EmptyState`, `signOut`
**Requirement**: RBAC-02

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [x] Textos de pendente e bloqueado; Sair chama `signOut`
- [x] Erro de perfil com "Tentar novamente" e "Sair"
- [x] Build gate verde (fim de fase)

**Tests**: unit
**Gate**: build

---

### T6: Repositório de usuários

**What**: `listarUsuarios`, `alterarPerfilUsuario`, `alterarStatusUsuario`, `listarPerfis` com Zod e erros em português.
**Where**: `src/features/usuarios/usuariosRepository.ts`, `src/features/usuarios/types.ts`, `src/features/usuarios/__tests__/usuariosRepository.test.ts`
**Depends on**: None (Phase 2 concluída)
**Reuses**: `src/features/categorias/categoriasRepository.ts`
**Requirement**: RBAC-04

**Tools**:

- MCP: NONE
- Skill: `supabase-query`, `teste-componente`

**Done when**:

- [x] Sucesso, erro do Supabase, 42501 e resposta inválida cobertos
- [x] Gate quick verde

**Tests**: unit
**Gate**: quick

---

### T7: Lista de usuários (só Admin)

**What**: `UsuariosListView`, rota `app/(app)/usuarios/index.tsx`, guard `isAdmin` no layout `(app)` e botão "Usuários" na Home só para Admin.
**Where**: `src/features/usuarios/UsuariosListView.tsx`, `src/features/usuarios/__tests__/UsuariosListView.test.tsx`, `app/(app)/_layout.tsx`, `app/(app)/usuarios/index.tsx`, `src/features/auth/HomeView.tsx`, `src/features/auth/__tests__/HomeView.test.tsx`
**Depends on**: T6
**Reuses**: `CategoriasListView.tsx`
**Requirement**: RBAC-03

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [x] Lista mostra nome, e-mail, perfil e status; carregando, vazio e erro
- [x] Home mostra "Usuários" só para Admin
- [x] Gate quick verde

**Tests**: unit
**Gate**: quick

---

### T8: Detalhe do usuário (perfil, aprovar, bloquear)

**What**: `UsuarioDetalheView` com escolha de perfil, Aprovar/Bloquear, feedback, e bloqueio das ações no próprio usuário.
**Where**: `src/features/usuarios/UsuarioDetalheView.tsx`, `src/features/usuarios/__tests__/UsuarioDetalheView.test.tsx`, `app/(app)/usuarios/[id].tsx`
**Depends on**: T7
**Reuses**: `CategoriaFormView.tsx`, `ListItem`, `Snackbar`
**Requirement**: RBAC-04, RBAC-06

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [ ] Salvar perfil, Aprovar e Bloquear com loading e Snackbar
- [ ] Erro mantém dados e mostra mensagem
- [ ] Próprio usuário: sem escolha de perfil e sem Bloquear, com aviso
- [ ] Build gate verde

**Tests**: unit
**Gate**: build
