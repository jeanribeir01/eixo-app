# EIX-81 · Reativar veículo inativo — Validação

## Validation: EIX-81 — PASS

**Data**: 2026-11-10
**Verifier**: sub-agente independente (autor ≠ verificador)
**Spec**: `.specs/features/eix81-reativar-veiculo/spec.md`
**Diff**: `git diff main...HEAD` em `feat/eix-81-us06-reativar-veiculo` (3 commits: `9c9149d` spec/tasks, `158a352` repositório, `503f71d` lista).

Os 10 critérios de aceite (REA-01 a REA-10) têm evidência rastreável. Não foram encontradas lacuna de implementação, regressão de segurança nem mutante sobrevivente. O PASS cobre a verificação automatizada e a revisão estática. O teste de aceite em dispositivo continua pendente.

## Critérios de aceite contra a spec

Os caminhos apontam para asserções reais. `inativo` é o fixture `{ ...veiculosMock[0], id: '3', placa: 'GHI1234', status: 'Inativo' }` da lista; `volvo` é o fixture do repositório.

| AC | Resultado esperado pela spec | Evidência (arquivo:linha e asserção) | Resultado |
| --- | --- | --- | --- |
| REA-01 | UPDATE para Disponivel condicionado a id e status Inativo, sem DELETE | `src/features/veiculos/__tests__/repository.test.ts:103` `expect(query.update).toHaveBeenCalledWith({ status: 'Disponivel' })`; linha 104 `.eq` com `('id','1')`; linha 105 `expect(query.eq).toHaveBeenCalledWith('status', 'Inativo')`; linha 107 `expect(query.delete).not.toHaveBeenCalled()`. Código: `src/features/veiculos/repository.ts:210-212` | PASS |
| REA-02 | Zero linhas devolve erro em português, sem sucesso | `src/features/veiculos/__tests__/repository.test.ts:112-115` `expect(await reativarVeiculo('1')).toEqual({ ok: false, mensagem: 'Não foi possível reativar. O veículo pode já ter sido reativado ou você não tem permissão. ...' })`. Código: `repository.ts:218` | PASS |
| REA-03 | 42501 e falha traduzidos para português; resposta inválida rejeitada pelo Zod | `src/features/veiculos/__tests__/repository.test.ts:120` `toEqual({ ok:false, mensagem:'Você não tem permissão para alterar veículos.' })`; linha 121 `'Não foi possível reativar o veículo. Tente novamente.'` para PGRST301; linha 122 `'Os dados recebidos são inválidos. Tente novamente.'` para status `Vendido` | PASS |
| REA-04 | Botão Reativar só para Inativo | `src/features/veiculos/__tests__/VeiculosListView.test.tsx:164` `expect(screen.getAllByRole('button', { name: 'Reativar' })).toHaveLength(1)` numa lista com Disponivel, EmManutencao, EmViagem e Inativo. Código: `VeiculosListView.tsx:191` | PASS |
| REA-05 | Confirmação nativa com Cancelar; cancelar não chama o repositório | `src/features/veiculos/__tests__/VeiculosListView.test.tsx:172` `expect(alerta).toHaveBeenCalledWith('Reativar veículo?', expect.stringContaining('GHI-1234'), [ {text:'Cancelar',style:'cancel'}, {text:'Reativar',onPress:expect.any(Function)} ])`; linha 176 `expect(reativarVeiculo).not.toHaveBeenCalled()`; linha 177 placa continua visível. O botão Cancelar não tem callback | PASS |
| REA-06 | Pendente mostra loading e impede repetição | `src/features/veiculos/__tests__/VeiculosListView.test.tsx:188` `.toBeDisabled()`; linha 189 `expect(screen.getByTestId('button-loading')).toBeOnTheScreen()`; linha 191 `expect(reativarVeiculo).toHaveBeenCalledTimes(1)` após segunda confirmação; linha 193 libera o botão após a resposta | PASS |
| REA-07 | Sucesso mostra Snackbar e recarrega com o filtro atual | `src/features/veiculos/__tests__/VeiculosListView.test.tsx:207` `expect(reativarVeiculo).toHaveBeenCalledWith('3')`; linha 208 `getByText('Veículo reativado.')`; linha 209 `queryByText('GHI-1234')).toBeNull()` (só passa se a lista recarregar); linha 210 `toHaveBeenLastCalledWith({ busca: undefined, status: 'Inativo' })` | PASS |
| REA-08 | Falha mostra Snackbar de erro e preserva o veículo | `src/features/veiculos/__tests__/VeiculosListView.test.tsx:220` mensagem de erro visível; linha 221 `getByText('GHI-1234')).toBeOnTheScreen()`; linha 222 sem `'Veículo reativado.'`; linha 223 `expect(listarVeiculos).toHaveBeenCalledTimes(1)` (sem recarga) | PASS |
| REA-09 | Reativado volta a `listarVeiculosSelecionaveis` porque a consulta filtra Disponivel | Por construção: REA-01 grava `Disponivel` (`repository.test.ts:103`) e `src/features/veiculos/__tests__/repository.test.ts:128/133` `expect(query.in).toHaveBeenCalledWith('status', ['Disponivel'])` para viagem (e `['Disponivel','EmManutencao']` para manutenção). Código: `repository.ts:230-231`, não alterado pelo diff | PASS |
| REA-10 | Edição de Inativo preserva o status (ANO-06, sem regressão) | `src/features/veiculos/__tests__/VeiculoFormView.test.tsx:194` `expect(screen.queryByRole('tab')).toBeNull()`; linha 197 `expect(atualizarVeiculo).toHaveBeenCalledWith('9', expect.objectContaining({ status: 'Inativo', modelo: 'FH 460' }))`; `src/features/veiculos/__tests__/repository.test.ts:310` `expect(query.eq).toHaveBeenCalledWith('status','Inativo')`. Nenhum desses arquivos foi alterado pelo diff, e todos passam | PASS |

Observação de precisão: a spec não fixa o texto exato das mensagens de REA-02/REA-03; os testes conferem textos exatos em português, o que é mais estrito que a spec.

## Gate

- `npx jest src/features/veiculos --silent`: 5 suítes, 101 testes aprovados (linha de base do sensor).
- `npm run typecheck`: saída 0.
- `npm run lint`: saída 0.
- A suíte completa (`npm run test`) não foi executada pelo Verifier; fica para o orquestrador antes do PR.

## Sensor de discriminação

Mutações aplicadas uma por vez com `sed` na árvore real, seguidas de `npx jest src/features/veiculos` e desfeitas imediatamente com `git checkout -- <arquivo>`. A linha de base verde (101/101) precedeu as mutações.

| Mutação semântica isolada | Código-fonte | Teste que falhou | Resultado |
| --- | --- | --- | --- |
| M1: guarda `.eq('status','Inativo')` vira `.eq('status','EmViagem')` | `src/features/veiculos/repository.ts:212` | repository › reativarVeiculo (REA-01) | Morto; 1 falhou, 100 passaram |
| M2: checagem `if (!data)` vira `if (false)` | `src/features/veiculos/repository.ts:218` | repository › zero linhas (REA-02) | Morto; 1 falhou, 100 passaram |
| M3: payload `status: 'Disponivel'` vira `'EmViagem'` | `src/features/veiculos/repository.ts:210` | repository › reativarVeiculo (REA-01) | Morto; 1 falhou, 100 passaram |
| M4: Reativar para qualquer status, `(item.status === 'Inativo' \|\| true)` | `src/features/veiculos/VeiculosListView.tsx:191` | lista › REA-04 e INA-03 | Morto; 2 falharam, 99 passaram |
| M5: remover a trava `if (operacaoPendente.current) return;` em `alterarStatus` | `src/features/veiculos/VeiculosListView.tsx:85` | lista › REA-06 e INA-03 | Morto; 2 falharam, 99 passaram |
| M6: remover `await carregarAtual.current()` após sucesso | `src/features/veiculos/VeiculosListView.tsx:95` | lista › REA-07 e INA-06 (2 testes) | Morto; 3 falharam, 98 passaram |
| M7: ramo reativar chama `inativarVeiculo` | `src/features/veiculos/VeiculosListView.tsx:89` | lista › REA-06, REA-07, REA-08 | Morto; 3 falharam, 98 passaram |

**Resultado do sensor**: 7 injetadas, 7 mortas, 0 sobreviventes. Todas morreram por falha de asserção, não por erro de carregamento. Uma primeira versão de M4 com precedência de operadores errada (que escondia o botão em vez de mostrá-lo) foi descartada e refeita na forma acima; ela não conta no total.

O `git status --porcelain` foi capturado antes e depois do sensor e comparado com `cmp`: idêntico. Nenhum arquivo de código ou de teste ficou alterado. O único arquivo modificado na árvore, `.specs/STATE.md`, já estava modificado antes do início da verificação e não foi tocado pelo Verifier.

## Regras do projeto (AGENTS.md)

- Escopo: o diff altera só `src/features/veiculos/{repository.ts,VeiculosListView.tsx}`, `src/features/veiculos/__tests__/{repository.test.ts,VeiculosListView.test.tsx}` e `.specs/features/eix81-reativar-veiculo/{spec.md,tasks.md}`. Nada fora de `src/features/veiculos/**` e `.specs/`.
- Nenhuma alteração em `supabase/migrations/`, `src/types/database.ts`, `src/ui/`, CI ou dependências.
- Nenhum valor visual hardcoded (cor, espaçamento, tamanho de fonte) nas linhas adicionadas; o botão novo reusa o primitivo `Button` com `variant="ghost"`, sem botão novo.
- Sem `any` nem `@ts-ignore` (a única ocorrência de "any" é o matcher `expect.any(Function)`).
- Sem import entre features: os imports novos são de `./repository` e `../repository`.
- Feedback de ação presente: loading no botão, Snackbar de sucesso e de erro.
- RLS: não alterado; a spec registra que a policy `veiculo_update` já cobre Admin e Gestor de Frota. A conferência de viagem/manutenção aberta antes de reativar ficou fora de escopo por decisão registrada (a) na spec.

## Lacunas e revisão manual

Nenhuma lacuna de implementação que exija correção. Pontos de atenção não bloqueantes:

- REA-09 é verificado por composição (status gravado + filtro da consulta), sem teste de integração ponta a ponta nem teste de RLS no PGlite específico para a transição Inativo → Disponivel.
- A asserção `toHaveBeenLastCalledWith({ status: 'Inativo' })` de REA-07 (linha 210) sozinha não discrimina a recarga, porque já valia antes; quem prova a recarga é a linha 209, confirmada pela mutação M6.

**Teste de aceite em dispositivo continua pendente.** O Verifier não executou o app. Revisar manualmente: o Alert nativo de reativação (Cancelar e Reativar, sem estilo destrutivo), a Snackbar, o spinner do botão, o fluxo do Independent Test da spec (filtrar Inativo, reativar, ver o veículo sumir do filtro e aparecer no seletor de Nova viagem) e o layout em celular pequeno e tablet.

## Rastreabilidade

REA-01 a REA-10 verificados aqui. O orquestrador atualiza as tabelas da spec e do STATE, porque o Verifier só tinha autorização para escrever este relatório. O Verifier não fez commit, push, PR nem atualização no Linear.
