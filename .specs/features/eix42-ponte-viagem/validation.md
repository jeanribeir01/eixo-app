# EIX-42 · US09 — Ponte Caixa ↔ Viagens — Validação

**Verdict**: PASS
**Result**: PASS

**Data**: 2026-11-11 (rodada 2 de re-verificação)
**Spec**: `.specs/features/eix42-ponte-viagem/spec.md`
**Diff range**: `4bd80b4..4ae1e4c` (branch `feat/eix-42-us09-integracao-viagem-caixa`, 9 commits; a correção da rodada 1 está em `4ae1e4c`)
**Verifier**: sub-agente independente (autor ≠ verificador)

## Histórico

| Rodada | Commit | Veredito | Sensor | Motivo |
| --- | --- | --- | --- | --- |
| 1 | `e73ef16` | FAIL | 16/21 | Sobreviveram M3 (ordem), M11/M13 (mensagens do seletor), M18 (revoke do `anon`, porque o stub do PGlite não dá `execute` em função ao `anon`) e M21 (parâmetro da rota) |
| 2 | `4ae1e4c` | **PASS** | 13/13 nesta rodada; os 5 sobreviventes da rodada 1 agora morrem | Os gaps G1–G5 e G7 (loading) foram fechados nos testes. G6 foi resolvido ajustando a spec |

---

## Conclusão das tarefas

| Task | Status | Observação |
| --- | --- | --- |
| T1 Migration | ✅ Done | ACESSO-04 e ordem agora discriminados |
| T2 Tipos | ✅ Done | Gerados, não avaliados |
| T3 Select | ✅ Done | - |
| T4 Repositório da ponte | ✅ Done | Import de `viagens/types` agora previsto na spec |
| T5 Schema/repositório | ✅ Done | - |
| T6 Formulário | ✅ Done | Casos de borda do seletor testados no formulário |
| T7 Detalhe | ✅ Done | Loading do Desvincular testado |
| T8 Lista e hub | ✅ Done | Guard das rotas testado |

---

## Critérios de aceite ancorados na spec

### P1 — Vincular e desvincular (PONTE)

| ID | Resultado definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| PONTE-01 | Campo "Vincular à viagem" com "Sem viagem" | `src/features/movimentacoes/__tests__/MovimentacaoFormView.test.tsx:492`: `toHaveTextContent('Sem viagem')` | ✅ |
| PONTE-02 | EmAndamento + Finalizada ≤30 dias, em andamento primeiro, rótulo "PLACA · Origem/UF → Destino/UF" | `supabase/tests/ponte_viagem.test.ts:230-235`: `toEqual([andamento, semFim, recente, limite29])`. A em andamento começou há 35 dias; ficam fora a de 31 e a de 40 dias e a cancelada. `src/features/ponte-viagem/__tests__/ponteRepository.test.ts:68`: `toBe('ABC1D23 · São Paulo/SP → Curitiba/PR')`; `MovimentacaoFormView.test.tsx:501-502` | ✅ |
| PONTE-03 | Filtra pelo rótulo, sem diferenciar maiúsculas e acentos | `src/ui/__tests__/Select.test.tsx:126-129` (`'sao paulo'`); `MovimentacaoFormView.test.tsx:511-514` | ✅ |
| PONTE-04 | Grava `viagem_id` para qualquer categoria | `MovimentacaoFormView.test.tsx:525`: `objectContaining({ categoriaId: 'cat-frete', viagemId: 'v-1' })`, e Combustível em `:673-675`; `movimentacoesRepository.test.ts:220`: `insert` com `viagem_id: 'v-1'`; `ponte_viagem.test.ts:184-187` (Frete/Pedágio no banco) | ✅ |
| PONTE-05 | "Sem viagem" grava `viagem_id = null` e mantém o lançamento | `MovimentacaoFormView.test.tsx:561`: `mockAtualizar('mov-1', objectContaining({ viagemId: null }))`; `movimentacoesRepository.test.ts:253`; `Select.test.tsx:192-193` | ✅ |
| PONTE-06 | Sem viagem grava `viagem_id = null` | `MovimentacaoFormView.test.tsx:298-310`: `{... viagemId: null, litros: null }`; `schema.test.ts:131` | ✅ |
| PONTE-07 | Viagem fora da lista mostra o rótulo dela | `MovimentacaoFormView.test.tsx:573-576`: `mockBuscarViagem('v-velha')` + `toHaveTextContent('OLD1A11 · São Paulo/SP → Curitiba/PR')` | ✅ |
| PONTE-08 | Parâmetro `viagemId` abre com a viagem escolhida | `__tests__/routes/novaMovimentacaoRoute.test.tsx:30`: `getByText('viagemIdInicial=v-2')`; `MovimentacaoFormView.test.tsx:585,589`: rótulo BH + `objectContaining({ viagemId: 'v-2' })` | ✅ |
| PONTE-09 | Falha nas viagens → erro de carga com "Voltar" | `MovimentacaoFormView.test.tsx:616-617` | ✅ |

### P1 — Litros (LITROS)

| ID | Resultado definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| LITROS-01 | Campo "Quantidade em litros" visível em Combustível | `MovimentacaoFormView.test.tsx:632` | ✅ |
| LITROS-02 | Escondido fora de Combustível e grava `litros = null` | `MovimentacaoFormView.test.tsx:629,635` (some), `:688` (`litros: null`); `schema.test.ts:167` | ✅ |
| LITROS-03 | "Informe a quantidade em litros." e não salva | `MovimentacaoFormView.test.tsx:647-648`; `schema.test.ts:136` | ✅ |
| LITROS-04 | Mensagem exata da faixa/casas decimais e não salva | `schema.test.ts:158` (it.each com 7 entradas inválidas); `MovimentacaoFormView.test.tsx:660-661` | ✅ |
| LITROS-05 | `23514` para litros fora de Combustível e para Combustível vinculado sem litros | `ponte_viagem.test.ts:145` (frete/pedágio), `:152` (insert), `:163` (update), `:214` (Financeiro pela API): `toBe('23514')` | ✅ |
| LITROS-06 | `litros <= 0` → `23514` | `ponte_viagem.test.ts:140`: `it.each([0, -1])` → `toBe('23514')` | ✅ |

### P1 — Detalhe (DETALHE)

| ID | Resultado definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| DETALHE-01 | Hub → lista com as viagens do seletor; o toque abre o detalhe | `src/navigation/__tests__/FinanceiroHubView.test.tsx:118`; `ViagensLancamentosListView.test.tsx:65-67`, `:76`: `push('/viagens/v-2')` | ✅ |
| DETALHE-02 | Placa, rota, status e início num cartão de destaque | `ViagemLancamentosView.test.tsx:77` (placa), `:96-97` | ✅ para o conteúdo. ⚠️ cosmético: o `Card variant="feature"` não tem asserção, e o coordenador aceitou isso |
| DETALHE-03 | Seções "Entradas"/"Saídas", com descrição, categoria e valor com `+`/`−` | `ViagemLancamentosView.test.tsx:105-122`: blocos por `within`, `'+ R$ 8.500,00'`, `'− R$ 2.450,50'`, `'Combustível · 412,5 L'` | ✅ |
| DETALHE-04 | `viagem_id = null`, a linha sai, "Lançamento desvinculado.", com loading | `ViagemLancamentosView.test.tsx:134-137`, `:151`: `toBeBusy()`; `ponteRepository.test.ts:192-194`: `update({ viagem_id: null })` | ✅ |
| DETALHE-05 | Mantém a linha e mostra "Não foi possível desvincular. Tente novamente." | `ViagemLancamentosView.test.tsx:162-163`; `ponteRepository.test.ts:201-204`, `:211-214` | ✅ |
| DETALHE-06 | "Nenhum lançamento vinculado" + "Nova movimentação" com a viagem | `ViagemLancamentosView.test.tsx:171-174`: `push({ pathname: '/movimentacoes/nova', params: { viagemId: 'v-1' } })` | ✅ |
| DETALHE-07 | Carregando; erro com "Tentar novamente" | `ViagemLancamentosView.test.tsx:183`, `:191-195` | ✅ |
| DETALHE-08 | O toque na linha abre a edição | `ViagemLancamentosView.test.tsx:204` | ✅ |
| DETALHE-09 | "Ver viagem" abre o detalhe | `MovimentacaoFormView.test.tsx:598-600`: `push('/viagens/v-1')` | ✅ |

### P1 — Acesso (ACESSO)

| ID | Resultado definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| ACESSO-01 | Admin/Financeiro recebem as 9 colunas, na regra e na ordem de PONTE-02 | `ponte_viagem.test.ts:227-235` (os dois perfis), `:243`: `toEqual(COLUNAS_DA_RPC)` | ✅ |
| ACESSO-02 | Mesmas colunas, qualquer status ou data | `ponte_viagem.test.ts:271-273` (antiga e cancelada) e Admin | ✅ |
| ACESSO-03 | Gestor, Motorista e não aprovado → `42501` | `ponte_viagem.test.ts:306` (4 perfis × 2 funções), `:312` (anon) | ✅ |
| ACESSO-04 | Sem `execute` para `anon` e `public`; com `execute` para `authenticated` | `ponte_viagem.test.ts:331`: `toEqual([{ anon: false, publico: false, authenticated: true }])`. Agora discrimina: o banco do teste imita o privilégio padrão de função do Supabase antes da migration (`:95-100`, `criarBanco({ antesDe })` + `alter default privileges` + `aplicarMigration`) | ✅ |
| ACESSO-05 | O Financeiro lê 0 linhas de `viagem` | `ponte_viagem.test.ts:339`: `toEqual([])` | ✅ |

**Status**: 29/29 com evidência e resultado da spec conferido. Resta 1 ⚠️ cosmético, aceito (cartão de destaque do DETALHE-02).

---

## Casos de borda

- [x] FK `23503` → "Viagem, categoria ou forma de pagamento não encontrada.": `movimentacoesRepository.test.ts:228`
- [x] `23514` → "Valor, data de pagamento ou litros inválidos.": `movimentacoesRepository.test.ts:227`
- [x] Trocar Combustível por outra categoria descarta os litros: `MovimentacaoFormView.test.tsx:688`, `schema.test.ts:167`
- [x] Busca sem resultado → "Nenhuma viagem encontrada.": `MovimentacaoFormView.test.tsx:535`
- [x] Nenhuma viagem vinculável → "Sem viagem" + "Nenhuma viagem em andamento ou concluída nos últimos 30 dias.": `MovimentacaoFormView.test.tsx:545-546`

Assumption "Rotas" (guard do Financeiro): `__tests__/routes/navegacaoPorPerfil.test.tsx:273-275` (Gestor e Motorista em `/viagens/lancamentos` e `/viagens/v-1` voltam para a home) e `:290` (Admin e Financeiro abrem).

---

## Sensor de discriminação

Worktree descartável (`git worktree add` + junction de `node_modules`), rodadas sequenciais, `git checkout -- .` após cada mutante.

### Rodada 2 (`4ae1e4c`)

| # | Arquivo | Mutação | Resultado |
| --- | --- | --- | --- |
| M3 | `20261111000100_ponte_viagem.sql:110` | `order by` sem a chave "em andamento primeiro" | ✅ Morto (antes sobrevivia) |
| M18 | `…ponte_viagem.sql:152` | `buscar_viagem_vinculavel`: revoke sem `anon` | ✅ Morto (antes sobrevivia) |
| M18b | `…ponte_viagem.sql:150` | `listar_viagens_vinculaveis`: revoke sem `anon` | ✅ Morto |
| M2b | `…ponte_viagem.sql:108` | Janela de 30 → 32 dias (limite de 31 entra) | ✅ Morto |
| M2c | `…ponte_viagem.sql:108` | Janela de 30 → 28 dias (limite de 29 sai) | ✅ Morto |
| M1b | `…ponte_viagem.sql:54` | Desliga a regra "Combustível vinculado exige litros" | ✅ Morto |
| M11 | `MovimentacaoFormView.tsx:292` | Troca o `emptyMessage` do seletor de viagem | ✅ Morto (antes sobrevivia) |
| M13 | `MovimentacaoFormView.tsx:293` | Remove o `noResultsMessage` do seletor de viagem | ✅ Morto (antes sobrevivia) |
| M21 | `app/(app)/movimentacoes/nova.tsx:7` | A rota lê `id` no lugar de `viagemId` | ✅ Morto (antes sobrevivia) |
| M22 | `app/(app)/_layout.tsx:39` | `viagens/[id]/index` movido para o guard `podeVerViagens` | ✅ Morto |
| M23 | `ViagemLancamentosView.tsx:124` | `loading={false}` no Desvincular | ✅ Morto |
| M5 | `src/ui/Select.tsx:38` | `normalize('NFD')` → `'NFC'` | ✅ Morto |
| M9 | `ViagemLancamentosView.tsx:108` | Entradas filtradas por `'Saida'` | ✅ Morto |

M10 e M16 não foram reexecutados na rodada 2: a correção só tocou em testes e não enfraqueceu as asserções que os matavam.

### Rodada 1 (`e73ef16`), mutantes mortos e ainda válidos

M1, M2 (30→60), M4 (Gestor aceito), M6, M7, M8, M9, M10, M12, M14, M15, M16, M17, M19, M20 foram mortos. As asserções que os matavam continuam no `4ae1e4c`.

**Profundidade**: expandida (≥5, integridade de dados e autorização).
**Resultado**: rodada 2 com 13/13 mutantes listados mortos; os 5 sobreviventes da rodada 1 agora morrem. **PASS**.
**Isolamento**: o `git status --porcelain` da árvore real antes e depois mostra só `?? .specs/features/eix42-ponte-viagem/validation.md`, o esperado. Worktree removida e `git worktree prune` executado.

Observação: um teste anterior à feature, `MovimentacoesListView — editar e excluir (LST-02)`, e o teste NAV-02/04 do formulário são instáveis sob carga de CPU. Os dois apareceram como falha extra em rodadas paralelas ou em mutantes. Nenhum veredito depende só deles: cada mutante morto tem pelo menos uma falha no teste da própria regra.

---

## Gate (`4ae1e4c`)

- `npm run typecheck`: exit 0
- `npm run lint`: exit 0
- `npx jest --selectProjects app`: 115 suítes, **1408 passed**, 0 failed, 0 skipped
- `jest --selectProjects supabase` (PGlite): 19 suítes, **359 passed**, 0 failed
- Delta desde `4bd80b4`: +80 casos na rodada 1 e +13 no app na rodada 2. Nenhum teste foi removido e nenhuma asserção ficou mais fraca. O banco do `ponte_viagem.test.ts` agora é montado com `antesDe` + privilégio padrão + `aplicarMigration`, e o stub global ficou intacto

---

## Qualidade de código e regras do projeto

| Item | Status |
| --- | --- |
| Valores visuais fixos nas views novas | ✅ Nenhum; só tokens e primitivos |
| Estados carregando, vazio, erro e sucesso | ✅ |
| Um cyan por tela, alvo de 44pt | ✅ |
| `any` / `@ts-ignore` | ✅ Nenhum |
| RLS, grants, `security definer` + checagem de perfil | ✅ E agora discriminados por teste |
| Alteração em `src/ui` | ✅ Autorizada na spec |
| RNF08 | ✅ `viagens` não importa nada do Financeiro. A ponte reaproveita só `rotuloStatusViagem` de `viagens/types`, como a spec revisada prevê |

---

## Gaps restantes

1. **Cosmético, aceito**: DETALHE-02 não confere o `Card variant="feature"` do cartão de destaque. Se quiser fechar, um `testID`/`toHaveStyle` no card em `ViagemLancamentosView.test.tsx`.
2. **Informativo**: duas premissas da spec continuam com `Confirmed? = n` ("Concluídas recentes" e "Onde mora o código da ponte"). Vale confirmar com o usuário antes do PR.

---

## Rastreabilidade

| Requisito | Antes | Depois |
| --- | --- | --- |
| PONTE-01..09 | Implementing | ✅ Verified |
| LITROS-01..06 | Implementing | ✅ Verified |
| DETALHE-01..09 | Implementing | ✅ Verified (DETALHE-02 com a ressalva cosmética) |
| ACESSO-01..05 | Implementing | ✅ Verified |

---

## Resumo

**Overall**: ✅ Pronto para o PR, depois da revisão manual.
**Checagem ancorada na spec**: 29/29, sem gap de precisão aberto (1 cosmético aceito)
**Sensor**: rodada 2 com 13/13 mortos; os 5 sobreviventes da rodada 1 agora morrem
**Gate**: 1408 + 359 passed, typecheck e lint limpos
