# EIX-79 — Ano de fabricação e inativação

## Problem Statement

O cadastro da EIX-37 não expõe o ano nem permite inativar veículos. A EIX-56 já entregou coluna, enum e RLS; esta continuação completa o frontend e o contrato dos seletores.

## Goals

- Exigir ano válido ao salvar sem impedir a leitura de cadastros antigos.
- Inativar somente veículos disponíveis, preservando histórico e autorização.
- Entregar selecionáveis para EIX-39 e EIX-40.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Telas de manutenção e viagens | Pertencem às EIX-39 e EIX-40 |
| Reativação | Usuário aprovou preservar Inativo durante edição |
| Migrations, UI compartilhada, dependências, offline | Base existente suficiente; cadastro continua online |
| Commit, push, PR, mudança no Linear | Proibidos pelo usuário nesta entrega |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Inativação | Botão na lista, somente Disponivel, confirmação nativa | Decisão aprovada e guarda atômica contra concorrência | Sim |
| Formulário | Sem opção Inativo; edição de inativo mantém status | Inativar exige confirmação; reativação fora do escopo | Sim |
| Selecionáveis | Finalidade viagem ou manutencao | Cada operação aceita status distintos | Sim |
| Ano legado | Resposta nullable; formulário obrigatório | Migration EIX-56 e comentário de Jean | Sim |
| Zero linhas ao inativar | Falha sem sucesso falso, pedir atualização da lista | Pode ser concorrência, ID ausente ou RLS | Sim |
| Ano vigente | America/Sao_Paulo, calculado em cada validação | Mesma regra do banco inclusive no réveillon | Sim |

**Open questions:** none — decisões aprovadas em 16/10/2026.

## User Stories

### P1: Cadastro completo

Como Admin/Gestor de Frota quero informar o ano de fabricação e editar cadastros antigos.

**Acceptance Criteria**:

1. WHEN o formulário salva THEN o sistema SHALL exigir ano inteiro entre 1950 e ano atual de São Paulo + 1 (ANO-01).
2. IF o ano está vazio, ausente, não numérico ou fracionário THEN o sistema SHALL impedir o envio com mensagem em português no campo (ANO-02).
3. WHEN um veículo é lido THEN o repositório SHALL selecionar e validar ano_fabricacao aceitando null (ANO-03).
4. WHEN o formulário cria ou atualiza THEN o repositório SHALL persistir o ano informado (ANO-04).
5. IF o banco retorna 23514 com ano_fabricacao na mensagem THEN o repositório SHALL devolver campo ano_fabricacao e mensagem de ano, preservando os erros de placa (ANO-05).
6. WHILE um veículo está Inativo o formulário SHALL manter esse status sem oferecer opções de mudança (ANO-06).

**Independent Test**: criar com 1950; editar um legado com null e informar o ano; editar inativo mantendo status.

### P1: Inativação segura

Como gestor quero retirar um veículo disponível de circulação sem apagar seu histórico.

**Acceptance Criteria**:

1. WHEN Inativar é confirmado THEN o repositório SHALL atualizar status para Inativo condicionado ao id e ao status Disponivel, sem delete (INA-01).
2. IF nenhuma linha é atualizada THEN o sistema SHALL mostrar erro em português sem anunciar sucesso (INA-02).
3. WHILE a inativação está pendente o botão SHALL exibir loading e impedir repetição (INA-03).
4. WHEN Inativar é acionado THEN a lista SHALL solicitar confirmação Alert.alert com Cancelar e ação destructive (INA-04).
5. IF a confirmação é cancelada THEN a lista SHALL preservar o veículo sem chamar o repositório (INA-05).
6. WHEN a inativação retorna sucesso THEN a lista SHALL atualizar o item respeitando o filtro atual e mostrar Snackbar de sucesso (INA-06).
7. IF a operação falha THEN a lista SHALL preservar o item e mostrar Snackbar de erro (INA-07).
8. WHILE o veículo está EmViagem, EmManutencao ou Inativo a lista SHALL omitir o botão Inativar (INA-08).
9. The sistema SHALL preservar os guards existentes e as policies de escrita para Admin/Gestor de Frota (INA-09).

**Independent Test**: confirmar, cancelar, repetir toque pendente, simular concorrência e falha de permissão.

### P1: Filtro e selecionáveis

**Acceptance Criteria**:

1. WHEN o filtro Inativo é selecionado THEN a lista SHALL consultar status Inativo e manter o header nativo (SEL-01).
2. WHEN listarVeiculosSelecionaveis recebe viagem THEN o repositório SHALL consultar apenas Disponivel (SEL-02).
3. WHEN listarVeiculosSelecionaveis recebe manutencao THEN o repositório SHALL consultar apenas Disponivel e EmManutencao (SEL-03).
4. The selecionáveis SHALL excluir Inativo e EmViagem sem modificar as telas consumidoras (SEL-04).

**Independent Test**: inspecionar filtros enviados ao Supabase e os resultados validados.

## Edge Cases

- WHEN o ano muda em São Paulo com o schema já importado THEN a validação SHALL usar o novo limite.
- IF o veículo legado tem ano null THEN o formulário SHALL abrir vazio e exigir preenchimento para salvar.
- IF o veículo é inativado em outra sessão após carregar o formulário THEN a atualização SHALL falhar sem reativá-lo; edição com status Inativo só atualiza registro que já está Inativo.
- IF a inativação não encontra veículo disponível THEN o retorno SHALL ser "Não foi possível inativar. O veículo pode não estar mais disponível ou você não tem permissão. Atualize a lista e tente novamente.".
- IF a carga do formulário falha THEN a tela SHALL permitir tentar novamente.
- WHILE os cinco filtros são exibidos a lista SHALL permitir rolagem horizontal em larguras pequenas.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| ANO-01 | Cadastro completo | Execute | Verified |
| ANO-02 | Cadastro completo | Execute | Verified |
| ANO-03 | Cadastro completo | Execute | Verified |
| ANO-04 | Cadastro completo | Execute | Verified |
| ANO-05 | Cadastro completo | Execute | Verified |
| ANO-06 | Cadastro completo | Execute | Verified |
| INA-01 | Inativação | Execute | Verified |
| INA-02 | Inativação | Execute | Verified |
| INA-03 | Inativação | Execute | Verified |
| INA-04 | Inativação | Execute | Verified |
| INA-05 | Inativação | Execute | Verified |
| INA-06 | Inativação | Execute | Verified |
| INA-07 | Inativação | Execute | Verified |
| INA-08 | Inativação | Execute | Verified |
| INA-09 | Inativação | Execute | Verified |
| SEL-01 | Selecionáveis | Execute | Verified |
| SEL-02 | Selecionáveis | Execute | Verified |
| SEL-03 | Selecionáveis | Execute | Verified |
| SEL-04 | Selecionáveis | Execute | Verified |

## Success Criteria

Critérios da EIX-79 cobertos, typecheck/lint/test verdes e diff restrito. Revisão manual Android permanece necessária para teclado, diálogo nativo, acessibilidade e tablet.
