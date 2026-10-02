# EIX-30 — US16 Perfis RBAC Validation

**Date**: 2026-10-02
**Spec**: `.specs/features/eix30-perfis-rbac/spec.md`
**Diff range**: `952c316..HEAD` (HEAD = `14bae19`, branch `feat/eix-30-us16-perfis-rbac`)
**Verifier**: independent sub-agent (author ≠ verifier)

**Verdict**: FAIL ❌

The verdict is FAIL because of one surviving mutant. "Admin gerencia" AC1 requires that the `usuarios` route is not registered for non-Admin users, and no test covers that. Every other AC has evidence that matches the spec. The gate is green.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 Migration status + travas | ✅ Done | 14bae19 range |
| T2 Tipos `status_usuario` | ✅ Done | build gate only |
| T3 Helpers de permissão | ✅ Done | - |
| T4 profileStore / useProfile | ✅ Done | - |
| T5 Aguardando liberação + guards | ✅ Done | - |
| T6 Repositório de usuários | ✅ Done | - |
| T7 Lista de usuários (Admin) | ⚠️ Partial | No test covers the route guard `guard={isAdmin}` in `app/(app)/_layout.tsx:13` (M9 survived) |
| T8 Detalhe do usuário | ✅ Done | - |

---

## Spec-Anchored Acceptance Criteria

### P1: Novo usuário entra bloqueado até aprovação

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| AC1 conta nova → `usuario` com `AguardandoAprovacao` | status `AguardandoAprovacao` | `supabase/tests/usuario_status.test.ts:53` - `expect(await lerUsuario(db, id)).toEqual({ status: 'AguardandoAprovacao', perfil: 'Motorista' })` | ✅ PASS |
| AC2 status ≠ Aprovado → `auth_perfil()` null | `null` for AguardandoAprovacao and Bloqueado | `supabase/tests/usuario_status.test.ts:66` - `expect(perfil).toBe(esperado)` (table at :57-59) | ✅ PASS |
| AC3 não aprovado não lê `viagem`, nem a própria | 0 rows (Aprovado: 1) | `supabase/tests/usuario_status.test.ts:110` - `expect(total).toBe(quantidade)` (table at :101-103) | ✅ PASS |
| AC4 backfill cria linha faltante | Motorista + AguardandoAprovacao | `supabase/tests/usuario_status.test.ts:211-212` - `toEqual([{ nome: 'Beto', ... }])`, `toEqual({ status: 'AguardandoAprovacao', perfil: 'Motorista' })` | ✅ PASS |
| AC5 linhas existentes → AguardandoAprovacao | status AguardandoAprovacao | `supabase/tests/usuario_status.test.ts:216` - `toEqual({ status: 'AguardandoAprovacao', perfil: 'Admin' })` | ✅ PASS |
| AC6 não aprovado vê só "Aguardando liberação" | aguardando shown, no module screen | `__tests__/routes/authGuard.test.tsx:115-117` - `findByText('Tela Aguardando')`, `queryByText('Tela Home')).not.toBeOnTheScreen()`, `getPathname()).toBe('/aguardando')`; `src/features/auth/__tests__/AguardandoLiberacaoView.test.tsx:40` - `getByText('Aguardando liberação')` | ✅ PASS |
| AC7 Bloqueado → texto exato | "Seu acesso foi bloqueado. Fale com o administrador." | `src/features/auth/__tests__/AguardandoLiberacaoView.test.tsx:57` - `getByText('Seu acesso foi bloqueado. Fale com o administrador.')` | ✅ PASS |
| AC8 Sair encerra a sessão | `signOut` called | `src/features/auth/__tests__/AguardandoLiberacaoView.test.tsx:67` - `expect(signOut).toHaveBeenCalledTimes(1)` | ✅ PASS |
| AC9 falha ao carregar perfil | message + "Tentar novamente" + "Sair" | `src/features/auth/__tests__/AguardandoLiberacaoView.test.tsx:83-89` - `getByText('Não foi possível carregar seu perfil.')`, press "Tentar novamente" → refetch, press "Sair" → `signOut` x1 | ✅ PASS |

### P1: Admin gerencia perfis e status

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| AC1 não-Admin: esconde acesso **e não registra a rota `usuarios`** | button hidden; route absent | `src/features/auth/__tests__/HomeView.test.tsx:113` - `queryByRole('button', { name: 'Usuários' })).not.toBeOnTheScreen()` (3 perfis); Admin :102. **Route non-registration: no evidence** (M9 survived) | ❌ GAP (partial) |
| AC2 lista nome, e-mail, rótulo perfil, rótulo status | e.g. "Operador/Motorista", "Aguardando aprovação" | `src/features/usuarios/__tests__/UsuariosListView.test.tsx:51-58` - `getByText('Ana Souza')`, `'ana@empresa.com'`, `'Administrador'`, `'Aprovado'`, ..., `'Operador/Motorista'`, `'Aguardando aprovação'` | ✅ PASS |
| AC3 carregando → "Carregando usuários" | indicator label | `src/features/usuarios/__tests__/UsuariosListView.test.tsx:50` - `getByLabelText('Carregando usuários')` | ✅ PASS |
| AC4 erro → "Não foi possível carregar" + "Tentar novamente" | exact texts | `src/features/usuarios/__tests__/UsuariosListView.test.tsx:85-88` - `findByText('Não foi possível carregar')`, press `'Tentar novamente'` → reload | ✅ PASS |
| AC5 salvar perfil → `perfil_id` gravado + "Perfil atualizado." | DB updated; snackbar text | `src/features/usuarios/__tests__/UsuarioDetalheView.test.tsx:85-86` - `findByText('Perfil atualizado.')`, `alterarPerfilUsuario` called with `('u2', 'p-fin')`; `src/features/usuarios/__tests__/usuariosRepository.test.ts:117` - `update` called with `{ perfil_id: 'p-fin' }`; `supabase/tests/usuario_status.test.ts:157` - another user's row ends as `{ status: 'Aprovado', perfil: 'Gestor de Frota' }` | ✅ PASS |
| AC6 Aprovar → `Aprovado` + "Usuário aprovado." | status Aprovado; snackbar | `src/features/usuarios/__tests__/UsuarioDetalheView.test.tsx:96-97` - `findByText('Usuário aprovado.')`, `alterarStatusUsuario` called with `('u2', 'Aprovado')`; `src/features/usuarios/__tests__/usuariosRepository.test.ts:153` | ✅ PASS |
| AC7 Bloquear → `Bloqueado` + "Usuário bloqueado." | status Bloqueado; snackbar | `src/features/usuarios/__tests__/UsuarioDetalheView.test.tsx:112-113` - `findByText('Usuário bloqueado.')`, called with `('u2', 'Bloqueado')` | ✅ PASS |
| AC8 falha → mensagem PT + dados anteriores mantidos | error text; previous status still shown | `src/features/usuarios/__tests__/UsuarioDetalheView.test.tsx:127-129` - error text shown, `getByText('Aguardando aprovação')`, Aprovar still present; repository messages `usuariosRepository.test.ts:131-137`, `:157-163`. Only the status-failure path is tested at screen level (perfil-failure path has no screen test) | ✅ PASS (minor gap noted) |
| AC9 não-Admin não altera `usuario` | rejected by policy (EIX-27) | `supabase/tests/rls.test.ts:210` - `expect(usuarioAlheio.rows).toHaveLength(0)` (existing test; checks `nome` on another user's row, not `perfil_id`/`status`) | ✅ PASS (⚠️ precision: column-specific attempt not asserted) |

### P1: Admin não perde o próprio acesso

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| AC1 alterar próprio `perfil_id` → 42501 | SQLSTATE 42501 | `supabase/tests/usuario_status.test.ts:133-134` - `expect(codigo).toBe('42501')`, row unchanged | ✅ PASS |
| AC2 alterar próprio `status` → 42501 | SQLSTATE 42501 | `supabase/tests/usuario_status.test.ts:144-145` - `expect(codigo).toBe('42501')`, row unchanged | ✅ PASS |
| AC3 próprio usuário: sem perfil/Bloquear + aviso | exact warning text | `src/features/usuarios/__tests__/UsuarioDetalheView.test.tsx:141-144` - `getByText('Você não pode alterar o próprio perfil nem bloquear a si mesmo.')`, no `Salvar perfil`, no `Perfil Administrador`, no `Bloquear` | ✅ PASS |
| AC4 sem usuário logado → aceita | update persists | `supabase/tests/usuario_status.test.ts:169` - `toEqual({ status: 'Bloqueado', perfil: 'Financeiro' })` | ✅ PASS |

### P1: `useProfile()` e helpers

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| AC1-AC3 isAdmin / canSeeFinanceiro / canSeeFrota | matrix per profile, Aprovado | `src/features/auth/__tests__/permissions.test.ts:25-29` - `toEqual(esperadoAprovado[perfil])` (matrix :12-17 matches spec) | ✅ PASS |
| AC4 não aprovado / sem usuário → false | all false | `src/features/auth/__tests__/permissions.test.ts:40-45` (2 status × 4 perfis), `:50-55` (null) | ✅ PASS |
| AC5 `useProfile()` exposes fields | usuario, estado, isAprovado, isAdmin, canSeeFinanceiro, canSeeFrota, recarregar | `src/features/auth/__tests__/profileStore.test.ts:125-133` - `toMatchObject({ estado: 'pronto', usuario: {...}, isAprovado: true, isAdmin: false, canSeeFinanceiro: true, canSeeFrota: false })`, `recarregar).toBe(recarregarPerfil)` | ✅ PASS |

**Status**: ❌ 1 gap (Admin gerencia AC1, route non-registration). 1 spec-precision note (AC9 rests on an older generic test).

---

## Edge Cases

- [x] Zod rejects the profile response → error state: `src/features/auth/__tests__/profileStore.test.ts:79`
- [x] Empty list → "Nenhum usuário encontrado": `src/features/usuarios/__tests__/UsuariosListView.test.tsx:76`
- [x] Logout discards the profile: `src/features/auth/__tests__/profileStore.test.ts:88` (state reset), `:100` (late response ignored). The root-layout wiring (`limparPerfil` when the session ends) has no direct assertion.

---

## Discrimination Sensor

Run in a temporary `git worktree` (detached at HEAD) under the scratchpad, with `node_modules` reached through a directory junction. The scratch was removed afterwards. Real-tree `git status --porcelain` matched the baseline (` M package-lock.json`).

| # | File:line | Mutation | Killed? |
| - | --------- | -------- | ------- |
| M1 | `supabase/migrations/20261002000100_usuario_status.sql:40` | `auth_perfil()` drops `and u.status = 'Aprovado'` | ✅ Killed (4 failed) |
| M2 | `supabase/migrations/20261002000100_usuario_status.sql:90` | self-alteration trigger drops the `status` check | ✅ Killed (1 failed) |
| M3 | `supabase/migrations/20261002000100_usuario_status.sql:75` | `viagem_select` back to `motorista_id = auth_usuario_id()` with no profile check | ✅ Killed (2 failed) |
| M4 | `supabase/migrations/20261002000100_usuario_status.sql:59` | `handle_new_user` writes `'Aprovado'` | ✅ Killed (2 failed) |
| M5 | `src/features/auth/permissions.ts:38` | `isAdmin` ignores status (`usuario?.perfil === 'Admin'`) | ✅ Killed (3 failed) |
| M6 | `app/_layout.tsx:36` | root guard ignores `isAprovado` | ✅ Killed (2 failed) |
| M7 | `src/features/usuarios/UsuarioDetalheView.tsx:177` | Bloquear shown on the user's own row | ✅ Killed (1 failed) |
| M8 | `src/features/usuarios/UsuarioDetalheView.tsx:74` | optimistic status update before the write (stale data kept after an error) | ✅ Killed (1 failed) |
| M9 | `app/(app)/_layout.tsx:13` | `guard={isAdmin}` → `guard={true}` (route registered for every profile) | ❌ Survived → fix task |
| M10 | `src/features/auth/profileStore.ts:53` | a response that arrives after logout is not discarded | ✅ Killed (1 failed) |

**Sensor depth**: P0 (auth/RBAC), 10 manual mutations
**Result**: 9/10 killed - FAIL ❌

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes | ✅ |
| No scope creep | ⚠️ Small extras beyond the spec: the trigger also blocks self-change of `ativo` (`usuario_status.sql:91`), and the pending screen has a "Verificar novamente" button (`AguardandoLiberacaoView.tsx`, tested at `AguardandoLiberacaoView.test.tsx:70`). Both are harmless but no AC claims them |
| Matches patterns | ✅ (repository/view shape mirrors `categorias`) |
| Spec-anchored outcome check | ✅ except Admin gerencia AC1 (route) |
| Per-layer coverage (DB 1:1; screens happy/edge/error) | ⚠️ route-guard layer of `(app)/_layout.tsx` uncovered |
| Every test maps to a spec requirement | ⚠️ "Verificar novamente" test unclaimed |
| Documented guidelines followed: `AGENTS.md`, `.claude/CLAUDE.md`, `DESIGN_CYAN.md` | ✅ No hardcoded colors/spacing in the new views. One inline `style={{ flex: 1 }}` (`UsuariosListView.tsx:73`) is layout, not a token value |

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm test`
- **Result**: typecheck clean, lint clean, app 186 passed / 0 failed (27 suites), supabase 59 passed / 0 failed (8 suites), 0 skipped
- **Test count before feature**: not measured. The diff deletes no test files and only adds to existing ones (`authGuard.test.tsx`, `helpers/db.ts`)
- **Failures**: none

---

## Fix Plans

### Fix 1: test that the `usuarios` route is not registered for non-Admin users (Major)

- **Root cause**: `__tests__/routes/authGuard.test.tsx` registers no `(app)/usuarios/*` routes. No test asserts that `Stack.Protected guard={isAdmin}` blocks navigation.
- **Fix task**: in `authGuard.test.tsx`, add stub routes `'(app)/usuarios/index'`. For each non-Admin approved profile, render with `initialUrl: '/usuarios'` or call `router.push('/usuarios')`, and assert the stub is not on screen. For Admin, assert that it renders.
- **Verify**: re-run M9 (`guard={true}`). It must be killed.

### Fix 2 (minor, optional)

- Add a screen test for a failed profile save in `UsuarioDetalheView` (AC8, profile path): the error snackbar shows and the previous profile stays selected.
- Add a PGlite test where an approved non-Admin tries `update usuario set perfil_id/status` on another user and gets 0 rows (AC9 precision).

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| RBAC-01 | Implementing | ✅ Verified |
| RBAC-02 | Pending | ✅ Verified |
| RBAC-03 | Pending | ❌ Needs Fix (AC1 route guard) |
| RBAC-04 | Pending | ✅ Verified |
| RBAC-05 | Implementing | ✅ Verified |
| RBAC-06 | Pending | ✅ Verified |
| RBAC-07 | Pending | ✅ Verified |
| RBAC-08 | Pending | ✅ Verified |

(The traceability table in `spec.md` still shows the old statuses. The orchestrator should update it.)

---

## Summary

**Overall**: ⚠️ Issues. Not ready until Fix 1 lands.

**Spec-anchored check**: 26/27 ACs match the spec outcome; 1 gap (Admin gerencia AC1, route) and 1 precision note (AC9)
**Sensor**: 9/10 mutations killed
**Gate**: 245 passed, 0 failed

**What works**: approval is enforced in the database (`auth_perfil`, `viagem_select`, new-user trigger, backfill); the self-alteration trigger returns 42501; the root-layout approval guard, the permission matrix, `useProfile()`, and the list and detail screens all show the exact Portuguese texts from the spec.

**Next steps**: implement Fix 1 and re-run the Verifier (iteration 1 of 3).

---

## Re-verification — iteration 1 (2026-10-02, HEAD = `2f0fb36`)

**Verdict**: PASS ✅

- **Fix 1**: `__tests__/routes/authGuard.test.tsx` registers `(app)/usuarios/index`. It asserts that an approved Admin reaches `/usuarios` and that Gestor de Frota, Financeiro and Motorista stay on Home (`it.each`). The fix commit also declares `index` first in `app/(app)/_layout.tsx`, so an Admin no longer opens straight into Usuários.
- **M9 re-run** (`guard={isAdmin}` → `guard={true}`): ✅ Killed, 3 failed (the 3 non-Admin profiles). The file was restored and the real tree matches the baseline.
- **Fix 2**: the failed profile save is covered at screen level (`UsuarioDetalheView.test.tsx`). PGlite shows that an approved non-Admin cannot change `perfil_id`/`status` on another user (`usuario_status.test.ts`). The logout → `limparPerfil` wiring is now asserted in `authGuard.test.tsx`.
- **Gate**: typecheck clean, lint clean, app 192 passed (27 suites), supabase 62 passed (8 suites), 0 failed.
- **Sensor**: 10/10 mutations killed.
- **Traceability**: RBAC-01…08 → Verified (`spec.md` updated).
