# EIX-38 · US07 — Cadastro de Rotas

## Problem Statement

A viagem (US08) e o custo por KM (US10) precisam de um trecho padrão: origem, destino e distância estimada. Hoje a tela de Rotas é o placeholder da EIX-77 e o gestor não tem onde cadastrar esses trechos. O schema já está na main (EIX-75: UF por enum, `ativa`, índice `rota_trecho_unico` sem acento/maiúscula), então falta só o app.

Rota é só o molde do trecho. Hodômetro, motorista e datas pertencem à Viagem (US08).

## Goals

- [ ] Admin e Gestor de Frota cadastram, editam, inativam e reativam rotas sem criar trecho duplicado.
- [ ] A lista mostra, por rota, quantas viagens finalizadas já passaram por ela, com a contagem feita no banco.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Hodômetro, motorista e datas | Pertencem à Viagem (US08, EIX-40) |
| Bloquear inativação de rota com viagem `EmAndamento` | Nenhum AC pede e o banco não bloqueia; observação registrada para a US08 |
| Cache offline da rota no SQLite (`src/db/schema.ts`) | Já existe (EIX-78, AD-010); a sincronização é da EIX-41. O cadastro de rota é online-only |
| Nova migration (índice parcial `where ativa`) | Decidido com o usuário em 17/10/2026: mantém a regra da EIX-75 (rota inativa bloqueia a duplicata) |
| Alterações em `src/ui/` | O `Select`, o `Switch`, o `FAB` e o ícone `rotas` já atendem |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Rota inativa x duplicidade | Rota inativa **continua** bloqueando a duplicata; o formulário orienta a reativar e oferece o botão "Reativar rota existente". Substitui o AC original "rota inativa não conta para duplicidade" | Regra do índice `rota_trecho_unico` (EIX-75): o histórico de viagens fica numa rota só, o que importa para o custo por KM (US10). Decidido com o usuário em 17/10/2026; o usuário avisa quem acompanha a task | y |
| O que o "Reativar rota existente" faz | Só muda `ativa` para `true` na rota existente; não grava a distância digitada no formulário | Ação explícita e reversível; quem quiser outra distância edita a rota depois | y |
| Onde mora a regra de duplicidade | Checagem no cliente antes de gravar (para devolver o id e o estado da rota existente) + o `23505` do índice como garantia contra corrida | Mesmo padrão de `categoriasRepository.ts`; o banco continua sendo a autoridade | y |
| Normalização da cidade no cliente | `chaveCidade` repete em TypeScript o `normaliza_cidade()` da migration `20261014000400` (lower + troca das mesmas letras acentuadas) | A migration cita esse caminho; o comentário do código aponta para ela (AD-008: mesma regra, os dois lados) | y |
| Contagem de viagens finalizadas | Embed `viagem(count)` do PostgREST filtrado por `viagem.status = 'Finalizada'` | Agregação no Postgres, não no cliente (RNF06); o RLS de `viagem` já libera tudo para Admin e Gestor de Frota, os únicos perfis da tela | y |
| Busca na lista | Local, por cidade de origem ou de destino, ignorando acento, maiúscula e espaço | Catálogo pequeno (limite 500), como Categorias; dispensa nova query a cada letra | n |
| Limite do nome da cidade | 1 a 80 caracteres depois de limpar os espaços | O banco só exige não vazio; 80 cobre o maior município brasileiro com folga e evita texto sem teto | n |
| Distância | Texto com vírgula decimal, maior que zero, até 99.999.999,99, no máximo 2 casas | Igual ao `numeric(10, 2)` + `rota_distancia_positiva` | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Cadastrar e editar rota ⭐ MVP

**User Story**: As a gestor de frota, I want to register a route with origin, destination and estimated distance so that trips reuse a standard leg.

**Why P1**: Sem rota cadastrada não existe viagem (US08).

**Acceptance Criteria**:

1. WHEN o usuário abre "Nova rota" THEN o sistema SHALL mostrar os campos Cidade de origem, UF de origem, Cidade de destino, UF de destino e Distância estimada (km).
2. The system SHALL oferecer a UF de origem e a UF de destino como lista das 27 UFs vindas do enum `uf` do banco, sem campo de texto livre.
3. WHEN o usuário salva uma rota válida THEN o sistema SHALL gravá-la com a cidade sem espaços nas pontas e sem espaços repetidos, mostrar "Rota cadastrada." e voltar à lista.
4. WHEN o usuário salva a edição de uma rota THEN o sistema SHALL gravar as mudanças, mostrar "Rota atualizada." e voltar à lista.
5. IF a distância está vazia, não é número, é zero ou negativa THEN o sistema SHALL bloquear o envio e mostrar abaixo do campo "Informe a distância estimada em km." (vazia ou não numérica) ou "A distância deve ser maior que zero." (zero ou negativa).
6. IF a distância tem mais de 2 casas decimais THEN o sistema SHALL bloquear o envio e mostrar "Use no máximo 2 casas decimais."
7. IF uma cidade está vazia ou uma UF não foi escolhida THEN o sistema SHALL bloquear o envio e mostrar a mensagem do campo ("Informe a cidade de origem.", "Escolha a UF de origem.", e o equivalente para destino).
8. WHILE o envio está em andamento the system SHALL mostrar loading no botão "Salvar" e ignorar novos toques.
9. IF o banco recusa a gravação THEN o sistema SHALL mostrar um Snackbar de erro em português, sem o texto do Postgres.

**Independent Test**: Abrir "Nova rota", salvar Curitiba/PR → São Paulo/SP com 408 km, ver o Snackbar e a rota na lista; repetir com distância 0 e ver a mensagem no campo.

---

### P1: Bloquear rota duplicada ⭐ MVP

**User Story**: As a gestor de frota, I want the app to refuse a leg that already exists so that the trip history of a leg stays in one route.

**Why P1**: Rota duplicada divide o histórico de viagens e distorce o custo por KM (US10).

**Acceptance Criteria**:

1. IF já existe rota ativa com a mesma cidade e UF de origem e a mesma cidade e UF de destino THEN o sistema SHALL recusar a gravação e mostrar "Já existe uma rota com esse trecho."
2. The system SHALL considerar iguais, na comparação de cidade, nomes que só diferem por maiúscula, espaços ou acento ("São Paulo", " sao  paulo ", "SAO PAULO").
3. WHEN a origem e o destino de uma rota existente aparecem trocados THEN o sistema SHALL tratar como rota diferente e permitir a gravação.
4. IF a rota igual existente está inativa THEN o sistema SHALL recusar a gravação e mostrar "Já existe uma rota inativa com esse trecho. Reative-a para usar de novo." com o botão "Reativar rota existente".
5. WHEN o usuário toca em "Reativar rota existente" THEN o sistema SHALL marcar a rota existente como ativa, mostrar "Rota reativada." e voltar à lista.
6. WHEN o usuário salva a edição de uma rota sem mudar o trecho THEN o sistema SHALL NOT tratar a própria rota como duplicada.
7. IF o banco recusa a gravação por violação de `rota_trecho_unico` (`23505`) THEN o sistema SHALL mostrar a mesma mensagem de rota duplicada.

**Independent Test**: Cadastrar Curitiba/PR → São Paulo/SP e tentar "curitiba"/PR → "Sao Paulo"/SP (recusa); cadastrar São Paulo/SP → Curitiba/PR (aceita); inativar a primeira e tentar de novo (recusa com botão de reativar).

---

### P1: Listar, buscar e inativar rotas ⭐ MVP

**User Story**: As a gestor de frota, I want to see the routes with how many trips each one already had so that I know which legs the fleet really uses.

**Why P1**: É a porta de entrada da tela e onde mora o soft delete.

**Acceptance Criteria**:

1. WHEN a lista carrega THEN o sistema SHALL mostrar, por rota, "Cidade/UF → Cidade/UF" como título e "<distância> km · <N> viagens finalizadas" como subtítulo.
2. The system SHALL contar, para cada rota, só as viagens com status `Finalizada`.
3. WHEN o usuário digita na busca THEN o sistema SHALL mostrar só as rotas cuja cidade de origem ou de destino contém o termo, ignorando maiúscula, espaço e acento.
4. WHILE "Mostrar inativas" está desligado the system SHALL esconder as rotas inativas.
5. WHEN o usuário desliga o switch "Ativa" de uma rota THEN o sistema SHALL marcá-la como inativa (soft delete, nunca DELETE) e mostrar "Rota inativada."
6. WHEN o usuário liga o switch "Ativa" de uma rota inativa THEN o sistema SHALL reativá-la e mostrar "Rota reativada."
7. WHEN o usuário toca numa rota THEN o sistema SHALL abrir a edição dela.
8. WHEN o usuário toca no FAB "Nova rota" THEN o sistema SHALL abrir o cadastro.
9. WHILE a primeira carga está em andamento the system SHALL mostrar o skeleton.
10. IF a carga falha THEN o sistema SHALL mostrar a mensagem de erro em português com o botão "Tentar novamente".
11. WHILE não há rota para mostrar the system SHALL mostrar "Nenhuma rota cadastrada" (sem busca) ou "Nenhuma rota encontrada" (com busca).

**Independent Test**: Abrir Rotas com duas rotas e uma viagem finalizada, ver "1 viagem finalizada"; buscar "sao" e ver só a rota de São Paulo; inativar e ver o Snackbar.

---

## Edge Cases

- IF a rota pedida na edição não existe ou o RLS a esconde THEN o sistema SHALL mostrar "Rota não encontrada." com o botão "Voltar".
- IF o RLS recusa a escrita (`42501`) THEN o sistema SHALL mostrar a mensagem de acesso negado de `src/lib/errors.ts`.
- IF o banco recusa a cidade pela check de normalização (`23514`) THEN o sistema SHALL mostrar "Cidade inválida. Revise os nomes de origem e destino."
- IF a resposta do banco não passa no schema Zod THEN o sistema SHALL mostrar "Os dados recebidos são inválidos. Tente novamente."
- WHEN uma rota tem exatamente 1 viagem finalizada THEN o sistema SHALL escrever "1 viagem finalizada" (singular).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| ROTA-01 | P1: Cadastrar — AC1 | Tasks | Pending |
| ROTA-02 | P1: Cadastrar — AC2 | Tasks | Pending |
| ROTA-03 | P1: Cadastrar — AC3 | Tasks | Pending |
| ROTA-04 | P1: Cadastrar — AC4 | Tasks | Pending |
| ROTA-05 | P1: Cadastrar — AC5 | Tasks | Pending |
| ROTA-06 | P1: Cadastrar — AC6 | Tasks | Pending |
| ROTA-07 | P1: Cadastrar — AC7 | Tasks | Pending |
| ROTA-08 | P1: Cadastrar — AC8 | Tasks | Pending |
| ROTA-09 | P1: Cadastrar — AC9 | Tasks | Pending |
| ROTA-10 | P1: Duplicada — AC1 | Tasks | Pending |
| ROTA-11 | P1: Duplicada — AC2 | Tasks | Pending |
| ROTA-12 | P1: Duplicada — AC3 | Tasks | Pending |
| ROTA-13 | P1: Duplicada — AC4 | Tasks | Pending |
| ROTA-14 | P1: Duplicada — AC5 | Tasks | Pending |
| ROTA-15 | P1: Duplicada — AC6 | Tasks | Pending |
| ROTA-16 | P1: Duplicada — AC7 | Tasks | Pending |
| ROTA-17 | P1: Lista — AC1 | Tasks | Pending |
| ROTA-18 | P1: Lista — AC2 | Tasks | Pending |
| ROTA-19 | P1: Lista — AC3 | Tasks | Pending |
| ROTA-20 | P1: Lista — AC4 | Tasks | Pending |
| ROTA-21 | P1: Lista — AC5 | Tasks | Pending |
| ROTA-22 | P1: Lista — AC6 | Tasks | Pending |
| ROTA-23 | P1: Lista — AC7 | Tasks | Pending |
| ROTA-24 | P1: Lista — AC8 | Tasks | Pending |
| ROTA-25 | P1: Lista — AC9 | Tasks | Pending |
| ROTA-26 | P1: Lista — AC10 | Tasks | Pending |
| ROTA-27 | P1: Lista — AC11 | Tasks | Pending |
| ROTA-28 | Edge: rota não encontrada | Tasks | Pending |
| ROTA-29 | Edge: 42501 / 23514 / resposta inválida | Tasks | Pending |
| ROTA-30 | Edge: singular "1 viagem finalizada" | Tasks | Pending |

**Coverage:** 30 total, 30 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] Cadastrar, editar, inativar e reativar uma rota sem tocar em `src/ui/` nem em `supabase/migrations/`.
- [ ] `npm run typecheck`, `npm run lint` e `npm run test` verdes.
