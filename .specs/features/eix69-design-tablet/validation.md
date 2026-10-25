# EIX-69 — Validação independente

**Date**: 2026-10-25
**Spec**: `.specs/features/eix58-design-app/spec.md:256` (TAB-01)
**Diff range**: `95c001a..2978a31`
**Verifier**: subagente independente, distinto do autor
**Verdict**: FAIL — AC1 e AC2 aprovados; AC3 aguarda evidência visual Android.
**Result**: FAIL

## Critérios e evidências

| Critério | Resultado esperado | Evidência e asserção | Resultado |
| --- | --- | --- | --- |
| TAB-01 AC1 | A partir de 768, conteúdo centralizado com máximo 720 | `src/ui/__tests__/Screen.test.tsx:145` cobre 360, 412, 767, 768 e 800; `src/ui/__tests__/Screen.test.tsx:150` exige `{ width: '100%', maxWidth: 720, alignSelf: 'center' }`; linhas 159–160 repetem a exigência em scroll e overlay. Implementação: `src/ui/Screen.tsx:32`, `src/ui/Screen.tsx:79`. | PASS |
| TAB-01 AC2 | Hub Financeiro em duas colunas no tablet | `src/navigation/__tests__/FinanceiroHubView.test.tsx:98` cobre as cinco larguras; linha 103 exige `flexDirection: 'row'` e `alignItems: 'flex-start'`; linha 105 exige colunas flexíveis; linha 108 impede row no celular. Cada caso também aciona Formas de pagamento e exige o destino `/formas-pagamento`. Implementação: `src/navigation/FinanceiroHubView.tsx:101`. | PASS |
| TAB-01 AC3 | Todas as telas do épico sem rolagem horizontal em 360, 412 e 800 | Os testes acima validam propriedades, não o layout medido pelo Android. Não há prints nem inspeção executada de todas as telas nessas larguras. `.specs/features/eix58-design-app/tasks.md:1337` permanece desmarcado corretamente. | PENDENTE |

T43 atende os critérios automatizados. T44 atende os critérios automatizados e permanece parcial pela verificação visual. Os valores de breakpoint e largura estão centralizados em `src/ui/tokens.ts:27`; não foram encontrados valores visuais novos soltos nas telas. O diff mantém carregamento, erro, retry, navegação, FAB e estados existentes, sem alteração de lógica de dados.

## Gate

- Gate completo informado pelo autor: `npm run typecheck`, `npm run lint` e `npm run test` aprovados; 1073 testes app e 311 testes banco. Esta evidência é do autor, não uma execução independente deste verificador.
- Gate independente em scratch no commit 2978a31: `npx jest --selectProjects app --runInBand --runTestsByPath src/ui/__tests__/Screen.test.tsx src/navigation/__tests__/FinanceiroHubView.test.tsx`: exit 0, 2 suítes, 33 testes aprovados, nenhum skip.
- O diff acrescenta 10 casos parametrizados e preserva os testes existentes; não remove nem enfraquece asserções.

## Sensor de discriminação

Scratch: worktree separado e destacado no commit 2978a31, em diretório temporário. Nenhum código ou teste real foi modificado; nenhum stash foi utilizado.

| Mutação isolada | Evidência | Resultado |
| --- | --- | --- |
| `src/ui/Screen.tsx:32`: trocar `>= layout.tablet` por `> layout.tablet` | Teste de largura 768 falhou em `src/ui/__tests__/Screen.test.tsx:150`; exit 1, 1 falha e 14 aprovações. | KILLED |
| `src/navigation/FinanceiroHubView.tsx:101`: trocar direção row por column | Testes 768 e 800 falharam em `src/navigation/__tests__/FinanceiroHubView.test.tsx:103`; exit 1, 2 falhas e 16 aprovações. | KILLED |

Resultado: 2 mutações, 2 eliminadas, 0 sobreviventes. A primeira mutação foi revertida no scratch antes da segunda. Junction de dependências removida antes de descartar a worktree; `git status --porcelain` real era vazio antes e depois do sensor.

## Pendência por prioridade

1. **AC3 / validação Android**: percorrer as telas do épico a 360, 412 e 800, capturar evidência e conferir ausência de corte ou overflow horizontal, incluindo FAB e Snackbar. Só então marcar o checklist visual de T44 e revalidar o relatório. Não há aprovação visual inferida dos testes Jest.

Não foi encontrada falha de implementação nos critérios automatizados revisados. A entrega completa da EIX-69 permanece condicionada à evidência visual. Não foram alterados status da issue, spec, tarefas ou código pelo verificador.
