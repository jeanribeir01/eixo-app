# EIX-58 · Design — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

**Uma issue do Linear = uma branch = um PR.** Cada fase abaixo diz a que issue pertence; o Verifier roda no fim de cada issue, antes do PR. Antes da primeira fase de código: `npm ci` (o `node_modules` local está incompleto desde 06/10).

---

**Design**: `.specs/features/eix58-design-app/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md` §2.5 ("toda task entrega teste: render, caminho feliz e validações dos critérios de aceite"), `.claude/skills/teste-componente`, `jest` em `package.json` (projetos `app` e `supabase`), `.github/workflows`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Primitivos (`src/ui`) | unit (Testing Library) | Toda prop e estado citado nos ACs; `accessibilityRole`/`accessibilityLabel`; valores vindos de token | `src/ui/__tests__/*.test.tsx` | `npx jest --selectProjects app src/ui` |
| Navegação (`src/navigation`: menu, options, views) | unit | 1:1 com os ACs (ícone por aba, aba inicial por perfil, opções do header, hub, placeholders) | `src/navigation/__tests__/*.test.ts(x)` | `npx jest --selectProjects app src/navigation` |
| Layouts de rota (`app/**/_layout.tsx`) | unit com `renderRouter` (`expo-router/testing-library`) | Header com título e voltar; ícones da tab bar; voltar retorna à tela anterior | `__tests__/routes/*.test.tsx` (padrão do projeto, skill `teste-componente`) | `npx jest routes --selectProjects app` |
| Telas de feature (`src/features/*/*View.tsx`) | unit (Testing Library) | Caminho feliz + cada AC + carregando, vazio e erro | `src/features/*/__tests__/*View.test.tsx` | `npx jest --selectProjects app src/features` |
| Hooks (`src/lib`) | unit | Todos os ramos: primeira carga, recarga sem piscar, falha em recarga, resposta antiga descartada, pull-to-refresh | `src/lib/__tests__/*.test.ts` | `npx jest --selectProjects app src/lib` |
| Arquivo de rota fino (`app/**` que só renderiza uma View) | none | build gate | - | build gate only |
| Config, assets e docs (`package.json`, `app.config.ts`, `assets/**`, `*.md`) | none | build gate | - | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Depois de task com teste unitário | `npx jest --selectProjects app <caminho do teste>` |
| Full | Depois de task que mexe em layout de rota ou em várias telas | `npm run test` |
| Build | Fim de fase, task de config/asset/doc, dependência nova | `npm run typecheck && npm run lint && npm run test` (+ `npx -y npm@10 ci --dry-run --ignore-scripts` quando o `package.json` mudar) |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Skills e spec — EIX-59 (06/10)

```
T1 → T2
```

### Phase 2: Ícones e tab bar — EIX-60 (07/10)

```
T3 → T4 → T5 → T6 → T7
```

### Phase 3: Header nativo e Screen — EIX-60 (07/10)

```
T8 → T9 → T11
T10 → T11
T9 → T12
T10 → T12
```

### Phase 4: Primitivos de lista e feedback — EIX-61 (07/10)

```
T13 → T17
T16 → T17
T14 → T15
T14 → T20
T15 → T20
T16 → T20
T17 → T20
T18 → T20
T19 → T20
```

### Phase 5: Hub Financeiro e abas — EIX-62 (08/10)

```
T21
T22
T23 → T24
```

### Phase 6: Listas do Financeiro — EIX-63 (08/10)

```
T25 → T26
T25 → T27
T25 → T28
```

### Phase 7: Conta e usuários — EIX-64 (08/10)

```
T29
T30
```

### Phase 8: Marca — EIX-11 (08/10)

```
T31 → T32 → T34
T31 → T33
```

### Phase 9: Data com calendário nativo — EIX-65 (09/10, cortável)

```
T35 → T36
```

### Phase 10: Build de release — EIX-66 (09/10)

```
T37
```

### Phase 11: Haptics — EIX-67 (pós-entrega)

```
T38 → T39
T38 → T40
```

### Phase 12: Motion — EIX-68 (pós-entrega)

```
T41
T42
```

### Phase 13: Tablet — EIX-69 (pós-entrega)

```
T43 → T44
```

### Phase 14: Spike NativeTabs — EIX-70 (pós-entrega)

```
T45
```

### Phase 15: Performance — EIX-71 (pós-entrega)

```
T46 → T47
T46 → T48
```

### Phase 16: Auditoria final — EIX-72 (pós-entrega)

```
T49
```

---

## Task Breakdown

### Phase 1: Skills e spec — EIX-59

#### T1: Instalar as skills de design Expo

**What**: Instalar `expo-router`, `expo-native-ui`, `expo-design-system`, `expo-animation` (expo/skills) e `vercel-react-native-skills` (vercel-labs/agent-skills) em `.claude/skills/`, com o lock gerado pelo CLI.
**Where**: `skills-lock.json`
**Depends on**: None
**Reuses**: método `copy` das skills existentes
**Requirement**: UIP-06 (as skills guiam os primitivos)

**Tools**:

- MCP: NONE
- Skill: `find-skills`

**Done when**:

- [x] 5 pastas novas em `.claude/skills/`, conteúdo idêntico ao revisado (só markdown, sem script)
- [x] `package.json` e `package-lock.json` sem alteração

**Tests**: none
**Gate**: build (sem código; o `node_modules` local está incompleto, então o gate roda na EIX-60)

---

#### T2: Gravar spec, design, tasks e a AD-009

**What**: Criar `spec.md`, `design.md` e `tasks.md` desta pasta e registrar no `STATE.md` a AD-009 (o DESIGN_CYAN vence as skills `expo-*`).
**Where**: `.specs/STATE.md`
**Depends on**: T1
**Reuses**: formato da `.specs/features/eix36-dividas/spec.md`
**Requirement**: UIP-06

**Tools**:

- MCP: `Linear` (issues EIX-58 a EIX-72)
- Skill: `tlc-spec-driven`

**Done when**:

- [x] `validate_spec.py` e `validate_tasks.py` saem com código 0
- [x] AD-009 em `## Decisions`

**Tests**: none
**Gate**: build (só documentação)

---

### Phase 2: Ícones e tab bar — EIX-60

#### T3: Declarar o expo-symbols

**What**: Declarar `expo-symbols` (versão já instalada pelo expo-router, `~57.0.3`) em `dependencies`, instalando com npm 10 para não reescrever o lockfile.
**Where**: `package.json`
**Depends on**: None
**Reuses**: memória do projeto sobre lockfile (npm 10 no CI)
**Requirement**: NAV-03

**Tools**:

- MCP: NONE
- Skill: `expo-native-ui` (references/icons.md)

**Done when**:

- [x] `"expo-symbols": "~57.0.3"` em `dependencies`
- [x] `npx -y npm@10 ci --dry-run --ignore-scripts` passa
- [x] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: none
**Gate**: build

**Commit**: `chore(ui): declara expo-symbols para os ícones (EIX-60)`

---

#### T4: Token iconSize e mapa de ícones

**What**: Adicionar `iconSize = { sm: 16, md: 20, lg: 24 }` em `tokens.ts` e criar o mapa `icons` (nome semântico → `{ android, ios }`) com os 20 nomes do design.
**Where**: `src/ui/icons.ts`
**Depends on**: T3
**Reuses**: `src/ui/tokens.ts`
**Requirement**: NAV-03

**Tools**:

- MCP: NONE
- Skill: `expo-native-ui`, `expo-design-system`

**Done when**:

- [x] Teste: todo nome Android do mapa existe em `expo-symbols/build/android/symbols.json`
- [x] Teste: todo item tem nome iOS não vazio
- [x] Gate check passes: `npx jest --selectProjects app src/ui/__tests__/icons.test.ts`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): mapa de ícones semânticos e token iconSize (EIX-60)`

---

#### T5: Primitivo Icon

**What**: Criar `Icon` sobre `SymbolView` (tamanho de `iconSize`, cor de `tone`), exportar no `index.ts`, exportar `toneColors` do `Text` e mockar `expo-symbols` no `jest.setup.ts`.
**Where**: `src/ui/Icon.tsx`
**Depends on**: T4
**Reuses**: `toneColors` de `src/ui/Text.tsx`
**Requirement**: NAV-03

**Tools**:

- MCP: NONE
- Skill: `expo-native-ui`, `teste-componente`

**Done when**:

- [x] Teste: renderiza o nome Android do mapa no tamanho do token pedido
- [x] Teste: sem `accessibilityLabel` fica escondido do leitor de tela; com rótulo é anunciado
- [x] Teste: `tone="body"` usa `colors.textBody`
- [x] Gate check passes: `npx jest --selectProjects app src/ui/__tests__/Icon.test.tsx`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): primitivo Icon com Material Symbols (EIX-60)`

---

#### T6: Ícone de cada aba no menu

**What**: Adicionar `icone: IconName` ao tipo `Aba` e preencher conforme a spec (Dashboards `dashboard`, Financeiro `financeiro`, Frota `frota`, Viagens `viagens`, Configurações `configuracoes`).
**Where**: `src/navigation/menu.ts`
**Depends on**: T5
**Reuses**: lista `abas` existente
**Requirement**: NAV-01

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] Teste do `menu.test.ts` afirma o ícone de cada uma das 5 abas
- [x] Gate check passes: `npx jest --selectProjects app src/navigation/__tests__/menu.test.ts`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(navegacao): ícone por aba no menu (EIX-60)`

---

#### T7: Tab bar desenha os ícones

**What**: Passar `tabBarIcon` com `Icon` (tom `primary` na ativa, `body` na inativa) em cada `Tabs.Screen` e tirar `tabBarIcon: () => null` e `tabBarIconStyle` do `tabBarOptions.ts`.
**Where**: `app/(app)/(tabs)/_layout.tsx`
**Depends on**: T6
**Reuses**: `src/navigation/tabBarOptions.ts`
**Requirement**: NAV-01

**Tools**:

- MCP: NONE
- Skill: `expo-router` (references/tabs.md), `teste-componente`

**Done when**:

- [x] Teste com `renderRouter` (perfil Admin): 5 abas com ícone; ativa em `textPrimary`, inativas em `textBody`
- [x] Gate check passes: `npm run test`

**Tests**: unit
**Gate**: full

**Commit**: `feat(navegacao): tab bar com ícones Material Symbols (EIX-60)`

---

### Phase 3: Header nativo e Screen — EIX-60

#### T8: Opções do header em tokens

**What**: Criar `stackOptions` com fundo `canvas`, sem sombra, título `subheading` regular, tint `textPrimary` e voltar só com a seta.
**Where**: `src/navigation/stackOptions.ts`
**Depends on**: None
**Reuses**: estrutura de `src/navigation/tabBarOptions.ts`
**Requirement**: NAV-02

**Tools**:

- MCP: NONE
- Skill: `expo-router` (references/toolbar-and-headers.md)

**Done when**:

- [x] Teste afirma cada opção contra o token correspondente
- [x] Gate check passes: `npx jest --selectProjects app src/navigation/__tests__/stackOptions.test.ts`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(navegacao): opções do header nativo em tokens (EIX-60)`

---

#### T9: Header e títulos na pilha do app

**What**: Usar `screenOptions={stackOptions}` na pilha de `(app)`, manter `headerShown: false` só em `(tabs)` e dar o título em português a cada uma das 14 telas internas (as 12 originais + Novo veículo e Editar veículo, que entraram com o PR #7).
**Where**: `app/(app)/_layout.tsx`
**Depends on**: T8
**Reuses**: guards existentes do `Stack.Protected`
**Requirement**: NAV-02

**Tools**:

- MCP: NONE
- Skill: `expo-router`, `teste-componente`

**Done when**:

- [x] Teste com `renderRouter`: `/categorias` mostra o header "Categorias" e o botão voltar; voltar retorna à aba
- [x] Teste: a aba Financeiro não tem header nativo
- [x] PR #7 (EIX-37) mergeado antes desta task (06/10)
- [x] Gate check passes: `npm run test`

**Tests**: unit
**Gate**: full

**Commit**: `feat(navegacao): header nativo com título e voltar nas telas internas (EIX-60)`

---

#### T10: Screen com scroll, teclado e overlay

**What**: Adicionar ao `Screen` as props `underHeader` (sem inset de topo), `scroll` (`KeyboardAvoidingView` + `ScrollView` com `keyboardShouldPersistTaps="handled"`) e `overlay` (fora do scroll); sem props, nada muda.
**Where**: `src/ui/Screen.tsx`
**Depends on**: None
**Reuses**: estilo atual do `Screen`
**Requirement**: NAV-04

**Tools**:

- MCP: NONE
- Skill: `vercel-react-native-skills` (ui-safe-area-scroll), `teste-componente`

**Done when**:

- [x] Teste: sem props, renderiza como hoje
- [x] Teste: `scroll` cria `ScrollView` com `keyboardShouldPersistTaps="handled"`
- [x] Teste: `overlay` fica fora do `ScrollView`
- [x] Teste: `underHeader` tira o `top` das `edges`
- [x] Gate check passes: `npx jest --selectProjects app src/ui/__tests__/Screen.test.tsx`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): Screen com scroll, teclado e overlay (EIX-60)`

---

#### T11: Formulários e detalhe sem título duplicado

**What**: Nos formulários de categoria, forma de pagamento, movimentação e veículo e no detalhe de usuário, tirar o sobretítulo e o título do conteúdo, usar `Screen underHeader scroll` (o formulário de movimentação larga o próprio `ScrollView`) e mover o Snackbar para `overlay`, que passa a assentar no rodapé. É a mesma edição mecânica em 5 arquivos (o de veículo entrou com o PR #7). No detalhe de usuário o nome continua: é dado, não título repetido.
**Where**: `src/features/categorias/CategoriaFormView.tsx`, `src/features/formas-pagamento/FormaPagamentoFormView.tsx`, `src/features/movimentacoes/MovimentacaoFormView.tsx`, `src/features/veiculos/VeiculoFormView.tsx`, `src/features/usuarios/UsuarioDetalheView.tsx`
**Depends on**: T9, T10
**Reuses**: views atuais
**Requirement**: NAV-02, NAV-04

**Tools**:

- MCP: NONE
- Skill: `formulario-validado`, `teste-componente`

**Done when**:

- [x] Testes das 5 telas: não existe "Eixo Certo" nem título no conteúdo; validações e salvamento seguem passando
- [ ] Teclado testado no emulador em Nova movimentação (campo Descrição e botão Salvar visíveis) — **pendente: conferência manual do Jean no emulador**; o desconto do header está coberto em `Screen.test.tsx`
- [x] Gate check passes: `npm run test`

**Tests**: unit
**Gate**: full

**Commit**: `refactor(telas): formulários sem título duplicado sob o header (EIX-60)`

---

#### T12: Listas e Saldo sem título duplicado

**What**: Em Categorias, Formas de pagamento, Movimentações, Usuários e Saldo e projeção, tirar o sobretítulo e o título do conteúdo, usar `Screen underHeader` e mover o Snackbar para `overlay`. Mesma edição mecânica em 5 arquivos.
**Where**: `src/features/categorias/CategoriasListView.tsx`, `src/features/formas-pagamento/FormasPagamentoListView.tsx`, `src/features/movimentacoes/MovimentacoesListView.tsx`, `src/features/usuarios/UsuariosListView.tsx`, `src/features/caixa/components/SaldoProjecaoView.tsx`
**Depends on**: T9, T10
**Reuses**: views atuais
**Requirement**: NAV-02

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [x] Testes das 5 telas: sem "Eixo Certo" nem título no conteúdo; estados carregando, vazio e erro intactos
- [x] `grep -rn "headerShown: false"` só acha `app/_layout.tsx`, `(auth)`, `(pendente)` e `(tabs)`
- [x] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit
**Gate**: build

**Commit**: `refactor(telas): listas sem título duplicado sob o header (EIX-60)`

---

**Ajustes do Verifier (EIX-60, iteração 1 → 2).** O Verifier deu FAIL por lacunas de teste: 7 de 18 mutantes sobreviveram. Correções:

- [x] AC 4: estilo do header renderizado afirmado no `RNSScreenStackHeaderConfig` (`__tests__/routes/navegacaoPorPerfil.test.tsx`)
- [x] AC 9–11: as 10 telas internas afirmam `underHeader`, e os 5 formulários afirmam o `ScrollView` dentro do `KeyboardAvoidingView`
- [x] AC 8: `Icon` afirma as duas props de esconder, a do iOS e a do Android
- [x] AC 2: a cor do rótulo da aba também é afirmada; o rótulo fica numa linha só (edge case de fonte 1.3)
- [x] AC 6: Formas de pagamento busca o título sem depender de maiúscula; Nova movimentação ganhou a checagem
- [x] AC 1: `tabBarLabelPosition: 'below-icon'` fixa o rótulo abaixo do ícone também no tablet

**Ajustes do Verifier (EIX-60, iteração 2 → 3).**

- [x] AC 11: carregando e erro de carga dos 5 formulários afirmam que a tela fica sob o header (sem inset de topo)
- [x] AC 12 (novo na spec): o overlay do `Screen` usa `pointerEvents="box-none"`, e o conteúdo continua tocável com o Snackbar visível

### Phase 4: Primitivos de lista e feedback — EIX-61

#### T13: Declarar Reanimated e Worklets

**What**: ~~Declarar `react-native-reanimated` (`4.6.0`) e `react-native-worklets` (`0.12.2`) com npm 10.~~ **Cancelada (07/10):** declarar as duas fez o npm aninhar um segundo `react-native-worklets` (0.10.4) dentro de `expo/`. O Snackbar usa o `Animated` do React Native (T17). Declarar o Reanimated passa para a EIX-68.
**Where**: `package.json`
**Depends on**: None
**Reuses**: versões já presentes no `node_modules`
**Requirement**: UIP-04

**Tools**:

- MCP: NONE
- Skill: `expo-animation`

**Done when**:

- [x] Cancelada: nenhuma dependência muda; `package.json` e lockfile iguais à `main`
- [x] `npx -y npm@10 ci --dry-run --ignore-scripts` passa
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: none
**Gate**: build

**Commit**: `chore(ui): declara reanimated e worklets já instalados (EIX-61)`

---

#### T14: ListItem com título, subtítulo, ícone e trailing

**What**: Estender o `ListItem` com `title`, `subtitle`, `icon` e `trailing`; chevron automático quando tem `onPress` e nenhum `trailing`; ripple `border` no Android; `children` continua funcionando.
**Where**: `src/ui/ListItem.tsx`
**Depends on**: None
**Reuses**: `ListItem` atual, `Icon`
**Requirement**: UIP-01

**Tools**:

- MCP: NONE
- Skill: `expo-design-system` (native-slop #13), `teste-componente`

**Done when**:

- [x] Teste: título, subtítulo e ícone aparecem
- [x] Teste: chevron só com `onPress` e sem `trailing`
- [x] Teste: `android_ripple` com `colors.border`
- [x] Teste: uso com `children` continua igual
- [x] Gate check passes: `npx jest --selectProjects app src/ui/__tests__/ListItem.test.tsx`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): ListItem com título, subtítulo, ícone e trailing (EIX-61)`

---

#### T15: ListSection

**What**: Criar `ListSection` (rótulo `caption` opcional + bloco `surface` com borda, `radius.card` e hairline entre as linhas).
**Where**: `src/ui/ListSection.tsx`
**Depends on**: T14
**Reuses**: tokens de `Card`
**Requirement**: UIP-02

**Tools**:

- MCP: NONE
- Skill: `expo-design-system`, `teste-componente`

**Done when**:

- [x] Teste: rótulo renderiza quando passado
- [x] Teste: N filhos geram N−1 separadores
- [x] Gate check passes: `npx jest --selectProjects app src/ui/__tests__/ListSection.test.tsx`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): ListSection para menus e grupos de linhas (EIX-61)`

---

#### T16: FAB estendido

**What**: Criar `FAB` (pílula cyan com ícone e rótulo, ancorado no canto inferior direito com inset de safe area) e exportar `FAB_ALTURA_RESERVADA`.
**Where**: `src/ui/FAB.tsx`
**Depends on**: None
**Reuses**: estilo do `Button variant="primary"`, `Icon`
**Requirement**: UIP-03

**Tools**:

- MCP: NONE
- Skill: `expo-design-system`, `teste-componente`

**Done when**:

- [x] Teste: `accessibilityRole="button"` com o rótulo e `onPress` chamado
- [x] Teste: fundo `accent`, borda `accentEdge`, `minHeight` 44
- [x] Gate check passes: `npx jest --selectProjects app src/ui/__tests__/FAB.test.tsx`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): FAB estendido para a ação principal das listas (EIX-61)`

---

#### T17: Snackbar flutuante

**What**: Animar a entrada do `Snackbar` com o `Animated` do React Native (driver nativo): fade e deslize de 8pt em 200 ms, sem deslize quando o sistema pede menos animação. A posição vem do `overlay` do `Screen`, que empilha Snackbar e FAB no rodapé; por isso a prop `aboveFab` sai do design.
**Where**: `src/ui/Snackbar.tsx`
**Depends on**: T13, T16
**Reuses**: `Snackbar` atual (props mantidas)
**Requirement**: UIP-04

**Tools**:

- MCP: NONE
- Skill: `expo-animation`, `teste-componente`

**Done when**:

- [x] Teste: continua anunciando com `accessibilityRole="alert"` e some após `duration`
- [x] Teste: com "remover animações" ligado, entra sem deslize
- [x] Teste: dentro do `overlay` com FAB, o Snackbar fica acima do FAB
- [x] Gate check passes: `npx jest --selectProjects app src/ui/__tests__/Snackbar.test.tsx`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): Snackbar flutuante com animação curta (EIX-61)`

---

#### T18: Card de destaque e tocável

**What**: Adicionar ao `Card` `variant="feature"` (`radius.feature`) e `onPress` (cartão inteiro vira um botão).
**Where**: `src/ui/Card.tsx`
**Depends on**: None
**Reuses**: `Card` atual
**Requirement**: UIP-05

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] Teste: `feature` usa `radius.feature`
- [x] Teste: com `onPress` tem `accessibilityRole="button"` e dispara o toque
- [x] Gate check passes: `npx jest --selectProjects app src/ui/__tests__/Card.test.tsx`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): Card de destaque e tocável (EIX-61)`

---

#### T19: EmptyState com ícone

**What**: Adicionar `icon` opcional ao `EmptyState` (tamanho `lg`, tom `muted`, acima do título).
**Where**: `src/ui/EmptyState.tsx`
**Depends on**: None
**Reuses**: `EmptyState` atual, `Icon`
**Requirement**: UIP-05

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] Teste: ícone aparece só quando passado
- [x] Gate check passes: `npx jest --selectProjects app src/ui/__tests__/EmptyState.test.tsx`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): EmptyState com ícone (EIX-61)`

---

#### T20: Documentar os primitivos no DESIGN_CYAN

**What**: Atualizar o `DESIGN_CYAN.md` §7 com Icon, header, ListItem, ListSection, FAB e posição do Snackbar, e a regra "o FAB conta como o único cyan da tela".
**Where**: `DESIGN_CYAN.md`
**Depends on**: T14, T15, T16, T17, T18, T19
**Reuses**: estrutura atual do §7
**Requirement**: UIP-06

**Tools**:

- MCP: NONE
- Skill: `expo-design-system`

**Done when**:

- [x] Cada primitivo novo tem anatomia, tokens usados e quando usar
- [x] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: none
**Gate**: build

**Commit**: `docs(design): documenta os primitivos novos no DESIGN_CYAN (EIX-61)`

---

### Phase 5: Hub Financeiro e abas — EIX-62

#### T21: Admin e Financeiro abrem no Financeiro

**What**: Mudar `abaInicialPorPerfil` de Admin e Financeiro para `financeiro`.
**Where**: `src/navigation/menu.ts`
**Depends on**: None
**Reuses**: `abaInicial()`
**Requirement**: FIN-01

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] Teste: Admin → financeiro, Financeiro → financeiro, Gestor de Frota → frota, Motorista → viagens
- [x] Gate check passes: `npx jest --selectProjects app src/navigation/__tests__/menu.test.ts`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(navegacao): Admin e Financeiro abrem no Financeiro (EIX-62)`

---

#### T22: Abas ainda não construídas com ícone e frase

**What**: Trocar a prop `atalhos` do `ModuloEmBreveView` por `icone` e `descricao` e preencher nas rotas de Dashboards, Frota e Viagens.
**Where**: `src/navigation/ModuloEmBreveView.tsx`
**Depends on**: None
**Reuses**: `EmptyState` com ícone
**Requirement**: FIN-04

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [x] Teste: mostra ícone, nome do módulo e a frase; não mostra "Este módulo ainda está em construção."
- [x] Gate check passes: `npx jest --selectProjects app src/navigation/__tests__/ModuloEmBreveView.test.tsx`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(navegacao): abas futuras com ícone e descrição do módulo (EIX-62)`

---

#### T23: Hub Financeiro

**What**: Criar `FinanceiroHubView`: título, cartão de destaque com o saldo (skeleton, erro dentro do cartão, toque abre `/caixa`), `ListSection` com 4 linhas e FAB "Nova movimentação".
**Where**: `src/navigation/FinanceiroHubView.tsx`
**Depends on**: None
**Reuses**: `buscarResumoCaixa`, `SaldoAtualCard`, `Card`, `ListSection`, `FAB`
**Requirement**: FIN-02, FIN-03

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [x] Teste: saldo aparece formatado; skeleton enquanto carrega
- [x] Teste: erro mostra "Não foi possível carregar o saldo." e "Tentar novamente", e as 4 linhas continuam tocáveis
- [x] Teste: cada linha e o FAB navegam para a rota certa
- [x] Teste: não aparece "Em breve"
- [x] Gate check passes: `npx jest --selectProjects app src/navigation/__tests__/FinanceiroHubView.test.tsx`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(financeiro): hub com saldo em destaque e menu do módulo (EIX-62)`

---

#### T24: Aba Financeiro usa o hub

**What**: Trocar o `ModuloEmBreveView` da rota `financeiro` pelo `FinanceiroHubView` e reescrever o `FinanceiroRoute.test.tsx` a partir dos ACs novos.
**Where**: `app/(app)/(tabs)/financeiro.tsx`
**Depends on**: T23
**Reuses**: `FinanceiroRoute.test.tsx`
**Requirement**: FIN-03

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] Teste da rota: renderiza o hub
- [x] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit
**Gate**: build

**Commit**: `feat(navegacao): aba Financeiro abre o hub (EIX-62)`

---

### Phase 6: Listas do Financeiro — EIX-63

#### T25: Hook useDadosDaTela

**What**: Criar o hook de carga de tela: skeleton só na primeira carga, recarga no foco sem piscar, erro em recarga vira `feedbackErro`, descarte de resposta antiga e pull-to-refresh.
**Where**: `src/lib/useDadosDaTela.ts`
**Depends on**: None
**Reuses**: padrões de `SaldoProjecaoView.tsx:35-58` e `MovimentacoesListView.tsx:56-71`
**Requirement**: LST-03

**Tools**:

- MCP: NONE
- Skill: `vercel-react-native-skills`, `teste-componente`

**Done when**:

- [x] Teste: primeira carga `carregando` → `pronto`
- [x] Teste: recarga com dado na tela mantém `pronto` e os dados antigos até chegar o novo
- [x] Teste: falha em recarga preenche `feedbackErro` e mantém os dados
- [x] Teste: resposta de um pedido antigo que chega depois é descartada
- [x] Gate check passes: `npx jest --selectProjects app src/lib/__tests__/useDadosDaTela.test.ts`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(lib): hook de carga de tela sem piscar (EIX-63)`

---

#### T26: Categorias no padrão de app

**What**: Linha tocável (editar), `Switch` "Ativa" na linha, FAB "Nova categoria", pull-to-refresh, 3 skeletons na primeira carga e espaço para o FAB, usando `useDadosDaTela`.
**Where**: `src/features/categorias/CategoriasListView.tsx`
**Depends on**: T25
**Reuses**: `ListItem`, `Switch`, `FAB`, `Skeleton`, `definirAtivaCategoria`
**Requirement**: LST-01, LST-03

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [x] Teste: tocar na linha abre `/categorias/:id/editar`
- [x] Teste: switch desativa, mostra "Categoria desativada." e fica desabilitado enquanto salva
- [x] Teste: FAB abre `/categorias/nova`
- [x] Teste: não existe botão "Editar" nem "Desativar" na linha
- [x] Gate check passes: `npx jest --selectProjects app src/features/categorias`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(categorias): lista no padrão de app com switch e FAB (EIX-63)`

---

#### T27: Formas de pagamento no padrão de app

**What**: Mesmo padrão da T26, mantendo `isFormaFixa` (forma fixa sem switch e sem edição).
**Where**: `src/features/formas-pagamento/FormasPagamentoListView.tsx`
**Depends on**: T25
**Reuses**: `isFormaFixa`, `definirAtivaFormaPagamento`
**Requirement**: LST-01, LST-03

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [x] Teste: forma fixa não tem switch nem abre edição
- [x] Teste: forma editável abre edição no toque e alterna pelo switch com Snackbar
- [x] Gate check passes: `npx jest --selectProjects app src/features/formas-pagamento`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(formas-pagamento): lista no padrão de app (EIX-63)`

---

#### T28: Movimentações no padrão de app

**What**: Linha com descrição, "categoria · data · status" e valor com sinal; toque edita; ícone "Mais opções" abre a confirmação de exclusão (só fora de parcela); meses com ícones; FAB; pull-to-refresh; `useDadosDaTela`.
**Where**: `src/features/movimentacoes/MovimentacoesListView.tsx`
**Depends on**: T25
**Reuses**: `ValorComSinal`, `excluirMovimentacao`, `Alert.alert`
**Requirement**: LST-02, LST-03

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [x] Teste: toque na linha abre `/movimentacoes/:id/editar`
- [x] Teste: "Mais opções" abre "Excluir movimentação?"; parcela não tem a opção
- [x] Teste: botões "Mês anterior" e "Próximo mês" trocam o mês
- [x] Teste: valor com `+`/`−` e tom semântico
- [x] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit
**Gate**: build

**Commit**: `feat(movimentacoes): lista no padrão de app (EIX-63)`

---

### Phase 7: Conta e usuários — EIX-64

#### T29: Tela de Conta

**What**: Criar `ContaView` (substitui `HomeView`): cartão com avatar, nome, e-mail e `Badge` do perfil; linha Usuários (só Admin); linha Versão; botão Sair sem confirmação. Rota `configuracoes` passa a usá-la.
**Where**: `src/features/auth/ContaView.tsx`
**Depends on**: None
**Reuses**: `profileFromSession`, `Avatar`, `Badge`, `ListSection`, `expo-constants`
**Requirement**: CTA-01

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [x] Teste: mostra nome, e-mail e perfil; sem "Login confirmado"
- [x] Teste: linha Usuários só para Admin
- [x] Teste: Versão igual a `expoConfig.version`
- [x] Teste: Sair chama `signOut` direto
- [x] Gate check passes: `npx jest --selectProjects app src/features/auth`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): tela de Conta no lugar da Home de teste (EIX-64)`

---

#### T30: Usuários no padrão de app

**What**: Linha com nome, e-mail e `Badge` de perfil/status; toque abre o detalhe; pull-to-refresh via `useDadosDaTela`.
**Where**: `src/features/usuarios/UsuariosListView.tsx`
**Depends on**: T25
**Reuses**: `ListItem`, `Badge`, `useDadosDaTela`
**Requirement**: CTA-02

**Tools**:

- MCP: NONE
- Skill: `tela-padrao`, `teste-componente`

**Done when**:

- [x] Teste: linha mostra nome, e-mail e perfil; toque abre `/usuarios/:id`
- [x] Teste: pull-to-refresh recarrega
- [x] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit
**Gate**: build

**Commit**: `feat(usuarios): lista no padrão de app (EIX-64)`

---

### Phase 8: Marca — EIX-11

#### T31: Desenho da marca em SVG

**What**: Desenhar a marca (duas rodas ligadas por um eixo, `accentEdge`) em SVG, fonte única dos PNGs e do `Logo`.
**Where**: `assets/brand/eixo-certo-mark.svg`
**Depends on**: None
**Reuses**: descrição do protótipo na EIX-11
**Requirement**: MRC-01

**Tools**:

- MCP: `Figma` (opcional, para revisar o desenho)
- Skill: NONE

**Done when**:

- [ ] SVG legível a 48px e a 1024px
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: none
**Gate**: build

**Commit**: `feat(marca): desenho da marca Eixo Certo em SVG (EIX-11)`

---

#### T32: Primitivo Logo

**What**: Criar `Logo` com `react-native-svg` (marca + wordmark opcional "Eixo Certo").
**Where**: `src/ui/Logo.tsx`
**Depends on**: T31
**Reuses**: molde do `src/ui/GoogleLogo.tsx`
**Requirement**: MRC-02

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [ ] Teste: `accessibilityLabel="Eixo Certo"`; wordmark só com `withWordmark`
- [ ] Gate check passes: `npx jest --selectProjects app src/ui/__tests__/Logo.test.tsx`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): primitivo Logo da marca (EIX-11)`

---

#### T33: Ícone adaptativo e splash

**What**: Gerar os PNGs (foreground, background, monochrome, `icon.png`, splash) a partir do SVG, sem dependência nova no `package.json`, e apontar o `app.config.ts`; apagar as imagens do template Expo.
**Where**: `app.config.ts`
**Depends on**: T31
**Reuses**: config atual do `expo-splash-screen`
**Requirement**: MRC-01

**Tools**:

- MCP: NONE
- Skill: `expo-native-ui`

**Done when**:

- [ ] Launcher e splash do emulador mostram a marca (print anexado na EIX-11)
- [ ] Nenhuma imagem do template em `assets/`
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: none
**Gate**: build

**Commit**: `feat(marca): ícone adaptativo e splash oficiais (EIX-11)`

---

#### T34: Login com a marca

**What**: Trocar o texto "Eixo Certo" do topo do Login pelo `Logo` com wordmark.
**Where**: `src/features/auth/LoginView.tsx`
**Depends on**: T32
**Reuses**: `LoginView` atual
**Requirement**: MRC-02

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [ ] Teste: Login mostra o `Logo`; botões e erros continuam passando
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit
**Gate**: build

**Commit**: `feat(auth): Login com a marca Eixo Certo (EIX-11)`

---

### Phase 9: Data com calendário nativo — EIX-65

#### T35: Declarar o datetimepicker

**What**: Instalar `@react-native-community/datetimepicker` com a versão do SDK 57 (npm 10) e avisar o time que o development build precisa ser refeito.
**Where**: `package.json`
**Depends on**: None
**Reuses**: memória do projeto sobre lockfile
**Requirement**: DAT-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Dependência declarada; `npx -y npm@10 ci --dry-run --ignore-scripts` passa
- [ ] Aviso de rebuild postado no grupo antes do merge
- [x] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: none
**Gate**: build

**Commit**: `chore(deps): adiciona datetimepicker nativo (EIX-65)`

---

#### T36: CampoData com calendário

**What**: No Android, tocar no campo abre `DateTimePickerAndroid` na data atual do campo (ou hoje); confirmar preenche `DD/MM/AAAA`; cancelar mantém; botão "Limpar data" esvazia. Props intactas; iOS mantém a máscara.
**Where**: `src/features/movimentacoes/components/CampoData.tsx`
**Depends on**: T35
**Reuses**: `isoParaDataBR`, `CampoData` atual
**Requirement**: DAT-01

**Tools**:

- MCP: NONE
- Skill: `formulario-validado`, `teste-componente`

**Done when**:

- [x] Teste (mock de `DateTimePickerAndroid.open`): confirmar 05/10/2026 chama `onChange('05/10/2026')`
- [x] Teste: cancelar não chama `onChange`
- [x] Teste: "Limpar data" chama `onChange('')`
- [x] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit
**Gate**: build

**Commit**: `feat(movimentacoes): campo de data com calendário nativo (EIX-65)`

---

### Phase 10: Build de release — EIX-66

#### T37: Build de release e ensaio do roteiro

**What**: Gerar e instalar o APK de release no emulador, conferir o login Google (SHA-1 da chave de release), ensaiar o roteiro do EIX-55 com os dados da EIX-53 e documentar o comando no README.
**Where**: `README.md`
**Depends on**: None
**Reuses**: seção de emulador do README
**Requirement**: REL-01

**Tools**:

- MCP: `Linear` (resultado do ensaio comentado na EIX-55)
- Skill: `run`

**Done when**:

- [ ] APK de release instalado; Google login funciona
- [ ] Roteiro completo sem crash nem tela vermelha
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: none
**Gate**: build

**Commit**: `docs(readme): build de release para a gravação do vídeo (EIX-66)`

---

### Phase 11: Haptics — EIX-67

#### T38: Declarar o expo-haptics

**What**: Instalar `expo-haptics` da versão do SDK 57 com npm 10.
**Where**: `package.json`
**Depends on**: None
**Reuses**: NONE
**Requirement**: HAP-01

**Tools**:

- MCP: NONE
- Skill: `expo-animation`

**Done when**:

- [ ] Dependência declarada; `npx -y npm@10 ci --dry-run --ignore-scripts` passa
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: none
**Gate**: build

**Commit**: `chore(deps): adiciona expo-haptics (EIX-67)`

---

#### T39: Haptics no Snackbar

**What**: Disparar `notificationAsync(Success)` ou `(Error)` quando o Snackbar aparece, ignorando falha.
**Where**: `src/ui/Snackbar.tsx`
**Depends on**: T38
**Reuses**: `Snackbar`
**Requirement**: HAP-01

**Tools**:

- MCP: NONE
- Skill: `expo-animation`, `teste-componente`

**Done when**:

- [ ] Teste: sucesso e erro chamam o tipo certo; rejeição do haptics não quebra
- [ ] Gate check passes: `npx jest --selectProjects app src/ui/__tests__/Snackbar.test.tsx`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): vibração leve no feedback de sucesso e erro (EIX-67)`

---

#### T40: Haptics em Tabs e Switch

**What**: Disparar `selectionAsync()` ao trocar opção do `Tabs` e ao alternar o `Switch`.
**Where**: `src/ui/Tabs.tsx`, `src/ui/Switch.tsx`
**Depends on**: T38
**Reuses**: primitivos atuais
**Requirement**: HAP-01

**Tools**:

- MCP: NONE
- Skill: `expo-animation`, `teste-componente`

**Done when**:

- [ ] Testes: troca dispara `selectionAsync` uma vez
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit
**Gate**: build

**Commit**: `feat(ui): vibração de seleção em abas e switches (EIX-67)`

---

### Phase 12: Motion — EIX-68

#### T41: Skeleton pulsando

**What**: Pulsar a opacidade do `Skeleton` entre 1 e 0.5 em 1 s (Reanimated), parado com "remover animações" ligado.
**Where**: `src/ui/Skeleton.tsx`
**Depends on**: None
**Reuses**: `Skeleton` atual
**Requirement**: ANI-01

**Tools**:

- MCP: NONE
- Skill: `expo-animation`, `teste-componente`

**Done when**:

- [ ] Teste: com reduced motion não anima
- [ ] Gate check passes: `npx jest --selectProjects app src/ui/__tests__/Skeleton.test.tsx`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): skeleton com pulso discreto (EIX-68)`

---

#### T42: Transição de layout nas linhas

**What**: Animar entrada e saída de linha em lista (≤ 250 ms, `LinearTransition`), sem animar a primeira montagem da tela.
**Where**: `src/ui/ListItem.tsx`
**Depends on**: None
**Reuses**: `ListItem`
**Requirement**: ANI-01

**Tools**:

- MCP: NONE
- Skill: `expo-animation`, `teste-componente`

**Done when**:

- [ ] Teste: primeira montagem sem `entering`; reduced motion respeitado
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit
**Gate**: build

**Commit**: `feat(ui): transição de layout ao incluir e remover linhas (EIX-68)`

---

### Phase 13: Tablet — EIX-69

#### T43: Screen com largura máxima no tablet

**What**: Com largura ≥ 768, limitar o conteúdo do `Screen` a 720 e centralizar.
**Where**: `src/ui/Screen.tsx`
**Depends on**: None
**Reuses**: `useWindowDimensions` (padrão de `SaldoProjecaoView`)
**Requirement**: TAB-01

**Tools**:

- MCP: NONE
- Skill: `expo-native-ui`, `teste-componente`

**Done when**:

- [ ] Teste com largura 800: `maxWidth` 720; com 412: sem limite
- [ ] Gate check passes: `npx jest --selectProjects app src/ui/__tests__/Screen.test.tsx`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): largura máxima de conteúdo no tablet (EIX-69)`

---

#### T44: Hub em duas colunas no tablet

**What**: Com largura ≥ 768, dispor as linhas do hub em duas colunas.
**Where**: `src/navigation/FinanceiroHubView.tsx`
**Depends on**: T43
**Reuses**: `FinanceiroHubView`
**Requirement**: TAB-01

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [ ] Teste com largura 800: duas colunas; 412: uma
- [ ] Prints a 360, 412 e 800 sem rolagem horizontal
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit
**Gate**: build

**Commit**: `feat(financeiro): hub em duas colunas no tablet (EIX-69)`

---

### Phase 14: Spike NativeTabs — EIX-70

#### T45: ADR JS Tabs × NativeTabs

**What**: Protótipo descartável de NativeTabs numa branch de spike e ADR comparando RBAC (`Tabs.Protected`), estilo em tokens, testes e visual Android, com decisão.
**Where**: `docs/adr/0003-tab-bar-js-tabs-vs-native-tabs.md`
**Depends on**: None
**Reuses**: formato dos ADRs 0001 e 0002
**Requirement**: NTB-01

**Tools**:

- MCP: NONE
- Skill: `create-adr`, `expo-router` (references/tabs.md)

**Done when**:

- [ ] ADR com contexto, opções, decisão e consequências
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: none
**Gate**: build

**Commit**: `docs(adr): decide entre JS Tabs e NativeTabs (EIX-70)`

---

### Phase 15: Performance — EIX-71

#### T46: Medir a linha de base

**What**: Medir cold start e fps de rolagem (lista de 200 movimentações) no build de release e registrar.
**Where**: `.specs/features/eix58-design-app/perf.md`
**Depends on**: None
**Reuses**: build de release da EIX-66
**Requirement**: PRF-01

**Tools**:

- MCP: NONE
- Skill: `vercel-react-native-skills`, `run`

**Done when**:

- [ ] Tabela com cold start e fps antes da mudança
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: none
**Gate**: build

**Commit**: `docs(perf): linha de base de cold start e rolagem (EIX-71)`

---

#### T47: Linhas memoizadas em Movimentações

**What**: Extrair a linha de movimentação para componente com `memo` e passar `renderItem`/`keyExtractor` estáveis.
**Where**: `src/features/movimentacoes/MovimentacoesListView.tsx`
**Depends on**: T46
**Reuses**: `vercel-react-native-skills` (list-performance-item-memo, list-performance-callbacks)
**Requirement**: PRF-01

**Tools**:

- MCP: NONE
- Skill: `vercel-react-native-skills`, `teste-componente`

**Done when**:

- [ ] Testes da lista continuam verdes; fps registrado ≥ 55
- [ ] Gate check passes: `npx jest --selectProjects app src/features/movimentacoes`

**Tests**: unit
**Gate**: quick

**Commit**: `perf(movimentacoes): linhas memoizadas e callbacks estáveis (EIX-71)`

---

#### T48: Linhas memoizadas nas demais listas

**What**: Mesmo tratamento da T47 em Categorias, Formas de pagamento e Usuários, e registrar o "depois" no `perf.md`.
**Where**: `src/features/categorias/CategoriasListView.tsx`, `src/features/formas-pagamento/FormasPagamentoListView.tsx`, `src/features/usuarios/UsuariosListView.tsx`
**Depends on**: T46
**Reuses**: padrão da T47
**Requirement**: PRF-01

**Tools**:

- MCP: NONE
- Skill: `vercel-react-native-skills`, `teste-componente`

**Done when**:

- [ ] Testes das 3 listas verdes; tabela "depois" preenchida
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit
**Gate**: build

**Commit**: `perf(listas): linhas memoizadas nas listas restantes (EIX-71)`

---

### Phase 16: Auditoria final — EIX-72

#### T49: Auditoria de design e acessibilidade

**What**: Passar o checklist do DESIGN_CYAN §10, as 20 tells do `native-slop.md` e o TalkBack em todas as telas (incluindo Frota, Rotas e Dívidas), registrar a tabela e abrir uma issue "Bug" por defeito.
**Where**: `.specs/features/eix58-design-app/audit.md`
**Depends on**: None
**Reuses**: `.claude/skills/expo-design-system/references/audit.md` e `native-slop.md`
**Requirement**: AUD-01

**Tools**:

- MCP: `Linear`
- Skill: `expo-design-system`, `design:accessibility-review`

**Done when**:

- [ ] Tabela tela × item do checklist preenchida
- [ ] Uma issue por defeito encontrado
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: none
**Gate**: build

**Commit**: `docs(design): auditoria final de design e acessibilidade (EIX-72)`

---

## Pre-approval checks

`validate_tasks.py`: **0 erros, 17 avisos**, todos explicados abaixo.

### Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1–T10, T13–T39, T41–T47, T49 | 1 arquivo, 1 entrega | ✅ Granular |
| T11 | Mesma remoção mecânica (título + `underHeader` + `overlay`) em 4 formulários | ⚠️ Mantida: dividir gera 4 commits idênticos; o teste de cada tela é atualizado na mesma task |
| T12 | Mesma remoção mecânica em 5 listas | ⚠️ Mantida pelo mesmo motivo; as listas são reescritas de verdade nas T26–T30 |
| T40 | `Tabs` + `Switch` (uma linha de haptics em cada) | ⚠️ P2: dividir ao replanejar a EIX-67 |
| T48 | Memo em 3 listas | ⚠️ P2: dividir ao replanejar a EIX-71, depois da medição da T46 |

### Diagram-Definition Cross-Check

Conferido pelo script (`diagram ↔ Depends on` dentro de cada fase): sem divergência. Dependências entre fases só apontam para trás (T30 → T25).

### Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1, T2, T20, T31, T33, T37, T45, T46, T49 | Docs, assets, config | none | none | ✅ |
| T3, T13, T35, T38 | `package.json` | none | none | ✅ |
| T4, T5, T10, T14–T19, T32, T39, T41–T43 | Primitivos `src/ui` | unit | unit | ✅ |
| T6, T8, T21–T23, T44 | Navegação `src/navigation` | unit | unit | ✅ |
| T7, T9 | Layouts de rota | unit (`renderRouter`) | unit | ✅ |
| T24 | Rota fina com teste de rota existente | none | unit (mantém o `FinanceiroRoute.test.tsx`) | ✅ |
| T11, T12, T26–T30, T34, T36, T40, T47, T48 | Telas de feature | unit | unit | ✅ |
| T25 | Hook `src/lib` | unit | unit | ✅ |

## Issues do Linear

| Fase | Issue | Prazo | Prioridade |
| --- | --- | --- | --- |
| 1 | EIX-59 Skills e spec | 06/10 | P0 |
| 2–3 | EIX-60 Fundação: ícones, header nativo e Screen | 07/10 | P0 |
| 4 | EIX-61 Primitivos de lista e feedback | 07/10 | P0 |
| 5 | EIX-62 Hub Financeiro e abas | 08/10 | P0 |
| 6 | EIX-63 Listas do Financeiro | 08/10 | P0 |
| 7 | EIX-64 Conta e usuários | 08/10 | P0 |
| 8 | EIX-11 Marca: ícone, splash e Login | 08/10 | P0 |
| 9 | EIX-65 Data com calendário nativo | 09/10 (cortável) | P0 |
| 10 | EIX-66 Build de release e ensaio | 09/10 | P0 |
| 11–16 | EIX-67 a EIX-72 | depois de 12/10 | P1 |
