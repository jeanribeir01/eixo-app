# EIX-58 · Design: slice EIX-60 (T3–T12), iteration 3 (final)

## Validation: EIX-60 slice (iteration 3, final) - PASS ✅

**Date**: 2026-10-06
**Spec**: `.specs/features/eix58-design-app/spec.md`, story "P1: Navegação nativa e ícones ⭐ MVP" (AC 1–12, NAV-01..NAV-04) plus its Edge Cases
**Diff range**: `a4bf6c4..3247c01` (13 commits on `feat/eix-60-design-fundacao-navegacao`: `236f7b6`..`d7210ed` implementation, `0415cb0` + `edab078` iteration-1 fixes, `3247c01` iteration-2 fixes)
**Verifier**: independent sub-agent (author ≠ verifier), re-verification round 3 of 3
**Out of scope**: UIP, FIN, LST, CTA, MRC, DAT, REL and all P2 stories (EIX-61..EIX-72)

**Why PASS**: every in-scope AC that Jest can check is backed by a discriminating `file:line` assertion. All 14 mutants of this round were killed, including every earlier survivor and the AC 11 check on all 10 loading/error branches. Typecheck, lint and tests are green. What remains can only be confirmed on a device: the native back arrow, the real keyboard, header pixels, header-title truncation at font scale 1.3, TalkBack, and touch pass-through. These are listed under **Manual Verification**, and Jean should run them before opening the PR.

**For Jean to confirm (spec edits by the author inside this diff)**:
- AC 3 gained "Novo veículo, Editar veículo".
- AC 11 now explicitly covers loading and error states.
- AC 12 is new: the overlay keeps the content underneath touchable. It codifies the `design.md:89` rule that the verifier flagged in iteration 2.

---

## Iteration history

| Iteration | HEAD | Sensor | Verdict | Survivors |
| --------- | ---- | ------ | ------- | --------- |
| 1 | `d7210ed` | 11/18 killed | FAIL | M7, M8, M13, M14, M15, M16, M17 (+ font-scale edge case without evidence, AC 1 position precision gap) |
| 2 | `edab078` | 12/14 killed | FAIL (minor) | N6 (overlay `pointerEvents`, no AC at the time), N7 (AC 11 loading/error branches) |
| 3 | `3247c01` | 14/14 killed | PASS | none |

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T3–T10, T12 | ✅ Done | Iteration 3 changed no production code; only tests, `spec.md` and `tasks.md`. |
| T11 | ⚠️ Partial | `tasks.md:445`: *Teclado testado no emulador em Nova movimentação* is still unchecked. It is manual and part of the device list below. |
| Verifier fixes, iteration 1 → 2 and 2 → 3 | ✅ Done | Recorded in `tasks.md` after T12. Verified independently below. |

---

## Spec-Anchored Acceptance Criteria

Route test = `__tests__/routes/navegacaoPorPerfil.test.tsx` (real layouts with `renderRouter`, stub screens).

| # | Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| - | --------- | -------------------- | ----------------------- | ------ |
| 1 | Each visible tab has a Material Symbols icon above its label | `dashboard`, `account_balance_wallet`, `local_shipping`, `route`, `settings`; icon above label | `src/ui/__tests__/icons.test.ts:25-31` `expect(icons.dashboards.android).toBe('dashboard')`…; `src/navigation/__tests__/menu.test.ts:54` `expect(abas.find((aba) => aba.id === id)?.icone).toBe(icone)`; route `:256` `expect(simbolos(simbolo).length).toBeGreaterThan(0)`; `src/navigation/__tests__/tabBarOptions.test.ts:8` `expect(tabBarOptions.tabBarLabelPosition).toBe('below-icon')` | ✅ PASS (M10, M12, N1 killed in earlier rounds; code and tests unchanged since) |
| 2 | Active tab icon and label in `textPrimary`; inactive in `textBody` | token colors | route `:276` `expect(visiveis[0]).toHaveStyle({ color: aba === 'Financeiro' ? colors.textPrimary : colors.textBody })` (icon); route `:286` `expect(screen.getByText(aba)).toHaveStyle({ color: … })` (rendered label); `tabBarOptions.test.ts:12-13` | ✅ PASS (M1, M14, N2 killed) |
| 3 | Internal screen: native header, back button, Portuguese title | 14 exact titles (spec.md:66) | route `:329-331` `headersVisiveis().find((h) => h.props.title === titulo)` → `toBeDefined()`, `expect(header?.props.hideBackButton).toBe(false)` for all 14 routes | ✅ PASS for titles (M2 killed). ⚠️ The native back arrow is drawn by the system: **manual**. |
| 4 | Header: `canvas` bg, no shadow, title `subheading` + `fontFamily.regular`, tint `textPrimary` | exact tokens on the rendered header | route `:332-340` `expect(header?.props).toMatchObject({ backgroundColor: colors.canvas, hideShadow: true, titleFontFamily: fontFamily.regular, titleFontSize: typography.subheading.fontSize, titleColor: colors.textPrimary, color: colors.textPrimary })` for all 14 routes; `src/navigation/__tests__/stackOptions.test.ts:9-30` | ✅ PASS (M11, M13, N3 killed) |
| 5 | Tap header back → previous screen | returns to the tab of origin | route `:358-361` `act(() => navegador.back())` → `expect(router.getPathname()).toBe('/financeiro')` | ✅ PASS for the stack pop. ⚠️ Tapping the native arrow is **manual**. |
| 6 | No "Eixo Certo" overline or second in-content title on internal screens | absence in content | `CategoriasListView.test.tsx:59-60`; `CategoriaFormView.test.tsx:41-42,113`; `FormasPagamentoListView.test.tsx:58-59` (`/^formas de pagamento$/i`); `FormaPagamentoFormView.test.tsx:35-36`; `MovimentacoesListView.test.tsx:105-106`; `MovimentacaoFormView.test.tsx:93-94,236`; `VeiculoFormView.test.tsx:54-55,156`; `UsuariosListView.test.tsx:69-70`; `SaldoProjecaoView.test.tsx:79-80`, all `.not.toBeOnTheScreen()` | ✅ PASS (M17 killed). The Usuário detail keeps the user's name as a data heading, by design (T11). |
| 7 | `Icon`: semantic name, token color, `iconSize` 16/20/24 | `{sm:16, md:20, lg:24}` | `src/ui/__tests__/Icon.test.tsx:10-13,19,25`; `src/ui/__tests__/icons.test.ts:16-18,35` `expect(iconSize).toEqual({ sm: 16, md: 20, lg: 24 })` | ✅ PASS (M9, M10 killed) |
| 8 | `Icon` without label hidden from screen readers; with label announced | hidden on Android and iOS; role image with label | `src/ui/__tests__/Icon.test.tsx:42-43` `accessibilityElementsHidden).toBe(true)`, `importantForAccessibility).toBe('no-hide-descendants')`; `:31-33`; `:49` `getByRole('image', { name: 'Saldo negativo' })` | ✅ PASS (M7, M8, M7b, X2 killed) |
| 9 | `Screen scroll` → `ScrollView` `keyboardShouldPersistTaps="handled"` in `KeyboardAvoidingView` | exact prop | `src/ui/__tests__/Screen.test.tsx:48-49`; forms `CategoriaFormView.test.tsx:47`, `FormaPagamentoFormView.test.tsx:40`, `MovimentacaoFormView.test.tsx:98`, `VeiculoFormView.test.tsx:59`, `UsuarioDetalheView.test.tsx:67` | ✅ PASS (M6, M16, N4 killed) |
| 10 | Focused field in `Screen scroll` stays above keyboard | device behavior | `src/ui/__tests__/Screen.test.tsx:62` `keyboardVerticalOffset).toBe(64)` under header; `:72` → `0`; form wiring as in AC 9 | ✅ PASS for mechanism and wiring (M5, M16 killed). ⚠️ The real keyboard is **manual** (T11). |
| 11 | `Screen` under native header adds no top inset, **including loading and error states** | edges without `top` | `src/ui/__tests__/Screen.test.tsx:37` `toEqual(['right', 'bottom', 'left'])`. Main render of the 10 views: `CategoriasListView.test.tsx:63`, `CategoriaFormView.test.tsx:45`, `FormasPagamentoListView.test.tsx:61`, `FormaPagamentoFormView.test.tsx:38`, `MovimentacoesListView.test.tsx:108`, `MovimentacaoFormView.test.tsx:96`, `VeiculoFormView.test.tsx:57`, `UsuariosListView.test.tsx:72`, `UsuarioDetalheView.test.tsx:65`, `SaldoProjecaoView.test.tsx:82`. Loading/error branches: `CategoriaFormView.test.tsx:170,178`, `FormaPagamentoFormView.test.tsx:130,138`, `MovimentacaoFormView.test.tsx:285,294`, `VeiculoFormView.test.tsx:194,202`, `UsuarioDetalheView.test.tsx:197,205`. All `expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top')`. | ✅ PASS (M4, M15, N5, X1 and all 10 N7 branch mutants killed) |
| 12 | While an overlay is visible, content under it stays touchable outside the overlay's elements | overlay layer `pointerEvents="box-none"` | `src/ui/__tests__/Screen.test.tsx:105` `expect(screen.getByText('Flutuante').parent?.parent?.props.pointerEvents).toBe('box-none')`; `:94-95` layer is `position: 'absolute'`; `:83-84` overlay outside the ScrollView | ✅ PASS for the mechanism (N6, X3 killed). ⚠️ Real hit-testing: `fireEvent` ignores sibling overlays, so the device check is **manual**. |

**Status**: ✅ All in-scope ACs covered with discriminating evidence. ⚠️ Device-only outcomes are listed under Manual Verification (AC 3/5 native arrow, AC 10 keyboard, AC 12 hit-testing).

---

## Edge Cases

- [x] **Font scale 1.3, tab labels**: route `:294` `expect(screen.getByText(aba).props.numberOfLines).toBe(1)` for the 5 labels.
- [ ] **Font scale 1.3, header titles**: drawn by the native Android Toolbar, which Jest can't reach. **Manual** ("Editar forma de pagamento").
- [~] **Keyboard open + tap "Salvar" on first tap**: `keyboardShouldPersistTaps="handled"` is asserted in the primitive and in all 5 scroll screens (AC 9). The real tap is **manual**.
- [~] **Material Symbols not loaded → Icon reserves size**: `Icon.test.tsx:10-13` shows `iconSize[size]` reaches `SymbolView`. The reservation is library code (`node_modules/expo-symbols/build/SymbolView.js:33-35`), covered by delegation. Confirm on device.

---

## Discrimination Sensor (iteration 3)

Isolation: one mutant at a time on a single-file copy. Backup in the scratchpad, mutate, run only the relevant Jest files (`--selectProjects app`), copy back, `git diff --quiet` per file. No `git stash`. Baseline porcelain (` M .specs/LESSONS.md`, ` M .specs/lessons.json`, `?? …/validation.md`) was identical before and after the sensor. HEAD stayed at `3247c01`.

| # | File | Mutation | Killed by |
| - | ---- | -------- | --------- |
| N6 | `src/ui/Screen.tsx:50` | overlay `pointerEvents="auto"` | ✅ `Screen.test.tsx:105` (AC 12) |
| N7-cat-load | `src/features/categorias/CategoriaFormView.tsx:102` | loading `<Screen align="center">` (no `underHeader`) | ✅ `CategoriaFormView.test.tsx:170` |
| N7-cat-err | `src/features/categorias/CategoriaFormView.tsx:110` | error branch without `underHeader` | ✅ `CategoriaFormView.test.tsx:178` |
| N7-fp-load | `src/features/formas-pagamento/FormaPagamentoFormView.tsx:95` | loading without `underHeader` | ✅ `FormaPagamentoFormView.test.tsx:130` |
| N7-fp-err | `src/features/formas-pagamento/FormaPagamentoFormView.tsx:103` | error without `underHeader` | ✅ `FormaPagamentoFormView.test.tsx:138` |
| N7-mov-load | `src/features/movimentacoes/MovimentacaoFormView.tsx:236` | loading without `underHeader` | ✅ `MovimentacaoFormView.test.tsx:285` |
| N7-mov-err | `src/features/movimentacoes/MovimentacaoFormView.tsx:244` | error without `underHeader` | ✅ `MovimentacaoFormView.test.tsx:294` |
| N7-vei-load | `src/features/veiculos/VeiculoFormView.tsx:132` | loading without `underHeader` | ✅ `VeiculoFormView.test.tsx:194` |
| N7-vei-err | `src/features/veiculos/VeiculoFormView.tsx:140` | error without `underHeader` | ✅ `VeiculoFormView.test.tsx:202` |
| N7-usr-load | `src/features/usuarios/UsuarioDetalheView.tsx:103` | loading without `underHeader` | ✅ `UsuarioDetalheView.test.tsx:197` |
| N7-usr-err | `src/features/usuarios/UsuarioDetalheView.tsx:113` | error without `underHeader` | ✅ `UsuarioDetalheView.test.tsx:205` |
| X1 (new) | `src/features/usuarios/UsuariosListView.tsx:41` | `<Screen underHeader>` → `<Screen>` | ✅ `UsuariosListView.test.tsx:72` |
| X2 (new) | `src/ui/Icon.tsx:24` | `accessibilityRole={undefined}` (labelled icon no longer an image) | ✅ `Icon.test.tsx:49` (AC 8, announced half) |
| X3 (new) | `src/ui/Screen.tsx:50` | overlay without `StyleSheet.absoluteFill` (no longer floats) | ✅ `Screen.test.tsx:94-95` |

Earlier kills still stand: production code is unchanged since `edab078`, and no test line was removed in `edab078..3247c01`. That covers iteration 1 (M1–M17, M7b) and iteration 2 (M7, M8, M13–M17, N1–N5).

**Sensor depth**: expanded (14 mutants this round; 46 across the three rounds)
**Result**: 14/14 killed - PASS ✅

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code / surgical changes | ✅ The iteration-3 commit touches only tests, `spec.md` and `tasks.md` |
| No scope creep | ✅ |
| Matches patterns | ✅ Each of the 5 view tests has the same `describe("… estados de carga sob o header (NAV-04)")` shape, with a pending-promise mock for loading |
| Spec-anchored outcome check | ✅ |
| Per-layer Coverage Expectation (tasks.md matrix) | ✅ Route layouts, primitives, feature screens (success, loading, error) |
| Every test maps to a requirement | ✅ Cosmetic only: `MovimentacaoFormView.test.tsx` loading case sets `mockOpcoes.mockResolvedValue(...)` and then overrides it with `mockReturnValue(new Promise(() => {}))` (redundant line). The route test name at `:323` interpolates the stub text, not the header title. |
| Documented guidelines followed | ✅ `AGENTS.md` §2.5, `.claude/CLAUDE.md` §8, skill `teste-componente` |

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test`
- **typecheck**: exit 0
- **lint**: exit 0
- **test**: exit 0. Project `app`: 66 suites, **611 passed**. Project `supabase`: 12 suites, **163 passed**. 0 failed, 0 skipped.
- **Test count**: ≈504 before the slice (inferred) → 592 (iteration 1) → 600 (iteration 2) → **611** now. +11 this round: 10 loading/error tests + 1 overlay test.
- **Deleted or weakened assertions**: none

---

## Manual Verification Needed (Android emulator, before the PR)

1. **Nova movimentação**: focus "Descrição" with the keyboard open. The field stays visible above the keyboard, and "Salvar" fires on the first tap (AC 10 + edge case; `tasks.md:445`).
2. Native **back arrow** on each of the 14 internal screens, and tapping it returns to the previous screen (AC 3, AC 5).
3. Header pixels: canvas background, no elevation shadow, Inter Regular 20 title (AC 4; props proven in Jest).
4. **Font scale 1.3**: the header title "Editar forma de pagamento" truncates with an ellipsis. Tab labels are covered by test.
5. Cold start: tab icons appear without layout jump while the Material Symbols font loads.
6. **TalkBack**: tab icons are not announced separately from their labels (AC 8; props proven).
7. No double top inset under the header, including while a form is loading.
8. While a Snackbar is visible, the rest of the screen still responds to taps (AC 12; prop proven).

---

## Requirement Traceability Update

These are proposed statuses; the verifier does not edit `spec.md`.

| Requirement | Iteration 1 | Iteration 2 | Iteration 3 |
| ----------- | ----------- | ----------- | ----------- |
| NAV-01 (AC 1–2) | ❌ Needs Fix | ✅ Verified | ✅ Verified |
| NAV-02 (AC 3–6) | ❌ Needs Fix | ✅ Verified | ✅ Verified (native arrow: manual) |
| NAV-03 (AC 7–8 + font edge) | ❌ Needs Fix | ✅ Verified | ✅ Verified (header-title truncation: manual) |
| NAV-04 (AC 9–12 + keyboard edge) | ❌ Needs Fix | ❌ Needs Fix | ✅ Verified (keyboard and hit-testing: manual) |

---

## Summary

**Overall**: ✅ Ready for PR, after Jean runs the manual device list and confirms the spec edits (AC 3, AC 11, AC 12).

**Spec-anchored check**: 12/12 ACs matched on everything Jest can check. Device-only outcomes are flagged as manual items, not passed silently.
**Sensor**: 14/14 killed this round (46 mutants over 3 rounds; every survivor from rounds 1 and 2 is now killed)
**Gate**: typecheck ✅, lint ✅, test ✅ (611 app + 163 supabase, 0 failed)

**Completion gate**: `validate_state.py eix58-design-app --root C:\dev\eixo-app` exits 0 ("0 error(s) across [eix58-design-app]").
**Lessons**: no new lesson. This round is a clean PASS. The residual device-only items are the same signals already recorded for this feature in L-014 and L-016, and re-recording within the same feature does not add recurrence. L-009..L-018 stay candidates: the fixes applied them successfully, which calls for no penalize, and pruning would delete history.
