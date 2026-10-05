# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Test UTC-to-local date conversion with an instant near midnight and a pinned timezone, so a UTC shortcut fails the test
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `src/lib datas, repositories` · harmful: 0
- features: eix33-movimentacoes
- evidence: M11 src/features/movimentacoes/movimentacoesRepository.ts:66 (src/lib datas, repositories)
- last seen: 2026-10-05T00:26:13Z

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

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
