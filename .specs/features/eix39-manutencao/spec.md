# EIX-39 · US06-b — Registro de Manutenção de Frota

## Problem Statement

O gestor de frota não tem onde registrar a manutenção de um veículo: a tela de Manutenções é o placeholder da EIX-77. O banco já está pronto (EIX-75: RPCs `registrar_manutencao` e `concluir_manutencao`, com despesa automática, rollback e bloqueio de veículo em viagem), então falta o app. Há um bloqueio de dados: a RLS de `forma_pagamento` só libera leitura para Admin e Financeiro, e o Gestor de Frota, que é quem usa a tela, não consegue listar as formas de pagamento que a RPC exige.

## Goals

- [ ] Admin e Gestor de Frota registram uma manutenção, com a despesa gerada no mesmo ato, e concluem a manutenção depois.
- [ ] O Gestor de Frota escolhe a forma de pagamento sem ganhar leitura da tabela `forma_pagamento` inteira.
- [ ] O detalhe do veículo mostra o histórico de manutenções dele.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Editar ou excluir manutenção | O banco só escreve `manutencao` pelas RPCs e não há RPC de edição (EIX-75); nenhum AC pede |
| Hodômetro na manutenção | A coluna existe, mas nenhum AC pede e a RPC não recebe o valor |
| Filtro definitivo de veículos selecionáveis | É da EIX-79; aqui fica o workaround `status <> 'Inativo'` com `TODO(EIX-79)` |
| Mudar o toque da lista de Veículos (`VeiculosListView`) | Decidido com o usuário: o toque continua abrindo a edição; a entrada do detalhe é o "Ver veículo" da manutenção |
| Abrir a RLS de `forma_pagamento` para o Gestor de Frota | Decidido com o usuário (opção b): RPC que devolve só id e nome das formas ativas |
| Offline | O cadastro de manutenção é online-only; o offline obrigatório (RNF01) é viagem e hodômetro |
| Aplicar a migration na nuvem e regerar `src/types/database.ts` | Exige a Supabase CLI vinculada ao projeto, que esta máquina não tem; quem faz é o Jean, revisor da task |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Formas de pagamento para o Gestor | RPC nova `listar_formas_pagamento_ativas()`, `security definer`, devolvendo só `id` e `nome` das ativas, para Admin, Financeiro e Gestor de Frota; migration nova escrita nesta task e revisada pelo Jean | Opção (b) da sessão anterior; não abre a tabela inteira; autorizado em 18/10/2026 | y |
| Motorista e a RPC de formas | Motorista recebe `42501` | CLAUDE.md §7: Motorista tem zero áreas financeiras | y |
| Seletor de formas antes dos tipos regerados | A função do repositório lê `forma_pagamento` direto (`ativa = true`) até a migration estar na nuvem e os tipos regerados; a troca para a RPC é a última task, bloqueada até lá | Sem o tipo gerado, `supabase.rpc('listar_formas_pagamento_ativas')` não passa no typecheck, e `database.ts` nunca é editado à mão | y |
| Veículos selecionáveis | `status <> 'Inativo'`, com `TODO(EIX-79)`; veículo em viagem aparece e a RPC recusa com `MN001` | Workaround aprovado; o AC pede a mensagem explicando o bloqueio | y |
| `CampoData` e `CampoMoeda` | Movidos de `src/features/movimentacoes/components/` para `src/ui/`, com imports de Movimentações e Dívidas atualizados | Aprovado: a manutenção usa os dois e feature não importa de outra | y |
| Detalhe do veículo | Rota `app/(app)/frota/[id]/index.tsx` (URL `/frota/<id>`), título "Veículo" em `app/(app)/_layout.tsx` | Aprovado; evita arquivo e pasta com o mesmo nome dinâmico ao lado de `frota/[id]/editar.tsx` | y |
| Entrada do detalhe | Botão "Ver veículo" em cada linha da lista de manutenções | Aprovado em 18/10/2026 | y |
| Textos do Snackbar de conclusão | "Manutenção concluída. Veículo disponível." / "Manutenção concluída. O veículo segue em manutenção por outra ordem aberta." | Aprovados os dois status; o texto exato é este, ajustável na revisão | y |
| Valores iniciais do formulário | Data = hoje; Status do pagamento = Pendente | Mesmo padrão de Movimentações (Pendente) e o caso comum é registrar no dia do serviço | y |
| Limite da descrição | 1 a 200 caracteres depois do trim | O banco não limita; 200 cabe numa ordem de serviço e evita texto sem teto | y |
| Concluir sem diálogo de confirmação | O toque em "Concluir" conclui direto, com loading e Snackbar | Nenhum AC pede confirmação; a ação é a mesma de Categorias (switch direto) | y |
| Ordem da lista | Em aberto primeiro; dentro de cada grupo, da data da manutenção mais recente para a mais antiga | Quem abre a tela quer ver o que está parado | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Registrar manutenção ⭐ MVP

**User Story**: As a gestor de frota, I want to register a vehicle maintenance with its cost so that the vehicle stops and the expense is recorded in the same act.

**Why P1**: É o coração da US06-b: sem o registro não há histórico nem despesa.

**Acceptance Criteria**:

1. WHEN o usuário abre "Nova manutenção" THEN o sistema SHALL mostrar os campos Veículo, Data da manutenção, Descrição do serviço, Valor total, Forma de pagamento e Status do pagamento (Pago / Pendente).
2. The system SHALL listar no seletor de Veículo só os veículos com status diferente de `Inativo`, no formato "PLACA · Marca Modelo".
3. The system SHALL listar no seletor de Forma de pagamento só as formas ativas.
4. WHEN o formulário abre THEN o sistema SHALL preencher a Data da manutenção com a data de hoje no fuso do aparelho e o Status do pagamento com Pendente.
5. WHEN o usuário salva uma manutenção válida THEN o sistema SHALL chamar `registrar_manutencao` com o valor em reais, mostrar "Manutenção registrada. O veículo está em manutenção." e voltar à lista.
6. IF o valor está vazio ou é zero THEN o sistema SHALL bloquear o envio e mostrar "Informe um valor maior que zero."
7. IF a data está vazia ou incompleta THEN o sistema SHALL bloquear o envio e mostrar "Informe a data da manutenção."
8. IF a data é posterior a hoje no fuso do aparelho THEN o sistema SHALL bloquear o envio e mostrar "A data da manutenção não pode ser futura."
9. IF o veículo não foi escolhido THEN o sistema SHALL bloquear o envio e mostrar "Escolha o veículo."
10. IF a forma de pagamento não foi escolhida THEN o sistema SHALL bloquear o envio e mostrar "Escolha a forma de pagamento."
11. IF a descrição está vazia depois do trim THEN o sistema SHALL bloquear o envio e mostrar "Descreva o serviço."
12. IF a descrição passa de 200 caracteres depois do trim THEN o sistema SHALL bloquear o envio e mostrar "A descrição pode ter no máximo 200 caracteres."
13. IF a RPC recusa com `MN001` THEN o sistema SHALL mostrar o Snackbar "Veículo em viagem não pode entrar em manutenção. Feche a viagem antes."
14. IF a RPC recusa com `22023` THEN o sistema SHALL mostrar o Snackbar "Forma de pagamento inativa. Escolha outra."
15. WHILE o envio está em andamento the system SHALL mostrar loading no botão "Salvar" e ignorar novos toques.
16. The system SHALL gravar manutenção, despesa e status do veículo só pela RPC `registrar_manutencao`, sem insert ou update direto em `manutencao`, `movimentacao` ou `veiculo`.

**Independent Test**: Como Admin, registrar uma manutenção de R$ 1,13 num veículo Disponível, ver o Snackbar e a manutenção em aberto na lista; repetir num veículo Em Viagem e ver a mensagem do `MN001`.

---

### P1: Listar e concluir manutenções ⭐ MVP

**User Story**: As a gestor de frota, I want to see the open maintenances and close them so that the vehicle goes back to the fleet.

**Why P1**: O AC "Concluir manutenção devolve o veículo para Disponível" mora aqui, e é a porta de entrada da tela.

**Acceptance Criteria**:

1. WHEN a lista carrega THEN o sistema SHALL mostrar, por manutenção, "PLACA · descrição" como título e "DD/MM/AAAA · R$ valor · Em aberto" ou "DD/MM/AAAA · R$ valor · Concluída" como subtítulo.
2. The system SHALL ordenar as manutenções em aberto antes das concluídas e, dentro de cada grupo, da data da manutenção mais recente para a mais antiga.
3. WHERE a manutenção está em aberto the system SHALL mostrar o botão "Concluir" na linha.
4. WHEN o usuário toca em "Concluir" e a RPC devolve `Disponivel` THEN o sistema SHALL marcar a linha como concluída e mostrar "Manutenção concluída. Veículo disponível."
5. WHEN o usuário toca em "Concluir" e a RPC devolve `EmManutencao` THEN o sistema SHALL marcar a linha como concluída e mostrar "Manutenção concluída. O veículo segue em manutenção por outra ordem aberta."
6. WHILE a conclusão de uma manutenção está em andamento the system SHALL mostrar loading no "Concluir" daquela linha e ignorar novos toques nele.
7. IF a conclusão falha THEN o sistema SHALL mostrar o Snackbar de erro em português e manter a linha em aberto.
8. WHEN o usuário toca no FAB "Nova manutenção" THEN o sistema SHALL abrir `/manutencoes/nova`.
9. WHILE a primeira carga está em andamento the system SHALL mostrar o skeleton.
10. IF a carga falha THEN o sistema SHALL mostrar a mensagem de erro em português com o botão "Tentar novamente".
11. WHILE não há manutenção registrada the system SHALL mostrar "Nenhuma manutenção registrada".

**Independent Test**: Com duas manutenções abertas no mesmo veículo, concluir uma e ver "segue em manutenção"; concluir a outra e ver "Veículo disponível."

---

### P1: Formas de pagamento ativas para o Gestor de Frota ⭐ MVP

**User Story**: As a gestor de frota, I want to pick an active payment method so that I can register a maintenance without reading the whole financial table.

**Why P1**: Sem ela, o Gestor de Frota, usuário principal da história, não consegue salvar.

**Acceptance Criteria**:

1. WHEN um Admin, Financeiro ou Gestor de Frota com status Ativo chama `listar_formas_pagamento_ativas()` THEN o banco SHALL devolver só `id` e `nome` das formas com `ativa = true`, ordenadas por `nome`.
2. IF quem chama é Motorista ou um usuário sem status Ativo THEN o banco SHALL recusar com `42501`.
3. The system SHALL revogar `execute` da função para `public` e `anon` e concedê-lo a `authenticated`.
4. The system SHALL manter a policy `forma_pagamento_select` sem mudança: o Gestor de Frota continua sem leitura direta da tabela.
5. WHEN os tipos gerados incluem a função THEN o seletor de Forma de pagamento SHALL usar `supabase.rpc('listar_formas_pagamento_ativas')`.

**Independent Test**: No PGlite, Gestor recebe Pix e Boleto e não recebe a forma inativa; Motorista recebe `42501`; o select direto do Gestor em `forma_pagamento` continua voltando vazio.

---

### P1: Histórico de manutenções no detalhe do veículo ⭐ MVP

**User Story**: As a gestor de frota, I want to see a vehicle's maintenance history so that I know what was already done on it.

**Why P1**: É AC explícito da EIX-39.

**Acceptance Criteria**:

1. WHEN o usuário toca em "Ver veículo" numa linha da lista de manutenções THEN o sistema SHALL abrir `/frota/<veiculo_id>`.
2. WHEN o detalhe carrega THEN o sistema SHALL mostrar a placa, "Marca Modelo", o status do veículo com o rótulo em português e a seção "Histórico de manutenções".
3. The system SHALL listar no histórico as manutenções do veículo, da data mais recente para a mais antiga, com data, descrição, valor e "Em aberto" ou "Concluída".
4. WHILE o veículo não tem manutenção the system SHALL mostrar "Nenhuma manutenção registrada para este veículo."
5. WHILE o detalhe está carregando the system SHALL mostrar o indicador de carregamento.
6. IF o veículo não existe ou o RLS o esconde THEN o sistema SHALL mostrar "Veículo não encontrado." com o botão "Voltar".

**Independent Test**: Registrar duas manutenções num veículo, tocar em "Ver veículo" e ver as duas no histórico, a mais recente primeiro.

---

## Edge Cases

- IF a RPC `registrar_manutencao` recusa com `MN002` THEN o sistema SHALL mostrar "Veículo inativo não pode receber manutenção."
- IF a RPC recusa com `MN003` THEN o sistema SHALL mostrar "A categoria Manutenção está inativa. Peça ao Financeiro para reativá-la."
- IF `registrar_manutencao` recusa com `P0002` THEN o sistema SHALL mostrar "Veículo não encontrado."
- IF `concluir_manutencao` recusa com `P0002` THEN o sistema SHALL mostrar "Manutenção não encontrada ou já concluída."
- IF uma RPC recusa com `23514` THEN o sistema SHALL mostrar "Confira o valor e a data da manutenção."
- IF uma RPC recusa com `42501` THEN o sistema SHALL mostrar a mensagem de acesso negado de `src/lib/errors.ts`.
- IF a RPC recusa com um código não listado THEN o sistema SHALL mostrar "Não foi possível registrar a manutenção. Tente novamente." (ou "concluir", na conclusão), sem o texto do Postgres.
- IF a resposta do banco não passa no schema Zod THEN o sistema SHALL mostrar "Os dados recebidos são inválidos. Tente novamente."
- IF a carga dos veículos ou das formas de pagamento falha THEN o formulário SHALL mostrar o estado de erro com "Tentar novamente".
- WHILE não há forma de pagamento ativa the system SHALL mostrar "Nenhuma forma de pagamento ativa." ao abrir o seletor.
- WHEN o valor digitado é R$ 1,13 THEN o sistema SHALL enviar `1.13` à RPC (centavos inteiros convertidos uma vez só, sem resíduo de ponto flutuante).
- WHEN a data escolhida é hoje e o aparelho está às 23h30 no fuso de São Paulo THEN o sistema SHALL aceitar a data.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| MAN-01 | P1: Registrar — AC1 | Tasks | Implementing |
| MAN-02 | P1: Registrar — AC2 | Tasks | Implementing |
| MAN-03 | P1: Registrar — AC3 | Tasks | Implementing |
| MAN-04 | P1: Registrar — AC4 | Tasks | Implementing |
| MAN-05 | P1: Registrar — AC5 | Tasks | Implementing |
| MAN-06 | P1: Registrar — AC6 | Tasks | Implementing |
| MAN-07 | P1: Registrar — AC7 | Tasks | Implementing |
| MAN-08 | P1: Registrar — AC8 | Tasks | Implementing |
| MAN-09 | P1: Registrar — AC9 | Tasks | Implementing |
| MAN-10 | P1: Registrar — AC10 | Tasks | Implementing |
| MAN-11 | P1: Registrar — AC11 | Tasks | Implementing |
| MAN-12 | P1: Registrar — AC12 | Tasks | Implementing |
| MAN-13 | P1: Registrar — AC13 | Tasks | Implementing |
| MAN-14 | P1: Registrar — AC14 | Tasks | Implementing |
| MAN-15 | P1: Registrar — AC15 | Tasks | Implementing |
| MAN-16 | P1: Registrar — AC16 | Tasks | Implementing |
| MAN-17 | P1: Concluir — AC1 | Tasks | Pending |
| MAN-18 | P1: Concluir — AC2 | Tasks | Implementing |
| MAN-19 | P1: Concluir — AC3 | Tasks | Pending |
| MAN-20 | P1: Concluir — AC4 | Tasks | Implementing |
| MAN-21 | P1: Concluir — AC5 | Tasks | Implementing |
| MAN-22 | P1: Concluir — AC6 | Tasks | Pending |
| MAN-23 | P1: Concluir — AC7 | Tasks | Pending |
| MAN-24 | P1: Concluir — AC8 | Tasks | Pending |
| MAN-25 | P1: Concluir — AC9 | Tasks | Pending |
| MAN-26 | P1: Concluir — AC10 | Tasks | Pending |
| MAN-27 | P1: Concluir — AC11 | Tasks | Pending |
| MAN-28 | P1: Formas ativas — AC1 | Tasks | Implementing |
| MAN-29 | P1: Formas ativas — AC2 | Tasks | Implementing |
| MAN-30 | P1: Formas ativas — AC3 | Tasks | Implementing |
| MAN-31 | P1: Formas ativas — AC4 | Tasks | Implementing |
| MAN-32 | P1: Formas ativas — AC5 | Tasks | Pending |
| MAN-33 | P1: Detalhe — AC1 | Tasks | Pending |
| MAN-34 | P1: Detalhe — AC2 | Tasks | Implementing |
| MAN-35 | P1: Detalhe — AC3 | Tasks | Implementing |
| MAN-36 | P1: Detalhe — AC4 | Tasks | Implementing |
| MAN-37 | P1: Detalhe — AC5 | Tasks | Implementing |
| MAN-38 | P1: Detalhe — AC6 | Tasks | Implementing |
| MAN-39 | Edge: códigos de erro das RPCs e resposta inválida | Tasks | Implementing |
| MAN-40 | Edge: falha na carga das opções e nenhuma forma ativa | Tasks | Implementing |
| MAN-41 | Edge: R$ 1,13 sem resíduo de ponto flutuante | Tasks | Implementing |
| MAN-42 | Edge: data de hoje às 23h30 | Tasks | Implementing |

**Coverage:** 42 total, 42 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] Admin registra e conclui uma manutenção no app, e a despesa aparece em Movimentações para o Financeiro.
- [ ] Gestor de Frota faz o mesmo depois que a migration estiver na nuvem e os tipos regerados.
- [ ] `npm run typecheck`, `npm run lint` e `npm run test` verdes.
