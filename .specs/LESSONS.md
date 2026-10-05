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

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
