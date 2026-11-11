# EIX-42 · US09 — Ponte de módulos: lançamentos vinculados a viagens

## Problem Statement

O Financeiro registra fretes, combustível e pedágios, mas não consegue dizer de qual viagem cada lançamento veio. A coluna `movimentacao.viagem_id` existe desde a EIX-27, porém nenhuma tela a preenche. Também falta a quantidade de litros do abastecimento. Sem ela, a US10 (EIX-43) não calcula o KM/L. Há ainda um bloqueio de dados: pelo RLS, o perfil Financeiro não lê `viagem`, e o Gestor de Frota não lê `movimentacao`.

## Goals

- [ ] Admin e Financeiro vinculam um lançamento a uma viagem no formulário da US03 e desvinculam sem apagar o lançamento.
- [ ] O lançamento de Combustível guarda os litros, o dado que a US10 usa no KM/L.
- [ ] Admin e Financeiro abrem uma viagem e veem os lançamentos dela, separados em entradas e saídas.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Rentabilidade, R$/KM, KM/L e totais da viagem | São da US10 (EIX-43). Agregar no cliente fere o RNF06 |
| Gestor de Frota ver os lançamentos da viagem | O Gestor não lê `movimentacao` (RLS, AD-013: o Gestor não tem área financeira) |
| Motorista lançar despesa em campo | Nenhum AC pede. O Motorista tem zero áreas financeiras |
| Offline no formulário de lançamento | O offline obrigatório (RNF01) é só viagem e hodômetro. Lançamento continua online |
| Mudar o toque na lista da aba Viagens | A aba continua abrindo o fechamento. A entrada do detalhe fica no hub Financeiro e no formulário |
| Mostrar a viagem na linha da lista de Movimentações | Nenhum AC pede |
| Proibir no banco o vínculo com viagem Cancelada ou antiga | O AC restringe o que o seletor lista, não o vínculo. Ver Assumptions |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Busca e "Sem viagem" no seletor | `Select` de `src/ui` ganha `searchable` (busca no modal) e `clearLabel` + `onClear` (primeira linha da lista). As props são opcionais, então as telas atuais não mudam | Autorizado pelo usuário em 11/11/2026 (alteração em `src/ui`, AGENTS.md §4) | y |
| Quando os litros são obrigatórios | Só quando a categoria é Combustível e o lançamento está vinculado a uma viagem. Combustível sem viagem deixa os litros opcionais | Decidido com o usuário em 11/11/2026. É o caso que entra no KM/L da US10, e lançamentos antigos continuam válidos | y |
| Como o banco garante os litros | Coluna `litros numeric(8,2)` com check `litros > 0`. Um trigger recusa litros fora de Combustível e Combustível vinculado sem litros, com `23514` | Regra crítica validada no banco também (AGENTS.md §2.4). Depende de outra tabela (`categoria`), por isso é trigger, não check | y |
| Qual categoria é "Combustível" | `categoria.titulo = 'Combustível'` e `tipo = 'Saida'` | Mesma convenção da `registrar_manutencao` com "Manutenção" (EIX-75). O título é fixo no seed da EIX-27 | y |
| Limite de litros | De 0,01 a 999.999,99, com até 2 casas decimais | É o que cabe em `numeric(8,2)`. O Zod usa o mesmo limite e aponta para a migration | y |
| Leitura de viagem pelo Financeiro | RPCs `security definer` `listar_viagens_vinculaveis()` e `buscar_viagem_vinculavel(p_viagem_id)`, só para Admin e Financeiro, devolvendo placa, rota, status e datas. A policy de `viagem` não muda | Decidido com o usuário em 11/11/2026, no molde da AD-013: expõe só o que a tela precisa, sem hodômetro nem motorista | y |
| "Concluídas recentes" | Viagens `Finalizada` com `data_fim` nos últimos 30 dias (sem `data_fim`, que é opcional no banco, vale `data_atualizacao`), mais todas as `EmAndamento`. Ordem: em andamento primeiro, depois da data de início mais recente para a mais antiga | O AC não define "recentes". 30 dias cobre o fechamento do mês anterior | n |
| Viagem vinculada que saiu da janela | O formulário mostra o rótulo dela pelo `fallbackLabel`, buscado com `buscar_viagem_vinculavel` | Editar um lançamento antigo não pode apagar o rótulo do vínculo | y |
| Rótulo da viagem | "PLACA · Origem/UF → Destino/UF", com status e data de início na descrição | A busca filtra placa e rota (AC), e os dois estão no rótulo | y |
| Onde mora o código da ponte | `src/features/ponte-viagem/` (repositório, lista e detalhe). `movimentacoes` importa só o repositório da ponte, e `viagens` não importa nada do Financeiro. A ponte é o único lugar que conhece os dois lados e reaproveita só o rótulo de status de `viagens/types` | RNF08: Financeiro e Frota não se importam diretamente, e a ponte é o contrato explícito. A EIX-42 sugeria `src/features/viagens/detalhe/`, mas o detalhe lê `movimentacao`, então ficar em `viagens` criaria o import cruzado | n |
| Rotas | Detalhe em `app/(app)/viagens/[id]/index.tsx` (título "Viagem") e lista em `app/(app)/viagens/lancamentos.tsx` (título "Lançamentos por viagem"). As duas usam o guard do Financeiro (`podeVerCategorias`: Admin e Financeiro) | Decidido com o usuário em 11/11/2026 | y |
| Entradas do detalhe | Item "Lançamentos por viagem" no hub Financeiro. O botão "Ver viagem" no formulário aparece quando o lançamento salvo tem viagem | Decidido com o usuário em 11/11/2026 | y |
| Desvincular | No detalhe, cada linha tem o botão "Desvincular", que grava `viagem_id = null` sem confirmação, com loading e Snackbar. No formulário, a opção "Sem viagem" faz o mesmo | Desvincular não apaga nada e pode ser desfeito pelo formulário | y |
| Desvincular Combustível com litros | Os litros ficam no lançamento | O trigger só proíbe litros fora de Combustível. Apagar os litros perderia o dado | y |
| Estado vazio do detalhe | "Nenhum lançamento vinculado" com a ação "Nova movimentação", que abre o formulário com a viagem já escolhida (`/movimentacoes/nova?viagemId=<id>`) | DESIGN_CYAN §8: o vazio oferece a ação de criar | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Vincular e desvincular lançamento no formulário ⭐ MVP

**User Story**: As a usuário do Financeiro, I want to link a cash entry to a trip in the US03 form so that I know which costs and revenues each trip generated.

**Why P1**: É o vínculo em si. Sem ele, a US10 não tem dado.

**Acceptance Criteria**:

1. WHEN o formulário de movimentação abre THEN o sistema SHALL mostrar o campo opcional "Vincular à viagem", com "Sem viagem" quando nada está escolhido. (PONTE-01)
2. WHEN o usuário abre o seletor de viagem THEN o sistema SHALL listar as viagens `EmAndamento` e as `Finalizada` com `data_fim` nos últimos 30 dias, no rótulo "PLACA · Origem/UF → Destino/UF". (PONTE-02)
3. WHEN o usuário digita no campo de busca do seletor THEN o sistema SHALL mostrar só as viagens cujo rótulo contém o texto, ignorando maiúsculas e acentos. (PONTE-03)
4. WHEN o usuário escolhe uma viagem e salva THEN o sistema SHALL gravar o `viagem_id` dela no lançamento, para qualquer categoria (Frete, Combustível, Pedágio ou outra). (PONTE-04)
5. WHEN o usuário escolhe "Sem viagem" num lançamento vinculado e salva THEN o sistema SHALL gravar `viagem_id = null` e manter o lançamento. (PONTE-05)
6. WHEN o usuário salva um lançamento sem viagem THEN o sistema SHALL gravar `viagem_id = null`, como antes da US09. (PONTE-06)
7. WHILE o lançamento em edição está vinculado a uma viagem fora da lista THEN o sistema SHALL mostrar o rótulo dessa viagem no campo. (PONTE-07)
8. WHEN o formulário abre com o parâmetro `viagemId` THEN o sistema SHALL abrir com essa viagem escolhida. (PONTE-08)
9. IF a lista de viagens não carrega THEN o sistema SHALL mostrar o erro de carga do formulário com a ação "Voltar", como já faz para categorias. (PONTE-09)

**Independent Test**: Criar um Frete vinculado à viagem ABC1D23, reabrir e ver a viagem no campo. Trocar para "Sem viagem", salvar e conferir `viagem_id` nulo.

---

### P1: Litros no Combustível ⭐ MVP

**User Story**: As a usuário do Financeiro, I want to record the liters of each fuel entry so that the US10 can compute KM/L.

**Why P1**: Sem os litros, o KM/L da US10 sai sempre "—".

**Acceptance Criteria**:

1. WHILE a categoria escolhida é Combustível THEN o sistema SHALL mostrar o campo "Quantidade em litros". (LITROS-01)
2. WHILE a categoria escolhida não é Combustível THEN o sistema SHALL esconder o campo e gravar `litros = null`. (LITROS-02)
3. IF a categoria é Combustível, há viagem escolhida e os litros estão vazios THEN o sistema SHALL mostrar "Informe a quantidade em litros." e não salvar. (LITROS-03)
4. IF os litros não são um número entre 0,01 e 999.999,99 com até 2 casas THEN o sistema SHALL mostrar "Informe os litros com até 2 casas decimais, entre 0,01 e 999.999,99." e não salvar. (LITROS-04)
5. IF uma escrita no banco grava litros em categoria que não é Combustível, ou grava Combustível vinculado a viagem sem litros, THEN o banco SHALL recusar com `23514`. (LITROS-05)
6. IF uma escrita no banco grava `litros <= 0` THEN o banco SHALL recusar com `23514`. (LITROS-06)

**Independent Test**: Escolher Combustível e ver o campo. Escolher Frete e ver o campo sumir. Combustível com viagem e sem litros mostra o erro.

---

### P1: Detalhe da viagem com lançamentos ⭐ MVP

**User Story**: As a usuário do Financeiro, I want to open a trip and see its entries split into inflows and outflows so that I can review what the trip cost and earned.

**Why P1**: É o AC "tela de detalhe da viagem lista todas as movimentações vinculadas".

**Acceptance Criteria**:

1. WHEN o usuário toca "Lançamentos por viagem" no hub Financeiro THEN o sistema SHALL listar as mesmas viagens do seletor (PONTE-02), e tocar numa abre o detalhe dela. (DETALHE-01)
2. WHEN o detalhe abre THEN o sistema SHALL mostrar a placa, a rota, o status e a data de início da viagem num cartão de destaque. (DETALHE-02)
3. WHEN o detalhe abre THEN o sistema SHALL listar os lançamentos com aquele `viagem_id` em duas seções, "Entradas" e "Saídas", cada linha com descrição, categoria e valor com sinal `+` ou `−`. (DETALHE-03)
4. WHEN o usuário toca "Desvincular" numa linha THEN o sistema SHALL gravar `viagem_id = null` naquele lançamento, tirar a linha da lista e mostrar "Lançamento desvinculado.". (DETALHE-04)
5. IF o desvínculo falha THEN o sistema SHALL manter a linha e mostrar "Não foi possível desvincular. Tente novamente.". (DETALHE-05)
6. WHILE a viagem não tem lançamento vinculado THEN o sistema SHALL mostrar "Nenhum lançamento vinculado" com a ação "Nova movimentação", que abre o formulário com essa viagem escolhida. (DETALHE-06)
7. WHILE os dados carregam THEN o sistema SHALL mostrar um indicador de carregamento. IF a carga falha THEN SHALL mostrar a mensagem de erro com "Tentar novamente". (DETALHE-07)
8. WHEN o usuário toca uma linha THEN o sistema SHALL abrir a edição daquele lançamento. (DETALHE-08)
9. WHEN um lançamento salvo tem viagem THEN o formulário SHALL mostrar o botão "Ver viagem", que abre o detalhe dela. (DETALHE-09)

**Independent Test**: Vincular um Frete e um Pedágio à mesma viagem, abrir o detalhe pelo hub e ver um em Entradas e outro em Saídas. Desvincular o Pedágio e ver que ele continua na lista de Movimentações.

---

### P1: Acesso no banco ⭐ MVP

**User Story**: As a dono do sistema, I want the trip data the Financeiro sees to go through an authorized function so that no profile gains more access than the screen needs.

**Why P1**: O RLS é a única fronteira de autorização (CLAUDE.md §3).

**Acceptance Criteria**:

1. WHEN Admin ou Financeiro chama `listar_viagens_vinculaveis()` THEN o banco SHALL devolver `id`, `placa`, `cidade_origem`, `uf_origem`, `cidade_destino`, `uf_destino`, `status`, `data_inicio` e `data_fim` das viagens da regra PONTE-02. (ACESSO-01)
2. WHEN Admin ou Financeiro chama `buscar_viagem_vinculavel(id)` THEN o banco SHALL devolver as mesmas colunas daquela viagem, qualquer que seja o status ou a data. (ACESSO-02)
3. IF Gestor de Frota, Motorista ou usuário não aprovado chama uma das duas funções THEN o banco SHALL recusar com `42501`. (ACESSO-03)
4. The system SHALL negar `execute` das duas funções a `anon` e `public` e conceder a `authenticated`. (ACESSO-04)
5. The system SHALL manter a policy `viagem_select` sem mudança: o Financeiro continua lendo zero linhas de `viagem` direto na tabela. (ACESSO-05)

**Independent Test**: No PGlite, chamar as funções como cada perfil e conferir as linhas devolvidas e os `42501`.

---

## Edge Cases

- IF a viagem escolhida é apagada antes de salvar THEN o banco SHALL recusar pela FK (`23503`), e o sistema SHALL mostrar "Viagem, categoria ou forma de pagamento não encontrada.".
- IF o banco recusa o lançamento com `23514` (valor, data de pagamento ou litros) THEN o sistema SHALL mostrar "Valor, data de pagamento ou litros inválidos.".
- WHEN o usuário troca a categoria de Combustível para outra THEN o sistema SHALL descartar os litros digitados ao salvar (`litros = null`).
- WHEN a busca não encontra nenhuma viagem THEN o seletor SHALL mostrar "Nenhuma viagem encontrada.".
- IF não há nenhuma viagem vinculável THEN o seletor SHALL mostrar só "Sem viagem" e a mensagem "Nenhuma viagem em andamento ou concluída nos últimos 30 dias.".

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PONTE-01 | P1: Vincular | Execute | Verified |
| PONTE-02 | P1: Vincular | Execute | Verified |
| PONTE-03 | P1: Vincular | Execute | Verified |
| PONTE-04 | P1: Vincular | Execute | Verified |
| PONTE-05 | P1: Vincular | Execute | Verified |
| PONTE-06 | P1: Vincular | Execute | Verified |
| PONTE-07 | P1: Vincular | Execute | Verified |
| PONTE-08 | P1: Vincular | Execute | Verified |
| PONTE-09 | P1: Vincular | Execute | Verified |
| LITROS-01 | P1: Litros | Execute | Verified |
| LITROS-02 | P1: Litros | Execute | Verified |
| LITROS-03 | P1: Litros | Execute | Verified |
| LITROS-04 | P1: Litros | Execute | Verified |
| LITROS-05 | P1: Litros | Execute | Verified |
| LITROS-06 | P1: Litros | Execute | Verified |
| DETALHE-01 | P1: Detalhe | Execute | Verified |
| DETALHE-02 | P1: Detalhe | Execute | Verified |
| DETALHE-03 | P1: Detalhe | Execute | Verified |
| DETALHE-04 | P1: Detalhe | Execute | Verified |
| DETALHE-05 | P1: Detalhe | Execute | Verified |
| DETALHE-06 | P1: Detalhe | Execute | Verified |
| DETALHE-07 | P1: Detalhe | Execute | Verified |
| DETALHE-08 | P1: Detalhe | Execute | Verified |
| DETALHE-09 | P1: Detalhe | Execute | Verified |
| ACESSO-01 | P1: Acesso | Execute | Verified |
| ACESSO-02 | P1: Acesso | Execute | Verified |
| ACESSO-03 | P1: Acesso | Execute | Verified |
| ACESSO-04 | P1: Acesso | Execute | Verified |
| ACESSO-05 | P1: Acesso | Execute | Verified |

**Coverage:** 29 total, 29 mapped to tasks (T1–T8), 0 unmapped

---

## Success Criteria

- [ ] Um Frete, um Combustível com litros e um Pedágio vinculados à mesma viagem aparecem no detalhe dela, e a US10 consegue somar os litros por `viagem_id`.
- [ ] Nenhum perfil ganha leitura nova em `viagem` ou `movimentacao` direto na tabela.
