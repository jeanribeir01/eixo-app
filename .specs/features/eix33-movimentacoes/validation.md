# EIX-33 · US03 Movimentações — Validation

**Date**: 2026-10-04
**Spec**: `.specs/features/eix33-movimentacoes/spec.md`
**Diff range**: `6db7cb9^..9f39e93` (branch `feat/eix-33-us03-movimentacoes`, 16 commits; iteração 0 em `1ae7c98`, iteração 1 em `60fc53f`)
**Verifier**: independent sub-agent (author ≠ verifier)
**Verdict**: PASS (re-verificação 2 de 3)

---

## Re-verificação 2 (iteração 2 de 3) — `60fc53f..9f39e93`

**Commit**: `9f39e93` test: `jest.global-setup.js` define `process.env.TZ = 'America/Sao_Paulo'` no processo pai, antes dos workers (`package.json:50`, `"globalSetup"` de nível superior, vale para os projetos app e supabase); `dataDeReferencia.test.ts` não mexe mais no fuso.

| Item | Evidência | Resultado |
| ---- | --------- | --------- |
| Fix 1b — MOV-08 AC1 data local sem vencimento, portável para o CI | `src/features/movimentacoes/__tests__/dataDeReferencia.test.ts` - `expect(dataDeReferencia({data_vencimento: null, data_inclusao: '2026-11-01T01:00:00Z'})).toBe('2026-10-31')`; fuso definido em `jest.global-setup.js:5` | ✅ PASS |

### Sensor (scratch `git worktree` em `9f39e93`, **todas as execuções com `TZ=UTC`**, simulando o `ubuntu-latest`)

| # | Mutação | Resultado |
| - | ------- | --------- |
| controle | nenhuma (código correto) | ✅ `src/features/movimentacoes`: 72/72 passam |
| M11 | `dataDeReferencia` → `data_inclusao.slice(0, 10)` | ✅ Killed (1 falha) |
| M11b | `dataDeReferencia` → `toISOString().slice(0, 10)` | ✅ Killed (1 falha) |

Agora o controle passa e os mutantes falham no mesmo ambiente: o teste discrimina. Depois da limpeza, o porcelain da árvore real ficou igual ao baseline (` M package-lock.json` + `.specs/LESSONS.md`, `.specs/lessons.json`, `validation.md` não rastreados).

**Sensor acumulado**: M1–M10 mortos (iteração 0) + M11/M11b mortos sob UTC → 12/12 killed.

### Gate

- Scratch com `TZ=UTC npm test`: app 49 suítes / 394 testes, supabase 9 suítes / 77 testes, 0 falhas.
- Árvore real: typecheck exit 0 (`router.d.ts` movido e restaurado); lint exit 0; `npm test` 394 + 77 passados, 0 falhas, 0 skips.

**Veredito da re-verificação 2**: PASS ✅ — Fix 1b resolvido; Fix 2 continua resolvido. Observação menor que fica (sem mudança, fora da spec): a mensagem do 42501 diz "registrar" também ao listar e ao excluir.

---

## Re-verificação 1 (iteração 1 de 3) — `1ae7c98..60fc53f`

**Commits**: `629e905` test(movimentacoes): `dataDeReferencia.test.ts`; `60fc53f` fix(movimentacoes): rótulo "Valor (R$)".

| Item | Evidência | Resultado |
| ---- | --------- | --------- |
| Fix 2 — MOV-01 AC1 rótulo "Valor (R$)" | `src/features/movimentacoes/camposMovimentacao.ts:18` - `rotulo: 'Valor (R$)'`; `MovimentacaoFormView.test.tsx:91` - `getByLabelText('Valor (R$)')).toBeOnTheScreen()`; `:223` - `toHaveDisplayValue('R$ 80,00')` | ✅ PASS |
| Fix 1 — MOV-08 AC1 data local sem vencimento | `src/features/movimentacoes/__tests__/dataDeReferencia.test.ts:21` - `expect(dataDeReferencia({data_vencimento: null, data_inclusao: '2026-11-01T01:00:00Z'})).toBe('2026-10-31')` | ❌ GAP: o teste depende do fuso da máquina |

### Sensor (scratch `git worktree` em `60fc53f`; porcelain igual ao baseline após a limpeza)

| # | Ambiente | Mutação | Resultado |
| - | -------- | ------- | --------- |
| M11 | máquina local (America/Sao_Paulo) | `dataDeReferencia` → `data_inclusao.slice(0, 10)` | ✅ Killed |
| M11b | máquina local | `dataDeReferencia` → `toISOString().slice(0, 10)` | ✅ Killed |
| controle | `TZ=UTC`, **código sem mutação** | — | ❌ `dataDeReferencia.test.ts:21` falha: Expected "2026-10-31", Received "2026-11-01" |

Sob `TZ=UTC` os mutantes também "morrem", mas o código correto falha do mesmo jeito, então essa morte não discrimina nada.

**Causa raiz**: `dataDeReferencia.test.ts:7-9` faz `process.env.TZ = 'America/Sao_Paulo'` dentro do teste. Em Node puro a troca vale em tempo de execução, mas o ambiente do Jest (sandbox `jest-expo`) expõe uma cópia de `process.env`, e o fuso do processo não muda. O teste só passa porque esta máquina já está em America/Sao_Paulo. O CI (`.github/workflows/ci.yml:36`, `runs-on: ubuntu-latest`, fuso UTC, `npm run test -- --ci` em `:44`) vai **falhar com o código correto**.

### Fix 1b (Blocker para o CI)

- **Fix task**: definir o fuso antes de o worker do Jest subir, não dentro do teste. Exemplos: `"test": "cross-env TZ=America/Sao_Paulo jest"` (exige dependência nova, confirmar com o usuário), `env: TZ: America/Sao_Paulo` no job de teste do `ci.yml` (mexer em CI exige autorização, AGENTS.md §4) ou um `globalSetup` do Jest que faça `process.env.TZ = ...` (roda no processo pai antes dos workers). Também dá para tornar o teste independente do fuso: calcular o esperado com `dataLocalISO(new Date(instante))` e escolher o instante de forma que a data local e a UTC sejam diferentes no fuso em que o teste está rodando.
- **Done when**: `TZ=UTC npx jest --selectProjects app --testPathPattern dataDeReferencia` passa com o código correto **e** falha com o M11.

### Gate (árvore real, `60fc53f`)

typecheck exit 0 (`router.d.ts` movido e restaurado); lint exit 0; `app` 49 suítes / 394 testes passados; `supabase` 9 suítes / 77 testes passados; 0 falhas. Verde **só nesta máquina** — ver Fix 1b.

**Veredito da re-verificação**: FAIL ❌ — Fix 2 resolvido; Fix 1 virou Fix 1b (o teste existe, mas não é portável para o CI).

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1–T11 | ✅ Done | Evidência abaixo |
| T12 | ✅ Done | O teste ficou em `src/navigation/__tests__/FinanceiroRoute.test.tsx` (tasks.md citava `ModuloEmBreveView.test.tsx`); cobre o atalho do mesmo jeito |

---

## Spec-Anchored Acceptance Criteria

### P1: Lançar movimentação (MOV-01..MOV-05)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| AC1 campos e default | Valor (R$), Descrição, Categoria, Forma, Vencimento, Status = Pendente | `src/features/movimentacoes/__tests__/MovimentacaoFormView.test.tsx:91-97` - `getByLabelText('Valor')`… `getByRole('tab',{name:'Pendente'})).toBeSelected()` | ⚠️ Spec-precision gap: rótulo implementado é "Valor", a spec diz "Valor (R$)" |
| AC2 salvar → 1 linha, "Movimentação registrada.", volta | insert + Snackbar + `router.back()` | `MovimentacaoFormView.test.tsx:174-184` - `expect(mockCriar).toHaveBeenCalledWith({...})`, `getByText('Movimentação registrada.')`, `expect(mockBack).toHaveBeenCalled()`; `movimentacoesRepository.test.ts:190` - `query.insert` com o objeto exato | ✅ PASS |
| AC3 não envia data_inclusao/data_atualizacao | payload sem os dois campos | `movimentacoesRepository.test.ts:190-198` - `toHaveBeenCalledWith` com objeto exato (sem as chaves) | ✅ PASS |
| AC4 `1234` → `R$ 12,34` | texto exibido `R$ 12,34` | `CampoMoeda.test.tsx:356` - `onChange(1234)`; `:362` - `toHaveDisplayValue('R$ 12,34')`; `money.test.ts:24` | ✅ PASS |
| AC5 valor vazio/zero | "Informe um valor maior que zero." | `schema.test.ts:313`; `MovimentacaoFormView.test.tsx:134` | ✅ PASS |
| AC6 descrição vazia após trim | "Informe a descrição." | `schema.test.ts:317` (`'   '`); `MovimentacaoFormView.test.tsx:135` | ✅ PASS |
| AC7 sem categoria / sem forma | "Escolha a categoria." / "Escolha a forma de pagamento." | `schema.test.ts:328,332`; `MovimentacaoFormView.test.tsx:136-138` (+ `mockCriar` não chamado) | ✅ PASS |
| AC8 Pago mostra data de pagamento | campo visível só com Pago | `MovimentacaoFormView.test.tsx:97` (oculto em Pendente), `:115`, `:124` | ✅ PASS |
| AC9 Pago sem data | "Informe a data de pagamento." | `schema.test.ts:336`; `MovimentacaoFormView.test.tsx:148-149` | ✅ PASS |
| AC10 data inválida | "Data inválida. Use DD/MM/AAAA." | `schema.test.ts:342,345`; `MovimentacaoFormView.test.tsx:159` | ✅ PASS |
| AC11 "Hoje" | data local atual | `CampoData.test.tsx:328-334` - relógio 05/10 23:30 local → `'05/10/2026'` | ✅ PASS |
| AC12 só itens ativos; categoria mostra tipo | inativos filtrados; "Entrada"/"Saída" | `movimentacoesRepository.test.ts:293`; `MovimentacaoFormView.test.tsx:105-106` | ✅ PASS |
| AC13 "Recebido" (Entrada) / "Pago" (Saída) | rótulos exatos | `schema.test.ts:352-358` (`rotuloStatus`); `MovimentacaoFormView.test.tsx:113,122` | ✅ PASS |
| AC14 erro mantém form, para loading, 42501 traduzido | "Você não tem permissão para registrar movimentações." | `MovimentacaoFormView.test.tsx:194-197`; `movimentacoesRepository.test.ts:203` | ✅ PASS |
| AC15 loading e ignora toque repetido | busy + 1 chamada | `MovimentacaoFormView.test.tsx:208-210` - `toBeBusy()`, `toHaveBeenCalledTimes(1)` | ✅ PASS |

### P1: Banco garante as invariantes (MOV-06, MOV-07)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| AC1 valor ≤ 0 | 23514 em insert e update | `supabase/tests/movimentacao_regras.test.ts:336,346,360` - `expect(codigo).toBe('23514')`; caso permitido `:372` (0,01) | ✅ PASS |
| AC2 Pago sem data | 23514 | `movimentacao_regras.test.ts:386,398` | ✅ PASS |
| AC3 delete de parcela | 0 linhas, parcela preservada | `movimentacao_regras.test.ts:422-424`; caso permitido `:410` | ✅ PASS |
| AC4 Motorista/Gestor sem acesso | 0 linhas na leitura; escrita rejeitada | `movimentacao_regras.test.ts:432` (select 0), `:447` (42501), `:460` (update/delete 0) | ✅ PASS |

### P1: Listar e filtrar (MOV-08, MOV-09)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| AC1 mês atual por vencimento ou inclusão (fuso local) | filtro `.or()` + data de referência local | `MovimentacoesListView.test.tsx:93` - `listar(2026,10)`; `movimentacoesRepository.test.ts:102`; `datas.test.ts:101` | ❌ GAP parcial: o filtro é testado, mas `dataDeReferencia` (data exibida e ordenação de lançamento sem vencimento) não é discriminada em fuso local - mutante M11 sobreviveu |
| AC2 ‹ › e nome do mês | "Setembro 2026", "Novembro 2026", virada de ano | `MovimentacoesListView.test.tsx:100-106,116-117` | ✅ PASS |
| AC3 abas de tipo | só o tipo escolhido | `MovimentacoesListView.test.tsx:141-147` | ✅ PASS |
| AC4 abas de status | só o status escolhido | `MovimentacoesListView.test.tsx:153-159` | ✅ PASS |
| AC5 linha: descrição, categoria, DD/MM, rótulo, `+ R$ 1.500,00` / `− R$ 80,00` | textos exatos | `MovimentacoesListView.test.tsx:167-168,174-175` | ✅ PASS (data só exercitada com vencimento — ver AC1) |
| AC6 carregando / erro "Tentar novamente" / vazio "Nova movimentação" | três estados | `MovimentacoesListView.test.tsx:90,182-185,192-194` | ✅ PASS |
| AC7 cor só no valor, com sinal | cor no texto do valor | `MovimentacoesListView.test.tsx:167-168` - `toHaveStyle({color: colors.success/danger})` no texto com sinal | ✅ PASS (ausência de cor no resto da linha não é afirmada; risco baixo) |

### P1: Editar e excluir (MOV-10, MOV-11)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| AC1 Editar abre form preenchido | rota de edição + valores | `MovimentacoesListView.test.tsx:208`; `MovimentacaoFormView.test.tsx:223-226` | ✅ PASS |
| AC2 salvar edição | update + "Movimentação atualizada."; `data_atualizacao` pelo trigger | `MovimentacaoFormView.test.tsx:230-239`; `movimentacoesRepository.test.ts:220`; trigger: `supabase/tests/financeiro.test.ts:135` (pré-existente) | ✅ PASS |
| AC3 confirmação | "Excluir movimentação?" com Cancelar/Excluir | `MovimentacoesListView.test.tsx:218` | ✅ PASS |
| AC4 confirmar exclui e mostra "Movimentação excluída." | linha some + Snackbar | `MovimentacoesListView.test.tsx:224-226` | ✅ PASS |
| AC5 cancelar mantém | linha intacta | `MovimentacoesListView.test.tsx:239-240` | ✅ PASS |
| AC6 parcela sem Excluir, caption "Parcela de dívida" | botão ausente + texto | `MovimentacoesListView.test.tsx:260-261` | ✅ PASS |
| AC7 categoria/forma inativa mantida | mostra e grava o id antigo | `MovimentacaoFormView.test.tsx:225,230-233` (`categoriaId: 'cat-antiga'`) | ✅ PASS |

**Status**: ❌ 1 gap parcial (MOV-08 AC1) + ⚠️ 1 spec-precision gap (MOV-01 AC1)

---

## Edge Cases

- [x] Id inexistente → "Movimentação não encontrada." + Voltar — `MovimentacaoFormView.test.tsx:246-248`; `movimentacoesRepository.test.ts:180`
- [x] Sem opção ativa → "Nenhuma opção cadastrada." — `MovimentacaoFormView.test.tsx:259`; o bloqueio do salvar é provado pelo form vazio (`:136-138`), não no mesmo cenário
- [x] 31/02/2026 → "Data inválida. Use DD/MM/AAAA." — `datas.test.ts:66`; `schema.test.ts:342`; `MovimentacaoFormView.test.tsx:156-159`
- [x] Troca de mês com pedido em voo → só o último — `MovimentacoesListView.test.tsx:131-133` (mutante M4 morto)

---

## Discrimination Sensor

Scratch: `git worktree` temporário com `node_modules` por junction (junction removida antes do worktree). Baseline `git status --porcelain` = ` M package-lock.json`; após limpeza, idêntico.

| # | File:line | Description | Killed? |
| - | --------- | ----------- | ------- |
| M1 | `supabase/migrations/20261004000100_movimentacao_regras.sql:7` | `valor > 0` → `valor >= 0` | ✅ Killed (2 falhas) |
| M2 | `supabase/migrations/20261004000100_movimentacao_regras.sql:14` | removido `and divida_id is null` | ✅ Killed |
| M3 | `src/features/movimentacoes/types.ts:30` | `rotuloStatus` sempre "Pago" | ✅ Killed (5 falhas) |
| M4 | `src/features/movimentacoes/MovimentacoesListView.tsx:61` | removida guarda `ultimoPedido` | ✅ Killed |
| M5 | `src/features/movimentacoes/schema.ts:34` | Pago não exige data de pagamento | ✅ Killed (3 falhas) |
| M6 | `src/lib/money.ts:20` | sem separador de milhar | ✅ Killed (3 falhas) |
| M7 | `src/features/movimentacoes/MovimentacoesListView.tsx:194` | "Excluir" visível também para parcela | ✅ Killed |
| M8 | `src/features/movimentacoes/movimentacoesRepository.ts:167` | categorias sem filtro `ativa` | ✅ Killed |
| M9 | `src/features/movimentacoes/MovimentacoesListView.tsx:39` | saída sem o sinal `−` | ✅ Killed |
| M10 | `src/features/movimentacoes/MovimentacaoFormView.tsx:109` | removido `if (salvando) return` | ✅ Killed |
| M11 | `src/features/movimentacoes/movimentacoesRepository.ts:66` | `dataDeReferencia` usa a data UTC (`data_inclusao.slice(0,10)`) em vez da data local | ❌ Survived → Fix 1 |

**Sensor depth**: P0-ampliado (≥5 mutações; integridade de dados financeiros)
**Result**: iteração 0: 10/11 killed (M11 sobreviveu); acumulado após a re-verificação 2: 12/12 killed (M11 e M11b mortos sob TZ=UTC) - PASS ✅

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes (diff só adiciona; única linha removida é um comentário em `app/(app)/_layout.tsx`) | ✅ |
| No scope creep | ✅ |
| Matches patterns (Categorias / Formas de Pagamento) | ✅ |
| Spec-anchored outcome check | ⚠️ MOV-01 AC1 rótulo "Valor" ≠ "Valor (R$)" |
| Per-layer Coverage Expectation | ❌ `dataDeReferencia` sem caso de fuso (M11) |
| Every test maps to a spec requirement | ✅ |
| Documented guidelines followed: `AGENTS.md` §2.5, `.claude/CLAUDE.md` §5/§8, `tasks.md` Test Coverage Matrix | ✅ |

Observação menor (não bloqueia): `traduzirErro` devolve "Você não tem permissão para **registrar** movimentações." também em listar/excluir (`movimentacoesRepository.ts:44`). A spec só fixa a frase para o salvar.

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm test` (typecheck com `.expo/types/router.d.ts` movido temporariamente e restaurado)
- **Result**: typecheck exit 0; lint exit 0; `app` 48 suítes / 392 testes passados; `supabase` 9 suítes / 77 testes passados; 0 falhas, 0 skips
- **Test count before feature**: não medido diretamente
- **Delta**: só adições (`git diff --stat`: 3441 inserções, 1 deleção — comentário); nenhum teste removido ou enfraquecido
- **Skipped tests**: nenhum
- **Failures**: nenhuma

---

## Fix Plans

### Fix 1: `dataDeReferencia` não é testada em fuso local (M11)

- **Root cause**: todos os casos de teste de lista usam `data_vencimento` preenchido ou `data_inclusao` ao meio-dia UTC, quando a data UTC e a local coincidem. Trocar a conversão local por UTC passa despercebido; um lançamento sem vencimento criado às 22h de 31/10 (Brasília) apareceria como "01/11" e fora de ordem.
- **Fix task**: em `src/features/movimentacoes/__tests__/movimentacoesRepository.test.ts` (ou um teste próprio de `dataDeReferencia`), afirmar que `dataDeReferencia({ data_vencimento: null, data_inclusao: '2026-11-01T01:00:00Z' })` devolve `'2026-10-31'` com o fuso `America/Sao_Paulo` — fixar o fuso no teste (ex.: `process.env.TZ` no `jest` config/globalSetup, ou calcular o esperado com `new Date(...).getDate()` locais), porque o CI pode rodar em UTC. Opcional: uma linha sem vencimento em `MovimentacoesListView.test.tsx` conferindo "31/10".
- **Done when**: M11 morto; suíte verde local e no CI.
- **Priority**: Major

### Fix 2: rótulo "Valor" vs "Valor (R$)" (spec-precision)

- **Root cause**: a spec (MOV-01 AC1) nomeia o campo "Valor (R$)"; `camposMovimentacao.ts:18` usa "Valor" (o placeholder `R$ 0,00` indica a moeda).
- **Fix task**: decidir com o time: ou trocar o rótulo para "Valor (R$)" e ajustar os testes, ou corrigir a spec para "Valor". Pergunta para a pessoa, não para o implementador decidir sozinho.
- **Priority**: Minor

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| MOV-01 | Implementing | ✅ Verified (rótulo corrigido em 60fc53f) |
| MOV-02 | Implementing | ✅ Verified |
| MOV-03 | Implementing | ✅ Verified |
| MOV-04 | Implementing | ✅ Verified |
| MOV-05 | Implementing | ✅ Verified |
| MOV-06 | Implementing | ✅ Verified |
| MOV-07 | Implementing | ✅ Verified |
| MOV-08 | Implementing | ✅ Verified (Fix 1b em 9f39e93; provado com TZ=UTC) |
| MOV-09 | Implementing | ✅ Verified |
| MOV-10 | Implementing | ✅ Verified |
| MOV-11 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready — após a re-verificação 2, todos os gaps foram fechados

**Spec-anchored check**: 32/34 critérios com saída exata da spec; 1 gap parcial (MOV-08 AC1), 1 spec-precision gap (MOV-01 AC1)
**Sensor**: 10/11 mutations killed
**Gate**: 469 passed (392 app + 77 supabase), 0 failed; typecheck e lint verdes

**What works**: regras do banco (valor > 0, Pago com data, parcela não excluível, RLS por perfil) com casos negado e permitido; schema com todas as mensagens da spec; lista com mês, filtros, sinal e cor, guarda de resposta antiga; edição com categoria inativa; exclusão com confirmação.

**Issues found**: M11 sobreviveu (data de referência local sem teste); rótulo "Valor (R$)".

**Next steps**: executar Fix 1 (e decidir Fix 2), depois re-verificar.
