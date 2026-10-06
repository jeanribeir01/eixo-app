# EIX-32 · US18 — Segurança de rotas e dados no backend (RLS)

## Problem Statement

A US17 esconde telas por perfil, mas o app fala direto com o PostgREST: quem chamar a API por fora ignora a navegação. O RLS das 10 tabelas já existe (EIX-27, EIX-30), mas a prova está incompleta — o teste confere uma lista fixa de tabelas, não cobre Gestor de Frota, Financeiro, pendente e bloqueado em todas as tabelas — e o usuário não aprovado ainda lê a tabela `perfil` inteira. No app, cada repositório traduz a recusa de permissão com uma frase diferente, sem um ponto único. Esta task fecha as lacunas e prova o bloqueio perfil a perfil.

## Goals

- [ ] Um teste falha se qualquer tabela do schema `public` existir sem RLS — inclusive tabelas criadas depois desta task.
- [ ] Usuário pendente ou bloqueado não lê nenhuma linha além da própria `usuario` e do próprio `perfil`.
- [ ] Uma matriz de testes no PGlite prova, para Admin, Financeiro, Gestor de Frota, Motorista, pendente e bloqueado, o que cada um lê e grava em cada tabela, chamando o banco como o PostgREST chama (role `authenticated` + JWT), sem passar pela UI.
- [ ] `src/lib/errors.ts` é o único lugar que traduz a recusa de permissão (`42501`) para "Acesso negado", e os repositórios que hoje traduzem `42501` passam a usá-lo.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Policies de tabelas que ainda não existem (ex.: mudanças de `veiculo` da EIX-56) | Cada task que cria tabela entrega a policy no mesmo PR (CLAUDE.md §3); o teste dinâmico desta task pega a que esquecer |
| Detectar update/delete/select barrados pelo RLS no app | Decidido com o usuário: o Postgres devolve 0 linhas sem erro; ver Assumptions |
| Financeiro ler `viagem` (ponte US09) | Nenhum AC pede; entra na EIX-42 |
| Custom claim no JWT via Auth Hook | `auth_perfil()` já é o padrão adotado; trocar é decisão de arquitetura sem demanda |
| Mudar telas além da troca de mensagem | As telas já exibem Snackbar com a `mensagem` que o repositório devolve |
| Tradução de outros códigos (`23514`, `23503`, `P0001`, `P0002`, `22023`) | Continuam nos repositórios, com frases específicas de cada regra |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Mensagem da recusa | `errors.ts` traduz `42501` para "Acesso negado. Seu perfil não tem permissão para esta ação."; categorias, formas de pagamento, movimentações, dívidas e caixa passam a usá-lo | Decidido com o usuário: cumpre o AC ("Acesso negado") e tira a regra de 5 lugares | y |
| Update/delete/select negados | Viram 0 linhas, sem erro, e o app não os trata como acesso negado. O Snackbar "Acesso negado" cobre o que o banco devolve como erro: insert barrado por `with check` e RPC com checagem de perfil, ambos `42501` | Decidido com o usuário: é como o RLS do Postgres funciona; a US17 já esconde esses botões; tratar 0 linhas como recusa confundiria "não existe" com "sem permissão" | y |
| `perfil` para não aprovado | Nova migration: quem não está `Ativo` lê só a linha do próprio perfil; aprovados continuam lendo os 4 | Decidido com o usuário: cumpre "nada além do próprio registro" sem quebrar o join `usuario → perfil` do `profileStore` | y |
| "Operador" no AC | É o perfil `Motorista` | O domínio só tem 4 perfis (CLAUDE.md §5); não existe "Operador" | y |
| "Categoria financeira" no AC | A tabela `categoria` inteira (e `forma_pagamento`) | Toda categoria é de movimentação financeira (Entrada/Saída) | y |
| "Chamando a API direto" | Testes no PGlite com `set role authenticated` + `request.jwt.claims`, o mesmo contexto que o PostgREST monta | Padrão do projeto (AD-006); não há Postgres/PostgREST local (AD-003) | y |
| Bloqueado | Mesmas regras de pendente | `auth_perfil()` devolve nulo para todo status diferente de `Ativo` | y |
| Gestor de Frota em `forma_pagamento` e `divida` | Bloqueado, como em `movimentacao` e `categoria` | Gestor não tem área financeira (CLAUDE.md §7, tabela de RBAC) | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Banco recusa acesso fora do perfil ⭐ MVP

**User Story**: Como administrador, quero que o banco recuse qualquer leitura ou escrita fora do perfil, para que ninguém contorne o app e acesse dados financeiros chamando a API direto.

**Why P1**: É a única fronteira de autorização do sistema (CLAUDE.md §3); sem prova, a US17 é só ocultação.

**Acceptance Criteria**:

1. The database SHALL keep row level security enabled on every table of the `public` schema. <!-- RLS-01 -->
2. WHILE the user is an approved Motorista, the database SHALL return zero rows from `movimentacao`, `divida`, `categoria` and `forma_pagamento`. <!-- RLS-02 -->
3. WHILE the user is an approved Motorista, the database SHALL return only the `viagem` rows whose `motorista_id` is the user's id. <!-- RLS-03 -->
4. IF an approved Motorista inserts a `viagem` whose `motorista_id` is another user THEN the database SHALL reject the insert with SQLSTATE `42501`; IF the Motorista updates another user's `viagem` THEN the database SHALL affect zero rows and leave that row unchanged. <!-- RLS-04 -->
5. WHILE the user is an approved Gestor de Frota, the database SHALL return all rows of `veiculo`, `rota`, `viagem` and `manutencao`. <!-- RLS-05 -->
6. WHILE the user is an approved Gestor de Frota, the database SHALL return zero rows from `movimentacao`, `divida`, `categoria` and `forma_pagamento`. <!-- RLS-06 -->
7. IF an approved Gestor de Frota or Motorista inserts into `movimentacao` THEN the database SHALL reject it with SQLSTATE `42501`. <!-- RLS-07 -->
8. IF an approved Gestor de Frota or Motorista calls `resumo_caixa` or `criar_divida` THEN the database SHALL raise SQLSTATE `42501`. <!-- RLS-08 -->
9. WHILE the user is an approved Admin or Financeiro, the database SHALL return all rows of `movimentacao`, `divida`, `categoria` and `forma_pagamento`. <!-- RLS-09 -->

**Independent Test**: `npm run test -- supabase/tests/rls` roda a matriz por perfil no PGlite; trocar qualquer policy por `using (true)` derruba ao menos um teste.

---

### P1: Usuário não aprovado não lê nada além de si ⭐ MVP

**User Story**: Como administrador, quero que uma conta recém-criada ou bloqueada não enxergue dado nenhum do sistema, para que só quem eu aprovei acesse a empresa.

**Why P1**: Todo login Google cria conta; sem isso, qualquer pessoa com conta Google veria a frota.

**Acceptance Criteria**:

1. WHILE the user's status is `AguardandoAprovacao` or `Bloqueado`, the database SHALL return zero rows from `categoria`, `forma_pagamento`, `divida`, `movimentacao`, `veiculo`, `rota`, `viagem` and `manutencao`. <!-- RLS-10 -->
2. WHILE the user's status is `AguardandoAprovacao` or `Bloqueado`, the database SHALL return from `usuario` only the user's own row. <!-- RLS-11 -->
3. WHILE the user's status is `AguardandoAprovacao` or `Bloqueado`, the database SHALL return from `perfil` only the row referenced by the user's own `perfil_id`. <!-- RLS-12 -->
4. WHILE the user's status is `Ativo`, the database SHALL return all 4 rows of `perfil`. <!-- RLS-13 -->

**Independent Test**: um usuário pendente no PGlite faz `select` em cada tabela e só recebe a própria linha de `usuario` e a do próprio `perfil`.

---

### P1: App mostra "Acesso negado" quando o banco recusa ⭐ MVP

**User Story**: Como usuário, quero uma mensagem clara quando meu perfil não pode fazer uma ação, em vez de um erro técnico ou tela branca.

**Why P1**: AC explícito da EIX-32; hoje cada repositório tem a sua frase.

**Acceptance Criteria**:

1. WHEN a Supabase error with code `42501` is translated THEN `src/lib/errors.ts` SHALL return the message "Acesso negado. Seu perfil não tem permissão para esta ação." <!-- RLS-14 -->
2. IF the error code is not `42501` THEN `src/lib/errors.ts` SHALL report that the error is not an access denial, so the repository keeps its own translation. <!-- RLS-15 -->
3. WHEN the categorias, formas de pagamento, movimentações or dívidas repository, or the caixa source, receives error `42501` THEN it SHALL return `{ ok: false }` with the message from RLS-14. <!-- RLS-16 -->

**Independent Test**: os testes dos repositórios simulam `{ error: { code: '42501' } }` e conferem a mensagem "Acesso negado…".

---

## Edge Cases

- IF a request has no authenticated user (`anon`) THEN the database SHALL return zero rows from every table. (já coberto por `rls.test.ts`; mantido)
- IF a new table is added to `public` without `enable row level security` THEN the RLS-01 test SHALL fail and name the table.
- IF an approved user's status changes to `Bloqueado` THEN the next request SHALL follow RLS-10 to RLS-12 (o perfil é lido a cada chamada por `auth_perfil()`, sem cache).

---

## Implicit-requirement sweep

| Dimension | Coverage |
| --- | --- |
| Auth boundaries | RLS-01 a RLS-13 |
| Failure states | RLS-14 a RLS-16; update/delete negados como 0 linhas (Assumptions) |
| State-transition integrity | Pendente/bloqueado → RLS-10 a RLS-12; aprovado → RLS-13 |
| Remaining dimensions | N/A for this scope: a task não cria escrita, fila, chamada externa nem dado com ciclo de vida novo |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| RLS-01 | P1: Banco recusa acesso | Execute | Implementing |
| RLS-02 | P1: Banco recusa acesso | Execute | Pending |
| RLS-03 | P1: Banco recusa acesso | Execute | Pending |
| RLS-04 | P1: Banco recusa acesso | Execute | Implementing |
| RLS-05 | P1: Banco recusa acesso | Execute | Implementing |
| RLS-06 | P1: Banco recusa acesso | Execute | Implementing |
| RLS-07 | P1: Banco recusa acesso | Execute | Implementing |
| RLS-08 | P1: Banco recusa acesso | Execute | Pending |
| RLS-09 | P1: Banco recusa acesso | Execute | Implementing |
| RLS-10 | P1: Não aprovado | Execute | Implementing |
| RLS-11 | P1: Não aprovado | Execute | Implementing |
| RLS-12 | P1: Não aprovado | Execute | Implementing |
| RLS-13 | P1: Não aprovado | Execute | Implementing |
| RLS-14 | P1: Acesso negado no app | Execute | Implementing |
| RLS-15 | P1: Acesso negado no app | Execute | Implementing |
| RLS-16 | P1: Acesso negado no app | Execute | Pending |

**Coverage:** 16 total, 0 mapped to tasks, 16 unmapped ⚠️ (mapeados na fase Tasks)

---

## Success Criteria

- [ ] `npm run test` verde com a matriz por perfil cobrindo os 6 estados de usuário (4 perfis aprovados + pendente + bloqueado).
- [ ] Nenhum repositório compara `'42501'` fora de `src/lib/errors.ts`.
- [ ] `npm run typecheck` e `npm run lint` verdes.
