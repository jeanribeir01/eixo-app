# EIX-27 — Schema base no Supabase Specification

**Linear:** EIX-27 · **Branch:** `feat/eix-27-schema-base` · **Revisor:** Eduardo

## Problem Statement

Todas as telas das US01–US14 dependem de tabelas que ainda não existem. Se cada dev criar a
própria migration, os schemas vão conflitar e divergir do MER. Esta entrega cria o schema inteiro
de uma vez, com as regras de integridade no banco, RLS por perfil e os tipos TypeScript gerados.

## Goals

- [ ] As 10 tabelas do domínio existem no projeto Supabase, criadas só por arquivos em `supabase/migrations/`.
- [ ] Nenhuma tabela é acessível sem uma policy explícita para o perfil do usuário logado.
- [ ] O app importa os tipos de tabela de `src/types/database.ts`, gerado pela CLI.
- [ ] Qualquer dev aplica as migrations e regenera os tipos seguindo só o README.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Espelho local SQLite/Drizzle | Drizzle não está instalado; o offline entra na US08. Exceção registrada ao CLAUDE.md |
| Edge Functions (dívida com parcelas, hodômetro) | US04 e US08 |
| Views de saldo, custo por KM e dashboards | US05, US10, US11–13 |
| Geração automática de despesa na manutenção | US06-b |
| Regra "hodômetro inicial ≥ último final do veículo" | Regra de negócio da US08 (Edge Function + trigger lá) |
| Telas e queries do app | Cada US de módulo |
| Stack local em Docker | AD-003 continua valendo |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Convenção de nomes | snake_case em tabelas e colunas | Segue a task e o padrão Postgres (camelCase exige aspas) | y |
| RLS | RLS em todas as tabelas + policies por perfil via função `auth_perfil()` | Exigência do AGENTS/CLAUDE.md; RLS é a única fronteira de autorização | y |
| Ferramenta | `npx supabase` ligado ao projeto na nuvem; usuário roda `login` e `db push` | Sem Docker (AD-003); `db push` altera o banco compartilhado | y |
| Caminho dos tipos | `src/types/database.ts`; CLAUDE.md corrigido | Segue a task e o AGENTS.md | y |
| Drizzle | Fora desta entrega | Dependência não instalada; offline é US08 | y |
| Chave primária | `uuid` com `default gen_random_uuid()`; o cliente pode enviar o próprio UUID v7 | Permite IDs gerados offline sem depender do banco | y |
| Timestamps | Todas as tabelas têm `data_inclusao` (default `now()`) e `data_atualizacao` (trigger) | A task nomeia assim em `movimentacao`; mesmo nome em todas evita duas convenções | y |
| Tipos enumerados | `enum` do Postgres (`perfil_nome`, `tipo_categoria`, `status_veiculo`, `status_viagem`, `status_pagamento`) | O `gen types` vira união de strings no TS | y |
| Status da viagem | `EmAndamento`, `Finalizada`, `Cancelada` | O MER não lista valores; cobre abrir/fechar/cancelar da US08 | y |
| Dinheiro | `numeric(12,2)` com `check (valor >= 0)` | CLAUDE.md proíbe float; valor negativo não tem sentido (sentido vem da categoria) | y |
| Vínculo usuário ↔ auth | `usuario.id` = `auth.users.id` (FK); `google_subject_id` guardado; trigger cria `usuario` com perfil Motorista no primeiro login | CLAUDE.md: primeiro login vira Motorista; sem a linha, as policies não funcionam | y |
| Campos de `manutencao` | `veiculo_id`, `descricao`, `data_manutencao`, `valor`, `hodometro`, `movimentacao_id` (nullable) | Não está no MER; mínimo para a US06-b ligar a despesa depois | y |
| Nome da forma de pagamento | "Cartão Corporativo" | A task é mais recente que o CLAUDE.md ("Cartão") | y |
| Seeds | Dentro de uma migration (idempotente com `on conflict do nothing`) | `seed.sql` só roda em banco local, que não existe (AD-003) | y |
| Delete físico | Sem policy de DELETE em `categoria`, `forma_pagamento`, `usuario`, `perfil` | Soft delete obrigatório | y |
| Leitura de `usuario` | Próprio usuário lê a sua linha; Admin e Gestor de Frota leem todas | Gestor precisa escolher motorista na viagem | y |
| Comprovantes | Bucket privado `comprovantes`; ler/enviar/apagar só Admin e Financeiro | Motorista não acessa área financeira | y |
| Testes | Jest + `@electric-sql/pglite` (devDependency) aplica as migrations num Postgres em WASM; stubs mínimos de `auth` e `storage` | Postgres real sem Docker; testa constraints e RLS no `npm test` | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Tabelas e integridade ⭐ MVP

**User Story**: As a dev do time, I want o schema completo criado por migrations so that eu construa minha US sem criar tabela própria.

**Why P1**: Bloqueia EIX-28 a EIX-47.

**Acceptance Criteria**:

1. The migrations SHALL criar as tabelas `perfil`, `usuario`, `categoria`, `forma_pagamento`, `movimentacao`, `divida`, `veiculo`, `rota`, `viagem` e `manutencao` em `public`.
2. The schema SHALL permitir `movimentacao.viagem_id` e `movimentacao.divida_id` nulos, com FK para `viagem` e `divida`.
3. The schema SHALL ter FKs `usuario.perfil_id`, `movimentacao.categoria_id`, `movimentacao.forma_pagamento_id`, `divida.categoria_id`, `viagem.veiculo_id`, `viagem.rota_id`, `viagem.motorista_id` e `manutencao.veiculo_id` obrigatórias.
4. WHEN uma linha de qualquer tabela é atualizada THEN the database SHALL gravar `now()` em `data_atualizacao`.
5. IF `movimentacao.status_pagamento = 'Pago'` e `data_pagamento` é nulo THEN the database SHALL rejeitar a escrita.
6. IF um `veiculo` é gravado com uma `placa` já existente THEN the database SHALL rejeitar a escrita.
7. IF `viagem.hodometro_final` não é nulo e é menor ou igual a `hodometro_inicial` THEN the database SHALL rejeitar a escrita.
8. IF `viagem.status = 'Finalizada'` e `hodometro_final` é nulo THEN the database SHALL rejeitar a escrita.
9. IF um valor monetário (`movimentacao.valor`, `divida.valor_parcela`, `manutencao.valor`) é negativo THEN the database SHALL rejeitar a escrita.

**Independent Test**: Aplicar as migrations e inserir um veículo com placa repetida — o banco recusa.

---

### P1: Dados padrão ⭐ MVP

**User Story**: As a financeiro, I want categorias e formas de pagamento já cadastradas so that eu lance movimentações sem configurar nada.

**Why P1**: US01, US02 e US03 partem desses registros.

**Acceptance Criteria**:

1. The migrations SHALL inserir os perfis `Admin`, `Gestor de Frota`, `Financeiro` e `Motorista`.
2. The migrations SHALL inserir as categorias ativas Combustível (Saida), Pedágio (Saida), Manutenção (Saida), Salário (Saida), Financiamento (Saida) e Frete (Entrada).
3. The migrations SHALL inserir as formas de pagamento ativas Boleto, Pix, TED e Cartão Corporativo.
4. WHEN a migration de seed roda de novo THEN the database SHALL manter um único registro por nome.

**Independent Test**: Ler `categoria` e `forma_pagamento` como Financeiro e ver 6 e 4 linhas.

---

### P1: Acesso por perfil (RLS) ⭐ MVP

**User Story**: As a admin, I want que cada perfil só enxergue o que lhe cabe so that o app não exponha dado financeiro a quem não deve.

**Why P1**: Sem policy a tabela fica aberta ou inacessível; PR sem RLS não é aprovado.

**Acceptance Criteria**:

1. The database SHALL manter RLS ativo em todas as 10 tabelas.
2. WHEN um usuário se cadastra em `auth.users` THEN the database SHALL criar a linha em `usuario` com o perfil `Motorista`.
3. WHILE o perfil do usuário é `Motorista` the database SHALL retornar zero linhas de `movimentacao`, `divida`, `categoria` e `forma_pagamento`.
4. WHILE o perfil do usuário é `Motorista` the database SHALL retornar só as linhas de `viagem` com `motorista_id` igual ao seu `usuario.id`.
5. WHILE o perfil do usuário é `Admin` ou `Financeiro` the database SHALL permitir ler e gravar `movimentacao`, `divida`, `categoria` e `forma_pagamento`.
6. WHILE o perfil do usuário é `Admin` ou `Gestor de Frota` the database SHALL permitir gravar `veiculo`, `rota`, `viagem` e `manutencao`.
7. The database SHALL permitir a qualquer usuário autenticado ler `veiculo`, `rota` e `perfil`.
8. IF um usuário que não é `Admin` tenta gravar em `usuario` ou `perfil` THEN the database SHALL rejeitar a escrita.
9. IF qualquer usuário tenta apagar uma linha de `categoria`, `forma_pagamento`, `usuario` ou `perfil` THEN the database SHALL rejeitar a operação.
10. IF o usuário não está autenticado THEN the database SHALL retornar zero linhas de todas as tabelas.

**Independent Test**: Logar como Motorista e consultar `movimentacao` — lista vazia.

---

### P1: Comprovantes no Storage ⭐ MVP

**User Story**: As a financeiro, I want um bucket privado para comprovantes so that a US03 anexe arquivos com segurança.

**Acceptance Criteria**:

1. The migrations SHALL criar o bucket `comprovantes` com `public = false`.
2. WHILE o perfil do usuário é `Admin` ou `Financeiro` the database SHALL permitir ler, enviar e apagar objetos do bucket `comprovantes`.
3. IF um usuário de outro perfil tenta ler ou enviar objeto no bucket `comprovantes` THEN the database SHALL rejeitar a operação.

**Independent Test**: Como Motorista, tentar enviar um arquivo ao bucket — erro de permissão.

---

### P2: Tipos e documentação

**User Story**: As a dev do time, I want tipos gerados e um passo a passo so that eu use o schema sem digitar tipo à mão.

**Acceptance Criteria**:

1. The repo SHALL conter `src/types/database.ts` gerado por `supabase gen types typescript`, com as 10 tabelas.
2. The README SHALL descrever como ligar a CLI ao projeto, aplicar as migrations e regenerar os tipos.
3. WHEN `npm run typecheck` roda THEN the typecheck SHALL passar com `src/types/database.ts` presente.

**Independent Test**: Seguir o README num clone limpo e obter o mesmo `database.ts`.

---

## Edge Cases

- IF uma movimentação é marcada como `Pendente` com `data_pagamento` preenchida THEN the database SHALL aceitar (pagamento agendado não é bloqueado).
- WHEN `viagem.hodometro_final` é nulo e `status = 'EmAndamento'` THEN the database SHALL aceitar a viagem aberta.
- IF um usuário autenticado não tem linha em `usuario` THEN `auth_perfil()` SHALL retornar nulo e as policies SHALL negar acesso.
- IF a placa difere só em caixa ou espaços (`abc1d23` vs `ABC1D23`) THEN the database SHALL tratá-la como a mesma placa.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| DB-01 | P1: Tabelas — AC1 | Design | Implementing |
| DB-02 | P1: Tabelas — AC2, AC3 | Design | Pending |
| DB-03 | P1: Tabelas — AC4 | Design | Implementing |
| DB-04 | P1: Tabelas — AC5 | Design | Pending |
| DB-05 | P1: Tabelas — AC6 + placa normalizada | Design | Implementing |
| DB-06 | P1: Tabelas — AC7, AC8 | Design | Implementing |
| DB-07 | P1: Tabelas — AC9 | Design | Implementing |
| SEED-01 | P1: Dados padrão — AC1–AC4 | Design | Implementing |
| RLS-01 | P1: RLS — AC1, AC10 | Design | Pending |
| RLS-02 | P1: RLS — AC2 | Design | Implementing |
| RLS-03 | P1: RLS — AC3, AC5 | Design | Pending |
| RLS-04 | P1: RLS — AC4, AC6, AC7 | Design | Pending |
| RLS-05 | P1: RLS — AC8, AC9 | Design | Pending |
| STO-01 | P1: Comprovantes — AC1–AC3 | Design | Pending |
| TYPE-01 | P2: Tipos — AC1, AC3 | Design | Pending |
| DOC-01 | P2: Tipos — AC2 | Design | Implementing |

**Coverage:** 16 total, 0 mapped to tasks, 16 unmapped ⚠️

---

## Success Criteria

- [ ] `npx supabase db push` aplica tudo sem erro num projeto vazio.
- [ ] Os testes de schema e RLS passam para os quatro perfis.
- [ ] EIX-28 a EIX-47 começam sem criar nenhuma tabela nova.
