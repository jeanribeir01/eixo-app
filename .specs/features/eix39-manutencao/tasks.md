# EIX-39 · US06-b Manutenção — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/eix39-manutencao/spec.md`
**Design**: inline (sem `design.md`) — RPC no molde de `criar_divida` (AD-008) e de `registrar_manutencao`; repositório no molde de `src/features/dividas/dividasRepository.ts` (RPC + tradução de SQLSTATE) e de `src/features/rotas/rotasRepository.ts` (Zod na resposta); lista no molde de `RotasListView` (`useDadosDaTela`, FAB, quatro estados); formulário no molde de `MovimentacaoFormView` (`Select`, `CampoData`, `CampoMoeda`, `Tabs`).
**Status**: In Progress

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md` §2.5 ("toda task entrega teste": render, caminho feliz e validações dos AC), skills `teste-componente`, `supabase-query` e `formulario-validado`; `.specs/LESSONS.md` L-001 (data perto da meia-noite com fuso fixo), L-005 (centavos com 1,13), L-006 (grants com `has_function_privilege`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Migration / RPC (PGlite) | integration | Cada perfil (Admin, Financeiro, Gestor, Motorista, não aprovado, anon), só ativas, só `id`/`nome`, ordem por nome, grants via `has_function_privilege` (L-006), RLS de `forma_pagamento` intacta | `supabase/tests/*.test.ts` | `node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects supabase supabase/tests/formasPagamentoAtivas.test.ts` |
| Primitivos movidos para `src/ui/` | unit | Os testes existentes de `CampoData` e `CampoMoeda` passam no lugar novo, sem perder caso | `src/ui/__tests__/*.test.tsx` | `npx jest src/ui src/features/movimentacoes src/features/dividas --selectProjects app` |
| Schema Zod do formulário | unit | Cada mensagem dos AC, o caminho feliz, R$ 1,13 (L-005) e hoje às 23h30 com fuso fixo (L-001) | `src/features/manutencao/__tests__/schema.test.ts` | `npx jest src/features/manutencao --selectProjects app` |
| Repositório Supabase | unit (client mockado) | RPC chamada com os parâmetros certos e sem escrita direta, cada SQLSTATE traduzido, resposta inválida, filtros e ordem das consultas | `src/features/manutencao/__tests__/manutencaoRepository.test.ts` | `npx jest src/features/manutencao --selectProjects app` |
| Telas (formulário, lista, detalhe) | unit (render + interação) | Render, carregando/vazio/erro/sucesso, caminho feliz e cada validação e mensagem dos AC | `src/features/manutencao/__tests__/*View.test.tsx` | `npx jest src/features/manutencao --selectProjects app` |
| Rota fina em `app/` e título no `_layout` | unit | A rota renderiza a View com o id da URL | `__tests__/routes/*.test.tsx` | `npx jest __tests__/routes --selectProjects app` |
| Tipos (`types.ts`) | none | Derivados de `Tables<...>`; checados no typecheck | - | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Task com testes só da pasta da feature | `npx jest src/features/manutencao --selectProjects app` |
| Full | Task que mexe no banco ou em mais de uma feature | `npm run typecheck && npx jest <pastas da task> --selectProjects app` (T2, T3) ou o comando PGlite da task (T1) |
| Build | Fim de fase e última task | `npm run typecheck && npm run lint && npm run test` |

> Rota nova em `app/` (T7): regenerar `.expo/types/router.d.ts` com `npx expo start` antes do typecheck.

---

## Execution Plan

### Phase 1: Banco

A RPC de formas ativas não depende de nada do app.

```
T1
```

### Phase 2: Primitivos compartilhados

Os dois campos saem de Movimentações antes de o formulário de manutenção usá-los.

```
T2 → T3
```

### Phase 3: Domínio e dados

```
T4 → T5
```

### Phase 4: Telas

O detalhe vem antes da lista porque o "Ver veículo" da lista navega para ele. T6 parte do repositório da T5 (Phase 3).

```
T5 → T6 → T7 → T8
```

### Phase 5: Troca para a RPC (bloqueada)

Só começa depois que a migration da T1 estiver aplicada na nuvem e `src/types/database.ts` regerado (Jean, Supabase CLI vinculada). Altera a função da T5 (Phase 3).

```
T5 → T9
```

---

## Task Breakdown

### T1: RPC `listar_formas_pagamento_ativas`

**What**: Migration nova com a função `security definer` que devolve `id` e `nome` das formas ativas para Admin, Financeiro e Gestor de Frota, com revoke/grant, e o teste PGlite dela.
**Where**: `supabase/migrations/20261018000200_formas_pagamento_ativas.sql`
**Depends on**: None
**Reuses**: `supabase/migrations/20261014000300_manutencao_rpc.sql` (checagem de perfil, `search_path`, revoke/grant), `supabase/tests/manutencao.test.ts` e `supabase/tests/helpers/db.ts`
**Requirement**: MAN-28, MAN-29, MAN-30, MAN-31

**Tools**:

- MCP: NONE
- Skill: `supabase-query`, `teste-componente`

**Done when**:

- [x] Admin, Financeiro e Gestor ativos recebem só as ativas, só `id` e `nome`, ordenadas por nome
- [x] Motorista, Gestor bloqueado e anon recebem `42501`; `has_function_privilege` prova anon sem execute e authenticated com execute
- [x] Select direto do Gestor em `forma_pagamento` continua vazio (policy intacta)
- [x] Gate check passes: `node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects supabase supabase/tests/formasPagamentoAtivas.test.ts`

**Tests**: integration
**Gate**: full

**Commit**: `feat(db): rpc de formas de pagamento ativas para o gestor (EIX-39)`

---

### T2: Mover `CampoData` para `src/ui/`

**What**: `CampoData` e o teste dele saem de Movimentações para `src/ui/`, exportados em `src/ui/index.ts`, com os imports de Movimentações e Dívidas atualizados.
**Where**: `src/ui/CampoData.tsx`
**Depends on**: None
**Reuses**: `src/features/movimentacoes/components/CampoData.tsx`, `src/features/movimentacoes/__tests__/CampoData.test.tsx`
**Requirement**: MAN-01 (suporte; refatoração aprovada)

**Tools**:

- MCP: NONE
- Skill: `expo-design-system`, `teste-componente`

**Done when**:

- [x] Nenhum import restante de `movimentacoes/components/CampoData`
- [x] Mesma quantidade de casos no teste movido
- [x] Gate check passes: `npm run typecheck && npx jest src/ui src/features/movimentacoes src/features/dividas --selectProjects app`

**Tests**: unit
**Gate**: full

**Commit**: `refactor(ui): move CampoData para src/ui (EIX-39)`

---

### T3: Mover `CampoMoeda` para `src/ui/`

**What**: `CampoMoeda` e o teste dele saem de Movimentações para `src/ui/`, exportados em `src/ui/index.ts`, com os imports de Movimentações e Dívidas atualizados.
**Where**: `src/ui/CampoMoeda.tsx`
**Depends on**: T2
**Reuses**: `src/features/movimentacoes/components/CampoMoeda.tsx`, `src/features/movimentacoes/__tests__/CampoMoeda.test.tsx`
**Requirement**: MAN-01 (suporte; refatoração aprovada)

**Tools**:

- MCP: NONE
- Skill: `expo-design-system`, `teste-componente`

**Done when**:

- [x] Nenhum import restante de `movimentacoes/components/CampoMoeda`
- [x] Mesma quantidade de casos no teste movido
- [x] Gate check passes: `npm run typecheck && npx jest src/ui src/features/movimentacoes src/features/dividas --selectProjects app`

**Tests**: unit
**Gate**: full

**Commit**: `refactor(ui): move CampoMoeda para src/ui (EIX-39)`

---

### T4: Tipos e schema Zod do formulário

**What**: `manutencaoSchema` (mais os tipos derivados de `Tables<'manutencao'>` em `types.ts`, só tipos) com as mensagens dos AC: data obrigatória e não futura no fuso do aparelho, descrição de 1 a 200, valor em centavos maior que zero, veículo, forma e status.
**Where**: `src/features/manutencao/schema.ts`
**Depends on**: None
**Reuses**: `src/features/movimentacoes/schema.ts` (data BR → ISO, centavos), `src/lib/datas.ts` (`hojeISO`, `dataBRParaISO`)
**Requirement**: MAN-04, MAN-06, MAN-07, MAN-08, MAN-09, MAN-10, MAN-11, MAN-12, MAN-41, MAN-42

**Tools**:

- MCP: NONE
- Skill: `formulario-validado`, `teste-componente`

**Done when**:

- [x] Cada mensagem dos AC 6 a 12 coberta; caminho feliz devolve data ISO e centavos inteiros
- [x] Hoje às 23h30 em `America/Sao_Paulo` aceito e amanhã recusado, com fuso fixo no teste (L-001)
- [x] Gate check passes: `npx jest src/features/manutencao --selectProjects app`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(manutencao): schema Zod do formulário de manutenção (EIX-39)`

---

### T5: Repositório Supabase

**What**: `registrarManutencao` e `concluirManutencao` (RPCs), `listarManutencoes`, `buscarVeiculoComHistorico`, `listarVeiculosSelecionaveis` (`status <> 'Inativo'`, `TODO(EIX-79)`) e `listarFormasPagamentoAtivas` (select direto com `ativa = true` e `TODO` da T9), com tradução de SQLSTATE e Zod na resposta.
**Where**: `src/features/manutencao/manutencaoRepository.ts`
**Depends on**: T4
**Reuses**: `src/features/dividas/dividasRepository.ts`, `src/features/rotas/rotasRepository.ts`, `src/lib/errors.ts`, `src/lib/money.ts`
**Requirement**: MAN-02, MAN-03, MAN-05, MAN-13, MAN-14, MAN-16, MAN-18, MAN-20, MAN-21, MAN-35, MAN-39, MAN-41

**Tools**:

- MCP: NONE
- Skill: `supabase-query`, `teste-componente`

**Done when**:

- [x] RPC chamada com valor em reais (R$ 1,13 → `1.13`, L-005) e nenhum `insert`/`update` direto
- [x] `MN001`, `MN002`, `MN003`, `22023`, `23514`, `P0002` (nas duas RPCs), `42501`, código desconhecido e resposta inválida viram as mensagens da spec
- [x] Ordem da lista (abertas primeiro, data mais recente) e filtro de veículos cobertos
- [x] Gate check passes: `npx jest src/features/manutencao --selectProjects app`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(manutencao): repositório com RPCs e tradução de erros (EIX-39)`

---

### T6: Formulário de manutenção

**What**: `ManutencaoFormView` real no lugar do placeholder: carrega veículos e formas, valida pelo schema, chama `registrarManutencao` e volta à lista.
**Where**: `src/features/manutencao/ManutencaoFormView.tsx`
**Depends on**: T5
**Reuses**: `src/features/movimentacoes/MovimentacaoFormView.tsx`, `src/ui/Select.tsx`, `src/ui/CampoData.tsx`, `src/ui/CampoMoeda.tsx`
**Requirement**: MAN-01, MAN-02, MAN-03, MAN-04, MAN-05, MAN-06, MAN-07, MAN-08, MAN-09, MAN-10, MAN-11, MAN-12, MAN-13, MAN-14, MAN-15, MAN-40

**Tools**:

- MCP: NONE
- Skill: `formulario-validado`, `teste-componente`

**Done when**:

- [x] Render com os seis campos e os valores iniciais; caminho feliz com Snackbar e volta
- [x] Cada validação bloqueia o envio; `MN001` e `22023` mostram a mensagem; loading no "Salvar"
- [x] Erro na carga das opções com "Tentar novamente"; seletor vazio com "Nenhuma forma de pagamento ativa."
- [x] Caso do formulário removido de `placeholders.test.tsx`
- [x] Gate check passes: `npx jest src/features/manutencao --selectProjects app`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(manutencao): formulário de registro de manutenção (EIX-39)`

---

### T7: Detalhe do veículo com histórico

**What**: `VeiculoDetalheView` com placa, "Marca Modelo", status e o histórico de manutenções, mais a rota fina `app/(app)/frota/[id]/index.tsx` e o título "Veículo" no `_layout.tsx`, dentro do guard de Frota.
**Where**: `src/features/manutencao/VeiculoDetalheView.tsx`
**Depends on**: T6
**Reuses**: `src/features/veiculos/types.ts` (`rotuloStatusVeiculo`), `app/(app)/rotas/[id]/editar.tsx` (rota fina com id)
**Requirement**: MAN-34, MAN-35, MAN-36, MAN-37, MAN-38

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `expo-router`, `teste-componente`

**Done when**:

- [x] Carregando, histórico na ordem certa, vazio e "Veículo não encontrado." com "Voltar"
- [x] Rota renderiza a View com o id da URL; título "Veículo" no `_layout`
- [x] Gate check passes: `npx jest src/features/manutencao __tests__/routes --selectProjects app`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(manutencao): detalhe do veículo com histórico (EIX-39)`

---

### T8: Lista de manutenções

**What**: `ManutencoesListView` real no lugar do placeholder: ordem abertas primeiro, "Concluir" com os dois Snackbars, "Ver veículo", FAB e os quatro estados.
**Where**: `src/features/manutencao/ManutencoesListView.tsx`
**Depends on**: T7
**Reuses**: `src/features/rotas/RotasListView.tsx`, `src/lib/useDadosDaTela.ts`, `src/lib/money.ts`, `src/lib/datas.ts`
**Requirement**: MAN-17, MAN-18, MAN-19, MAN-20, MAN-21, MAN-22, MAN-23, MAN-24, MAN-25, MAN-26, MAN-27, MAN-33

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [x] Título e subtítulo no formato da spec; abertas primeiro
- [x] "Concluir" com loading e os dois textos de Snackbar; erro mantém a linha aberta
- [x] "Ver veículo" abre `/frota/<veiculo_id>`; FAB abre `/manutencoes/nova`
- [x] Skeleton, erro com "Tentar novamente" e vazio
- [x] `placeholders.test.tsx` removido
- [x] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit
**Gate**: build

**Commit**: `feat(manutencao): lista com conclusão e acesso ao veículo (EIX-39)`

---

### T9: Seletor de formas pela RPC

**What**: `listarFormasPagamentoAtivas` passa a chamar `supabase.rpc('listar_formas_pagamento_ativas')`, sem o select direto e sem o `TODO`.
**Where**: `src/features/manutencao/manutencaoRepository.ts` (modify)
**Depends on**: T5
**Reuses**: tipos regerados em `src/types/database.ts`
**Requirement**: MAN-32

**Tools**:

- MCP: NONE
- Skill: `supabase-query`, `teste-componente`

**Done when**:

- [x] Pré-requisito externo: migration da T1 aplicada na nuvem e `src/types/database.ts` regerado com a função
- [x] Teste do repositório prova a chamada `rpc` e nenhum `from('forma_pagamento')`
- [ ] Teste manual com Gestor de Frota: seletor lista as formas ativas e o registro salva
- [x] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit
**Gate**: build

**Commit**: `feat(manutencao): formas de pagamento pela RPC listar_formas_pagamento_ativas (EIX-39)`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1:  T1
Phase 2:  T2 ------→ T3
Phase 3:  T4 ------→ T5
Phase 4:  (T5) ---→ T6 ------→ T7 ------→ T8
Phase 5:  (T5) ---→ T9   (bloqueada: db push + tipos regerados)
```

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | início da Phase 1 | ✅ Match |
| T2 | None | início da Phase 2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | None | início da Phase 3 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | T5 | T5 → T9 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Migration / RPC | integration | integration | ✅ OK |
| T2 | Primitivo em `src/ui/` | unit | unit | ✅ OK |
| T3 | Primitivo em `src/ui/` | unit | unit | ✅ OK |
| T4 | Schema Zod + tipos | unit | unit | ✅ OK |
| T5 | Repositório Supabase | unit | unit | ✅ OK |
| T6 | Tela de formulário | unit | unit | ✅ OK |
| T7 | Tela de detalhe + rota | unit | unit | ✅ OK |
| T8 | Tela de lista | unit | unit | ✅ OK |
| T9 | Repositório Supabase | unit | unit | ✅ OK |
