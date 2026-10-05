# EIX-33 — US03 Movimentações Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/eix33-movimentacoes/design.md`
**Status**: In Progress
**Linear**: EIX-33 · commits usam `Refs: EIX-33`

---

## Test Coverage Matrix

> Guidelines: `AGENTS.md` §2.5 (render, caminho feliz, validações dos ACs), `.claude/skills/teste-componente`, padrão de `supabase/tests` (PGlite) e de `src/features/formas-pagamento/__tests__`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Migration SQL (check, policy) | integration (PGlite) | 1:1 com MOV-06/MOV-07; caso permitido e negado | `supabase/tests/*.test.ts` | `npm test` |
| Helpers puros (`src/lib`) | unit | Todos os ramos; bordas (31/02, limite de valor, virada de ano) | `src/lib/__tests__/` | `npx jest --selectProjects app src/lib` |
| Primitivos `src/ui` | unit (Testing Library) | Render, interação, estado de erro/vazio | `src/ui/__tests__/` | `npx jest --selectProjects app src/ui` |
| Schema Zod | unit | 1:1 com MOV-03/04/05 (cada mensagem) | `src/features/movimentacoes/__tests__/` | `npx jest --selectProjects app src/features/movimentacoes` |
| Repositório | unit (mock do client) | Cada função: sucesso, erro traduzido, resposta inválida | `src/features/movimentacoes/__tests__/` | `npx jest --selectProjects app src/features/movimentacoes` |
| Componentes e telas | unit (Testing Library) | Render, caminho feliz, carregando/vazio/erro, feedback, cada AC de UI | `src/features/movimentacoes/__tests__/` | `npx jest --selectProjects app src/features/movimentacoes` |
| Atalhos de navegação | unit (Testing Library) | Atalho da aba Financeiro | `src/navigation/__tests__/` | `npx jest --selectProjects app src/navigation` |
| Arquivos de rota (só reexportam a view) e registro no `_layout` | none | build gate only (typecheck valida as rotas tipadas) | - | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tasks com teste unitário do app | `npx jest --selectProjects app <pasta da task>` |
| Full | Tasks com teste PGlite | `npm test` |
| Build | Fim de fase | `npm run typecheck && npm run lint && npm test` |

---

## Execution Plan

### Phase 1: Banco

```
T1
```

### Phase 2: Fundações

```
T2 → T3 → T4 → T5
```

### Phase 3: Domínio da feature

```
T6 → T7
```

### Phase 4: Telas e rotas

```
T8 → T9 → T10 → T11 → T12
```

---

## Task Breakdown

### T1: Migration de regras da movimentação

**What**: Criar `20261004000100_movimentacao_regras.sql` (check `valor > 0`; `movimentacao_delete` exigindo `divida_id is null`) com testes PGlite.
**Where**: `supabase/migrations/20261004000100_movimentacao_regras.sql`
**Depends on**: None
**Reuses**: `supabase/tests/helpers/db.ts`, `supabase/tests/rls.test.ts`
**Requirement**: MOV-06, MOV-07

**Tools**:

- MCP: NONE
- Skill: `supabase-query`

**Done when**:

- [x] `supabase/tests/movimentacao_regras.test.ts` prova: valor 0 rejeitado (23514) em insert e update; Pago sem data rejeitado (23514); Financeiro apaga avulsa (1 linha) e não apaga parcela (0 linhas); Motorista e Gestor de Frota não leem nem gravam
- [x] Suíte `supabase` inteira verde (rls.test.ts e financeiro.test.ts sem regressão)
- [x] Gate check passes: `npm test`

**Status**: ✅ Done
**Tests**: integration
**Gate**: full

**Commit**: `feat(db): valor positivo e parcela não excluível em movimentacao (EIX-33)`

---

### T2: Helpers de dinheiro

**What**: `digitosParaCentavos`, `formatarMoeda`, `centavosParaReais`, `reaisParaCentavos` em centavos inteiros.
**Where**: `src/lib/money.ts`
**Depends on**: None
**Reuses**: NONE
**Requirement**: MOV-03, MOV-09

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] `src/lib/__tests__/money.test.ts`: `1234` → `R$ 12,34`; `150000` → `R$ 1.500,00`; `0` → `R$ 0,00`; letras ignoradas; limite de 12 dígitos; ida e volta reais↔centavos sem erro de float (`0.1 + 0.2` case, `19.99`)
- [x] Gate check passes: `npx jest --selectProjects app src/lib`

**Status**: ✅ Done
**Tests**: unit
**Gate**: quick

**Commit**: `feat(lib): helpers de dinheiro em centavos (EIX-33)`

---

### T3: Helpers de data

**What**: `mascararData`, `dataBRParaISO`, `isoParaDataBR`, `hojeISO`, `intervaloDoMes`, `nomeDoMes`.
**Where**: `src/lib/datas.ts`
**Depends on**: T2
**Reuses**: NONE
**Requirement**: MOV-05, MOV-08

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] `src/lib/__tests__/datas.test.ts`: máscara parcial e completa; 31/02/2026 e 00/10/2026 → null; 29/02/2028 válido; `intervaloDoMes(2026, 12)` vira o ano; `nomeDoMes(2026, 10)` = "Outubro 2026"; `hojeISO` usa data local (relógio falso)
- [x] Gate check passes: `npx jest --selectProjects app src/lib`

**Status**: ✅ Done
**Tests**: unit
**Gate**: quick

**Commit**: `feat(lib): helpers de data DD/MM/AAAA e intervalo do mês (EIX-33)`

---

### T4: Tons success e danger no Text

**What**: Acrescentar os tons `success` e `danger` ao primitivo `Text`, usando os tokens existentes.
**Where**: `src/ui/Text.tsx`
**Depends on**: T3
**Reuses**: `colors.success`, `colors.danger` de `src/ui/tokens.ts`
**Requirement**: MOV-09

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] Teste em `src/ui/__tests__/Text.test.tsx` confere a cor de cada tom novo e que os tons antigos não mudaram
- [x] Gate check passes: `npx jest --selectProjects app src/ui`

**Status**: ✅ Done
**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): tons success e danger no Text (EIX-33)`

---

### T5: Primitivo Select

**What**: Campo de seleção com lista em modal, aparência do `Input`, exportado em `src/ui/index.ts`.
**Where**: `src/ui/Select.tsx`
**Depends on**: T4
**Reuses**: `Input` (estilo), `ListItem`, `Button`, `Text`, tokens
**Requirement**: MOV-01, MOV-04, MOV-10

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [x] `src/ui/__tests__/Select.test.tsx`: mostra placeholder; abre a lista; escolher chama `onChange` e fecha; Cancelar fecha sem mudar; mostra `error`; lista vazia mostra `emptyMessage`; `value` fora das opções usa `fallbackLabel`; alvo de toque ≥ 44
- [x] Gate check passes: `npx jest --selectProjects app src/ui`

**Status**: ✅ Done
**Tests**: unit
**Gate**: build

**Commit**: `feat(ui): primitivo Select com lista em modal (EIX-33)`

---

### T6: Tipos e schema da movimentação

**What**: `types.ts` (tipo derivado do banco + `rotuloStatus`) e `schema.ts` (Zod com pagamento condicional e saída em ISO).
**Where**: `src/features/movimentacoes/schema.ts`
**Depends on**: None (fase 2 concluída)
**Reuses**: `src/features/categorias/types.ts`, `src/lib/datas.ts`
**Requirement**: MOV-03, MOV-04, MOV-05, MOV-01

**Tools**:

- MCP: NONE
- Skill: `formulario-validado`, `teste-componente`

**Done when**:

- [x] `__tests__/schema.test.ts`: cada mensagem da spec (valor 0, descrição vazia, sem categoria, sem forma, Pago sem data, data inválida); Pendente grava `data_pagamento: null`; descrição com 121 caracteres rejeitada; saída em ISO
- [x] `rotuloStatus('Pago','Entrada')` = "Recebido", `('Pago','Saida')` = "Pago"
- [x] Gate check passes: `npx jest --selectProjects app src/features/movimentacoes`

**Status**: ✅ Done
**Tests**: unit
**Gate**: quick

**Commit**: `feat(movimentacoes): tipos e schema Zod com pagamento condicional (EIX-33)`

---

### T7: Repositório de movimentações

**What**: Listar do mês, buscar, criar, atualizar, excluir e listar opções ativas, com erros traduzidos.
**Where**: `src/features/movimentacoes/movimentacoesRepository.ts`
**Depends on**: T6
**Reuses**: `categoriasRepository.ts` (padrão e `listarCategorias`), `listarFormasPagamento`, `src/lib/money.ts`
**Requirement**: MOV-02, MOV-08, MOV-10, MOV-11

**Tools**:

- MCP: NONE
- Skill: `supabase-query`, `teste-componente`

**Done when**:

- [x] `__tests__/movimentacoesRepository.test.ts`: filtro `.or()` do mês com vencimento/inclusão; valor convertido para centavos na leitura e para reais na escrita; insert não envia `data_inclusao`/`data_atualizacao`; 42501, 23514, 23503 traduzidos; delete com 0 linhas → mensagem da spec; resposta inválida → mensagem de dados inválidos; opções só ativas
- [x] Gate check passes: `npx jest --selectProjects app src/features/movimentacoes`

**Status**: ✅ Done
**Tests**: unit
**Gate**: quick

**Commit**: `feat(movimentacoes): repositório com filtro por mês e erros traduzidos (EIX-33)`

---

### T8: Campos de moeda e data

**What**: `CampoMoeda` (máscara R$ em centavos) e `CampoData` (máscara DD/MM/AAAA + botão "Hoje") em `components/`.
**Where**: `src/features/movimentacoes/components/`
**Depends on**: None (fase 3 concluída)
**Reuses**: `Input`, `Button`, `src/lib/money.ts`, `src/lib/datas.ts`
**Requirement**: MOV-03, MOV-05

**Tools**:

- MCP: NONE
- Skill: `formulario-validado`, `teste-componente`

**Done when**:

- [x] `__tests__/CampoMoeda.test.tsx`: digitar `1234` mostra `R$ 12,34` e devolve 1234; mostra erro
- [x] `__tests__/CampoData.test.tsx`: digitar `05102026` mostra `05/10/2026`; "Hoje" preenche a data local (relógio falso)
- [x] Gate check passes: `npx jest --selectProjects app src/features/movimentacoes`

**Status**: ✅ Done
**Tests**: unit
**Gate**: quick

**Commit**: `feat(movimentacoes): campos de moeda e data com máscara (EIX-33)`

---

### T9: Config dos campos e formulário

**What**: `camposMovimentacao.ts` (array de config) e `MovimentacaoFormView` para criar e editar.
**Where**: `src/features/movimentacoes/MovimentacaoFormView.tsx`
**Depends on**: T8
**Reuses**: `FormaPagamentoFormView.tsx` (fluxo), `Select`, `Tabs`, `Snackbar`
**Requirement**: MOV-01, MOV-02, MOV-04, MOV-05, MOV-10

**Tools**:

- MCP: NONE
- Skill: `formulario-validado`, `teste-componente`

**Done when**:

- [ ] `__tests__/MovimentacaoFormView.test.tsx`: render com todos os campos e status Pendente; data de pagamento só aparece com Pago; rótulo "Recebido" com categoria de Entrada; cada validação bloqueia sem chamar o repositório; criar com sucesso → Snackbar "Movimentação registrada." e `router.back()`; erro do repositório mantém o form e mostra Snackbar; loading no Salvar ignora segundo toque; edição carrega dados (inclusive categoria inativa) e salva "Movimentação atualizada."; id inexistente → "Movimentação não encontrada." + Voltar
- [ ] Gate check passes: `npx jest --selectProjects app src/features/movimentacoes`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(movimentacoes): formulário de lançamento e edição (EIX-33)`

---

### T10: Lista de movimentações

**What**: `MovimentacoesListView` com navegação por mês, abas de tipo e status, linhas com sinal e cor, editar e excluir com confirmação.
**Where**: `src/features/movimentacoes/MovimentacoesListView.tsx`
**Depends on**: T9
**Reuses**: `FormasPagamentoListView.tsx` (estados), `Tabs`, `ListItem`, `EmptyState`, `Snackbar`
**Requirement**: MOV-08, MOV-09, MOV-11

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [ ] `__tests__/MovimentacoesListView.test.tsx`: carregando → lista do mês atual; ‹ › trocam o mês e o título; abas de tipo e status filtram; linha mostra `+ R$`/`− R$` e rótulo de status; vazio com "Nova movimentação"; erro com "Tentar novamente"; Excluir abre `Alert` e só apaga ao confirmar (Snackbar "Movimentação excluída."); parcela sem Excluir e com "Parcela de dívida"; resposta antiga de mês não sobrescreve a nova
- [ ] Gate check passes: `npx jest --selectProjects app src/features/movimentacoes`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(movimentacoes): lista com filtro por mês, tipo e status (EIX-33)`

---

### T11: Rotas de movimentações sob o guard

**What**: Criar `index`, `nova` e `[id]/editar` em `app/(app)/movimentacoes/` e registrá-las no `Stack.Protected guard={podeVerCategorias}`.
**Where**: `app/(app)/_layout.tsx`
**Depends on**: T10
**Reuses**: rotas de `app/(app)/formas-pagamento/`
**Requirement**: MOV-02, MOV-08

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`

**Done when**:

- [ ] Rotas criadas e registradas no guard; typecheck aceita `router.push('/movimentacoes/nova')`
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm test`

**Tests**: none
**Gate**: build

**Commit**: `feat(movimentacoes): rotas protegidas por perfil (EIX-33)`

---

### T12: Atalho na aba Financeiro

**What**: Adicionar "Movimentações" aos atalhos da aba Financeiro.
**Where**: `app/(app)/(tabs)/financeiro.tsx`
**Depends on**: T11
**Reuses**: `ModuloEmBreveView`
**Requirement**: MOV-08

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [ ] Teste em `src/navigation/__tests__/ModuloEmBreveView.test.tsx` cobre o atalho de Movimentações levando a `/movimentacoes`
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm test`

**Tests**: unit
**Gate**: build

**Commit**: `feat(movimentacoes): atalho na aba Financeiro (EIX-33)`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1
Phase 2:  T2 ------→ T3 ------→ T4 ------→ T5
Phase 3:  T6 ------→ T7
Phase 4:  T8 ------→ T9 ------→ T10 ------→ T11 ------→ T12
```

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | 1 migration + seu teste | ✅ |
| T2 | 1 módulo de funções | ✅ |
| T3 | 1 módulo de funções | ✅ |
| T4 | 1 componente (2 tons) | ✅ |
| T5 | 1 componente | ✅ |
| T6 | schema + tipos da mesma entidade | ⚠️ coeso |
| T7 | 1 repositório | ✅ |
| T8 | 2 campos pequenos irmãos | ⚠️ coeso |
| T9 | config de campos + form que a consome | ⚠️ coeso |
| T10 | 1 tela | ✅ |
| T11 | 3 rotas de 5 linhas + registro no layout | ⚠️ coeso |
| T12 | 1 atalho | ✅ |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | — | ✅ |
| T2 | None | — (início da fase 2) | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T4 | T4 → T5 | ✅ |
| T6 | None (fase 2) | início da fase 3 | ✅ |
| T7 | T6 | T6 → T7 | ✅ |
| T8 | None (fase 3) | início da fase 4 | ✅ |
| T9 | T8 | T8 → T9 | ✅ |
| T10 | T9 | T9 → T10 | ✅ |
| T11 | T10 | T10 → T11 | ✅ |
| T12 | T11 | T11 → T12 | ✅ |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Migration SQL | integration | integration | ✅ |
| T2 | Helpers puros | unit | unit | ✅ |
| T3 | Helpers puros | unit | unit | ✅ |
| T4 | Primitivo ui | unit | unit | ✅ |
| T5 | Primitivo ui | unit | unit | ✅ |
| T6 | Schema Zod | unit | unit | ✅ |
| T7 | Repositório | unit | unit | ✅ |
| T8 | Componentes | unit | unit | ✅ |
| T9 | Tela | unit | unit | ✅ |
| T10 | Tela | unit | unit | ✅ |
| T11 | Arquivos de rota + registro no `_layout` | none | none | ✅ |
| T12 | Atalhos de navegação | unit | unit | ✅ |
