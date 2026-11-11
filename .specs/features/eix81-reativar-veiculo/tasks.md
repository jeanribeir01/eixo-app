# EIX-81 Tasks

## Execution Protocol

Usar tlc-spec-driven. Usuário aprovou a opção (a) e a execução em 10/11/2026. Avisar antes de cada commit. Não mexer em migrations, `src/types/database.ts` nem `src/ui/`. Não encerrar a issue no Linear.

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Repository | unit | Payload, guarda condicional, zero linhas, 42501, falha, resposta inválida, sem delete | veiculos/__tests__/repository.test.ts | quick |
| View | unit | Botão só em Inativo, confirmação, cancelar, loading, sucesso com filtro, erro | veiculos/__tests__/VeiculosListView.test.tsx | quick |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Cada tarefa de código | npx jest src/features/veiculos |
| Build | Conclusão | npm run typecheck; npm run lint; npm run test |

## Execution Plan

```text
T1 → T2 → T3
```

### T1: `reativarVeiculo` no repositório

- **What**: `update({ status: 'Disponivel' }).eq('id', id).eq('status', 'Inativo')`, erro sem linha, tradução de erros.
- **Where**: `src/features/veiculos/repository.ts`, `__tests__/repository.test.ts`
- **Covers**: REA-01, REA-02, REA-03, REA-09, REA-10
- **Done when**: testes do repositório verdes.

### T2: Botão Reativar na lista

- **What**: botão ghost só em `Inativo`, `Alert.alert` com Cancelar, loading, Snackbar, recarga com filtro atual. Reaproveita a trava de operação pendente da inativação.
- **Where**: `src/features/veiculos/VeiculosListView.tsx`, `__tests__/VeiculosListView.test.tsx`
- **Covers**: REA-04 a REA-08
- **Done when**: testes da lista verdes.

### T3: Verificação

- **What**: typecheck, lint, test; verificação independente em `validation.md`; handoff em `.specs/STATE.md`.
- **Covers**: todos
