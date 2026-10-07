# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

### L-001 - Test UTC-to-local date conversion with an instant near midnight and a pinned timezone, so a UTC shortcut fails the test
- signal: `surviving_mutant` · recurrence: 2 feature(s) · scope: `src/lib datas, repositories` · harmful: 0
- features: eix33-movimentacoes, eix35-motor-saldo
- evidence: M11 src/features/movimentacoes/movimentacoesRepository.ts:66 (src/lib datas, repositories) (+1 more)
- last seen: 2026-10-05T13:35:12Z

### L-005 - Test cents conversion with amounts not exact in binary floating point such as 1.13, so a float cast fails the test
- signal: `surviving_mutant` · recurrence: 2 feature(s) · scope: `dinheiro, sql-rpc` · harmful: 0
- features: eix35-motor-saldo, eix36-dividas
- evidence: M12/M21 supabase/migrations/20261005000100_resumo_caixa.sql:60,67 (dinheiro, sql-rpc) (+1 more)
- last seen: 2026-10-05T17:46:38Z

### L-006 - Assert grants and revokes directly with has_function_privilege, because a second authorization check masks a missing revoke
- signal: `surviving_mutant` · recurrence: 2 feature(s) · scope: `supabase, rls, grants` · harmful: 0
- features: eix35-motor-saldo, eix36-dividas
- evidence: M10 supabase/migrations/20261005000100_resumo_caixa.sql:87 (supabase, rls, grants) (+1 more)
- last seen: 2026-10-05T17:46:38Z

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-002 - Assert field labels exactly as the spec writes them, and fix the spec or the code when they differ
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `forms` · harmful: 0
- features: eix33-movimentacoes
- evidence: MOV-01 AC1 src/features/movimentacoes/camposMovimentacao.ts:18 (forms)
- last seen: 2026-10-05T00:26:14Z

### L-003 - Set TZ before Jest workers start, never via process.env.TZ inside a test file, and prove the test with TZ=UTC
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `jest, datas` · harmful: 0
- features: eix33-movimentacoes
- evidence: MOV-08 AC1 src/features/movimentacoes/__tests__/dataDeReferencia.test.ts:7 (jest, datas)
- last seen: 2026-10-05T00:31:12Z

### L-004 - Use a reference date in a different period from today in at least one test, so code that ignores the date parameter fails
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `datas, sql-rpc` · harmful: 0
- features: eix35-motor-saldo
- evidence: M15 supabase/migrations/20261005000100_resumo_caixa.sql:21 (datas, sql-rpc)
- last seen: 2026-10-05T13:35:12Z

### L-007 - Cover every money field with float-trap values and check that each computed sum, not only each input, is inexact in binary
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `dinheiro, sql-rpc` · harmful: 0
- features: eix35-motor-saldo
- evidence: M21/M24/M25/M26 supabase/tests/resumo_caixa.test.ts:303-313 (dinheiro, sql-rpc)
- last seen: 2026-10-05T13:42:06Z

### L-008 - When an access AC lists several RPCs, test every denied profile and status against each listed RPC, not only the first
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `supabase, rls, sql-rpc` · harmful: 0
- features: eix36-dividas
- evidence: S18 supabase/migrations/20261005000200_divida.sql:116 (DIV-06 AC1) (supabase, rls, sql-rpc)
- last seen: 2026-10-05T17:46:38Z

### L-009 - Assert navigator options on the rendered header or tab bar, not only on the exported options object, so dropping the wiring fails a test
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `navigation, expo-router` · harmful: 0
- features: eix58-design-app
- evidence: validation.md M13 (app/(app)/_layout.tsx:16) (navigation, expo-router)
- last seen: 2026-10-07T02:09:15Z

### L-010 - When a criterion styles both a tab icon and its label, assert each one, because different props drive them
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `navigation, expo-router` · harmful: 0
- features: eix58-design-app
- evidence: validation.md M14 (src/navigation/tabBarOptions.ts:16) (navigation, expo-router)
- last seen: 2026-10-07T02:09:15Z

### L-011 - Assert each platform accessibility prop directly, because Testing Library treats either one as hidden and masks a missing Android prop
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `ui, acessibilidade` · harmful: 0
- features: eix58-design-app
- evidence: validation.md M7+M8 (src/ui/Icon.tsx:26-27) (ui, acessibilidade)
- last seen: 2026-10-07T02:09:16Z

### L-012 - When a primitive behavior is an opt-in prop, assert in each screen test that the screen passes the prop
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `ui, telas` · harmful: 0
- features: eix58-design-app
- evidence: validation.md M15+M16 (CategoriasListView.tsx:70, MovimentacaoFormView.tsx:254) (ui, telas)
- last seen: 2026-10-07T02:09:16Z

### L-013 - Write absence assertions with the exact text the spec defines, not the old text the change removed
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `telas` · harmful: 0
- features: eix58-design-app
- evidence: validation.md M17 (FormasPagamentoListView.test.tsx:58) (telas)
- last seen: 2026-10-07T02:09:16Z

### L-014 - Assert numberOfLines on header titles and tab labels when the spec requires truncation at large font scale
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `navigation, acessibilidade` · harmful: 0
- features: eix58-design-app
- evidence: validation.md Edge case font scale 1.3 (NAV-03, no evidence) (navigation, acessibilidade)
- last seen: 2026-10-07T02:09:17Z

### L-015 - Set tabBarLabelPosition explicitly when the spec fixes icon and label layout, because the default changes at 768 wide
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `navigation, tablet` · harmful: 0
- features: eix58-design-app
- evidence: validation.md AC 1 position (BottomTabBar.js:63) (navigation, tablet)
- last seen: 2026-10-07T02:09:17Z

### L-016 - For native-only behavior such as the header back arrow or the keyboard, assert the configuration props in Jest and record a device check in the task
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `navigation, ui` · harmful: 0
- features: eix58-design-app
- evidence: validation.md AC 3/AC 5 native back arrow; AC 10 keyboard (navigation, ui)
- last seen: 2026-10-07T02:09:17Z

### L-017 - Assert screen layout props in the loading and error branches too, not only in the success render
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `ui, telas` · harmful: 0
- features: eix58-design-app
- evidence: validation.md N7 (src/features/categorias/CategoriaFormView.tsx:102) (ui, telas)
- last seen: 2026-10-07T02:27:17Z

### L-018 - Assert pointerEvents box-none on full-screen overlay layers, because fireEvent ignores sibling overlays that would block taps on a device
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `ui, overlay` · harmful: 0
- features: eix58-design-app
- evidence: validation.md N6 (src/ui/Screen.tsx:50; design.md:89) (ui, overlay)
- last seen: 2026-10-07T02:27:17Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
