# EIX-30 — US16 Gestão de Perfis de Usuário (RBAC) Specification

## Problem Statement

Hoje todo login novo vira `Motorista` com acesso imediato, e não existe tela para o Admin promover, aprovar ou bloquear ninguém — a única forma de mudar perfil é SQL no painel. As US17 (navegação por perfil) e US18 (RLS) precisam de um perfil confiável e de uma API única no app (`useProfile()`) para decidir o que cada pessoa vê.

## Goals

- [ ] Nenhuma conta nova acessa módulo algum até um Admin aprová-la (banco e app).
- [ ] O Admin gerencia perfil e status de todos os usuários pelo app, sem SQL.
- [ ] `useProfile()` e os helpers de permissão existem e são a API consumida por US17/US18.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Árvore de rotas separada por perfil (`(gestor)`/`(motorista)`) | US17 (EIX-31) |
| Revisão completa das policies RLS por módulo | US18 (EIX-32); aqui só o necessário para "não aprovado não acessa nada" |
| Login com e-mail e senha | Não há task no Linear |
| Contas de demonstração e seeds de dados | EIX-53 |
| Criar usuário pelo app / convite por e-mail | Não pedido; conta nasce no primeiro login |
| Renomear o enum `perfil_nome` | Decisão do usuário: enum fica, rótulo muda só na UI |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Task pede perfis `Administrador` e `Operador/Motorista`; o enum aplicado usa `Admin` e `Motorista` | Enum do banco não muda; a UI exibe "Administrador", "Gestor de Frota", "Financeiro", "Operador/Motorista" | CLAUDE.md §5 exige os nomes do MER; seed dos 4 perfis já existe (EIX-27) | y |
| Valores do status | Enum `status_usuario`: `AguardandoAprovacao`, `Aprovado`, `Bloqueado`; rótulos "Aguardando aprovação", "Aprovado", "Bloqueado" | Segue o padrão sem acento/espaço dos enums existentes (`EmViagem`, `Saida`) | y |
| Status das contas que já existem quando a migration roda | `AguardandoAprovacao` | Ninguém ganha acesso sem querer; o primeiro Admin é promovido por SQL no painel | y |
| Contas de `auth.users` criadas antes do trigger `handle_new_user` (EIX-27) não têm linha em `usuario` | A migration cria a linha que falta (perfil Motorista, `AguardandoAprovacao`) | Sem a linha a conta não pode ser aprovada pela tela | y |
| Perfil de quem entra pela primeira vez | Continua `Motorista` (menor privilégio), mas com status `AguardandoAprovacao` | `perfil_id` é not null; o status é que bloqueia o acesso | y |
| Admin bloquear a si mesmo | Proibido, igual a rebaixar o próprio perfil | Mesmo risco: ficar sem Admin | y |
| Bloqueado vs `ativo = false` | `ativo` continua sendo o soft delete; bloquear muda só `status` | Bloqueio é reversível pela tela; soft delete é outra regra | y |
| Tela de usuário não aprovado | Mesma tela para `AguardandoAprovacao` e `Bloqueado`, com texto diferente; botão Sair nas duas | O critério cita "não aprovado"; bloqueado também não é aprovado | y |
| Usuário logado sem linha em `usuario` (falha rara) | Tratado como não aprovado | Fecha por padrão (deny-by-default) | y |
| `canSeeFrota` | `true` para Admin e Gestor de Frota | Tabela RBAC do CLAUDE.md §7; a rotina de campo do Motorista é da US17 | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Novo usuário entra bloqueado até aprovação ⭐ MVP

**User Story**: Como administrador, quero que toda conta nova nasça sem acesso, para que ninguém veja dado da empresa antes de eu liberar.

**Why P1**: Sem isso qualquer conta Google vira Motorista com acesso a viagens.

**Acceptance Criteria**:

1. WHEN uma conta é criada em `auth.users` THEN o banco SHALL criar a linha em `usuario` com status `AguardandoAprovacao`.
2. WHILE o status do usuário for diferente de `Aprovado` a função `auth_perfil()` SHALL retornar `null`.
3. WHILE o status do usuário for diferente de `Aprovado` o banco SHALL negar a leitura de `viagem`, inclusive das viagens em que ele é o motorista.
4. WHEN a migration roda THEN o banco SHALL criar em `usuario` a linha que faltar para cada conta de `auth.users`, com perfil `Motorista` e status `AguardandoAprovacao`.
5. WHEN a migration roda THEN toda linha já existente em `usuario` SHALL ficar com status `AguardandoAprovacao`.
6. WHILE o usuário logado não estiver `Aprovado` o app SHALL mostrar a tela "Aguardando liberação" e nenhuma tela de módulo.
7. WHEN o usuário logado tem status `Bloqueado` THEN a tela SHALL mostrar o texto "Seu acesso foi bloqueado. Fale com o administrador.".
8. WHEN o usuário toca "Sair" na tela "Aguardando liberação" THEN o app SHALL encerrar a sessão.
9. IF o app não consegue carregar o perfil do usuário logado THEN o app SHALL mostrar "Não foi possível carregar seu perfil." com os botões "Tentar novamente" e "Sair".

**Independent Test**: logar com conta nova → ver "Aguardando liberação" → Sair volta ao Login.

---

### P1: Admin gerencia perfis e status ⭐ MVP

**User Story**: Como administrador, quero listar os usuários e alterar perfil e status de cada um, para que cada colaborador acesse só o necessário.

**Why P1**: É o critério central da US16 e destrava o teste com perfis diferentes.

**Acceptance Criteria**:

1. WHILE o perfil do usuário logado não for `Admin` o app SHALL esconder o acesso à tela de usuários e não registrar a rota `usuarios`.
2. WHEN o Admin abre a tela de usuários THEN o app SHALL listar nome, e-mail, rótulo do perfil e rótulo do status de cada usuário.
3. WHEN a lista de usuários está carregando THEN a tela SHALL mostrar o indicador "Carregando usuários".
4. IF a lista de usuários falhar ao carregar THEN a tela SHALL mostrar "Não foi possível carregar" e o botão "Tentar novamente".
5. WHEN o Admin salva um novo perfil para outro usuário THEN o banco SHALL gravar o novo `perfil_id` e o app SHALL mostrar "Perfil atualizado.".
6. WHEN o Admin toca "Aprovar" em um usuário não aprovado THEN o banco SHALL gravar status `Aprovado` e o app SHALL mostrar "Usuário aprovado.".
7. WHEN o Admin toca "Bloquear" em um usuário aprovado THEN o banco SHALL gravar status `Bloqueado` e o app SHALL mostrar "Usuário bloqueado.".
8. IF a gravação falhar THEN o app SHALL mostrar a mensagem de erro em português e manter os dados anteriores na tela.
9. IF um usuário que não é Admin tenta alterar `usuario` THEN o banco SHALL rejeitar a alteração (policy existente da EIX-27).

**Independent Test**: Admin abre Usuários → aprova uma conta pendente com perfil Financeiro → essa conta, ao recarregar, entra no app.

---

### P1: Admin não perde o próprio acesso ⭐ MVP

**User Story**: Como administrador, quero ser impedido de rebaixar ou bloquear a mim mesmo, para que o sistema nunca fique sem Admin por engano.

**Why P1**: Critério de aceite explícito; erro aqui exige SQL para desfazer.

**Acceptance Criteria**:

1. IF o usuário logado tenta alterar o próprio `perfil_id` THEN o banco SHALL rejeitar com SQLSTATE `42501`.
2. IF o usuário logado tenta alterar o próprio `status` THEN o banco SHALL rejeitar com SQLSTATE `42501`.
3. WHEN o Admin abre o próprio usuário THEN o app SHALL esconder a escolha de perfil e o botão "Bloquear" e mostrar "Você não pode alterar o próprio perfil nem bloquear a si mesmo.".
4. WHEN uma alteração de perfil/status é feita sem usuário logado (SQL Editor do painel) THEN o banco SHALL aceitá-la.

**Independent Test**: logado como Admin, abrir o próprio usuário → sem ações; tentativa via API → erro 42501.

---

### P1: `useProfile()` e helpers de permissão ⭐ MVP

**User Story**: Como dev das US17/US18, quero uma API única de perfil no app, para não reimplementar regra de acesso em cada tela.

**Why P1**: A task declara que é a API consumida pelas US17/US18.

**Acceptance Criteria**:

1. The `isAdmin` helper SHALL retornar `true` só para perfil `Admin` com status `Aprovado`.
2. The `canSeeFinanceiro` helper SHALL retornar `true` só para `Admin` e `Financeiro` com status `Aprovado`.
3. The `canSeeFrota` helper SHALL retornar `true` só para `Admin` e `Gestor de Frota` com status `Aprovado`.
4. IF o status não é `Aprovado` ou não há usuário THEN todos os helpers SHALL retornar `false`.
5. The `useProfile()` hook SHALL expor `usuario` (id, nome, email, perfil, status), o estado de carregamento (`carregando` | `pronto` | `erro`), `isAprovado`, `isAdmin`, `canSeeFinanceiro`, `canSeeFrota` e `recarregar`.

**Independent Test**: testes unitários dos helpers para os 4 perfis × 3 status.

---

## Edge Cases

- IF a resposta do Supabase para o perfil não passa no Zod THEN o app SHALL tratar como erro de carregamento (P1 AC9 da primeira história).
- WHEN a lista de usuários volta vazia THEN a tela SHALL mostrar "Nenhum usuário encontrado".
- WHEN a sessão termina (Sair) THEN o perfil carregado SHALL ser descartado, para a próxima conta não herdar o perfil anterior.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| RBAC-01 | P1: Novo usuário bloqueado — banco (AC1–AC5) | Verify | Verified |
| RBAC-02 | P1: Novo usuário bloqueado — app (AC6–AC9) | Verify | Verified |
| RBAC-03 | P1: Admin gerencia — lista (AC1–AC4) | Verify | Verified |
| RBAC-04 | P1: Admin gerencia — alterações (AC5–AC9) | Verify | Verified |
| RBAC-05 | P1: Admin não perde o acesso — banco (AC1, AC2, AC4) | Verify | Verified |
| RBAC-06 | P1: Admin não perde o acesso — app (AC3) | Verify | Verified |
| RBAC-07 | P1: helpers de permissão (AC1–AC4) | Verify | Verified |
| RBAC-08 | P1: `useProfile()` (AC5) | Verify | Verified |

**Coverage:** 8 total, 8 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] Conta nova não lê nenhuma tabela de módulo até ser aprovada (teste PGlite).
- [ ] Admin aprova e troca perfil de outra conta pelo app em menos de 1 minuto, sem SQL.
- [ ] `npm run typecheck`, `npm run lint` e `npm run test` verdes.
