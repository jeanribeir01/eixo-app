# EIX-39 · US06-b Manutenção — Validation

**Date**: 2026-10-19
**Spec**: `.specs/features/eix39-manutencao/spec.md`
**Diff range**: `d23b9f8..working tree (T9, não commitada)` — `src/features/manutencao/manutencaoRepository.ts` e `src/features/manutencao/__tests__/manutencaoRepository.test.ts`. Iterações anteriores: `eff0160..6c72ffa`, branch `feat/eix-39-us06b-manutencao`
**Iteração**: 3 (T9 / MAN-32). Iteração 1: FAIL por M16/MAN-40 (`eff0160..ff9ac6a`). Iteração 2: PASS (`6c72ffa`)
**Verifier**: sub-agente independente (autor ≠ verificador)

**Verdict**: PASS ✅ — iteração 3. A T9 troca o select direto em `forma_pagamento` pela RPC `listar_formas_pagamento_ativas`. O teste prova a chamada `rpc` e que `from()` não é chamado. Os 7 mutantes novos (M17–M22) morreram. O gate passa. Falta o commit e o teste manual com o Gestor de Frota, que ficam com o humano.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 | ✅ Done | `b84bfc2` migration + PGlite |
| T2 | ✅ Done | `7f0b847` CampoData → `src/ui/` |
| T3 | ✅ Done | `873af37` CampoMoeda → `src/ui/` |
| T4 | ✅ Done | `dc9b070` schema Zod |
| T5 | ✅ Done | `2e3e5f5` repositório |
| T6 | ✅ Done | `b3e0a63` formulário |
| T7 | ✅ Done | `c6a16eb` detalhe + rota `/frota/[id]` |
| T8 | ✅ Done | `ff9ac6a` lista |
| Fix 1 | ✅ Done | `6c72ffa` teste de MAN-40 com as duas fontes |
| T9 | 🟡 Implementada, aguardando commit | Pré-requisito cumprido: tipos regerados em `d23b9f8` (`src/types/database.ts:474`). Código e teste no working tree, sem commit. Teste manual com o Gestor de Frota **não feito** (fica com o humano) |

---

## Spec-Anchored Acceptance Criteria

Caminhos de teste abreviados: `F` = `src/features/manutencao/__tests__/`, `DB` = `supabase/tests/formasPagamentoAtivas.test.ts`, `R` = `__tests__/routes/`.

### P1: Registrar manutenção

| Req | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| MAN-01 | Campos Veículo, Data, Descrição, Valor total, Forma de pagamento, Status (Pago/Pendente) | `F/ManutencaoFormView.test.tsx:81-87` - `findByRole('button',{name:'Veículo'})`, `getByLabelText('Data da manutenção')`, `'Descrição do serviço'`, `'Valor total'`, `getByRole('button',{name:'Forma de pagamento'})`, `getByRole('tab',{name:'Pendente'})` / `'Pago'` | ✅ PASS |
| MAN-02 | Só status ≠ `Inativo`; rótulo "PLACA · Marca Modelo" | `F/manutencaoRepository.test.ts:307` - `expect(query.neq).toHaveBeenCalledWith('status','Inativo')`; `F/ManutencaoFormView.test.tsx:102-103` - `getByRole('button',{name:'ABC-1234 · Volvo FH 540'})` | ✅ PASS (nota: a placa sai formatada por `formatarPlaca`, ex. `ABC-1234`; o padrão do app) |
| MAN-03 | Só formas ativas | Cadeia em três elos. (1) Banco: `DB:29` semeia `Cheque` inativa e `DB:52` - `expect(resultado.rows).toEqual(ATIVAS_EM_ORDEM.map(...))` (Cheque fora). (2) Repositório chama essa RPC e devolve o resultado sem mexer: `F/manutencaoRepository.test.ts:331` - `expect(mockRpc).toHaveBeenCalledWith('listar_formas_pagamento_ativas')`, `:330` - `toEqual({ ok: true, data: formas })`. (3) Tela mostra o que o repositório devolve: `F/ManutencaoFormView.test.tsx:112-114` | ✅ PASS (iteração 3: o filtro saiu do app e mora na RPC; M1 e M17/M18/M22 provam os três elos) |
| MAN-04 | Data = hoje no fuso do aparelho; status = Pendente | `F/schema.test.ts:32-39` - `expect(valoresIniciais()).toEqual({... dataManutencao:'18/10/2026', statusPagamento:'Pendente'})` às 23h30; `F/ManutencaoFormView.test.tsx:82,86` - `toHaveProp('value','18/10/2026')`, `tab Pendente toBeSelected()` | ✅ PASS |
| MAN-05 | `registrar_manutencao` com valor em reais; Snackbar "Manutenção registrada. O veículo está em manutenção."; volta à lista | `F/manutencaoRepository.test.ts:104-112` - `toHaveBeenCalledWith('registrar_manutencao',{... valor:1.13 ...})`; `F/ManutencaoFormView.test.tsx:128-141` - payload completo, `getByRole('alert')).toHaveTextContent('Manutenção registrada. O veículo está em manutenção.')`, `mockBack toHaveBeenCalledTimes(1)` | ✅ PASS |
| MAN-06 | Vazio ou zero → "Informe um valor maior que zero." | `F/schema.test.ts:58` - `toEqual(['Informe um valor maior que zero.'])`; `F/ManutencaoFormView.test.tsx:154,156` (campo vazio = 0) - `getByText(...)`, `mockRegistrar not.toHaveBeenCalled()` | ✅ PASS |
| MAN-07 | Vazia/incompleta → "Informe a data da manutenção." | `F/schema.test.ts:62-67` - `''`, `'18/10'`, `'31/02/2026'` → `toEqual(['Informe a data da manutenção.'])`; `F/ManutencaoFormView.test.tsx:152` | ✅ PASS |
| MAN-08 | Futura → "A data da manutenção não pode ser futura." | `F/schema.test.ts:73-75`; `F/ManutencaoFormView.test.tsx:167-168` | ✅ PASS |
| MAN-09 | "Escolha o veículo." | `F/schema.test.ts:84`; `F/ManutencaoFormView.test.tsx:151` | ✅ PASS |
| MAN-10 | "Escolha a forma de pagamento." | `F/schema.test.ts:89`; `F/ManutencaoFormView.test.tsx:155` | ✅ PASS |
| MAN-11 | Vazia após trim → "Descreva o serviço." | `F/schema.test.ts:94-95` - `''` e `'   '`; `F/ManutencaoFormView.test.tsx:153` | ✅ PASS |
| MAN-12 | >200 após trim → "A descrição pode ter no máximo 200 caracteres." | `F/schema.test.ts:100-101` (200 com espaços aceita, 201 recusa); `F/ManutencaoFormView.test.tsx:179-180` | ✅ PASS |
| MAN-13 | `MN001` → "Veículo em viagem não pode entrar em manutenção. Feche a viagem antes." | `F/manutencaoRepository.test.ts:119,132` - `toEqual({ok:false, mensagem})`; `F/ManutencaoFormView.test.tsx:194,198` - alert + `mockBack not.toHaveBeenCalled()` | ✅ PASS |
| MAN-14 | `22023` → "Forma de pagamento inativa. Escolha outra." | `F/manutencaoRepository.test.ts:121,132`; `F/ManutencaoFormView.test.tsx:194` | ✅ PASS |
| MAN-15 | Loading no "Salvar" e ignora toques | `F/ManutencaoFormView.test.tsx:209-214` - `toBeDisabled()`, `mockRegistrar toHaveBeenCalledTimes(1)`, depois `not.toBeDisabled()` | ✅ PASS (o `Button` liga `disabled` e `busy` pelo mesmo `loading`, `src/ui/Button.tsx:29,37`; o spinner em si não é asserido) |
| MAN-16 | Escrita só pela RPC | `F/manutencaoRepository.test.ts:114,149` - `expect(mockFrom).not.toHaveBeenCalled()` em registrar e concluir | ✅ PASS |

### P1: Listar e concluir

| Req | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| MAN-17 | Título "PLACA · descrição"; subtítulo "DD/MM/AAAA · R$ valor · Em aberto/Concluída" | `F/ManutencoesListView.test.tsx:99-100` - `subtitle toBe('16/10/2026 · R$ 1,13 · Em aberto')`, `'10/10/2026 · R$ 2.500,00 · Concluída'` (título via `linha('ABC-1234 · Troca de pneus')`) | ✅ PASS |
| MAN-18 | Abertas antes; data desc em cada grupo | `F/manutencaoRepository.test.ts:184` - `toEqual(['a1','a2','c1','c2'])`; `F/ManutencoesListView.test.tsx:107` - ordem preservada | ✅ PASS |
| MAN-19 | "Concluir" só nas abertas | `F/ManutencoesListView.test.tsx:141-143` | ✅ PASS |
| MAN-20 | `Disponivel` → linha concluída + "Manutenção concluída. Veículo disponível." | `F/ManutencoesListView.test.tsx:155-158`; `F/manutencaoRepository.test.ts:147-148` | ✅ PASS |
| MAN-21 | `EmManutencao` → "Manutenção concluída. O veículo segue em manutenção por outra ordem aberta." | `F/ManutencoesListView.test.tsx:170-173` | ✅ PASS |
| MAN-22 | Loading só naquela linha; ignora toques | `F/ManutencoesListView.test.tsx:184-188` - `toBeDisabled()`, `toHaveBeenCalledTimes(1)`, outra linha `not.toBeDisabled()` | ✅ PASS |
| MAN-23 | Erro em português; linha segue em aberto | `F/ManutencoesListView.test.tsx:202-204` | ✅ PASS |
| MAN-24 | FAB abre `/manutencoes/nova` | `F/ManutencoesListView.test.tsx:232` - `mockPush toHaveBeenCalledWith('/manutencoes/nova')` | ✅ PASS |
| MAN-25 | Skeleton na primeira carga | `F/ManutencoesListView.test.tsx:90-91` - label + 3 `Skeleton` | ✅ PASS |
| MAN-26 | Erro em português + "Tentar novamente" | `F/ManutencoesListView.test.tsx:121-124` | ✅ PASS |
| MAN-27 | "Nenhuma manutenção registrada" | `F/ManutencoesListView.test.tsx:132` | ✅ PASS |

### P1: Formas de pagamento ativas (banco)

| Req | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| MAN-28 | Admin/Financeiro/Gestor Ativo: só `id` e `nome` das ativas, por `nome` | `DB:52` - `expect(resultado.rows).toEqual(ATIVAS_EM_ORDEM.map(nome => ({id, nome})))` (semente fora de ordem + forma inativa `Cheque`; status padrão `Ativo`, `supabase/tests/helpers/db.ts:101`) | ✅ PASS |
| MAN-29 | Motorista ou não Ativo → `42501` | `DB:60` (Motorista), `DB:69` (Bloqueado, AguardandoAprovacao), `DB:77` (anon) - `toBe('42501')` | ✅ PASS |
| MAN-30 | `revoke` de public/anon, `grant` a authenticated | `DB:88` - `has_function_privilege` → `toEqual([{anon:false, authenticated:true}])` (L-006) | ✅ PASS |
| MAN-31 | `forma_pagamento_select` intacta | `DB:99` - select direto do Gestor `toEqual([])`; a migration não toca policy | ✅ PASS |
| MAN-32 | Seletor via `supabase.rpc('listar_formas_pagamento_ativas')` | `F/manutencaoRepository.test.ts:331` - `expect(mockRpc).toHaveBeenCalledWith('listar_formas_pagamento_ativas')`; `:332` - `expect(mockFrom).not.toHaveBeenCalled()`; erro: `:338` (mensagem padrão), `:347` (42501 → `MENSAGEM_ACESSO_NEGADO`), `:353` (Zod → `MENSAGEM_DADOS_INVALIDOS`). Única chamada do seletor: `src/features/manutencao/ManutencaoFormView.tsx:44` | ✅ PASS (iteração 3; teste manual com o Gestor pendente) |

### P1: Detalhe do veículo

| Req | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| MAN-33 | "Ver veículo" abre `/frota/<veiculo_id>` | `F/ManutencoesListView.test.tsx:215,223` - `toHaveBeenCalledWith('/frota/v2')`; `R/rotasDaS5.test.tsx:42` - rota renderiza `VeiculoDetalheView {"veiculoId":"id-1"}`; `R/navegacaoPorPerfil.test.tsx:258,280,435` (bloqueio Financeiro/Motorista, Gestor abre, header "Veículo") | ✅ PASS |
| MAN-34 | Placa, "Marca Modelo", status em português, "Histórico de manutenções" | `F/VeiculoDetalheView.test.tsx:64-68` - `'ABC-1234'`, `'Volvo FH 540'`, `'Em Manutenção'`, `'Histórico de manutenções'` | ✅ PASS |
| MAN-35 | Data desc; data, descrição, valor, situação | `F/manutencaoRepository.test.ts:252` - `toEqual(['m3','m2','m1'])`; `F/VeiculoDetalheView.test.tsx:80-83` | ✅ PASS |
| MAN-36 | "Nenhuma manutenção registrada para este veículo." | `F/VeiculoDetalheView.test.tsx:91` | ✅ PASS |
| MAN-37 | Indicador de carregamento | `F/VeiculoDetalheView.test.tsx:63` - `getByLabelText('Carregando veículo')` | ✅ PASS |
| MAN-38 | "Veículo não encontrado." + "Voltar" | `F/manutencaoRepository.test.ts:279` (linha nula → mensagem); `F/VeiculoDetalheView.test.tsx:100-103` | ✅ PASS |

### Edge cases

| Req | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| MAN-39 | MN002, MN003, P0002 (veículo / manutenção), 23514, 42501, código desconhecido (registrar/concluir), resposta inválida | `F/manutencaoRepository.test.ts:123-128,132` (registrar), `:153-155,159` (concluir P0002/42501/XX000), `:138,165,230,294` (Zod → "Os dados recebidos são inválidos. Tente novamente.") | ✅ PASS (23514 só testado no registrar; o caminho de tradução é a mesma função) |
| MAN-40 | Falha na carga dos **veículos ou** das formas → erro + "Tentar novamente"; sem forma ativa → "Nenhuma forma de pagamento ativa." | `F/ManutencaoFormView.test.tsx:221-251` - `it.each` com os casos "dos veículos" e "das formas de pagamento": `:244` `expect(await screen.findByText(mensagem)).toBeOnTheScreen()` (mensagem exata de cada fonte), `:245` `queryByLabelText('Descrição do serviço')).not.toBeOnTheScreen()`, `:251` `expect(fonte()).toHaveBeenCalledTimes(2)` (recarga da fonte que falhou após "Tentar novamente"); `:261` `getByText('Nenhuma forma de pagamento ativa.')` | ✅ PASS (iteração 2; M16 agora morto) |
| MAN-41 | R$ 1,13 → `1.13` | `F/manutencaoRepository.test.ts:109` - `valor: 1.13` em `toHaveBeenCalledWith` (L-005) | ✅ PASS |
| MAN-42 | Hoje às 23h30 SP é aceito | `F/schema.test.ts:5,72-75` - relógio fixo em 18/10 23h30 com `TZ=America/Sao_Paulo` (L-001) | ✅ PASS |

**Status**: ✅ 42/42 requisitos com evidência completa (iteração 3 inclui MAN-32). As citações de `F/manutencaoRepository.test.ts` anteriores à linha 321 não mudaram: o diff da T9 só toca o `describe('listarFormasPagamentoAtivas')`.

---

## Discrimination Sensor

Scratch: `git worktree` em `<scratchpad>/eix39-sensor` (iteração 1, M1–M16 em `ff9ac6a`) e `<scratchpad>/eix39-sensor2` (iteração 2, M16 reaplicado em `6c72ffa`), com junction para `node_modules` removida por `rmdir` antes do `git worktree remove --force`; árvore real igual ao baseline nas duas rodadas. M1–M15 não foram reexecutados: `6c72ffa` não muda código de produção nem os testes que os matavam.

| # | File:line | Description | Killed? |
| - | --------- | ----------- | ------- |
| M1 | `supabase/migrations/20261018000200_formas_pagamento_ativas.sql:33` | Remove `where f.ativa` | ✅ Killed (3 testes MAN-28) |
| M2 | `...formas_pagamento_ativas.sql:24` | Motorista incluído na checagem de perfil | ✅ Killed (MAN-29) |
| M3 | `...formas_pagamento_ativas.sql:39` | Remove `revoke ... from public, anon` | ✅ Killed (MAN-30) |
| M4 | `...formas_pagamento_ativas.sql:34` | Remove `order by f.nome` | ✅ Killed (MAN-28) |
| M5 | `src/features/manutencao/manutencaoRepository.ts:113` | `centavosParaReais` → `valorCentavos * 0.01` | ✅ Killed (MAN-41) |
| M6 | `src/features/manutencao/schema.ts:23` | `hojeISO()` → data UTC | ✅ Killed (MAN-42) |
| M7 | `manutencaoRepository.ts:169` | Remove `abertasPrimeiro` | ✅ Killed (MAN-18) |
| M8 | `src/features/manutencao/ManutencoesListView.tsx:39-40` | Inverte os dois textos de conclusão | ✅ Killed (MAN-20, MAN-21) |
| M9 | `ManutencoesListView.tsx:142` | `loading={false}` no Concluir | ✅ Killed (MAN-22) |
| M10 | `manutencaoRepository.ts:72-73` | Remove tradução de `MN001` | ✅ Killed (MAN-13) |
| M11 | `manutencaoRepository.ts:197` | Remove a ordenação do histórico | ✅ Killed (MAN-35) |
| M12 | `schema.ts:55` | Status inicial `Pago` | ✅ Killed (MAN-04) |
| M13 | `manutencaoRepository.ts:208` | Remove `.neq('status','Inativo')` | ✅ Killed (MAN-02) |
| M14 | `schema.ts:28` | `.max(200)` → `.max(201)` | ✅ Killed (MAN-12) |
| M15 | `src/features/manutencao/ManutencaoFormView.tsx:102` | Snackbar de sucesso com tom de erro (não volta) | ✅ Killed (MAN-05) |
| M16 | `ManutencaoFormView.tsx:48` | Ignora a falha de `listarVeiculosSelecionaveis` (`const falha = !resultadoFormas.ok ? resultadoFormas : null`) | ✅ Killed na iteração 2 (1 failed / 72: "falha na carga dos veículos…"). Na iteração 1 sobreviveu (71/71) → Fix 1 |

### Iteração 3 (T9, working tree não commitado)

Sem `git worktree` (a mudança não está em HEAD) e sem `git stash`. Cópia do original em `<scratchpad>/manutencaoRepository.orig.ts`; cada mutante foi escrito no arquivo real, rodou `npx jest src/features/manutencao --selectProjects app` (baseline: 5 suítes, 74 testes verdes) e o arquivo foi restaurado da cópia num `finally`. Depois: `cmp` do arquivo com a cópia igual, `git status --porcelain` e `git diff` iguais ao baseline capturado antes do sensor.

| # | File:line | Description | Killed? |
| - | --------- | ----------- | ------- |
| M17 | `manutencaoRepository.ts:226` | Nome da RPC → `listar_formas_pagamento` | ✅ Killed (1 failed / 74: `:331`) |
| M18 | `manutencaoRepository.ts:226` | Volta ao `from('forma_pagamento').select('id, nome').eq('ativa', true).order('nome')` | ✅ Killed (4 failed / 74: os 4 testes do describe) |
| M19a | `manutencaoRepository.ts:228-230` | Remove o ramo `if (error)` | ✅ Killed (2 failed / 74: `:338`, `:347`) |
| M19b | `manutencaoRepository.ts:229` | Mensagem padrão → "Não foi possível carregar os dados. Tente novamente." | ✅ Killed (1 failed / 74: `:338`) |
| M20 | `manutencaoRepository.ts:232-236` | Remove o `safeParse` e devolve `data` cru | ✅ Killed (1 failed / 74: `:353`) |
| M21 | `manutencaoRepository.ts:229` | Ignora `traduzirErro` (42501 cai na mensagem padrão) | ✅ Killed (1 failed / 74: `:347`) |
| M22 | `manutencaoRepository.ts:236` | Inverte a lista devolvida (o app mexendo na ordem que a RPC define) | ✅ Killed (1 failed / 74: `:330`) |

**Sensor depth**: P0 (dinheiro, data, autorização no banco) — 16 mutações manuais nas iterações 1–2, mais 7 na iteração 3
**Result**: 23/23 killed — PASS ✅

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes | ✅ (Dívidas e Movimentações só trocam o import de CampoData/CampoMoeda; move aprovado na spec) |
| No scope creep | ✅ (sem edição/exclusão, sem hodômetro, `VeiculosListView` intocada) |
| Matches patterns | ✅ (`Resultado<T>`, tradução de erro no molde de `dividasRepository`, `useDadosDaTela`) |
| Sem valor visual hardcoded | ✅ (grep de hex/números: só `flex: 1` e `valorCentavos: 0`) |
| Sem `any` / `@ts-ignore` | ✅ |
| Mensagens em português, texto do Postgres nunca exposto | ✅ |
| Spec-anchored outcome check | ✅ (mensagens exatas da spec asseridas) |
| Per-layer Coverage Expectation | ✅ (ramo de erro de veículos coberto na iteração 2) |
| Every test maps to a spec requirement | ✅ (cada teste traz o comentário `MAN-NN`; os extras cobrem Zod/erro do Supabase) |
| Documented guidelines followed: `AGENTS.md`, `.claude/CLAUDE.md`, `DESIGN_CYAN.md` | ✅ |

---

## Edge Cases

- [x] MN002 / MN003 / P0002 (veículo e manutenção) / 23514 / 42501 / código desconhecido / resposta inválida
- [x] Falha na carga dos veículos → estado de erro (iteração 2, `F/ManutencaoFormView.test.tsx:221-251`)
- [x] Falha na carga das formas → estado de erro
- [x] Nenhuma forma ativa → "Nenhuma forma de pagamento ativa."
- [x] R$ 1,13 → `1.13`
- [x] Hoje às 23h30 em São Paulo

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test`
- **Iteração 3** (`d23b9f8` + working tree da T9): `typecheck` exit 0; `lint` exit 0; `test` exit 0 — projeto `app` 97 suítes / **1057 testes**; projeto `supabase` 17 suítes / **311 testes**; 0 falhas, 0 skipped. A alta frente à iteração 2 vem do merge de `origin/main` (`8858ca5`, EIX-79) e dos commits `f018a79..d23b9f8`; na pasta `manutencao`, 74 testes (72 da iteração 2 + 2 novos no describe de formas: 42501 e resposta inválida). O aviso "worker process has failed to exit gracefully" no projeto `app` não falha o gate
- **typecheck** (iteração 2): exit 0
- **lint** (iteração 2): exit 0
- **test** (iteração 2, em `6c72ffa`): exit 0 — projeto `app` 93 suítes / **936 testes** passaram; projeto `supabase` 17 suítes / **305 testes** passaram; 0 falhas, 0 skipped (iteração 1: 935 + 305; +1 = o novo caso do `it.each` de MAN-40)
- **Test count before feature**: não medido; o diff remove `placeholders.test.tsx` (2 testes do placeholder da EIX-77, substituído pelas telas reais) e move `CampoData`/`CampoMoeda` tests sem alterar asserções
- **Delta**: +5 arquivos de teste novos (72 testes na pasta `manutencao` após a iteração 2 + 9 no PGlite) e linhas novas em 2 testes de rota
- **Skipped tests**: nenhum
- **Failures**: nenhuma

---

## Fix Plans

### Fix 1: falha na carga de veículos não é testada (MAN-40) — ✅ aplicado em `6c72ffa`, verificado na iteração 2

- **Root cause**: o único teste de falha de carga (`F/ManutencaoFormView.test.tsx:220-235`) faz só `listarFormasPagamentoAtivas` falhar. O ramo `!resultadoVeiculos.ok` de `ManutencaoFormView.tsx:48` pode ser apagado sem quebrar nada (M16): a tela abriria com o seletor de veículo vazio e sem aviso.
- **Fix task**: em `ManutencaoFormView.test.tsx`, transformar o teste de MAN-40 num `it.each` com dois casos (veículos falha / formas falha), asserindo a mensagem de cada um, o botão "Tentar novamente" e a recarga (`toHaveBeenCalledTimes(2)` do mock que falhou).
- **Verify**: reaplicar M16 em scratch e confirmar que o teste fica vermelho.
- **Priority**: Minor

---

## Requirement Traceability Update

Proposta (o Verifier não edita `spec.md`):

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| MAN-01 a MAN-31, MAN-33 a MAN-42 | Verified | ✅ Verified (sem regressão na iteração 3) |
| MAN-32 | Pending | ✅ Verified (iteração 3; depende do commit da T9 e do teste manual com o Gestor) |

---

## Summary

**Overall**: ✅ Ready (iteração 3), condicionado ao commit da T9 e ao teste manual com o Gestor de Frota

**Spec-anchored check**: 42/42 requisitos com evidência completa; 0 spec-precision gaps
**Sensor**: 23/23 mutações mortas (M17–M22 novas na iteração 3)
**Gate**: typecheck ✅, lint ✅, 1057 + 311 testes verdes (iteração 3)

**Iteração 3**: o seletor de formas usa `supabase.rpc('listar_formas_pagamento_ativas')` e não lê mais a tabela. A prova de "só ativas" (MAN-03) passou do teste do repositório para a cadeia RPC no PGlite (`DB:52`) → chamada da RPC sem transformar o resultado (`F/manutencaoRepository.test.ts:330-331`) → tela (`F/ManutencaoFormView.test.tsx:112-114`).

**What works**: RPC de formas ativas (filtro, ordem, perfil, status, grants), conversão de centavos sem resíduo, data no fuso local às 23h30, reagrupamento da lista, textos de conclusão, loading por linha, tradução de todos os códigos de erro, detalhe do veículo e roteamento por perfil.

**Issues found**: nenhum pendente. Fix 1 (iteração 1) resolvido em `6c72ffa`. Lição L-025 registrada na iteração 1.

**Next steps**: commitar a T9 (`feat(manutencao): formas de pagamento pela RPC listar_formas_pagamento_ativas (EIX-39)`); teste manual com um Gestor de Frota (seletor lista as formas ativas e o registro salva); marcar MAN-32 como Verified no `spec.md`.
