# EIX-80 · US07-b Mapa da rota — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/eix80-mapa-rota/spec.md`
**Design**: inline (sem `design.md`). As decisões de arquitetura estão no ADR 0005 e na AD-012. O detalhe segue `DividaDetalheView` e usa `useDadosDaTela`, para recarregar quando a tela volta ao foco. O mapa usa a API do MapLibre 11.5.0: `Map` com `mapStyle`, `Camera` com `initialViewState`, e `GeoJSONSource` com `Layer` `line` e `circle`.
**Status**: Approved

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md` §2.5 ("toda task entrega teste": render, caminho feliz e validações dos AC), skill `teste-componente`, critério de aceite da EIX-80 ("componente de mapa mockado no Jest").

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Busca de coordenadas | unit | Cada regra de MAPA-03 contra o JSON real: acento, maiúscula, espaço, UF errada, cidade inexistente | `src/features/rotas/mapa/__tests__/coordenadas.test.ts` | `npx jest src/features/rotas --selectProjects app` |
| Componente do mapa | unit (MapLibre mockado) | Cada AC de MAPA-01..12 e MAPA-21, pelas props passadas ao MapLibre e pelo texto na tela | `src/features/rotas/mapa/__tests__/MapaRota.test.tsx` | `npx jest src/features/rotas --selectProjects app` |
| Telas (detalhe e lista) | unit (render + interação) | Carregando, erro, sucesso, inativa, Editar, recarga ao focar, navegação da lista | `src/features/rotas/__tests__/*View.test.tsx` | `npx jest src/features/rotas --selectProjects app` |
| Dados embarcados, config e rota do expo-router | none | Provados pelos testes de coordenadas e pelo typecheck dos tipos de rota | - | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Task com testes só da pasta da feature | `npx jest src/features/rotas --selectProjects app` |
| Build | Task sem teste, fim de fase e última task | `npm run typecheck && npm run lint && npm run test` |

---

## Execution Plan

### Phase 1: Fundação

Dependência nativa e dados das cidades. Nada de tela ainda.

```
T1 → T2 → T3
```

### Phase 2: Mapa e detalhe

```
T4 → T5 → T6 → T7
```

---

## Task Breakdown

### T1: Dependência do MapLibre e config plugin

**What**: Instalar `@maplibre/maplibre-react-native@11.5.0` e `@types/geojson` (devDependency) e registrar o plugin em `app.config.ts`.
**Where**: `app.config.ts`
**Depends on**: None
**Reuses**: comentários dos plugins já registrados
**Requirement**: MAPA-12

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `package.json` com a versão exata 11.5.0 e o `@types/geojson`
- [ ] Plugin `@maplibre/maplibre-react-native` em `plugins`, com o motivo comentado
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: none
**Gate**: build

**Commit**: `chore(deps): adiciona MapLibre para o mapa da rota (EIX-80)`

---

### T2: Dataset compacto de municípios

**What**: JSON por UF com `[nome, latitude, longitude]` gerado do `kelvins/Municipios-Brasileiros`, com o script gerador e a licença MIT ao lado.
**Where**: `src/features/rotas/mapa/municipios.json`
**Depends on**: T1
**Reuses**: dataset citado no ADR 0005
**Requirement**: MAPA-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] 27 UFs e 5.571 municípios; arquivo de ~190 KB
- [ ] `gerarMunicipios.mjs` regenera o JSON a partir dos CSVs do kelvins; `municipios.LICENSE` com o texto MIT
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: none
**Gate**: build

**Commit**: `feat(rotas): tabela de municípios do IBGE para o mapa (EIX-80)`

---

### T3: Busca de coordenadas

**What**: `buscarCoordenadas(cidade, uf)` devolve `[longitude, latitude]` ou `null`, comparando com `chaveCidade`.
**Where**: `src/features/rotas/mapa/coordenadas.ts`
**Depends on**: T2
**Reuses**: `src/features/rotas/cidade.ts` (`chaveCidade`)
**Requirement**: MAPA-03

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [ ] Curitiba/PR devolve a coordenada do dataset; "sao  PAULO "/SP acha São Paulo/SP; Curitiba/SP e "Curitba"/PR devolvem `null`
- [ ] Gate check passes: `npx jest src/features/rotas --selectProjects app`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(rotas): busca de coordenadas por cidade e UF (EIX-80)`

---

### T4: Componente MapaRota

**What**: Mapa com marcadores de origem e destino, linha, enquadramento, legenda e os estados sem coordenadas, carregando e erro com "Tentar novamente".
**Where**: `src/features/rotas/mapa/MapaRota.tsx`
**Depends on**: T3
**Reuses**: `src/ui` (`Card`, `Column`, `EmptyState`, `Skeleton`, `Text`, tokens), `src/features/rotas/types.ts`
**Requirement**: MAPA-01, MAPA-02, MAPA-04..MAPA-12, MAPA-21

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [ ] Com coordenadas: dados GeoJSON com os dois pontos e a linha, bounds e padding certos, cores só dos tokens, gestos desligados, estilo da constante, legenda
- [ ] Sem coordenadas: mensagem por cidade, sem montar o mapa
- [ ] Skeleton até `onDidFinishLoadingMap`; `onDidFailLoadingMap` mostra o erro; "Tentar novamente" volta ao carregando
- [ ] Mesmo ponto: centraliza com zoom 10; proporção 4:3 e 16:9 conforme a largura
- [ ] Gate check passes: `npx jest src/features/rotas --selectProjects app`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(rotas): componente de mapa da rota com MapLibre (EIX-80)`

---

### T5: Tela de detalhe da rota

**What**: `RotaDetalheView`: trecho, distância (e "Inativa"), `MapaRota` e botão "Editar", com os estados carregando e erro.
**Where**: `src/features/rotas/RotaDetalheView.tsx`
**Depends on**: T4
**Reuses**: `src/features/dividas/components/DividaDetalheView.tsx`, `src/lib/useDadosDaTela.ts`, `buscarRotaPorId`
**Requirement**: MAPA-14..MAPA-18, MAPA-20, MAPA-22, MAPA-23

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [ ] Trecho e distância com vírgula; "Inativa" na rota inativa; "Editar" abre `/rotas/<id>/editar`
- [ ] "Carregando rota"; erro com a mensagem do repositório e "Tentar novamente"; recarrega ao voltar ao foco
- [ ] Gate check passes: `npx jest src/features/rotas --selectProjects app`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(rotas): tela de detalhe da rota com o mapa (EIX-80)`

---

### T6: Rota `/rotas/[id]` e título no layout

**What**: Arquivo de rota que renderiza `RotaDetalheView`, e o título "Rota" declarado no guard de Frota.
**Where**: `app/(app)/rotas/[id]/index.tsx`
**Depends on**: T5
**Reuses**: `app/(app)/dividas/[id].tsx`, `app/(app)/_layout.tsx`
**Requirement**: MAPA-19

**Tools**:

- MCP: NONE
- Skill: `expo-router`

**Done when**:

- [ ] `Stack.Screen name="rotas/[id]/index"` com título "Rota" dentro de `podeVerFrota`
- [ ] Tipos de rota regenerados (`npx expo start` até o Metro subir)
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: none
**Gate**: build

**Commit**: `feat(rotas): rota do detalhe da rota (EIX-80)`

---

### T7: Lista abre o detalhe

**What**: Tocar numa rota da lista abre `/rotas/<id>`, não mais a edição (substitui o ROTA-23 da EIX-38).
**Where**: `src/features/rotas/RotasListView.tsx`
**Depends on**: T6
**Reuses**: teste ROTA-23 de `RotasListView.test.tsx`
**Requirement**: MAPA-13

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [ ] Teste da linha espera `/rotas/r2`, com o comentário de que MAPA-13 substitui o ROTA-23
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit
**Gate**: build

**Commit**: `feat(rotas): linha da lista abre o detalhe da rota (EIX-80)`

---

## Phase Execution Map

```
Phase 1 → Phase 2

Phase 1:  T1 ------→ T2 ------→ T3
Fases:    T3 ------→ T4
Phase 2:  T4 ------→ T5 ------→ T6 ------→ T7
```

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | início da Phase 1 | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | Phase 1 → Phase 2 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Config | none | none | ✅ OK |
| T2 | Dados embarcados | none | none | ✅ OK |
| T3 | Busca de coordenadas | unit | unit | ✅ OK |
| T4 | Componente do mapa | unit | unit | ✅ OK |
| T5 | Tela de detalhe | unit | unit | ✅ OK |
| T6 | Rota do expo-router | none | none | ✅ OK |
| T7 | Tela de lista | unit | unit | ✅ OK |
