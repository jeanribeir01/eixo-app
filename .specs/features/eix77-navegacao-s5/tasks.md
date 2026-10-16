# EIX-77 · Navegação da S5 — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/eix77-navegacao-s5/spec.md`
**Design**: inline (sem `design.md`) — mesmo padrão do hub Financeiro (EIX-62) e das rotas internas já existentes: a rota em `app/(app)/` só importa e renderiza a view da feature; título e guard ficam em `app/(app)/_layout.tsx`; a regra de perfil vem de `useMenu()`.
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md` §2.5 ("toda task entrega teste": render, caminho feliz e validações dos AC), skill `teste-componente`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Placeholders de feature | unit (render) | Cada view exportada renderiza título e frase do estado vazio | `src/features/<feature>/__tests__/*.test.tsx` | `npx jest src/features/<feature> --selectProjects app` |
| Hub de Frota | unit (render + navegação) | Título, três entradas e o `href` de cada uma | `src/navigation/__tests__/FrotaHubView.test.tsx`, `FrotaRoute.test.tsx` | `npx jest src/navigation --selectProjects app` |
| Lista de veículos | unit (render) | Sem o título "Frota" no conteúdo; testes existentes continuam verdes | `src/features/veiculos/__tests__/VeiculosListView.test.tsx` | `npx jest src/features/veiculos --selectProjects app` |
| Mapa de ícones (`src/ui/icons.ts`) | none | Só linhas novas; o tipo `AndroidSymbol`/`SFSymbol` valida no typecheck e o hub (T5) renderiza os ícones | - | build gate only |
| Rotas, títulos e guards | integration (`renderRouter` com os layouts reais) | Toda rota nova: header de título certo (Admin), perfil permitido abre, perfil proibido volta para a home; sem colisão de URL com aba | `__tests__/routes/navegacaoPorPerfil.test.tsx`, `__tests__/routes/colisaoComAbas.test.ts` | `npx jest __tests__/routes --selectProjects app` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Task com testes só da própria pasta | `npx jest <pasta da task> --selectProjects app` |
| Full | Task que mexe em rota ou navegação | `npx jest --selectProjects app` |
| Build | Fim de fase e task sem teste | `npm run typecheck && npm run lint && npm run test` |

---

## Execution Plan

### Phase 1: Ícones e placeholders das features

Os ícones entram primeiro porque os placeholders usam. Depois cada feature ganha as views que a task dona vai substituir.

```
T1 → T2 → T3 → T4
```

### Phase 2: Hub de Frota e lista de veículos

```
T5 → T6
```

### Phase 3: Rotas, títulos e guards

Liga tudo: arquivos de rota, `_layout.tsx`, `menu.ts` e os testes de navegação por perfil.

```
T7
```

---

## Task Breakdown

### T1: Ícones de Rotas e Manutenções

**What**: Acrescentar `rotas` e `manutencoes` ao mapa de `src/ui/icons.ts` (autorizado pelo usuário em 16/10/2026). Só linhas novas.
**Where**: `src/ui/icons.ts`
**Depends on**: None
**Reuses**: formato do mapa existente
**Requirement**: NAV5-01 (pré-condição)

**Tools**:

- MCP: NONE
- Skill: `expo-design-system`

**Done when**:

- [x] `rotas` e `manutencoes` no mapa, com símbolo Android e iOS válidos para o tipo
- [x] Gate build verde

**Tests**: none
**Gate**: build

**Commit**: `feat(ui): ícones de rotas e manutenções no mapa (EIX-77)`

---

### T2: Placeholders de Rotas

**What**: `RotasListView` e `RotaFormView` (prop opcional `rotaId`, como `CategoriaFormView`), cada uma com `Screen underHeader` + `EmptyState` com ícone `rotas`, título e uma frase do que a tela vai fazer. Teste de render.
**Where**: `src/features/rotas/RotasListView.tsx`, `src/features/rotas/RotaFormView.tsx`, `src/features/rotas/__tests__/placeholders.test.tsx`
**Depends on**: T1 (ícone `rotas`)
**Reuses**: `ModuloEmBreveView` (mesmo espírito), `EmptyState`, `Screen`
**Requirement**: NAV5-13

**Tools**:

- MCP: NONE
- Skill: `teste-componente`, `tela-padrao`

**Done when**:

- [x] As duas views renderizam título e frase do estado vazio
- [x] Gate quick verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(rotas): placeholders da lista e do formulário de rotas (EIX-77)`

---

### T3: Placeholders de Manutenção

**What**: `ManutencoesListView` e `ManutencaoFormView`, mesmo molde da T2, ícone `manutencoes`. Teste de render.
**Where**: `src/features/manutencao/ManutencoesListView.tsx`, `src/features/manutencao/ManutencaoFormView.tsx`, `src/features/manutencao/__tests__/placeholders.test.tsx`
**Depends on**: T2
**Reuses**: molde da T2
**Requirement**: NAV5-13

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] As duas views renderizam título e frase do estado vazio
- [x] Gate quick verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(manutencao): placeholders da lista e do formulário de manutenção (EIX-77)`

---

### T4: Placeholders de Viagens

**What**: `ViagensListView` (aba: sem header nativo, `Screen align="center"`, título no conteúdo como o `ModuloEmBreveView`), `AbrirViagemView` e `FecharViagemView` (prop `viagemId`), ícone `viagens`. Teste de render.
**Where**: `src/features/viagens/ViagensListView.tsx`, `src/features/viagens/AbrirViagemView.tsx`, `src/features/viagens/FecharViagemView.tsx`, `src/features/viagens/__tests__/placeholders.test.tsx`
**Depends on**: T3
**Reuses**: molde da T2
**Requirement**: NAV5-13

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [ ] As três views renderizam título e frase do estado vazio
- [ ] Gate build verde (fim de fase)

**Tests**: unit
**Gate**: build

**Commit**: `feat(viagens): placeholders da lista, abertura e fechamento de viagem (EIX-77)`

---

### T5: Hub de Frota

**What**: `FrotaHubView` no padrão do `FinanceiroHubView`: título "Frota", `ListSection` "Operação" (Manutenções → `/manutencoes`) e "Cadastros" (Veículos → `/frota/veiculos`, Rotas → `/rotas`). A aba `(tabs)/frota.tsx` passa a renderizar o hub.
**Where**: `src/navigation/FrotaHubView.tsx`, `app/(app)/(tabs)/frota.tsx`, `src/navigation/__tests__/FrotaHubView.test.tsx`, `src/navigation/__tests__/FrotaRoute.test.tsx`
**Depends on**: None (a Phase 1 termina antes)
**Reuses**: `FinanceiroHubView`, `ListSection`, `ListItem`
**Requirement**: NAV5-01, NAV5-02, NAV5-03, NAV5-04

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [ ] Hub mostra "Frota", "Veículos", "Rotas", "Manutenções"
- [ ] Cada entrada chama `router.push` com o `href` da spec
- [ ] A aba Frota renderiza o hub
- [ ] Gate quick verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(frota): hub de Frota com Veículos, Rotas e Manutenções (EIX-77)`

---

### T6: Lista de veículos como tela interna

**What**: `VeiculosListView` sem o bloco de título ("Eixo Certo" / "Frota") e com `Screen underHeader`.
**Where**: `src/features/veiculos/VeiculosListView.tsx`, `src/features/veiculos/__tests__/VeiculosListView.test.tsx`
**Depends on**: T5
**Reuses**: —
**Requirement**: NAV5-14

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [ ] A lista não mostra "Frota" nem "Eixo Certo" no conteúdo
- [ ] Testes existentes da lista continuam verdes, sem asserção removida
- [ ] Gate build verde (fim de fase)

**Tests**: unit
**Gate**: build

**Commit**: `refactor(veiculos): lista de veículos como tela interna, sem título no conteúdo (EIX-77)`

---

### T7: Rotas de arquivo, títulos e guards

**What**: Arquivos `app/(app)/frota/veiculos.tsx`, `rotas/index.tsx`, `rotas/nova.tsx`, `rotas/[id]/editar.tsx`, `manutencoes/index.tsx`, `manutencoes/nova.tsx`, `viagens/nova.tsx`, `viagens/[id]/fechar.tsx`; aba `(tabs)/viagens.tsx` renderiza `ViagensListView`. `podeVerViagens` em `useMenu()` com a mesma regra da aba. Títulos e guards em `app/(app)/_layout.tsx`. Testes de navegação por perfil e teste de colisão de URL com aba.
**Where**: `app/(app)/**`, `src/navigation/menu.ts`, `src/navigation/__tests__/menu.test.ts`, `__tests__/routes/navegacaoPorPerfil.test.tsx`, `__tests__/routes/colisaoComAbas.test.ts`
**Depends on**: None (a Phase 2 termina antes)
**Reuses**: padrão `Stack.Protected` e `entrarComo()` existentes
**Requirement**: NAV5-05, NAV5-06, NAV5-07, NAV5-08, NAV5-09, NAV5-10, NAV5-11, NAV5-12, NAV5-15

**Tools**:

- MCP: NONE
- Skill: `expo-router`, `teste-componente`

**Done when**:

- [ ] Admin abre as 8 URLs novas com o header de título da spec
- [ ] Motorista e Financeiro voltam para a home em `/frota/veiculos`, `/rotas`, `/rotas/nova`, `/manutencoes`; Gestor abre
- [ ] Motorista abre `/viagens/nova`; Financeiro volta para a home
- [ ] Gestor continua abrindo em `/frota` com o hub; voltar de `/frota/veiculos` retorna ao hub
- [ ] Nenhuma rota interna com a URL de uma aba
- [ ] Gate build verde

**Tests**: integration
**Gate**: build

**Commit**: `feat(navegacao): rotas, títulos e guards de Rotas, Manutenção e Viagens (EIX-77)`
