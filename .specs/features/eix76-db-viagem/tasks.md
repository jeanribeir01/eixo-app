# EIX-76 · DB de viagem — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/eix76-db-viagem/spec.md`
**Design**: inline (sem `design.md`) — uma migration nova `supabase/migrations/20261015000100_viagem_regras.sql`, construída task a task, no molde de `20261014000300_manutencao_rpc.sql` (comentário de cabeçalho com a conferência antes do `db push` e a tabela de SQLSTATEs). Duas funções de trigger `security definer` + `set search_path = public`: `valida_viagem()` (`before insert or update`) e `sincroniza_status_veiculo()` (`after insert or update of status`).
**Status**: In Progress

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md` §2.5 ("toda task entrega teste": caminho feliz + validações dos AC), `.claude/CLAUDE.md` §3 (regra no banco testada no PGlite, AD-006), `package.json` (`test` roda os projetos `app` e `supabase`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Migration SQL (trigger, índice, coluna gerada, policy) | integration (PGlite) | 1:1 com os AC da spec; todo SQLSTATE `VG***` tem caso que o dispara e caso-limite que passa; RLS do Motorista exercitado via `comoUsuario` | `supabase/tests/viagem.test.ts` | `node --experimental-vm-modules node_modules/jest/bin/jest.js supabase/tests/viagem.test.ts --selectProjects supabase` |
| Fixtures de testes existentes | integration (PGlite) | Mesmas asserções de antes, todas verdes; nenhuma removida | `supabase/tests/rls*.test.ts` | `node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects supabase` |
| App (`src/**`) | none | Fora do escopo; só o build gate | - | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Task que só mexe em `viagem.test.ts` + migration | `node --experimental-vm-modules node_modules/jest/bin/jest.js supabase/tests/viagem.test.ts --selectProjects supabase` |
| Full | Task que pode afetar outros testes do banco | `node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects supabase` |
| Build | Fim de fase | `npm run typecheck && npm run lint && npm run test` |

---

## Execution Plan

### Phase 1: Fixtures

Os testes de RLS abrem duas viagens no mesmo veículo; com a regra nova isso deixa de ser um cenário válido. Ajustar antes, sem mudar o que eles provam.

```
T1
```

### Phase 2: Regras da viagem

Cada task acrescenta um bloco à mesma migration e os testes correspondentes em `viagem.test.ts`.

```
T2 → T3 → T4 → T5 → T6 → T7 → T8
```

---

## Task Breakdown

### T1: Fixtures de RLS com um veículo por viagem aberta

**What**: `rls.test.ts` e `rls_perfis.test.ts` passam a usar um veículo por viagem `EmAndamento` (e um veículo livre no teste "Motorista cria viagem para outro motorista → 42501"), mantendo todas as asserções.
**Where**: `supabase/tests/rls_perfis.test.ts`
**Depends on**: None
**Reuses**: fixtures existentes (`comoSuperuser`, `insert into veiculo`)
**Requirement**: VIAG-01 (pré-condição)

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] `rls.test.ts` e `rls_perfis.test.ts` sem duas viagens abertas no mesmo veículo
- [x] Nenhuma asserção removida ou afrouxada
- [x] Gate full verde (mesma contagem de testes de antes)

**Tests**: integration
**Gate**: full

**Commit**: `test(frota): fixtures de RLS com um veículo por viagem aberta (EIX-76)`

---

### T2: Um veículo, uma viagem em andamento

**What**: Migration nova com índice único parcial `viagem_um_andamento_por_veiculo` e a função `valida_viagem()` (lock do veículo, `VG001`, saída antecipada quando o `id` já existe — upsert).
**Where**: `supabase/migrations/20261015000100_viagem_regras.sql`
**Depends on**: None (a Phase 1 termina antes)
**Reuses**: `20261014000300_manutencao_rpc.sql` (lock `for update`, códigos próprios)
**Requirement**: VIAG-01, VIAG-02, VIAG-03

**Tools**:

- MCP: NONE
- Skill: `supabase-query`

**Done when**:

- [x] Segunda viagem aberta no mesmo veículo → `VG001`
- [x] Insert direto que pula o trigger (`session_replication_role = replica` como superuser) → `23505`
- [x] Depois de finalizar/cancelar, abre de novo
- [x] Gate full verde

**Tests**: integration
**Gate**: full

**Commit**: `feat(frota): uma viagem em andamento por veículo (EIX-76)`

---

### T3: Veículo indisponível não abre viagem

**What**: `valida_viagem()` rejeita abrir viagem em veículo `EmManutencao` (`VG002`) ou `Inativo` (`VG003`); insert já encerrado não passa por essa checagem.
**Where**: `supabase/migrations/20261015000100_viagem_regras.sql`
**Depends on**: T2
**Reuses**: `valida_viagem()` de T2
**Requirement**: VIAG-04, VIAG-05, VIAG-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `EmManutencao` → `VG002`; `Inativo` → `VG003`
- [x] `Finalizada` / `Cancelada` retroativa aceita nesses veículos
- [x] Gate quick verde

**Tests**: integration
**Gate**: quick

**Commit**: `feat(frota): viagem não abre em veículo em manutenção ou inativo (EIX-76)`

---

### T4: Hodômetro não regride

**What**: `valida_viagem()` compara `hodometro_inicial` com o maior `hodometro_final` das outras viagens do veículo, no insert e quando o inicial muda (`VG004`).
**Where**: `supabase/migrations/20261015000100_viagem_regras.sql`
**Depends on**: T3
**Reuses**: `valida_viagem()`
**Requirement**: VIAG-07, VIAG-08, VIAG-09, VIAG-10, VIAG-11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Menor que o maior final → `VG004`; igual → aceito; sem viagem anterior → aceito
- [x] Update do inicial de viagem aberta para baixo → `VG004`
- [x] Motorista B (via `comoUsuario`) é barrado pelo final da viagem do motorista A
- [x] Checks antigas continuam com `23514`
- [x] Gate quick verde

**Tests**: integration
**Gate**: quick

**Commit**: `feat(frota): hodômetro inicial não regride em relação à última viagem (EIX-76)`

---

### T5: Viagem encerrada é terminal e veículo não troca

**What**: `valida_viagem()` no update rejeita mudar status/hodômetros de viagem encerrada (`VG005`) e trocar `veiculo_id` (`VG006`); reenvio com os mesmos valores passa.
**Where**: `supabase/migrations/20261015000100_viagem_regras.sql`
**Depends on**: T4
**Reuses**: `valida_viagem()`
**Requirement**: VIAG-17, VIAG-18, VIAG-19

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `Finalizada` → `EmAndamento` dá `VG005`; `Cancelada` → `Finalizada` dá `VG005`; mudar `hodometro_final` de encerrada dá `VG005`
- [x] Update com os mesmos valores em viagem encerrada é aceito
- [x] Trocar `veiculo_id` → `VG006`
- [x] Gate quick verde

**Tests**: integration
**Gate**: quick

**Commit**: `feat(frota): viagem encerrada não muda e veículo da viagem não troca (EIX-76)`

---

### T6: Status automático do veículo e upsert idempotente

**What**: `sincroniza_status_veiculo()` (`after insert or update of status`, `security definer`) põe o veículo `EmViagem` ao abrir e `Disponivel` ao encerrar (só se ainda `EmViagem`); testes de upsert com `on conflict (id) do update`.
**Where**: `supabase/migrations/20261015000100_viagem_regras.sql`
**Depends on**: T5
**Reuses**: `concluir_manutencao` (guarda "só se ainda está no status esperado")
**Requirement**: VIAG-12, VIAG-13, VIAG-14, VIAG-15, VIAG-16, VIAG-20, VIAG-21, VIAG-22, VIAG-23

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Abrir → `EmViagem`; finalizar e cancelar → `Disponivel`; inativado durante a viagem → continua `Inativo`; insert encerrado → status intacto
- [x] Motorista abre e fecha a própria viagem e o status muda (sem policy de update em `veiculo`)
- [x] Upsert repetido da viagem aberta: 1 linha, veículo `EmViagem`
- [x] Reenvio do fechamento depois de viagem nova: veículo continua `EmViagem`
- [x] Upsert `EmAndamento` sobre `Finalizada` → `VG005`; fechamento por upsert → `Disponivel`
- [x] Gate full verde (manutencao/rls não quebram com o status mudando)

**Tests**: integration
**Gate**: full

**Commit**: `feat(frota): status do veículo acompanha a viagem e upsert idempotente (EIX-76)`

---

### T7: Quilometragem rodada

**What**: Coluna gerada `km_rodado numeric(12,1) generated always as (hodometro_final - hodometro_inicial) stored`.
**Where**: `supabase/migrations/20261015000100_viagem_regras.sql`
**Depends on**: T6
**Reuses**: NONE
**Requirement**: VIAG-24, VIAG-25, VIAG-26

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] 1000 → 1234,5 dá `234.5`; aberta dá `null`
- [x] Insert com `km_rodado` explícito é rejeitado
- [x] Gate quick verde

**Tests**: integration
**Gate**: quick

**Commit**: `feat(frota): km rodado da viagem como coluna gerada (EIX-76)`

---

### T8: Viagem não é apagada

**What**: `drop policy viagem_delete on viagem`.
**Where**: `supabase/migrations/20261015000100_viagem_regras.sql`
**Depends on**: T7
**Reuses**: padrão do `drop policy veiculo_delete` (EIX-56)
**Requirement**: VIAG-27

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Admin, Gestor e Motorista: `delete` afeta 0 linhas e a viagem continua
- [ ] Build gate verde (`typecheck`, `lint`, `test`)

**Tests**: integration
**Gate**: build

**Commit**: `feat(frota): viagem sem delete físico (EIX-76)`

---

## Phase Execution Map

```
Phase 1 → Phase 2

Phase 1:  T1
Phase 2:  T2 ──→ T3 ──→ T4 ──→ T5 ──→ T6 ──→ T7 ──→ T8
```

8 tasks → um batch só, execução inline (sem sub-agentes). Verifier roda ao final.
