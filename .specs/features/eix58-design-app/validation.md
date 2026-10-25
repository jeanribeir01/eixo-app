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

---

# EIX-68 · Motion contido (T41–T42), revisão independente

**Date**: 2026-10-25
**Diff range**: `95c001a..d4a2a7b`
**Verifier**: independent sub-agent (author ≠ verifier)
**Verdict**: PASS nos critérios automatizáveis de ANI-01. O aceite completo da issue depende da conferência exigida em release no emulador modesto, conduzida separadamente pelo implementador. Esta revisão não atesta execução nativa.

## Spec-Anchored Acceptance Criteria — EIX-68

| Critério | Resultado esperado da spec | Evidência exata | Resultado |
| --- | --- | --- | --- |
| ANI-01 AC1: incluir/remover linha | Reflow Reanimated ≤250 ms | `src/ui/__tests__/ListMotion.test.tsx:23`: `expect(duration).toHaveBeenCalledWith(200)`; linhas 27–31 afirmam presença/remoção de B e manutenção de `itemLayoutAnimation`. `src/ui/List.tsx:10` aplica a transição à célula da lista virtualizada. | PASS configuração; execução nativa depende de release |
| ANI-01 AC2: pulso do Skeleton | Opacidade 1 → 0,5 → 1 em 1000 ms, repetição infinita | `src/ui/__tests__/Skeleton.test.tsx:15`: `toMatchObject({ animationName: { from: { opacity: 1 }, '50%': { opacity: 0.5 }, to: { opacity: 1 } }, animationDuration: 1000, animationIterationCount: 'infinite' })` | PASS configuração; execução nativa depende de release |
| ANI-01 AC3: remover animações | Sem pulso e sem layout animado enquanto a preferência está ativa | `src/ui/__tests__/ListMotion.test.tsx:68`: `expect(...props.itemLayoutAnimation).toBeUndefined()`; linhas 69/74/75 também afirmam ausência na linha e após evento de preferência. `src/ui/__tests__/Skeleton.test.tsx:27`, `:29`, `:45`: `expect(...animationName).toBeUndefined()`; linhas 30/46 afirmam opacidade 1. | PASS |
| ANI-01 AC4 / T42: sem entrada inicial ou repetida | Sem `entering` e sem `exiting` na montagem e remount da lista | `src/ui/__tests__/ListMotion.test.tsx:40`: `expect(list.props.skipEnteringExitingAnimations).toBe(true)`; linhas 41–45 afirmam `entering`/`exiting` indefinidos na lista e linhas; linhas 48–52 repetem depois de desmontar/montar. Nenhuma rota ou animação de entrada de tela foi adicionada no diff. | PASS |

Os testes novos mapeiam aos quatro ACs; os testes anteriores de aparência e interação foram preservados. O mock oficial de Reanimated não executa worklets, portanto não mede frames nem comprova a duração física no dispositivo. A API instalada em `node_modules/react-native-reanimated/src/component/FlatList.tsx` confirma que `itemLayoutAnimation` é aplicado ao contêiner de célula, e que `skipEnteringExitingAnimations` suprime entrada/saída de montagem sem suprimir layout.

## Gate Check — EIX-68

- Implementador executou typecheck e lint com exit 0 e a suíte completa: 98 suites / 1069 testes app e 17 suites / 311 testes Supabase, sem falhas e sem skips.
- Verifier executou, no scratch limpo, `npx jest --selectProjects app --runTestsByPath src/ui/__tests__/ListMotion.test.tsx src/ui/__tests__/Skeleton.test.tsx src/ui/__tests__/ListItem.test.tsx --runInBand`: **3 suites / 20 testes passaram**, 0 falhas, 0 skips.
- Uma tentativa adicional de repetir os gates foi interrompida por redundância; o resultado acima é da execução final completa, com as fontes restauradas.
- A issue usa uma dependência nativa nova e APIs de UI thread: o build release e a conferência em emulador são um gate separado, que não pode ser substituído pelo Jest.

## Discrimination Sensor — EIX-68

Scratch dedicado `C:/eix68-verify`, detached em `d4a2a7b`, com junction para dependências existentes. Cada mutação foi aplicada individualmente, executada e revertida antes da seguinte. Nenhuma fonte da árvore real foi alterada.

| Mutação | Local | Falha observada | Resultado |
| --- | --- | --- | --- |
| M1: ignorar reduced motion e sempre retornar transition | `src/ui/useListTransition.ts:13` | `ListMotion.test.tsx:68`, recebeu `{}` em vez de `undefined`; 1 falhou / 2 passaram | Killed |
| M2: pulso mínimo 0,8 em vez de 0,5 | `src/ui/Skeleton.tsx:31` | `Skeleton.test.tsx:15`, objeto de keyframes divergiu do valor 0,5; 1 falhou / 4 passaram | Killed |
| M3: acrescentar entering na lista | `src/ui/List.tsx:10` | `ListMotion.test.tsx:41`, recebeu `{}` em vez de `undefined`; 1 falhou / 2 passaram | Killed |

**Sensor result**: **3/3 killed, 0 survived**. Logs locais em `C:/eix68-verifier-evidence/`. Scratch e junction removidos; o arquivo `node_modules/react/package.json` da árvore real continua presente. `git status --porcelain` real estava vazio antes e depois do sensor. Só este relatório foi alterado ao registrar o resultado.

## Pendências da iteração 1 — EIX-68 (histórico, resolvidas abaixo)

- Conferir pulso, inclusão, remoção e nova visita em build release, no emulador de perfil modesto.
- Conferir a preferência Android ligada antes de abrir e alterada com o app aberto. A revisão indicou ao implementador um risco a conferir: Reanimated mantém um snapshot inicial em `ReducedMotionManager`, enquanto o hook local escuta mudanças. O caso iniciar com a preferência ligada e depois desligá-la precisa de evidência nativa, pois o mock não representa o manager nativo.
- A validação humana continua com o usuário; nenhuma issue foi encerrada.

**Lessons**: nenhuma nova. Os três mutantes foram mortos; não houve falha comprovada, sobrevivente, desvio de spec ou lacuna de precisão. A execução release permanece explicitamente pendente, sem resultado inventado.

## EIX-68 — Revalidação da preferência alterada em runtime (iteração 2)

**Verdict**: PASS na correção automatizável; a repetição nativa com a correção ainda é conduzida pelo implementador. A versão anterior apresentou uma falha real em release, portanto o PASS automatizado da iteração 1 não era aceite completo da issue.

**Falha confirmada pelo implementador**: iniciar o release com `transition_animation_scale=0` e depois alterar para `1` deixou a lista travada/inconsistente apesar de o contador do probe mudar. Evidências locais: `C:/eix68-build/evidence/restored.mp4` e `restored-video.png`. O Verifier inspecionou o screenshot; o diagnóstico temporal do vídeo e a operação nativa foram reportados pelo implementador.

**Causa conferida independentemente**: `node_modules/react-native-reanimated/src/ReducedMotion.ts:17` captura a preferência inicial em `IS_REDUCED_MOTION_ENABLED_IN_SYSTEM`; `ReducedMotionManager` deriva desse snapshot. A transição usava `ReduceMotion.System`, somando essa decisão estática à decisão atualizada do hook do projeto.

**Correção revisada**: `src/ui/useListTransition.ts:13` usa `.reduceMotion(ReduceMotion.Never)`. O guard em `:14`, `return reduced ? undefined : transition`, continua removendo a animação quando a preferência atual está ligada. Assim, há uma única decisão sobre acessibilidade, mantida pelo hook que ouve `reduceMotionChanged`. Não se trata de ignorar a preferência do usuário.

**Cobertura de regressão**: `src/ui/__tests__/ListMotion.test.tsx:73`, `expect(reduceMotion).toHaveBeenCalledWith(ReduceMotion.Never)`, depois do evento `handler(false)` com preferência inicial true; linhas 69–70 e 77–78 continuam afirmando transições indefinidas quando a preferência está ligada. A asserção antiga sobre `System` verificava uma escolha de implementação sem exigir esse modo na spec; substituí-la preserva o AC e evita codificar o defeito.

**Gate independente**: a cópia limpa dos dois arquivos corrigidos em scratch `C:/eix68-verify-fix` passou os **3/3 testes de ListMotion**, 0 falhas e 0 skips. Logs preservados em `C:/eix68-verifier-evidence/fixed-baseline.log`.

**Sensor M4**: reverter apenas `.reduceMotion(Never)` para `.reduceMotion(System)` no scratch foi **killed**: 2 testes falharam / 1 passou, incluindo a regressão em `ListMotion.test.tsx:73`. Log `C:/eix68-verifier-evidence/mutation4-system.log`. Total acumulado **4/4 mutantes mortos**. Scratch e junction removidos. O porcelain da árvore real permaneceu exatamente com os mesmos três arquivos modificados antes/depois do sensor (`validation.md`, `useListTransition.ts`, `ListMotion.test.tsx`); nenhuma fonte real foi modificada pelo Verifier.

**Gate nativo restante**: repetir no release corrigido o fluxo desligar/ligar/desligar a preferência com o app aberto, além dos demais cenários já planejados. O implementador registrará o resultado, sem atribuir essa execução ao Verifier.

## EIX-68 — Resultado final da conferência release corrigida

**Verdict: PASS.** A implementação corrigida tem cobertura automatizada, sensor **4/4 killed** e evidência nativa dos primitivos em release. As pendências de release das iterações anteriores estão resolvidas pelos registros abaixo. O defeito anterior e sua correção permanecem no histórico.

**Ambiente reportado pelo implementador**: emulador Android API 36, dois núcleos, `MemTotal=2532304 kB` (aproximadamente 2,4 GiB; o comando solicitou 1536 MB, mas este foi o valor efetivo observado). Build release com `BuildConfig.DEBUG=false`. APK do probe: `C:/eix68-build/evidence/fixed-probe.apk`. O probe usa os primitivos reais `Skeleton`, `List` e `ListItem`, com inclusão/remoção automática. A operação do Android, a compilação e a coleta foram feitas pelo implementador; o Verifier revisou os artefatos e reproduziu a análise dos vídeos.

| Cenário | Evidência e resultado |
| --- | --- |
| Iniciar com remover animações ligado | `fixed-reduced.mp4`: análise refeita pelo Verifier com `analyze-video.py` decodificou 540 amostras a 60 Hz, **zero posições intermediárias** do marcador B. Os únicos repousos foram 602 e 728 px; mudanças entre repousos em uma amostra (16,7 ms), sem transição gradual. |
| Desligar a preferência com o mesmo processo aberto | `fixed-restored.mp4`: análise refeita decodificou 648 amostras, **30 intermediárias** em quatro transições. `transition-bounds.py` reproduz limites observados de **133,3 / 150,0 / 100,0 / 183,3 ms**, todos abaixo de 250 ms. O token de duração continua 200 ms. Os dois repousos voltaram a ocorrer, corrigindo o travamento anterior. |
| Integridade da lista depois de reativar | Verifier inspecionou `fixed-restored-08.png`: linhas A, B e C presentes, sem desaparecimento de C. O contador do probe e a alternância dos repousos confirmam que a lista continuou mudando. |
| Skeleton sem movimento no início e ao ativar com app aberto | `fixed-reduced-start-pixels.json`: depois de passar o splash/canvas inicial, todas as amostras do Skeleton são RGB `[232,230,229]`; `fixed-reduced-live-pixels.json`: todas as 16 amostras são `[232,230,229]`. |
| Skeleton volta a pulsar quando a preferência é desligada | `fixed-restored-pixels.json` registra variação de `[232,230,229]` a `[241,240,239]`; screenshots confirmam alternância visual. Os endpoints de opacidade 1/0,5 e ciclo de 1000 ms são afirmados exatamente pelo teste `Skeleton.test.tsx:15–18`. |
| Entrada inicial e nova visita | Teste discriminante `ListMotion.test.tsx:35–52` confirma ausência de `entering`/`exiting` em montagem e remount; o diff não adiciona animação de entrada nas telas de rotina. |

Os tempos observados vêm da gravação reamostrada a 60 Hz e indicam a janela visível de deslocamento entre repousos; não são medição de FPS nem benchmark geral. A evidência release cobre os primitivos reais no probe isolado. **Não foi alegada navegação manual nem execução das rotinas de negócio no app completo**, cujo APK release foi compilado separadamente com sucesso segundo o implementador (`C:/eix68-build/release-app-build.log`, `evidence/eixo-app-release.apk`); o smoke de inicialização do app completo é registrado separadamente. A validação humana e a revisão do PR continuam com o usuário; a issue permanece aberta.

**Lessons**: a falha real da iteração 1 gerou a candidata **L-026** via `lessons.py`. Não há novo sinal a registrar depois da correção.

### Smoke de inicialização do app completo (implementador)

O APK completo abriu a tela de login, registrada em `C:/eix68-build/evidence/app-startup.png`, sem crash nativo. O build usa o `.env.local` existente, com backend local: a restauração da sessão anterior do emulador registrou `AuthRetryableFetchError`, pois HTTP para `10.0.2.2` é bloqueado pela política de rede do release, e depois exibiu o login. Não foi feito login nem alterada a política de rede; este APK de ensaio não comprova fluxos autenticados nem é artefato de deploy. Os testes de motion em release usaram o probe isolado, sem backend, conforme descrito acima.

### Validação visual com o usuário — 25/10/2026

O usuário conferiu o ensaio release no emulador e respondeu "sim" a cada resultado esperado:

| Cenário observado | Resultado |
| --- | --- |
| Skeleton pulsa discretamente em ciclo de 1 segundo | Aprovado pelo usuário |
| Inclusão/remoção de X reposiciona A, B e C suavemente, sem piscar nem desaparecer | Aprovado pelo usuário |
| Remover animações ativo: Skeleton parado e troca de posição instantânea | Aprovado pelo usuário |
| Reativar animações com o processo aberto: pulso e transições voltam sem linhas fora de posição | Aprovado pelo usuário |

**Aceite visual do motion: aprovado nos quatro cenários.** O emulador ficou com animações habilitadas. Esta conferência não incluiu os fluxos autenticados do app completo nem uma avaliação visual separada da primeira montagem/reabertura, cuja cobertura automatizada está descrita acima. A issue não foi encerrada; revisão de Jean no PR permanece necessária.
