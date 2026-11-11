# EIX-81 — Reativar veículo inativo

## Problem Statement

A EIX-79 permite inativar um veículo, mas não permite desfazer. Uma inativação feita por engano hoje só se corrige direto no banco.

## Goals

- Devolver à circulação, como `Disponivel`, um veículo `Inativo`, com confirmação e feedback.
- Manter a edição sem reativar (ANO-06 da EIX-79).

## Out of Scope

| Feature | Reason |
| --- | --- |
| Conferir viagem ou manutenção aberta antes de reativar | Só seria garantido no banco (constraint/RPC), e banco é com o Jean. Decisão (a) abaixo |
| Migrations, `src/types/database.ts`, `src/ui/` | Base existente suficiente: RLS `veiculo_update` já cobre Admin e Gestor de Frota |
| Mudança de status no Linear | Quem fecha a task é a pessoa |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Ponto a decidir da task: conferir viagem/manutenção aberta | (a) Basta o guard da tela | A tela só inativa `Disponivel`; uma conferência só no cliente não protege contra chamada direta à API. Se o Jean quiser garantia, é constraint/RPC no banco | Sim (usuário, 10/11/2026) |
| Guarda de concorrência | `update` condicionado a `id` e `status = 'Inativo'` | Mesmo molde do `inativarVeiculo` | Sim (critério da task) |
| Zero linhas | Erro em português, sem sucesso falso | Pode ser concorrência, id ausente ou RLS | Sim (critério da task) |
| Trigger do ano | Não dispara | `update of ano_fabricacao`: mudar só o status não revalida o ano, então veículo legado sem ano reativa normalmente | Sim (migration 20261014000100) |

**Open questions:** none.

## User Stories

### P1: Reativação segura

Como Admin/Gestor de Frota quero desfazer uma inativação feita por engano sem mexer no banco.

**Acceptance Criteria**:

1. WHEN Reativar é confirmado THEN o repositório SHALL atualizar status para `Disponivel` condicionado ao id e ao status `Inativo`, sem delete (REA-01).
2. IF nenhuma linha é atualizada THEN o repositório SHALL devolver erro em português sem anunciar sucesso (REA-02).
3. IF o banco recusa por permissão (42501) ou falha THEN o repositório SHALL traduzir para mensagem em português, e resposta inválida SHALL ser rejeitada pelo Zod (REA-03).
4. WHILE o veículo está `Inativo` a lista SHALL oferecer o botão Reativar; para qualquer outro status SHALL NOT oferecer (REA-04).
5. WHEN Reativar é tocado THEN o sistema SHALL pedir confirmação nativa com Cancelar; cancelar SHALL NOT chamar o repositório (REA-05).
6. WHILE a reativação está pendente o botão SHALL exibir loading e impedir repetição (REA-06).
7. WHEN a reativação dá certo THEN o sistema SHALL mostrar Snackbar de sucesso e recarregar a lista com o filtro atual (REA-07).
8. IF a reativação falha THEN o sistema SHALL mostrar Snackbar de erro e preservar o veículo na lista (REA-08).
9. WHEN um veículo é reativado THEN ele SHALL voltar a aparecer em `listarVeiculosSelecionaveis` — garantido porque a consulta filtra por `Disponivel` (REA-09).
10. WHILE o veículo está `Inativo` a edição SHALL preservar o status (ANO-06 da EIX-79, sem regressão) (REA-10).

**Independent Test**: filtrar Inativo, reativar um veículo, ver Snackbar e o veículo sumir do filtro; abrir Nova viagem e encontrá-lo no seletor.
