# EIX-47 · US14 — Validação

## Validation: eix47-exportacao - PASS ✅

**Data**: 2026-11-23
**Spec**: `.specs/features/eix47-exportacao/spec.md`
**Diff range**: `efb8c4d..9c76e2d` (8 commits, branch `feat/eix-47-us14-exportacao`). A iteração 2 é o commit `9c76e2d`.
**Verifier**: sub-agente independente (autor ≠ verificador)

**Iteração 2: PASS.** Os 22 requisitos e os 3 edge cases têm evidência `file:line` que bate com o spec. Typecheck, lint e jest (202/202) passam. Os 4 sobreviventes da iteração 1 (M39, M55, M59, M60) agora morrem, e também os 2 mutantes novos sobre o `catch` acrescentado (M61, M62).

**Iteração 1: FAIL** (commit `a1f0e09`). 56 de 60 mutantes mortos. Os sobreviventes apontavam partes de dois ACs sem asserção:

- **EXP-10**: nome da empresa lido de `EXPO_PUBLIC_NOME_EMPRESA` (M39, M55).
- **EXP-01**: botão primário (M60) e posição abaixo do `FiltroPeriodo` (M59).

O commit `9c76e2d` acrescentou 6 testes. Também acrescentou um `catch` em `ExportarRelatorio.tsx:85-87`, que fecha a observação da iteração 1 sobre exceção inesperada.

---

## Iteração 2: o que mudou e como foi verificado

| Lacuna da iteração 1 | Teste novo (`file:line` + asserção) | Mutante | Resultado |
| --- | --- | --- | --- |
| EXP-10: `nomeDaEmpresa()` sem parâmetro lê o `.env` | `arquivo.test.ts:38-40`: `process.env.EXPO_PUBLIC_NOME_EMPRESA = 'Transportes Silva'` → `expect(nomeDaEmpresa()).toBe('Transportes Silva')`; `arquivo.test.ts:46` sem a variável → `'Eixo Certo'`; `afterEach` apaga a variável (`:33-35`) | M39 (`empresa.ts:6`, padrão `undefined`) | ✅ Morto (2 testes falham) |
| EXP-10: o componente usa o nome do `.env` no PDF | `ExportarRelatorio.test.tsx:90,98`: variável definida → `expect(html).toContain('<h1>Transportes Silva</h1>')`; o `finally` apaga a variável (`:99-101`) | M55 (`ExportarRelatorio.tsx:45`, `'Eixo Certo'` fixo) | ✅ Morto |
| EXP-01: botão primário (cyan preenchido) | `ExportarRelatorio.test.tsx:85`: `expect(botaoExportar()).toHaveStyle({ backgroundColor: colors.accent })` | M60 (`variant="ghost"`) | ✅ Morto |
| EXP-01: abaixo do `FiltroPeriodo` | `RankingView.test.tsx:406-409`: `arvore = JSON.stringify(screen.toJSON())`; `indexOf('Mês anterior') > -1`; `indexOf('Mês anterior') < indexOf('Exportar ')`; `indexOf('Exportar ') < indexOf('Gráficos ')` | M59 (Exportar movido para cima do filtro) | ✅ Morto |
| Observação: exceção inesperada sem Snackbar | Código: `catch { onFeedback(MENSAGEM_ERRO_RELATORIO, 'error') }` em `ExportarRelatorio.tsx:85-87`. Teste: `ExportarRelatorio.test.tsx:104-115`, com `mockCsv` lançando erro → `onFeedback(ERRO,'error')`, sem share, botão `{disabled:false,busy:false}` | M61 (remove o `catch`); M62 (esvazia o `finally` e libera o botão só no sucesso) | ✅ Ambos mortos |
| Edge case categoria inativa | `queries.test.ts:153-155`: `builder.select` e `builder.or` chamados com `expect.not.stringContaining('ativa')`; `data[0].categoria).toBe('Pedágio antigo')` | (efeito colateral do builder falso; agora também há asserção dedicada) | ✅ Coberto |

O `catch` é a única mudança de produção da iteração 2. Por isso o sensor rodou de novo, contra `9c76e2d`, os mutantes do componente que poderiam ser mascarados por um `catch` (M40–M42, M45–M51) e o M58. Resultado na tabela do sensor.

---

## Conclusão das tasks

| Task | Status | Observação |
| --- | --- | --- |
| T1 Dependências + ADR | ✅ Feita | `expo-print ~57.0.2`, `expo-sharing ~57.0.19`, ADR 0006, `EXPO_PUBLIC_NOME_EMPRESA=` no `.env.example` |
| T2 CSV, HTML, nome | ✅ Feita | `csv.test.ts` (18), `pdf.test.ts` (9), `arquivo.test.ts` (9) |
| T3 Consulta | ✅ Feita | `queries.test.ts` (11) |
| T4 Arquivo e Share Sheet | ✅ Feita | `compartilhar.test.ts` (10) |
| T5 ExportarRelatorio | ✅ Feita | 17 testes (iteração 2: variante primária, empresa do `.env`, exceção inesperada) |
| T6 RankingView | ✅ Feita | 4 testes novos (iteração 2: ordem filtro → Exportar → gráficos) |

---

## Checagem dos critérios de aceite contra o spec

Arquivos de teste abreviados, todos em `src/features/relatorios/export/__tests__/` salvo o último. Linhas citadas no HEAD `9c76e2d`.

| Sigla | Arquivo |
| --- | --- |
| `EX` | `ExportarRelatorio.test.tsx` |
| `CSV` | `csv.test.ts` |
| `PDF` | `pdf.test.ts` |
| `Q` | `queries.test.ts` |
| `ARQ` | `arquivo.test.ts` |
| `SH` | `compartilhar.test.ts` |
| `RV` | `src/features/dashboard/ranking/__tests__/RankingView.test.tsx` |

| Requisito | Resultado definido no spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| EXP-01 | Admin/Financeiro: botão primário "Exportar" abaixo do `FiltroPeriodo`, exportando o período em uso | `EX:85` `toHaveStyle({ backgroundColor: colors.accent })`; `EX:84,86` texto e `{disabled:false,busy:false}`; `RV:392` `getByText(\`Exportar ${dataInicial} a ${dataFinal}\`)`; `RV:396-397` acompanha a troca de mês; `RV:408-409` ordem `Mês anterior` < `Exportar ` < `Gráficos `; `EX:136` `mockBuscar).toHaveBeenCalledWith(NOVEMBRO)` | ✅ PASS |
| EXP-02 | Gestor de Frota não vê o botão | `RV:419` com `usarPerfil(true, false)`: `queryByText(/^Exportar /)).not.toBeOnTheScreen()` | ✅ PASS |
| EXP-03 | Alerta "Exportar relatório" com "Planilha (CSV)", "PDF", "Cancelar"; nada é consultado antes | `EX:124` título; `EX:125` `toEqual(['Planilha (CSV)','PDF','Cancelar'])`; `EX:126` `style).toBe('cancel')`; `EX:127` `mockBuscar).not.toHaveBeenCalled()` | ✅ PASS |
| EXP-04 | Vencimento no período ou, sem vencimento, dia local da inclusão; Pendente e Pago; páginas de 1000 até vir uma incompleta | `Q:66-70` `or` exato (UTC-3); `Q:81-82` sem `status_pagamento`, `['Pago','Pendente']`; `Q:129-133` 2 chamadas, `order('id')`, `range(0,999)`/`range(1000,1999)`, 1003 linhas; `Q:142-144` página cheia, depois a vazia | ✅ PASS |
| EXP-05 | Data asc, empate pela descrição; colunas Data DD/MM/AAAA, Descrição, Categoria, Valor, Status (Pendente / Pago / Recebido) | `Q:118` `['Água','Diesel','Pedágio','Aluguel']`; `Q:96` conversão (`dataReferencia '2026-11-30'` vinda da inclusão); `CSV:53-56` `'…;1,13;Recebido'`, `'…;-0,99;Pago'`; `CSV:44` `Pendente`; `PDF:43-46` | ✅ PASS |
| EXP-06 | BOM, `;`, CRLF, cabeçalho exato, acentos | `CSV:26` `0xfeff`; `CSV:27` cabeçalho; `CSV:33-36` CRLF sem LF solto; `CSV:44` acentos | ✅ PASS |
| EXP-07 | Vírgula decimal, sem milhar, `-` na Saída | `CSV:95-103` `'-1234,56'`, `'1234,56'`, `'1,13'`, `'-0,05'`, `'1000000,00'` | ✅ PASS |
| EXP-08 | Aspas no campo com `;`, `"`, CR, LF; aspa dobrada | `CSV:67` `'…;"Pedágio; ida e volta";"Taxa ""extra""";…'`; `CSV:68` LF; `CSV:69` CR | ✅ PASS |
| EXP-09 | Apóstrofo antes de `=`, `+`, `-`, `@`, tab, CR | `CSV:72-80` (6 casos, Descrição e Categoria); `CSV:86` texto comum sem apóstrofo | ✅ PASS |
| EXP-10 | Empresa de `EXPO_PUBLIC_NOME_EMPRESA` ("Eixo Certo" se vazio/ausente) + rótulo do período | `ARQ:40` env definido → `'Transportes Silva'`; `ARQ:46` env ausente → `'Eixo Certo'`; `ARQ:25,29` trim / `''` / `'   '`; `EX:98` `<h1>Transportes Silva</h1>` no PDF do componente; `EX:156-157` `<h1>Eixo Certo</h1>`, `Período: Novembro 2026`; `PDF:27-28` | ✅ PASS |
| EXP-11 | Três totais, de todas as linhas, uma vez, depois da última linha | `PDF:60-62` `+ R$ 1.500,00` / `− R$ 301,63` / `R$ 1.198,37`, com pendentes; `PDF:63-64` uma ocorrência; `PDF:65` depois da última `<tr class="linha">`; `PDF:74` saldo negativo | ✅ PASS |
| EXP-12 | A4 595 × 842, cabeçalho repetido, linha inteira, centenas de linhas | `SH:88` `{html, width:595, height:842}`; `PDF:126`; `PDF:85-87` 300 linhas; `PDF:88-90` `@page { size: A4;`, `thead { display: table-header-group; }`, `tr { page-break-inside: avoid; … }`. O jest só verifica o CSS; a paginação real fica para o UAT no aparelho | ✅ PASS |
| EXP-13 | Escape de `& < > " '` | `PDF:101-104`; `PDF:120` `'&amp;&lt;&gt;&quot;&#39;'` | ✅ PASS |
| EXP-14 | Nomes por mês, ano e customizado, `.csv`/`.pdf` | `ARQ:8-9`, `ARQ:13`, `ARQ:19`; `SH:61-62`; `SH:89-90`; `EX:137`, `EX:154` | ✅ PASS |
| EXP-15 | Share Sheet com mime `text/csv` / `application/pdf`; "Relatório gerado." depois que o Share Sheet fecha | `SH:116-120`, `SH:127-131`; `EX:141-142`, `EX:159-160`; `EX:175` sem feedback com o share pendente, `EX:180` depois que ele resolve; `RV:430` | ✅ PASS |
| EXP-16 | Loading e toques ignorados | `EX:171` `{disabled:true,busy:true}`; `EX:174` toque extra não abre alerta; `EX:179` liberado no fim | ✅ PASS |
| EXP-17 | Falha da consulta: mensagem genérica ou 42501 → acesso negado; sem share | `Q:161` 42501; `Q:167` genérica exata; `Q:177` erro na 2ª página; `Q:183` linha inválida; `EX:193-196` (it.each) `onFeedback(mensagem,'error')`, sem CSV, sem share, botão liberado | ✅ PASS |
| EXP-18 | Erro ao gravar CSV / gerar PDF → mensagem genérica | `SH:77`, `SH:108`; `EX:206-208` CSV; `EX:218-219` PDF; `EX:113-115` exceção inesperada → `onFeedback(ERRO,'error')`, sem share, botão liberado | ✅ PASS |
| EXP-19 | Sem compartilhamento: mensagem exata, `shareAsync` não é chamado | `SH:139-140`; `EX:229-231` só um feedback, o de erro, botão liberado | ✅ PASS |
| EXP-20 | Aviso "Nenhuma transação no período" com "Cancelar" e "Gerar mesmo assim" antes de criar arquivo | `EX:246` título; `EX:248` botões; `EX:249-250` nenhum arquivo, nenhum share | ✅ PASS |
| EXP-21 | Cancelar: nenhum arquivo, nenhum share, botão liberado | `EX:260-263`; `EX:274-275` (`onDismiss` do Android) | ✅ PASS |
| EXP-22 | "Gerar mesmo assim": só o cabeçalho (totais zerados no PDF) e compartilha | `EX:285-287` CSV `'\uFEFFData;Descrição;Categoria;Valor;Status\r\n'`, share e sucesso; `EX:298-299` PDF com `R$ 0,00`; `CSV:90`; `PDF:110-114` | ✅ PASS |

**Status**: ✅ 22/22 com evidência que bate com o spec. 0 spec-precision gaps.

---

## Edge cases

- [x] Descrição com acento, `;` ou aspas continua legível no Excel: `CSV:44`, `CSV:67`.
- [x] Categoria inativa mantém o título.
  - Teste: `Q:153-155`, `select`/`or` sem `ativa` e título `'Pedágio antigo'` preservado.
  - O RLS também não filtra `ativa`: `supabase/migrations/20260924000500_rls.sql:48-50`.
- [x] Mais de 1000 transações entram todas: `Q:129-133`.

---

## Discrimination Sensor

**Como rodou.** Em cada iteração, um worktree temporário (`git worktree add <scratchpad>/wt HEAD`) com junction de `node_modules` para o repositório principal. Cada mutante foi aplicado, testado e revertido. Comandos:

- `npx jest src/features/relatorios --selectProjects app` para os mutantes de `relatorios/export`.
- `npx jest src/features/dashboard/ranking --selectProjects app` para os da `RankingView`. Esses testes usam um stub do `ExportarRelatorio`, então não cobrem o código de `relatorios/export`.

Ao fim de cada iteração, o `git status --porcelain` do worktree estava vazio. Depois vieram junction removida, `git worktree remove --force` e `git worktree prune`. Nenhum `git stash`.

### Iteração 2 (HEAD `9c76e2d`)

| # | Arquivo | Falha injetada | Morto? |
| --- | --- | --- | --- |
| M39 | `empresa.ts:6` | Ignora `EXPO_PUBLIC_NOME_EMPRESA` (padrão `undefined`) | ✅ (`ARQ` "usa o nome do .env" + `EX` "PDF usa o nome da empresa do .env") |
| M55 | `ExportarRelatorio.tsx:45` | `empresa: 'Eixo Certo'` fixo | ✅ (`EX` "PDF usa o nome da empresa do .env") |
| M59 | `RankingView.tsx:185-190` | Exportar acima do `FiltroPeriodo` | ✅ (`RV` "o Exportar fica logo abaixo do FiltroPeriodo") |
| M60 | `ExportarRelatorio.tsx:109-114` | `variant="ghost"` | ✅ (`EX` "mostra o botão Exportar primário") |
| M61 | `ExportarRelatorio.tsx:85-87` | Remove o `catch` novo | ✅ (`EX` "erro inesperado ao montar o arquivo") |
| M62 | `ExportarRelatorio.tsx:84-91` | `finally` vazio; botão liberado só no sucesso | ✅ (6 testes falham) |
| M40–M42, M45–M51, M58 | componente / `RankingView` | Mutantes da iteração 1, rodados de novo contra o código com `catch` | ✅ 11/11 mortos (o `catch` não mascara nenhum) |

### Iteração 1 (HEAD `a1f0e09`): 56/60 mortos

Mortos: M01–M38, M40–M54, M56–M58. Eles cobriram:

- **CSV**: BOM, `;`, CRLF, aspas dobradas, CR entre aspas, apóstrofo de fórmula e tab, sinal, decimal, zero à esquerda e milhar do valor, data em ISO.
- **PDF**: escape (três variantes), totais só de Pago, sinal do saldo, `thead`, `break-inside`, A4 no CSS e no `printToFileAsync`, sinal do total de saídas, rótulo "Recebido".
- **Consulta**: parada após 1 página, página de 999, `<=`, `range` com uma linha a mais, ordem por `id`, desempate, direção e ausência da ordenação, dia local da inclusão, 42501, limite final do período.
- **Nome do arquivo**: os três modos; padrão do nome da empresa com `''`.
- **Componente e share**: aviso de vazio (sem aviso, Cancelar, voltar do Android), `isAvailableAsync`, loading preso, `loading={false}`, sucesso apesar da falha do share, sucesso antes do share fechar, consulta antes do formato, rótulo do CSV, share após erro da busca e do arquivo, mime type, sobrescrita do cache, PDF movido.
- **RankingView**: Exportar visível para o Gestor de Frota, `onFeedback` descartado, período fixo.

Sobreviveram M39, M55, M59 e M60. Os quatro morrem na iteração 2.

**Profundidade**: expandida. É caminho de dados financeiros, então foram ≥5 mutantes por camada.
**Resultado final**: na iteração 2, 17/17 mortos. São os 4 sobreviventes da iteração 1, os 2 novos (M61, M62) e os 11 mutantes do componente rodados de novo. Somando as duas iterações, nenhum sobrevivente em aberto. ✅ PASS

---

## Code Quality

| Princípio | Status |
| --- | --- |
| Código mínimo, sem abstração de uso único | ✅ |
| Mudanças cirúrgicas | ✅ Na iteração 2, só testes e o `catch` (3 linhas + import), que já tinha sido apontado como observação na iteração 1 |
| Sem escopo extra | ✅ Sem nova RPC, migration, primitivo ou token; `src/ui/` não foi tocado |
| Segue os padrões do projeto | ✅ `Resultado<T>`, `ehAcessoNegado`, Zod na resposta, alerta no padrão do `AnexoComprovante` |
| Sem `any` / `@ts-ignore` | ✅ |
| Sem valor visual fixo na tela | ✅ O componente usa só primitivos. O CSS do PDF tira cor, espaçamento e fonte dos tokens (`pdf.ts:49-67`). Ficam fixos o `1px` (hairline do DESIGN_CYAN), `margin: 0` e `font-weight: 400/500` |
| Mensagens em português | ✅ `queries.ts:12`, `compartilhar.ts:11`, `ExportarRelatorio.tsx:28,84,86` |
| Um único cyan preenchido na aba | ✅ O `Exportar` é o único `Button` primário: `FiltroPeriodo.tsx:113` é `ghost`, `:118,128` são `icon`, e o botão do `EmptyState` é `ghost`. Agora há teste (`EX:85`). Os tons dos gráficos (EIX-45) são cor de dado |
| Asserções batem com o spec | ✅ 22/22 |
| Todo teste corresponde a AC, edge case ou Done-when | ✅ |
| Diretrizes: `AGENTS.md` §2.1/§2.5, `.claude/CLAUDE.md` §8, `DESIGN_CYAN.md` | ✅ |

---

## Gate Check

Rodado primeiro na árvore real (`C:\dev\eixo-app`, HEAD `9c76e2d`). Durante a verificação, às 09:40:38, a árvore real trocou de branch para `fix/eix-93-sync-reenvio-abertura`. Para que o resultado do gate não dependa do momento da troca, os três comandos rodaram de novo num worktree fixado em `9c76e2d` (`npx tsc --noEmit`, `npx expo lint`, jest). O resultado foi o mesmo:

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npx jest src/features/relatorios src/features/dashboard --selectProjects app` | **16 suítes, 202/202, 0 falhas, 0 pulados** |
| `npm run test` completo (PGlite) | **não rodado**, por orientação do orquestrador. O diff não tem migration nem teste de banco |

- **Contagem de testes**: iteração 1 tinha 196; iteração 2 tem 202 (+6). Desde o início da feature são +78: 74 em `relatorios` e 4 na `RankingView`. Nenhum teste removido ou enfraquecido: o diff de `9c76e2d` só renomeia um título e acrescenta asserções.
- **Ruído**: aviso `not wrapped in act(...)` vindo de `src/lib/useDadosDaTela.ts:46` nos testes do dashboard. É só aviso, e o arquivo está fora do diff.

---

## Lacunas

Nenhuma lacuna bloqueante.

UAT recomendado no aparelho, porque o jest não renderiza PDF nem abre o Share Sheet:

- abrir o CSV no Excel pt-BR;
- conferir que um PDF com cerca de 300 linhas sai em várias páginas com o cabeçalho repetido.

---

## Lições (não gravadas nesta rodada)

Por orientação do orquestrador, o `lessons.py` não foi executado nesta rodada. As três lições da iteração 1 (L-032 a L-034) foram descartadas quando ele restaurou `.specs/lessons.json`. As lições que seriam gravadas, com sinal `surviving_mutant` da iteração 1:

1. *"When a value comes from an EXPO_PUBLIC_ env var, test with the variable set in process.env, not only via an injected parameter"*. Fonte: M39/M55, `src/features/relatorios/export/empresa.ts:6`. Escopo: `config-env`.
2. *"When the spec says a button is primary, assert its variant style in the component test"*. Fonte: M60, `src/features/relatorios/export/ExportarRelatorio.tsx:106` (linha da iteração 1). Escopo: `ui-components`.
3. *"When the spec fixes where an element sits on a screen, assert its order relative to the neighbor element"*. Fonte: M59, `src/features/dashboard/ranking/RankingView.tsx:185`. Escopo: `screens`.

---

## Rastreabilidade dos requisitos

| Requisito | Status anterior | Status novo |
| --- | --- | --- |
| EXP-01 | ❌ Needs Fix (iteração 1) | ✅ Verified |
| EXP-02 a EXP-09 | ✅ Verified | ✅ Verified |
| EXP-10 | ❌ Needs Fix (iteração 1) | ✅ Verified |
| EXP-11 a EXP-22 | ✅ Verified | ✅ Verified |

---

## Resumo

**Overall**: ✅ Ready, com UAT de aparelho recomendado para o PDF e o Excel.

| Item | Resultado |
| --- | --- |
| Spec-anchored check | 22/22 ACs batem com o resultado do spec; 0 spec-precision gaps; 3/3 edge cases |
| Sensor | iteração 1: 56/60; iteração 2: 17/17 (M39, M55, M59, M60, M61, M62 e 11 mutantes do componente rodados de novo) |
| Gate | typecheck ✅, lint ✅, jest 202/202 ✅ |
