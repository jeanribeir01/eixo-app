# US15 — Login com Google Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/us15-login-google/design.md`
**Status**: In Progress
**Linear**: EIX-13 (mãe) · commits usam `Refs: EIX-NN` / `Closes EIX-NN`

---

## Test Coverage Matrix

> Generated from project guidelines and spec. Guidelines found: `.claude/CLAUDE.md` (§11 comandos `npm run lint && npm run typecheck`, `npm test`) - no coverage threshold; strong defaults applied.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Lib / storage / env (`src/lib`, `src/supabase`) | unit | All branches; 1:1 to spec ACs | `src/**/__tests__/*.test.ts` | `npm test` |
| Auth service + store (`src/features/auth/*.ts`) | unit | All branches; 1:1 to ACs; every listed edge case | `src/features/auth/__tests__/*.test.ts` | `npm test` |
| UI primitives (`src/ui`) | unit (RNTL) | Variants, disabled/loading, min touch target | `src/ui/__tests__/*.test.tsx` | `npm test` |
| Views (`src/features/auth/*View.tsx`) | unit (RNTL) | Happy + every error path in ACs | `src/features/auth/__tests__/*.test.tsx` | `npm test` |
| Routes / layout (`app/`) | integration (`expo-router/testing-library`) | Guard: no session → Login; session → Home; restoring → nothing | `__tests__/routes/*.test.tsx` (fora de `app/`, senão o expo-router trata o teste como rota) | `npm test` |
| Config / docs (`app.config.ts`, README, ADR) | none | build gate only | - | build gate |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `npm test` |
| Full | After tasks with integration tests | `npm run typecheck && npm test` |
| Build | After phase completion or config/docs-only tasks | `npm run typecheck && npm run lint && npm test` |

---

## Execution Plan

### Phase 1: Foundation

```
T1 → T2 → T3
```

### Phase 2: Auth core

```
T3 → T4 → T5
```

### Phase 3: Screens and delivery

```
T5 → T6 → T7 → T8
```

---

## Task Breakdown

### T1: Scaffold do app Expo

**What**: Projeto Expo TypeScript strict com expo-router, Jest (jest-expo + RNTL), ESLint e scripts `typecheck`/`lint`/`test`.
**Where**: `package.json`
**Depends on**: None
**Reuses**: template `blank-typescript` do create-expo-app
**Requirement**: base de todas (sem AC própria)
**Linear**: EIX-16

**Tools**:

- MCP: NONE
- Skill: `react-native-expert` (project-structure, expo-router)

**Done when**:

- [x] `tsconfig.json` com `strict: true`
- [x] `app/_layout.tsx` mínimo renderiza via expo-router
- [x] `.gitignore` inclui `android/`, `ios/`, `.env`; `.env.example` com as 3 variáveis
- [x] Gate check passes: `npm run typecheck && npm run lint && npm test` (1 smoke test)

**Status**: ✅ Complete — RNTL fixado em 13.x (o `expo-router/testing-library` do SDK 57 ainda usa a API síncrona do RNTL 13); `react-dom` 19.2.3 instalado para o npm resolver o peer opcional do Expo; `tsconfig` declara `types: ["jest"]` (TypeScript 6 não inclui `@types` automaticamente).

**Tests**: integration
**Gate**: build

---

### T2: Tokens e primitivos de UI

**What**: `tokens.ts` do CLAUDE.md §8 e primitivos `Screen`, `Text`, `Button`, `Card` sobre eles.
**Where**: `src/ui/`
**Depends on**: T1
**Reuses**: tokens de `.claude/CLAUDE.md` §8 e `.claude/docs/DESIGN-CYAN.md`
**Requirement**: AUTH-03 (Button loading/disabled)
**Linear**: EIX-17

**Tools**:

- MCP: NONE
- Skill: `react-composition-patterns` (variantes explícitas)

**Done when**:

- [x] Button `primary` (fundo accent, borda accentEdge, texto branco) e `ghost` (transparente, borda border)
- [x] Button com `loading` fica desabilitado, mostra indicador e não dispara `onPress`
- [x] Button tem `minHeight` 44
- [x] Gate check passes: `npm test` (7 testes)

**Status**: ✅ Complete — `Screen`, `Text` e `Card` não têm AC própria; são exercitados pelos testes das Views (T6/T7).

**Tests**: unit
**Gate**: quick

---

### T3: Env e cliente Supabase com SecureStore

**What**: validação Zod das variáveis, adapter de storage em partes e cliente `supabase-js`.
**Where**: `src/supabase/`
**Depends on**: T2
**Reuses**: none
**Requirement**: AUTH-10, AUTH-11, AUTH-12
**Linear**: EIX-18

**Tools**:

- MCP: NONE
- Skill: `react-native-expert` (storage-patterns)

**Done when**:

- [x] Valor de 5000 caracteres gravado e lido idêntico, com cada parte ≤ 1800
- [x] `removeItem` apaga todas as partes; leitura depois retorna `null`
- [x] Variável ausente gera erro que cita o nome dela
- [x] Gate check passes: `npm test` (23 testes)

**Status**: ✅ Complete — `jest.setup.ts` define variáveis fictícias porque `env.ts` valida ao ser importado.

**Tests**: unit
**Gate**: quick

---

### T4: Serviço de autenticação Google

**What**: `errors.ts` + `googleAuth.ts` com `configureGoogleSignIn`, `signInWithGoogle` e `signOut`.
**Where**: `src/features/auth/googleAuth.ts`
**Depends on**: T3
**Reuses**: `src/supabase/client.ts`
**Requirement**: AUTH-02, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-15
**Linear**: EIX-19

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Sucesso chama `signInWithIdToken({ provider: 'google', token })` e retorna `{ ok: true }`
- [x] Cancelado → `cancelled`; Play Services → `play_services`; sem idToken → `no_id_token`; erro Supabase/outro → `unknown`
- [x] `signOut` chama os dois signOut e encerra Supabase mesmo se o Google falhar
- [x] Gate check passes: `npm test` (38 testes)

**Status**: ✅ Complete — `IN_PROGRESS` do Google cai em `unknown`, conforme AUTH-07 ("qualquer outro erro"); na prática não ocorre porque o botão fica desabilitado (AUTH-03). Testes usam o mock oficial do módulo nativo da lib.

**Tests**: unit
**Gate**: quick

---

### T5: Store de sessão e guard de rotas

**What**: `sessionStore.ts` (Zustand + `onAuthStateChange`) e `app/_layout.tsx` com splash e `Stack.Protected`.
**Where**: `app/_layout.tsx`
**Depends on**: T4
**Reuses**: `src/supabase/client.ts`
**Requirement**: AUTH-01, AUTH-08, AUTH-09
**Linear**: EIX-20

**Tools**:

- MCP: NONE
- Skill: `react-native-expert` (expo-router)

**Done when**:

- [x] Sem sessão → rota de Login; com sessão → Home; restaurando → nenhuma das duas
- [x] Evento `SIGNED_OUT` volta ao Login
- [x] Gate check passes: `npm run typecheck && npm test` (47 testes)

**Status**: ✅ Complete — Home ficou em `app/(app)/index.tsx` (rota `/`) em vez de `home.tsx`: é o padrão da doc do expo-router para `Stack.Protected`, e evita uma rota raiz vazia. O smoke test do scaffold (`__tests__/routes/layout.test.tsx`) e o placeholder `app/index.tsx` foram substituídos por `__tests__/routes/authGuard.test.tsx`, que renderiza o mesmo layout raiz com os cenários de sessão. A sessão vem só do evento `INITIAL_SESSION` do `onAuthStateChange` (sem `getSession()` separado).

**Tests**: integration
**Gate**: full

---

### T6: Tela de Login

**What**: `LoginView` com wordmark, título, CTA "Continuar com Google" e mensagem de erro; rota `app/(auth)/login.tsx`.
**Where**: `src/features/auth/LoginView.tsx`
**Depends on**: T5
**Reuses**: primitivos `src/ui`, `signInWithGoogle`
**Requirement**: AUTH-01, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
**Linear**: EIX-21

**Tools**:

- MCP: NONE
- Skill: `frontend-design` (hierarquia), DESIGN-CYAN

**Done when**:

- [ ] Loading desabilita o botão; cancelamento não mostra texto; cada código mostra a mensagem exata do spec
- [ ] Gate check passes: `npm test`

**Tests**: unit
**Gate**: quick

---

### T7: Home de teste

**What**: `HomeView` com Card (foto ou inicial, nome, e-mail) e botão ghost "Sair"; rota `app/(app)/home.tsx`.
**Where**: `src/features/auth/HomeView.tsx`
**Depends on**: T6
**Reuses**: primitivos `src/ui`, `signOut`, `sessionStore`
**Requirement**: AUTH-13, AUTH-14, AUTH-15
**Linear**: EIX-22

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Nome e e-mail visíveis; foto quando existe, inicial quando não; e-mail no lugar do nome vazio
- [ ] "Sair" chama `signOut`
- [ ] Gate check passes: `npm test`

**Tests**: unit
**Gate**: quick

---

### T8: Config nativa, README e ADR

**What**: `app.config.ts` Android (package, plugins), README de execução no emulador e ADR 0001.
**Where**: `README.md`
**Depends on**: T7
**Reuses**: AD-001..AD-003 de `.specs/STATE.md`
**Requirement**: Goals (execução pelo README)
**Linear**: EIX-23

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `npx expo config --type public` mostra `android.package = com.eixocerto.app`
- [ ] README cobre emulador (Windows/Linux), Supabase, Google Cloud, `.env`, `expo run:android`, troubleshooting, fluxo Linear
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm test`

**Tests**: none
**Gate**: build
