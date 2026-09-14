# US15 — Login com Google Validation

**Date**: 2026-09-13
**Spec**: `.specs/features/us15-login-google/spec.md`
**Diff range**: `a8eab5b..6419595` (branch `jeanribeiro1905/eix-13-us15-login-com-google-no-app-expo`)
**Verifier**: independent sub-agent (author ≠ verifier)

**Verdict**: PASS

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1 Scaffold Expo | ✅ Done | tsconfig strict, expo-router, jest-expo, RNTL 13.x |
| T2 Tokens/UI primitives | ✅ Done | `Button.test.tsx` |
| T3 Env + SecureStore adapter | ✅ Done | `env.test.ts`, `secureStorage.test.ts` |
| T4 googleAuth service | ✅ Done | `googleAuth.test.ts` |
| T5 sessionStore + route guard | ✅ Done | `sessionStore.test.ts`, `authGuard.test.tsx` |
| T6 LoginView | ✅ Done | `LoginView.test.tsx` |
| T7 HomeView | ✅ Done | `HomeView.test.tsx` |
| T8 Config/README/ADR | ✅ Done | `app.config.ts`, README, ADR 0001 |

All 8 tasks marked complete in `tasks.md`; none blocked or partial.

---

## Spec-Anchored Acceptance Criteria

| ID | Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------------- | --------------------- | ------------------------ | ------ |
| AUTH-01 | App aberto sem sessão salva → Login com botão "Continuar com Google" | Rota `/login` renderizada, botão habilitado | `__tests__/routes/authGuard.test.tsx:48-56` — `expect(await screen.findByText('Tela Login'))...`, `expect(router.getPathname()).toBe('/login')`; `src/features/auth/__tests__/LoginView.test.tsx:26-30` — `expect(screen.getByRole('button',{name:'Continuar com Google'})).toBeEnabled()` | ✅ PASS |
| AUTH-02 | Toque + idToken → `signInWithIdToken({provider:'google', token})`, Home ao receber sessão | Chamada exata + navegação para Home | `src/features/auth/__tests__/googleAuth.test.ts:62-67` — `expect(signInWithIdToken).toHaveBeenCalledWith({provider:'google', token:'id-token-123'})`; `__tests__/routes/authGuard.test.tsx:68-77` — `emit('SIGNED_IN', session)` → `expect(await screen.findByText('Tela Home'))...` | ✅ PASS |
| AUTH-03 | Durante autenticação: botão desabilitado + indicador | disabled+busy+testid visível; toque duplo ignorado | `src/features/auth/__tests__/LoginView.test.tsx:42-57` — `expect(button).toBeDisabled()`, `toBeBusy()`, `getByTestId('button-loading')`, 2º `pressGoogle()` não incrementa chamadas | ✅ PASS |
| AUTH-04 | Cancelar seletor → permanece no Login, sem erro, botão habilitado | sem alerta, botão habilitado | `src/features/auth/__tests__/LoginView.test.tsx:59-68` — `expect(screen.queryByRole('alert')).not.toBeOnTheScreen()`, `toBeEnabled()` | ✅ PASS |
| AUTH-05 | Play Services indisponível → mensagem exata + botão reabilitado | "Google Play Services indisponível neste dispositivo." | `src/features/auth/__tests__/LoginView.test.tsx:70-83` (`it.each`) — `expect(screen.getByRole('alert')).toHaveTextContent('Google Play Services indisponível neste dispositivo.')`; código mapeado em `src/features/auth/__tests__/googleAuth.test.ts:84-91` | ✅ PASS |
| AUTH-06 | Sem idToken → mensagem exata + botão reabilitado | "Não foi possível obter o token do Google. Tente novamente." | `src/features/auth/__tests__/LoginView.test.tsx:70-83`; código mapeado em `src/features/auth/__tests__/googleAuth.test.ts:93-100` | ✅ PASS |
| AUTH-07 | Supabase rejeita/outro erro → mensagem exata + botão reabilitado | "Não foi possível entrar. Tente novamente." | `src/features/auth/__tests__/LoginView.test.tsx:70-83`; código mapeado em `src/features/auth/__tests__/googleAuth.test.ts:102-118` (rejeição Supabase, erro sem código, erro com código desconhecido) | ✅ PASS |
| AUTH-08 | App com sessão salva válida → Home direto, sem Login | pathname `/`, "Tela Home" visível, "Tela Login" ausente | `__tests__/routes/authGuard.test.tsx:58-66` | ✅ PASS |
| AUTH-09 | Enquanto sessão é lida: splash visível, nem Login nem Home renderizam | nenhuma das duas telas renderiza | `__tests__/routes/authGuard.test.tsx:41-46` — `expect(screen.queryByText('Tela Login')).not.toBeOnTheScreen()` e idem para Home | ✅ PASS (adequado, ver nota) |
| AUTH-10 | Storage adapter grava só via SecureStore, em partes ≤1800, lê valor original | 5000 chars → 3 partes ≤1800, round-trip idêntico | `src/supabase/__tests__/secureStorage.test.ts:37-47` — `expect(storedText.length).toBe(3)`, `every(part.length<=1800)`, `getItem(KEY)).toBe(value)` | ✅ PASS |
| AUTH-11 | `removeItem` apaga todas as partes; leitura seguinte retorna `null` | store vazio, `getItem` → `null` | `src/supabase/__tests__/secureStorage.test.ts:67-74` — `expect(store.size).toBe(0)`, `getItem(KEY)).toBeNull()` | ✅ PASS |
| AUTH-12 | Variável de env ausente/inválida → erro cita o nome dela | mensagem contém exatamente o nome da variável, nenhuma outra | `src/lib/__tests__/env.test.ts:18-28` (`it.each`, ausente/vazia) + `:30-32` (URL inválida) + `:34-45` (não vaza nomes válidos) | ✅ PASS |
| AUTH-13 | Home exibe nome completo e e-mail | textos visíveis exatos | `src/features/auth/__tests__/HomeView.test.tsx:20-30` — `getByText('Maria Silva')`, `getByText('maria@example.com')` | ✅ PASS |
| AUTH-14 | Com foto → foto; sem foto → inicial maiúscula | `Image source={{uri}}` vs. inicial maiúscula | `src/features/auth/__tests__/HomeView.test.tsx:32-59` — `toHaveProp('source',{uri:...})`, `toHaveTextContent('M')` | ✅ PASS |
| AUTH-15 | "Sair" → `supabase.auth.signOut` + `GoogleSignin.signOut` + Login exibido | ambos chamados 1x, retorno ao Login | `src/features/auth/__tests__/HomeView.test.tsx:74-84` (chama `signOut()`); `src/features/auth/__tests__/googleAuth.test.ts:121-129` (`googleSignOut` e `supabaseSignOut` chamados 1x cada); `__tests__/routes/authGuard.test.tsx:79-88` (`SIGNED_OUT` → "Tela Login") | ✅ PASS |

**Status**: ✅ All 15 ACs covered, 0 gaps, 0 spec-precision gaps.

**Note on AUTH-09**: the spec bundles two effects ("splash visível" + "nem Login nem Home renderizam"). Unit/integration tests can only observe the second (no JS component tree is mounted for either screen while `isRestoring`). The first effect is a native `expo-splash-screen` call (`SplashScreen.preventAutoHideAsync()` at module scope in `app/_layout.tsx:11`, `hideAsync()` gated behind `isReady` at `app/_layout.tsx:25-27`) that is only verifiable on-device. This is the exact situation flagged in the verification brief as out of reach for unit tests — judged adequate; not counted as a gap.

---

## Edge Cases

| Edge case | Result | Evidence |
| --------- | ------ | -------- |
| Toque repetido durante tentativa em andamento → ignorado | ✅ Handled | `src/features/auth/__tests__/LoginView.test.tsx:53-54` — segundo `pressGoogle()`, `expect(mockSignIn).toHaveBeenCalledTimes(1)` |
| Nome vazio nos metadados → Home usa e-mail e inicial do e-mail | ✅ Handled | `src/features/auth/__tests__/HomeView.test.tsx:61-72` |
| `GoogleSignin.signOut` falha → Supabase ainda encerra a sessão | ✅ Handled | `src/features/auth/__tests__/googleAuth.test.ts:131-136` |
| Refresh automático falha, Supabase emite `SIGNED_OUT` → Login | ✅ Handled | `src/features/auth/__tests__/sessionStore.test.ts:49-56` (store) + `__tests__/routes/authGuard.test.tsx:79-88` (rota) |

**Status**: 4/4 edge cases handled with test evidence.

---

## Discrimination Sensor

Ran in an isolated `git worktree` at
`C:\Users\jeanr\AppData\Local\Temp\claude\...\scratchpad\verify-wt` (detached HEAD at `6419595`),
with a directory junction to the real `node_modules` (removed before `git worktree remove`). The
real working tree was never mutated; `git stash` was not used.

| # | File:line | Mutation | Killed? |
| - | --------- | -------- | ------- |
| 1 | `src/supabase/secureStorage.ts:6` | `SECURE_STORE_CHUNK_SIZE` 1800 → 5000 | ✅ Killed (`secureStorage.test.ts` — expected 3 parts, got 1; round-trip test failure) |
| 2 | `src/supabase/secureStorage.ts:48` | `removeItem` no longer deletes the `.count` key | ✅ Killed (`store.size` expected 0, got 1) |
| 3 | `src/features/auth/googleAuth.ts:33-35` | Missing idToken now returns `{ ok: true }` instead of `no_id_token` | ✅ Killed (AUTH-06 test) |
| 4 | `src/features/auth/googleAuth.ts:39-42` | Supabase `error` from `signInWithIdToken` swallowed, always returns `ok:true` | ✅ Killed (AUTH-07 "Supabase rejeita o token" test) |
| 5 | `src/features/auth/errors.ts:7` | `cancelled` now maps to `'Login cancelado.'` instead of `null` | ✅ Killed (AUTH-04 test: alert now present) |
| 6 | `src/features/auth/LoginView.tsx:20-23` | `setIsLoading(false)` removed from the failure branch | ✅ Killed (4 tests: button stays disabled after every failure code) |
| 7 | `app/_layout.tsx:36-41` | Swapped the two `Stack.Protected` guards | ✅ Killed (4/5 `authGuard.test.tsx` tests fail — wrong group shown for session/no-session/restoring states) |
| 8 | `src/features/auth/HomeView.tsx:27` | `avatar_url` ignored, only `picture` used for photo | ✅ Killed (AUTH-14 "com foto" test — `getByLabelText('Foto de Maria Silva')` not found) |

**Sensor depth**: expanded (8 mutations; feature touches auth/session integrity — treated as elevated risk beyond the lightweight 1-3 default).
**Result**: 8/8 killed — PASS ✅

**Isolation verification**: `git status --porcelain` on the real tree was empty before sensor work and empty after `git worktree remove --force` (junction removed first via `cmd /c rmdir`, so the shared `node_modules` directory was left intact — confirmed present after cleanup).

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes | ✅ |
| No scope creep | ✅ (Out of Scope items from spec.md genuinely absent: no `perfil`/`usuario` tables, no RLS, no iOS config, no offline/SQLite) |
| Matches patterns | ✅ (thin route files delegate to Views, per design.md) |
| Spec-anchored outcome check (asserted values match spec) | ✅ (all 15 ACs match exact spec wording, incl. error message strings) |
| Per-layer Coverage Expectation met (domain 1:1 ACs; routes happy+edge+error) | ✅ |
| Every test maps to a spec requirement — no unclaimed tests | ✅ (UI-primitive tests in `Button.test.tsx` map to T2's own Done-when criteria, not a spec AC, which is consistent with the Test Coverage Matrix) |
| Documented guidelines followed | ✅ CLAUDE.md §8 (design tokens, 44pt touch target), §12 (Zod at boundary in `HomeView.tsx`, no `AsyncStorage`, no hand-written table types) |

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm test`
- **Result**: typecheck clean (no output/errors), lint clean (no output/warnings), 59/59 tests passed, 0 failed, 0 skipped
- **Test count before feature**: 0 (greenfield feature)
- **Test count after feature**: 59
- **Delta**: +59
- **Skipped tests**: none
- **Failures**: none

---

## Manual UAT Required (out of reach for unit tests)

- Real Google account picker on an Android emulator/device (actual OAuth consent flow).
- Real Supabase project: token exchange, user row appearing in Authentication → Users.
- Session actually surviving an app kill via the task manager (native OS-level persistence).
- Native splash screen staying visually present during restoration (see AUTH-09 note above).
- `expo prebuild`/`expo run:android` end-to-end build succeeding on a real machine.

These map to the spec's own "Independent Test" and "Success Criteria" sections, which explicitly call for emulator verification — appropriately out of scope for this automated Verifier pass.

---

## Fix Plans

None. No gaps, no surviving mutants, no spec-precision gaps.

---

## Requirement Traceability Update (for reference — spec.md itself not modified by this Verifier)

| Requirement ID | Previous Status | New Status |
| -------------- | ---------------- | ---------- |
| AUTH-01 .. AUTH-15 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 15/15 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 8/8 mutations killed
**Gate**: typecheck + lint + 59 tests, all passing

**What works**: Full login flow (button → Google → Supabase → session → Home), all 4 error paths with exact Portuguese messages, chunked SecureStore adapter with idempotent round-trip, route guard driven purely by session state, Home rendering photo/initial/name/email with correct fallbacks, sign-out resilient to a failing native Google sign-out.

**Issues found**: none.

**Next steps**: none required for this feature. Manual UAT items above remain for a real-device pass before demo, per the spec's own Independent Test / Success Criteria sections.
