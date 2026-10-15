# EIX-76 · DB de viagem — hodômetro, um veículo por viagem em andamento e status automático do veículo

## Problem Statement

A EIX-40 (US08, tela de viagem) e a EIX-41 (sincronização offline) dependem de regras de `viagem` que ainda não estão no banco: hoje o mesmo caminhão pode estar em duas viagens abertas, o hodômetro pode voltar para trás entre viagens e o status do veículo não acompanha a viagem. Só o Jean aplica migration, então estas regras entram antes para o Eduardo começar com o banco pronto. As regras moram em **constraint e trigger**, não em RPC: o sync offline sobe a viagem como `upsert` idempotente na tabela, e um trigger vale tanto para a escrita online quanto para a que chega da outbox.

## Goals

- [ ] O banco rejeita, com SQLSTATE próprio, viagem que fura uma regra de US08 (veículo ocupado, indisponível, hodômetro regredindo, viagem encerrada alterada) — vale para Admin, Gestor e Motorista, online ou via sync.
- [ ] O status do veículo (`EmViagem` / `Disponivel`) acompanha a abertura e o encerramento da viagem sem nenhuma chamada extra do app.
- [ ] `upsert` repetido da mesma viagem (mesmo `id`) é seguro: não duplica, não falha por causa da própria viagem e não mexe no status do veículo de novo.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Tela de viagem, formulário, Zod e repositório (`src/features/viagens/**`) | EIX-40 (Eduardo) |
| Outbox, SQLite/Drizzle e espelho local de `viagem` | EIX-78 (fundação) e EIX-41 (Eduardo) |
| Renomear o enum `Finalizada` → `Concluída` | Decidido na task: o banco mantém `Finalizada`; a EIX-40 traduz só o rótulo (como `EmManutencao` → "Em Manutenção"). Registrado no PR |
| Checar sobreposição de faixa de hodômetro entre uma viagem retroativa e uma aberta | Nenhum AC pede; a regra é "não regride em relação ao maior final" (ver Assumptions) |
| Hodômetro da `manutencao` entrar na conta do "último hodômetro" | AC da task fala só em `hodometro_final` de viagem |
| Preencher `data_inicio` / `data_fim` no banco | Momento real da ação em campo vem do app (offline); nenhum AC pede |
| Bloquear inativação de veículo em viagem | Regra de `veiculo` (EIX-56/EIX-79), não de `viagem` |
| `db push` e `gen types` na nuvem | Alteração de banco de produção: só com autorização explícita do Jean, depois dos testes verdes |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Viagem encerrada | `Finalizada` e `Cancelada` são terminais: status, `hodometro_inicial`, `hodometro_final` e `veiculo_id` não mudam mais (`VG005`); reenviar os mesmos valores é aceito | Decidido com o usuário. Protege a regra de hodômetro das viagens seguintes e faz um reenvio atrasado de "abrir" ser rejeitado em vez de reabrir a viagem | y |
| Troca de veículo | `veiculo_id` não muda depois do insert (`VG006`); para corrigir, cancela e abre outra | Decidido com o usuário. Evita liberar um veículo e prender outro no mesmo trigger | y |
| Insert já encerrado | Insert direto como `Finalizada`/`Cancelada` é aceito; hodômetro é validado, disponibilidade e status do veículo não entram | Decidido com o usuário. Deixa a EIX-41 livre para coalescer abrir + fechar numa operação; registro retroativo cabe | y |
| "Último `hodometro_final` registrado" | O **maior** `hodometro_final` não nulo entre as outras viagens do veículo (qualquer status, inclusive `Cancelada` com final preenchido); igual é aceito (`>=`) | Hodômetro só sobe, então o maior é o último real; não depende de `data_fim`, que é opcional e vem do celular | n |
| Onde a regra de hodômetro roda | Trigger `before insert or update`, `security definer` | O Motorista só enxerga as próprias viagens pelo RLS; a regra precisa ver as viagens de todos os motoristas daquele veículo | n |
| Concorrência | O trigger trava a linha do veículo (`select ... for update`) antes de validar; índice único parcial em `viagem (veiculo_id) where status = 'EmAndamento'` é a última barreira (`23505`) | Mesmo lock que `registrar_manutencao` usa: abrir viagem e registrar manutenção no mesmo veículo ficam em fila | n |
| Status automático do veículo | Trigger `after insert or update of status`, `security definer`: insert `EmAndamento` → veículo `EmViagem`; transição `EmAndamento` → `Finalizada`/`Cancelada` → veículo `Disponivel` **só se** ele ainda está `EmViagem` | `after` só roda quando a linha foi gravada de fato; o "só se EmViagem" mantém Inativo um veículo inativado durante a viagem (mesmo cuidado da `concluir_manutencao`) | n |
| Upsert com `id` já existente | O trigger de insert detecta que o `id` já existe e não valida (quem valida é o trigger de update, que o Postgres dispara em seguida no `on conflict do update`) | O Postgres roda `before insert` mesmo quando a linha conflita; sem isso, reenviar uma viagem aberta seria rejeitado como "veículo em viagem" por ela mesma | n |
| Códigos de erro | Classe própria `VG`: `VG001` veículo já em viagem; `VG002` veículo em manutenção; `VG003` veículo inativo; `VG004` hodômetro inicial menor que o último final; `VG005` viagem encerrada não pode ser alterada; `VG006` veículo da viagem não pode ser trocado | Mesmo padrão `MN***` da EIX-75: o repositório da EIX-40 traduz por código, o texto do banco nunca chega ao usuário | n |
| `viagem_delete` | Policy removida: nenhum perfil apaga viagem (soft delete é `Cancelada`) | Recomendação da task; viagem com hodômetro é histórico, como veículo (EIX-56) | n |
| `km_rodado` | Coluna gerada `numeric(12,1) generated always as (hodometro_final - hodometro_inicial) stored` | Pedido da task; nula enquanto `hodometro_final` é nulo. O app não envia a coluna no insert/upsert | y (task) |
| Dados na nuvem | Comentário da migration manda conferir antes do `db push`: nenhum veículo com duas viagens `EmAndamento` (senão o índice falha e nada é aplicado). Em 14/10/2026 havia 0 viagens | Mesmo padrão das migrations da EIX-75 | n |
| Testes existentes | Fixtures que abrem duas viagens no mesmo veículo (`rls.test.ts`, `rls_perfis.test.ts`) passam a usar um veículo por viagem aberta; nenhuma asserção é removida | A regra nova invalida o fixture, não o que o teste prova | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Um veículo, uma viagem em andamento ⭐ MVP

**User Story**: As a gestor de frota, I want the database to refuse a second open trip on the same truck so that the fleet status never shows one vehicle in two places.

**Why P1**: É a base do status automático e do sync: sem ela, duas viagens offline no mesmo veículo subiriam as duas.

**Acceptance Criteria**:

1. IF a `viagem` is inserted with `status = 'EmAndamento'` for a `veiculo_id` that already has another `viagem` with `status = 'EmAndamento'` THEN the system SHALL reject it with SQLSTATE `VG001` and write nothing.
2. The system SHALL keep a unique partial index on `viagem (veiculo_id) where status = 'EmAndamento'`, so a write that bypasses the trigger check still fails with SQLSTATE `23505`.
3. WHEN the open `viagem` of a vehicle becomes `Finalizada` or `Cancelada` THEN the system SHALL accept a new `EmAndamento` `viagem` for that vehicle.

**Independent Test**: Abrir viagem no veículo A; tentar abrir outra no A → `VG001`; finalizar a primeira; abrir de novo → aceito.

---

### P1: Veículo indisponível não abre viagem ⭐ MVP

**User Story**: As a gestor de frota, I want trips on vehicles under maintenance or deactivated to be refused so that a truck in the shop is never dispatched.

**Why P1**: Decisão que a EIX-56 deixou para cá; fecha o par com `registrar_manutencao` (que já recusa veículo `EmViagem`).

**Acceptance Criteria**:

1. IF a `viagem` is inserted with `status = 'EmAndamento'` for a vehicle with `status = 'EmManutencao'` THEN the system SHALL reject it with SQLSTATE `VG002`.
2. IF a `viagem` is inserted with `status = 'EmAndamento'` for a vehicle with `status = 'Inativo'` THEN the system SHALL reject it with SQLSTATE `VG003`.
3. WHEN a `viagem` is inserted with `status = 'Finalizada'` or `'Cancelada'` THEN the system SHALL accept it regardless of the vehicle's `status`.

**Independent Test**: Veículo `EmManutencao` → abrir viagem dá `VG002`; `Inativo` → `VG003`; viagem retroativa `Finalizada` no mesmo veículo é aceita.

---

### P1: Hodômetro não regride ⭐ MVP

**User Story**: As a gestor de frota, I want a new trip's starting odometer to be at least the last recorded ending odometer of that vehicle so that km and cost-per-km (US10) are never negative or double-counted.

**Why P1**: É a regra central da US08 e do RNF07.

**Acceptance Criteria**:

1. IF a `viagem` is inserted with `hodometro_inicial` lower than the greatest non-null `hodometro_final` among the other trips of the same `veiculo_id` THEN the system SHALL reject it with SQLSTATE `VG004`.
2. WHEN a `viagem` is inserted with `hodometro_inicial` equal to that greatest `hodometro_final` THEN the system SHALL accept it.
3. IF an open `viagem` has `hodometro_inicial` updated to a value lower than that greatest `hodometro_final` THEN the system SHALL reject it with SQLSTATE `VG004`.
4. WHEN a Motorista inserts a `viagem` THEN the system SHALL compare against the trips of every motorista on that vehicle, not only the ones the Motorista can read.
5. The system SHALL keep the existing checks: `hodometro_final` null or greater than `hodometro_inicial` (`23514`), and `Finalizada` requires `hodometro_final` (`23514`).

**Independent Test**: Viagem do motorista A fecha com 1500; motorista B abre com 1499 → `VG004`; com 1500 → aceito.

---

### P1: Status automático do veículo ⭐ MVP

**User Story**: As a gestor de frota, I want the vehicle status to follow its trip so that the fleet list is right without anyone editing the vehicle by hand.

**Why P1**: O Motorista não tem update em `veiculo`; sem o trigger, o status ficaria parado.

**Acceptance Criteria**:

1. WHEN a `viagem` is inserted with `status = 'EmAndamento'` THEN the system SHALL set its vehicle's `status` to `EmViagem`.
2. WHEN a `viagem` changes from `EmAndamento` to `Finalizada` or `Cancelada` THEN the system SHALL set its vehicle's `status` to `Disponivel`.
3. IF the vehicle's `status` is not `EmViagem` when its `viagem` leaves `EmAndamento` THEN the system SHALL leave the vehicle's `status` unchanged.
4. WHEN a `viagem` is inserted with `status = 'Finalizada'` or `'Cancelada'` THEN the system SHALL leave its vehicle's `status` unchanged.
5. WHEN a Motorista opens or closes their own `viagem` THEN the system SHALL update the vehicle's `status` even though the Motorista has no update policy on `veiculo`.

**Independent Test**: Motorista abre viagem → veículo `EmViagem`; fecha → `Disponivel`; Gestor inativa o veículo durante a viagem e o motorista fecha → continua `Inativo`.

---

### P1: Viagem encerrada é terminal ⭐ MVP

**User Story**: As a gestor de frota, I want closed trips to be frozen so that a late or replayed sync never reopens a trip or rewrites a closed odometer.

**Why P1**: Decidido com o usuário; sem isso a regra de hodômetro das viagens seguintes pode ser furada editando uma viagem antiga.

**Acceptance Criteria**:

1. IF a `viagem` with `status` `Finalizada` or `Cancelada` is updated to a different `status`, `hodometro_inicial` or `hodometro_final` THEN the system SHALL reject it with SQLSTATE `VG005`.
2. WHEN a `viagem` with `status` `Finalizada` or `Cancelada` is updated with the same `status`, `hodometro_inicial` and `hodometro_final` THEN the system SHALL accept it.
3. IF a `viagem` is updated to a different `veiculo_id` THEN the system SHALL reject it with SQLSTATE `VG006`.

**Independent Test**: Viagem `Finalizada` → `update status = 'EmAndamento'` dá `VG005`; mudar `hodometro_final` dá `VG005`; trocar `veiculo_id` de viagem aberta dá `VG006`.

---

### P1: Upsert idempotente para o sync ⭐ MVP

**User Story**: As a motorista sem sinal, I want the app to resend my trip safely so that a retry after a dropped connection never duplicates the trip or fails because of itself.

**Why P1**: É o contrato que a EIX-41 usa (CLAUDE.md §7, regra 4).

**Acceptance Criteria**:

1. WHEN the same open `viagem` (same `id`, same values) is sent again with `insert ... on conflict (id) do update` THEN the system SHALL accept it, keep exactly one row with that `id` and keep the vehicle `EmViagem`.
2. WHEN the same `Finalizada` `viagem` is sent again by upsert after the vehicle was opened in a newer `viagem` THEN the system SHALL accept it and leave the vehicle `EmViagem`.
3. IF an upsert sends an `EmAndamento` payload for an `id` that is already `Finalizada` THEN the system SHALL reject it with SQLSTATE `VG005`.
4. WHEN an open `viagem` is closed by upsert (same `id`, `status = 'Finalizada'`, `hodometro_final` filled) THEN the system SHALL update the row and set the vehicle to `Disponivel`.

**Independent Test**: Upsert duas vezes da mesma viagem aberta → 1 linha, veículo `EmViagem`; fecha por upsert → `Disponivel`; reenvio do fechamento depois de uma viagem nova → veículo continua `EmViagem`.

---

### P2: Quilometragem rodada

**User Story**: As a gestor de frota, I want each trip's driven km stored so that the US10 views and the trip screen read it without recomputing.

**Why P2**: Conveniência para US10/EIX-40; o dado já é derivável.

**Acceptance Criteria**:

1. WHEN a `viagem` has `hodometro_final` filled THEN the system SHALL expose `km_rodado = hodometro_final - hodometro_inicial`.
2. WHILE `hodometro_final` is null the system SHALL keep `km_rodado` null.
3. IF a write sets `km_rodado` explicitly THEN the system SHALL reject it.

**Independent Test**: Viagem 1000 → 1234,5 tem `km_rodado = 234.5`; aberta tem `null`.

---

### P2: Viagem não é apagada

**User Story**: As a gestor de frota, I want trips to be impossible to delete so that odometer history and cost-per-km stay intact.

**Why P2**: Recomendação da task; o caminho de "desfazer" é `Cancelada`.

**Acceptance Criteria**:

1. WHEN any authenticated profile (Admin, Gestor de Frota, Motorista) deletes a `viagem` THEN the system SHALL affect 0 rows.

**Independent Test**: Admin `delete from viagem where id = ...` → 0 linhas; a viagem continua lá.

---

## Edge Cases

- IF a Motorista inserts a `viagem` for another motorista THEN the system SHALL keep rejecting it by RLS (comportamento atual preservado).
- WHEN a Motorista opens their own `viagem` on an available vehicle THEN the system SHALL accept it (RLS + triggers juntos).
- WHEN a vehicle has no previous trip THEN the system SHALL accept any `hodometro_inicial >= 0`.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| VIAG-01 | P1: Um veículo, uma viagem em andamento — AC1 | Execute | Implementing |
| VIAG-02 | P1: Um veículo, uma viagem em andamento — AC2 | Execute | Implementing |
| VIAG-03 | P1: Um veículo, uma viagem em andamento — AC3 | Execute | Implementing |
| VIAG-04 | P1: Veículo indisponível — AC1 | Execute | Implementing |
| VIAG-05 | P1: Veículo indisponível — AC2 | Execute | Implementing |
| VIAG-06 | P1: Veículo indisponível — AC3 | Execute | Implementing |
| VIAG-07 | P1: Hodômetro não regride — AC1 | Execute | Implementing |
| VIAG-08 | P1: Hodômetro não regride — AC2 | Execute | Implementing |
| VIAG-09 | P1: Hodômetro não regride — AC3 | Execute | Implementing |
| VIAG-10 | P1: Hodômetro não regride — AC4 | Execute | Implementing |
| VIAG-11 | P1: Hodômetro não regride — AC5 | Execute | Implementing |
| VIAG-12 | P1: Status automático — AC1 | Execute | Implementing |
| VIAG-13 | P1: Status automático — AC2 | Execute | Implementing |
| VIAG-14 | P1: Status automático — AC3 | Execute | Implementing |
| VIAG-15 | P1: Status automático — AC4 | Execute | Implementing |
| VIAG-16 | P1: Status automático — AC5 | Execute | Implementing |
| VIAG-17 | P1: Viagem encerrada é terminal — AC1 | Execute | Implementing |
| VIAG-18 | P1: Viagem encerrada é terminal — AC2 | Execute | Implementing |
| VIAG-19 | P1: Viagem encerrada é terminal — AC3 | Execute | Implementing |
| VIAG-20 | P1: Upsert idempotente — AC1 | Execute | Implementing |
| VIAG-21 | P1: Upsert idempotente — AC2 | Execute | Implementing |
| VIAG-22 | P1: Upsert idempotente — AC3 | Execute | Implementing |
| VIAG-23 | P1: Upsert idempotente — AC4 | Execute | Implementing |
| VIAG-24 | P2: Quilometragem rodada — AC1 | Execute | Implementing |
| VIAG-25 | P2: Quilometragem rodada — AC2 | Execute | Implementing |
| VIAG-26 | P2: Quilometragem rodada — AC3 | Execute | Implementing |
| VIAG-27 | P2: Viagem não é apagada — AC1 | Tasks | Pending |

**Coverage:** 27 total, 0 mapped to tasks, 27 unmapped ⚠️ (mapeados no `tasks.md`)

---

## Success Criteria

- [ ] Todos os testes PGlite de `viagem` e os existentes (`rls`, `rls_perfis`, `frota`, `manutencao`, `usuario_status`) verdes.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` verdes.
- [ ] Depois do ok do Jean: `db push` aplicado e `src/types/database.ts` regerado com `km_rodado`.
