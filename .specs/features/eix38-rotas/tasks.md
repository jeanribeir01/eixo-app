# EIX-38 · US07 Cadastro de Rotas — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/eix38-rotas/spec.md`
**Design**: inline (sem `design.md`) — mesmo padrão de Categorias (`useDadosDaTela`, FAB, `Switch` "Ativa" no `control` da linha, checagem de duplicada no repositório) e de Veículos (texto → número no schema, `traduzirErro` com `campo`). A rota em `app/(app)/rotas/` já renderiza as views (EIX-77) e não muda.
**Status**: Approved

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md` §2.5 ("toda task entrega teste": render, caminho feliz e validações dos AC), skills `teste-componente`, `supabase-query` e `formulario-validado`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Normalização de cidade | unit | Toda regra de limpeza e de equivalência (maiúscula, espaço, acento) | `src/features/rotas/__tests__/cidade.test.ts` | `npx jest src/features/rotas --selectProjects app` |
| Schema Zod do formulário | unit | Cada mensagem de validação dos AC (distância, cidade, UF) e o caminho feliz | `src/features/rotas/__tests__/schema.test.ts` | `npx jest src/features/rotas --selectProjects app` |
| Repositório Supabase | unit (client mockado) | Query montada, duplicada ativa/inativa/inversa/acento, edição sem auto-duplicada, tradução de 23505/23514/42501, resposta inválida, contagem de finalizadas | `src/features/rotas/__tests__/rotasRepository.test.ts` | `npx jest src/features/rotas --selectProjects app` |
| Telas (lista e formulário) | unit (render + interação) | Render, carregando/vazio/erro/sucesso, caminho feliz e cada validação dos AC | `src/features/rotas/__tests__/*View.test.tsx` | `npx jest src/features/rotas --selectProjects app` |
| Tipos (`types.ts`) | none | Derivados de `Tables<'rota'>`; checados no typecheck | - | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Task com testes só da pasta da feature | `npx jest src/features/rotas --selectProjects app` |
| Build | Fim de fase e última task | `npm run typecheck && npm run lint && npm run test` |

---

## Execution Plan

### Phase 1: Domínio

Normalização e schema não dependem do Supabase nem de tela.

```
T1 → T2
```

### Phase 2: Dados

```
T3
```

### Phase 3: Telas

A lista vem antes do formulário porque o formulário volta para ela.

```
T4 → T5
```

---

## Task Breakdown

### T1: Normalização de cidade

**What**: `limparCidade` (trim + espaços repetidos viram um) e `chaveCidade` (espelho de `normaliza_cidade()` da migration `20261014000400`).
**Where**: `src/features/rotas/cidade.ts`
**Depends on**: None
**Reuses**: lista de letras de `supabase/migrations/20261014000400_rota_trecho_sem_acento.sql`
**Requirement**: ROTA-03, ROTA-11, ROTA-19

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [ ] " São  Paulo " limpa para "São Paulo"; "São Paulo", " sao  paulo " e "SÃO PAULO" geram a mesma chave
- [ ] Gate check passes: `npx jest src/features/rotas --selectProjects app`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(rotas): normalização de cidade igual à do banco (EIX-38)`

---

### T2: Tipos e schema Zod do formulário

**What**: `Rota`, `RotaInput` e `RotaComViagens` derivados de `Tables<'rota'>`, e `rotaSchema` com as mensagens em português dos AC.
**Where**: `src/features/rotas/schema.ts` (e `types.ts`, só tipos)
**Depends on**: T1
**Reuses**: `src/features/veiculos/schema.ts` (texto com vírgula → número, 2 casas)
**Requirement**: ROTA-02, ROTA-05, ROTA-06, ROTA-07

**Tools**:

- MCP: NONE
- Skill: `formulario-validado`, `teste-componente`

**Done when**:

- [ ] Distância vazia, não numérica, 0, negativa e com 3 casas dão a mensagem do AC; "408,5" vira 408.5
- [ ] Cidade vazia e UF ausente/fora do enum dão a mensagem do AC; cidade sai limpa
- [ ] Gate check passes: `npx jest src/features/rotas --selectProjects app`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(rotas): schema Zod do formulário de rota (EIX-38)`

---

### T3: Repositório Supabase

**What**: `listarRotas` (com `viagem(count)` só de finalizadas), `buscarRotaPorId`, `criarRota`, `atualizarRota`, `definirAtivaRota`, com checagem de duplicada que devolve a rota existente.
**Where**: `src/features/rotas/rotasRepository.ts`
**Depends on**: T2
**Reuses**: `src/features/categorias/categoriasRepository.ts`, `src/features/veiculos/repository.ts`, `src/lib/errors.ts`
**Requirement**: ROTA-10..ROTA-16, ROTA-18, ROTA-21, ROTA-22, ROTA-28, ROTA-29

**Tools**:

- MCP: NONE
- Skill: `supabase-query`, `teste-componente`

**Done when**:

- [ ] Duplicada ativa, inativa (com id para reativar), inversa (aceita), por acento/maiúscula/espaço e edição do próprio trecho cobertas
- [ ] 23505, 23514, 42501 e resposta inválida viram mensagens em português; inativar usa `update`, nunca `delete`
- [ ] Gate check passes: `npx jest src/features/rotas --selectProjects app`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(rotas): repositório Supabase com duplicidade e soft delete (EIX-38)`

---

### T4: Lista de rotas

**What**: `RotasListView` real no lugar do placeholder: busca, "Mostrar inativas", contagem, switch "Ativa", FAB e os quatro estados.
**Where**: `src/features/rotas/RotasListView.tsx`
**Depends on**: T3
**Reuses**: `src/features/categorias/CategoriasListView.tsx`, `src/lib/useDadosDaTela.ts`
**Requirement**: ROTA-17..ROTA-27, ROTA-30

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [ ] Título "Cidade/UF → Cidade/UF", subtítulo com km e viagens finalizadas (singular e plural)
- [ ] Busca sem acento, filtro de inativas, inativar/reativar com Snackbar, navegação para editar e para nova
- [ ] Skeleton, erro com "Tentar novamente" e os dois vazios
- [ ] Teste de placeholder da lista removido de `placeholders.test.tsx`
- [ ] Gate check passes: `npx jest src/features/rotas --selectProjects app`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(rotas): lista com busca, contagem de viagens e inativação (EIX-38)`

---

### T5: Formulário de rota

**What**: `RotaFormView` real no lugar do placeholder: criar e editar, UF por `Select`, mensagens por campo, duplicada com "Reativar rota existente".
**Where**: `src/features/rotas/RotaFormView.tsx`
**Depends on**: T4
**Reuses**: `src/features/veiculos/VeiculoFormView.tsx`, `src/ui/Select.tsx`
**Requirement**: ROTA-01..ROTA-09, ROTA-10, ROTA-13, ROTA-14, ROTA-28

**Tools**:

- MCP: NONE
- Skill: `formulario-validado`, `teste-componente`

**Done when**:

- [ ] Render nos dois modos, caminho feliz de criar e editar, validações de distância/cidade/UF bloqueiam o envio
- [ ] Duplicada ativa mostra a mensagem sem botão; duplicada inativa mostra o botão e reativar volta à lista
- [ ] Loading no "Salvar"; "Rota não encontrada." com "Voltar"
- [ ] `placeholders.test.tsx` removido (nenhuma view de rotas é mais placeholder)
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit
**Gate**: build

**Commit**: `feat(rotas): formulário de cadastro e edição com UF e reativação (EIX-38)`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3

Phase 1:  T1 ------→ T2
Phase 2:  T3
Phase 3:  T4 ------→ T5
```

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | início da Phase 1 | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | Phase 1 → Phase 2 | ✅ Match |
| T4 | T3 | Phase 2 → Phase 3 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Normalização de cidade | unit | unit | ✅ OK |
| T2 | Schema Zod + tipos | unit | unit | ✅ OK |
| T3 | Repositório Supabase | unit | unit | ✅ OK |
| T4 | Tela de lista | unit | unit | ✅ OK |
| T5 | Tela de formulário | unit | unit | ✅ OK |
