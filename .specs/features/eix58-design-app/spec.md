# EIX-58 · Design — App com cara de produto para a entrega de 12/10

## Problem Statement

O app funciona, mas parece um protótipo. As telas internas não têm header nem botão voltar, a tab bar só tem texto e cada tela repete "Eixo Certo" como sobretítulo. O roteiro do vídeo (EIX-55) passa por telas de teste ("Login confirmado") e por placeholders ("Em breve"). As listas seguem o padrão de painel web: um botão por linha e um spinner que pisca a cada volta de foco. O vídeo só pode ser gravado depois do **congelamento de código de 09/10**, então o que aparece no roteiro precisa estar pronto até essa data.

## Goals

- [ ] Todas as telas do roteiro do EIX-55 usam header nativo com voltar, tab bar com ícones e nenhuma tela de teste ou texto "em construção" no Financeiro — até 09/10.
- [ ] Os padrões novos (Icon, header, ListItem, ListSection, FAB, Snackbar flutuante) existem como primitivos de `src/ui/` e estão documentados no `DESIGN_CYAN.md`, para Frota, Rotas e Dívidas (outros devs) adotarem sem inventar estilo.
- [ ] O vídeo é gravado num build de release, sem overlay de desenvolvimento.
- [ ] Depois de 12/10: haptics, motion com reduced motion, tablet, performance medida e auditoria final.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Dark mode | `userInterfaceStyle: 'light'` no `app.config.ts`; o DESIGN_CYAN só define a paleta clara |
| Trocar a fonte Inter pela do sistema | Decisão de marca do DESIGN_CYAN; a skill `expo-design-system` (tell #6) é sobreposta pelo guia |
| `@expo/ui` (SwiftUI/Compose) nos controles | Os primitivos próprios sobre tokens são a decisão do CLAUDE.md §2 e §8; `@expo/ui` mudaria a identidade visual |
| NativeTabs (Material 3) no P0 | Decidido com o Jean: JS Tabs + ícones; NativeTabs vira spike pós-entrega (EIX-70) |
| `react-native-keyboard-controller` | Dependência não autorizada; P0 usa `KeyboardAvoidingView` + `keyboardShouldPersistTaps` |
| Painel de KPIs, gráficos e ranking | US11–US13 (EIX-44, EIX-45, EIX-46) |
| Telas de Frota, Rotas e Dívidas | EIX-37, EIX-38 e EIX-50 (Diogo e Eduardo); elas adotam os primitivos novos nas próprias tasks |
| iOS | AD-003: nesta fase o app é só Android |
| Tela "Aguardando liberação" | Não aparece no roteiro do vídeo |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Tela inicial de Admin e Financeiro | Aba Financeiro (hub com saldo + menu) | Decidido com o Jean em 06/10; não invade a EIX-44 | y |
| Tab bar | JS `Tabs` do expo-router + ícones Material Symbols via `expo-symbols` | Decidido com o Jean; baixo risco antes do freeze | y |
| Dependências novas | `expo-symbols`, `expo-haptics`, `@react-native-community/datetimepicker` | Autorizadas pelo Jean em 06/10 | y |
| Prioridade | P1⭐ desta spec = P0 do vídeo (até 09/10); P2 = pós-entrega | Decidido com o Jean | y |
| Alterar `src/ui/` | Autorizado nas tasks deste épico | AGENTS.md §4 pede autorização explícita; dada pelo Jean em 06/10 | y |
| `react-native-reanimated` no Snackbar | Declarar no `package.json` a versão já instalada (peer obrigatório do expo-router), junto com `react-native-worklets` | Não baixa nada novo, mas é uma linha nova no `package.json`; autorizado pelo Jean em 06/10 | y |
| Precedência entre skills e guia | `DESIGN_CYAN.md` vence as skills `expo-*` em cor, tipografia, espaçamento, borda e forma | As skills sugerem cores semânticas do iOS, fonte do sistema e `@expo/ui`; o guia é a fonte única de verdade visual | y |
| Nome da aba de conta | Continua "Configurações" | Já aparece nos slides da EIX-54; renomear não muda o vídeo | n |
| Confirmação ao sair | Sem confirmação; "Sair" encerra a sessão direto | Logout é reversível (basta entrar de novo); a skill `expo-design-system` (tell #10) desaconselha alerta em ação rotineira e o vídeo faz logout duas vezes | n |
| Ação principal das listas | FAB estendido (pílula cyan com ícone + rótulo) no canto inferior direito | Padrão Material no Android (app só Android, AD-003); a pílula segue o `radius.pill` do guia | n |
| Excluir movimentação | Ícone "mais opções" na linha abre o alerta nativo de confirmação | Exclusão física e sem volta: a confirmação é o caso de uso correto do alerta | n |
| Desativar categoria e forma de pagamento | `Switch` na própria linha, sem confirmação, com Snackbar | Soft delete reversível; "switch de soft delete" é o que o CLAUDE.md §8 descreve para a US01 | n |
| Feedback de toque em linha | Ripple do Android (`android_ripple` na cor `border`); `opacity 0.6` continua nos botões | A skill (tell #13) pede destaque de fundo em linha; ripple é o idioma do Android | n |
| Ícone da marca | Duas rodas ligadas por um eixo (círculo + linha + círculo) em `accentEdge`, sobre fundo `canvas` | Desenho do protótipo descrito na EIX-11 | n |
| Campo de data no iOS | Mantém o campo com máscara atual | App só Android (AD-003); o calendário nativo é `DateTimePickerAndroid` | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Navegação nativa e ícones ⭐ MVP

**User Story**: As a gestor, I want every screen to have a native header with back and a tab bar with icons so that the app feels like a professional Android app.

**Why P1**: É o que mais denuncia "protótipo" no vídeo; todas as outras stories dependem dos primitivos daqui (EIX-60).

**Acceptance Criteria**:

1. The system SHALL render each visible tab with a Material Symbols icon above its label: Dashboards `dashboard`, Financeiro `account_balance_wallet`, Frota `local_shipping`, Viagens `route`, Configurações `settings`.
2. WHILE a tab is active the system SHALL draw its icon and label in `colors.textPrimary`, and the inactive tabs in `colors.textBody`.
3. WHEN an internal screen opens THEN the system SHALL show a native header with a back button and a title in Portuguese: Saldo e projeção, Categorias, Nova categoria, Editar categoria, Formas de pagamento, Nova forma de pagamento, Editar forma de pagamento, Movimentações, Nova movimentação, Editar movimentação, Novo veículo, Editar veículo, Usuários, Usuário.
4. The system SHALL style the header with `colors.canvas` background, no shadow or elevation, title in `typography.subheading` with `fontFamily.regular` and tint `colors.textPrimary`.
5. WHEN the user taps the header back button THEN the system SHALL return to the previous screen.
6. The system SHALL NOT render the "Eixo Certo" overline or a second in-content title on internal screens that have a header.
7. The system SHALL provide an `Icon` primitive that takes a semantic name from a central icon map and a `colors` token, and renders it at a size from the `iconSize` token (16, 20 or 24).
8. IF an `Icon` is rendered without `accessibilityLabel` THEN the system SHALL hide it from screen readers.
9. WHERE `Screen` receives `scroll` the system SHALL render the content in a `ScrollView` with `keyboardShouldPersistTaps="handled"` inside a `KeyboardAvoidingView`.
10. WHEN a text field inside a `Screen` with `scroll` receives focus THEN the system SHALL keep that field visible above the keyboard.
11. WHERE `Screen` is rendered under a native header the system SHALL NOT add the top safe-area inset.

**Independent Test**: Abrir Financeiro → Categorias no emulador: tab bar com 5 ícones, header "Categorias" com seta de voltar, nenhum "Eixo Certo" no conteúdo; abrir Nova movimentação e focar Descrição com o teclado aberto.

---

### P1: Primitivos de lista e feedback ⭐ MVP

**User Story**: As a dev do time, I want list rows, grouped sections, a FAB and a floating Snackbar as primitives so that every screen (incluindo Frota, Rotas e Dívidas) gets the same app pattern without custom styles.

**Why P1**: Hub, listas e conta (stories seguintes) são montados só com estes primitivos (EIX-61).

**Acceptance Criteria**:

1. The system SHALL let `ListItem` render a `title`, an optional `subtitle`, an optional leading `icon` and an optional `trailing` node, while still accepting free `children` as today.
2. WHERE `ListItem` has `onPress` and no `trailing` the system SHALL show a `chevron_right` icon in `colors.textMuted` at the end of the row.
3. WHEN the user presses a `ListItem` with `onPress` on Android THEN the system SHALL show a ripple in `colors.border`.
4. The system SHALL provide a `ListSection` primitive: optional caption-sized label above a `surface` block with 1px `colors.border` border, `radius.card` and hairline separators between rows.
5. The system SHALL provide a `FAB` primitive: `radius.pill`, `colors.accent` fill, 1px `colors.accentEdge` border, `add` icon plus a label in `colors.onAccent` weight medium, minimum height `touchTarget`, anchored `spacing.base` from the right and bottom edges plus the bottom safe-area inset.
6. The system SHALL require an `accessibilityLabel` on `FAB` and expose it with `accessibilityRole="button"`.
7. WHEN a `Snackbar` appears THEN the system SHALL float it over the content, anchored `spacing.base` above the bottom edge (or above the FAB when the screen has one), with a fade and 8pt slide lasting 200 ms.
8. WHILE the OS "remove animations" setting is on the system SHALL show the `Snackbar` without slide.
9. WHERE `EmptyState` receives an `icon` the system SHALL show that icon at `iconSize.lg` in `colors.textMuted` above the title.
10. WHERE `Card` receives `onPress` the system SHALL make the whole card one touch target with `accessibilityRole="button"`; WHERE it receives `variant="feature"` it SHALL use `radius.feature`.
11. The system SHALL document `Icon`, header, `ListItem`, `ListSection`, `FAB` and Snackbar position in `DESIGN_CYAN.md` §7.

**Independent Test**: Testes de componente de cada primitivo; tela de Categorias montada com eles no emulador.

---

### P1: Abas do menu sem cara de protótipo ⭐ MVP

**User Story**: As an Admin, I want to open the app on a Financeiro hub with my balance and the module menu so that the first screen after login is useful.

**Why P1**: É o primeiro frame do vídeo depois do login, e o roteiro passa por todas as abas do Admin (EIX-62).

**Acceptance Criteria**:

1. WHEN an Admin or Financeiro user enters the app THEN the system SHALL open the Financeiro tab.
2. WHEN a Gestor de Frota or Motorista enters the app THEN the system SHALL open Frota or Viagens respectively, as today.
3. The system SHALL show at the top of the Financeiro tab a `feature` card with "Saldo atual" and the balance from `resumo_caixa`, formatted like the Saldo e projeção screen.
4. WHEN the user taps the balance card THEN the system SHALL open Saldo e projeção.
5. WHILE the balance loads the system SHALL show a skeleton in the card's place.
6. IF the balance fails to load THEN the system SHALL show "Não foi possível carregar o saldo." and a "Tentar novamente" button inside the card, and keep the menu below usable.
7. The system SHALL list in a `ListSection` the rows Movimentações (`swap_vert`), Saldo e projeção (`monitoring`), Categorias (`category`) and Formas de pagamento (`credit_card`), each with a one-line description and opening its screen.
8. The system SHALL show on the Financeiro tab a FAB "Nova movimentação" that opens the new-movement form.
9. The system SHALL NOT show the text "Em breve" or "Este módulo ainda está em construção" on the Financeiro tab.
10. The system SHALL show on the Dashboards, Frota and Viagens tabs, while their modules are not built, an `EmptyState` with the module icon, the module name and one sentence on what the module will do.

**Independent Test**: Login como Admin no emulador abre Financeiro com saldo; tocar no cartão abre a projeção; abrir Dashboards mostra o ícone e a frase do módulo.

---

### P1: Listas do Financeiro no padrão de app ⭐ MVP

**User Story**: As a gestor financeiro, I want lists where I tap the row to edit, add with a FAB and pull to refresh so that managing the records feels like a native app.

**Why P1**: Categorias, Formas de Pagamento e Movimentações estão no roteiro do vídeo (EIX-63).

**Acceptance Criteria**:

1. WHEN the user taps a row in Categorias, in Movimentações, or an editable row in Formas de pagamento THEN the system SHALL open that item's edit screen.
2. The system SHALL replace the full-width "Nova categoria", "Nova forma de pagamento" and "Nova movimentação" buttons at the top with a `FAB` carrying the same label.
3. The system SHALL show in each row of Categorias and Formas de pagamento a `Switch` labeled "Ativa" that activates or deactivates the item, keeping the current rule of which payment forms can change.
4. WHILE the activation of a row is saving the system SHALL disable that row's `Switch`.
5. WHEN the activation is saved THEN the system SHALL show the Snackbar "Categoria desativada." / "Categoria reativada." (or the payment-form equivalent already in the code).
6. The system SHALL show each Movimentação row with the description as title, "categoria · data · status" as subtitle and the value with sign (`+`/`−`) and semantic color as trailing.
7. WHEN the user taps the "Mais opções" icon of a non-installment Movimentação THEN the system SHALL open the native confirmation "Excluir movimentação?" with Cancelar and Excluir.
8. The system SHALL NOT show a delete option on installment rows (`divida_id` not null).
9. WHEN the user pulls down a list THEN the system SHALL reload it showing the native refresh indicator in `colors.accent`.
10. WHEN the user returns to a list that already shows items THEN the system SHALL keep those items visible while reloading, without a spinner or skeleton.
11. WHILE a list loads for the first time the system SHALL show three skeleton rows.
12. The system SHALL change month in Movimentações with `chevron_left` / `chevron_right` icon buttons labeled "Mês anterior" / "Próximo mês".
13. The system SHALL leave bottom padding so the last row is never covered by the FAB.

**Independent Test**: No emulador, abrir Categorias, desativar uma pelo switch, tocar numa linha para editar, voltar (sem piscar), puxar para atualizar.

---

### P1: Conta e usuários ⭐ MVP

**User Story**: As a logged-in user, I want an account screen with my profile and sign-out so that the app has no test screens.

**Why P1**: O roteiro faz logout duas vezes nesta tela; hoje ela diz "tela de teste" (EIX-64).

**Acceptance Criteria**:

1. The system SHALL show on Configurações a card with the avatar, display name, e-mail and a `Badge` with the user's profile (Admin, Gestor de Frota, Financeiro ou Motorista).
2. The system SHALL NOT show the texts "Login confirmado" or "Esta é uma tela de teste da autenticação com Google." anywhere.
3. WHILE the user is Admin the system SHALL show a `ListItem` "Usuários" (`group` icon) that opens the Usuários screen.
4. The system SHALL show a `ListItem` "Versão" with the app version from `app.config.ts`.
5. WHEN the user taps "Sair" THEN the system SHALL end the session without a confirmation dialog.
6. The system SHALL show each row of Usuários with name as title, e-mail as subtitle and profile/status as trailing `Badge`, opening the user detail on tap.
7. WHEN the user pulls down the Usuários list THEN the system SHALL reload it.

**Independent Test**: Logar como Admin e como Motorista; conferir o cartão, a linha Usuários só no Admin e o Sair.

---

### P1: Marca — ícone, splash e Login ⭐ MVP

**User Story**: As the team, I want the official Eixo Certo icon, splash and logo on Login so that the video does not show the Expo template icon.

**Why P1**: O ícone aparece no launcher e na splash, os primeiros segundos do vídeo (EIX-11).

**Acceptance Criteria**:

1. The system SHALL use the Eixo Certo mark (two wheels joined by an axle, `colors.accentEdge`) as the Android adaptive icon foreground, with `colors.canvas` background and a monochrome version.
2. The system SHALL show the mark centered on `colors.canvas` in the splash screen.
3. The system SHALL show on Login the mark above the "Eixo Certo" wordmark, drawn by an in-app `Logo` component made with `react-native-svg`.
4. The system SHALL NOT keep any Expo template image in `assets/`.

**Independent Test**: Instalar o build no emulador e conferir launcher, splash e Login.

---

### P1: Data com calendário nativo ⭐ MVP

**User Story**: As a gestor financeiro, I want to pick dates in a calendar so that I do not type DD/MM/AAAA by hand.

**Why P1**: O roteiro cadastra uma Entrada mostrando a data de pagamento (EIX-65).

**Acceptance Criteria**:

1. WHEN the user taps a date field on Android THEN the system SHALL open the native date picker on the field's current date, or on today when empty.
2. WHEN the user confirms a date THEN the system SHALL fill the field as `DD/MM/AAAA` and call `onChange` with that string.
3. WHEN the user cancels the picker THEN the system SHALL keep the previous value.
4. WHERE the field has a value the system SHALL show a "Limpar data" icon button (`close`) that sets it to empty.
5. The system SHALL keep the `CampoData` props (`label`, `value`, `onChange`, `error`) unchanged, so the forms that use it compile without edits.

**Independent Test**: No formulário de Nova movimentação, escolher a data de pagamento pelo calendário e salvar.

---

### P1: Build de release para a gravação ⭐ MVP

**User Story**: As the team, I want to record the video on a release build so that it has real performance and no development overlays.

**Why P1**: Gravar em dev build mostra o menu de desenvolvimento e animações mais lentas (EIX-66).

**Acceptance Criteria**:

1. The system SHALL build and install a release APK on the Android emulator with `npx expo run:android --variant release`.
2. WHEN the user taps "Continuar com Google" on the release build THEN the system SHALL sign in successfully.
3. The system SHALL NOT show the dev menu, LogBox or performance overlays on the release build.
4. WHEN the full EIX-55 script runs on the release build with the EIX-53 demo data THEN the system SHALL complete it without a crash or a red error screen.

**Independent Test**: Ensaio do roteiro completo do EIX-55 no build de release.

---

### P2: Haptics

**User Story**: As a motorista or gestor, I want a light vibration when I complete an action so that I feel the app responded, even under sun glare in the cab.

**Why P2**: Não aparece no vídeo; melhora o uso real (EIX-67).

**Acceptance Criteria**:

1. WHEN a success Snackbar appears THEN the system SHALL fire `Haptics.notificationAsync(Success)`.
2. WHEN an error Snackbar appears THEN the system SHALL fire `Haptics.notificationAsync(Error)`.
3. WHEN the user changes a `Tabs` option or a `Switch` THEN the system SHALL fire `Haptics.selectionAsync()`.
4. IF the haptics call fails THEN the system SHALL ignore the failure without affecting the action.

---

### P2: Motion contido

**User Story**: As a user, I want subtle, interruptible motion on state changes so that the app feels fluid without distracting.

**Why P2**: Polimento pós-entrega, guiado pela skill `expo-animation` (EIX-68).

**Acceptance Criteria**:

1. WHEN an item is added to or removed from a list THEN the system SHALL animate the layout with Reanimated in at most 250 ms.
2. WHILE skeletons are visible the system SHALL pulse their opacity between 1 and 0.5 on a 1 s loop.
3. WHILE the OS "remove animations" setting is on the system SHALL skip the animations from AC 1 and AC 2.
4. The system SHALL NOT animate entrance of routine screens or replay list entrance on every visit.

---

### P2: Tablet

**User Story**: As a gestor using a tablet, I want readable line lengths and a two-column hub so that the app works on larger screens (RNF02).

**Why P2**: RNF02 exige; o vídeo é no celular (EIX-69).

**Acceptance Criteria**:

1. WHILE the window width is at least 768 the system SHALL limit `Screen` content to 720 wide, centered.
2. WHILE the window width is at least 768 the system SHALL lay out the Financeiro hub rows in two columns.
3. The system SHALL render every screen of this epic without horizontal scroll at 360, 412 and 800 wide.

---

### P2: Spike de NativeTabs

**User Story**: As the tech lead, I want a measured comparison between JS Tabs and NativeTabs so that the tab bar decision is documented for the banca.

**Why P2**: Decisão adiada do P0 (EIX-70).

**Acceptance Criteria**:

1. The system SHALL have an ADR in `docs/adr/` comparing JS Tabs and NativeTabs on RBAC (`Tabs.Protected`), token styling, tests and Android look, ending with a decision.

---

### P2: Performance medida

**User Story**: As a user on an old Android phone, I want fast startup and smooth lists so that the app never feels slow (RNF06).

**Why P2**: "Otimização" pedida pelo Jean; medir exige o build de release (EIX-71).

**Acceptance Criteria**:

1. The system SHALL memoize list row components and pass stable `renderItem` and `keyExtractor` references in every list of the epic.
2. The system SHALL record cold start time (process start to first interactive screen) on the release build in the task, before and after the changes.
3. WHEN a list with 200 items scrolls on the release build THEN the system SHALL keep the JS frame rate at or above 55 fps in the performance monitor.

---

### P2: Auditoria final de design e acessibilidade

**User Story**: As the team, I want a final audit of every screen against DESIGN_CYAN and the native-slop list so that the banca sees a consistent app.

**Why P2**: Fecha o épico antes da banca; inclui telas dos outros devs (EIX-72).

**Acceptance Criteria**:

1. The system SHALL pass the DESIGN_CYAN §10 checklist on every screen, recorded as a table in the task.
2. The system SHALL have every interactive element reachable and announced in Portuguese by TalkBack.
3. WHEN the audit finds a defect THEN the team SHALL open one Linear issue per defect with the "Bug" label.

---

## Edge Cases

- IF the user's name is missing in the Google metadata THEN the account card SHALL show the e-mail as display name (current behavior kept).
- IF the profile is still loading when Configurações opens THEN the profile `Badge` SHALL be hidden until it loads.
- IF a list has a single item THEN the FAB SHALL NOT cover it (bottom padding from Listas AC 13).
- WHEN the Snackbar appears on a screen with FAB THEN the Snackbar SHALL sit above the FAB, never over it.
- IF the device font scale is 1.3 THEN header titles and tab labels SHALL truncate with ellipsis instead of overflowing.
- WHEN the keyboard is open in a form and the user taps "Salvar" THEN the button SHALL fire on the first tap.
- IF Material Symbols has not loaded yet THEN `Icon` SHALL reserve its size so the layout does not jump.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| NAV-01 | P1: Navegação nativa e ícones (AC 1–2) | Tasks | Pending |
| NAV-02 | P1: Navegação nativa e ícones (AC 3–6) | Tasks | Pending |
| NAV-03 | P1: Navegação nativa e ícones (AC 7–8) + edge case de fonte | Tasks | Pending |
| NAV-04 | P1: Navegação nativa e ícones (AC 9–11) + edge case de teclado | Tasks | Pending |
| UIP-01 | P1: Primitivos (AC 1–3) | Tasks | Pending |
| UIP-02 | P1: Primitivos (AC 4) | Tasks | Pending |
| UIP-03 | P1: Primitivos (AC 5–6) | Tasks | Pending |
| UIP-04 | P1: Primitivos (AC 7–8) + edge case Snackbar/FAB | Tasks | Pending |
| UIP-05 | P1: Primitivos (AC 9–10) | Tasks | Pending |
| UIP-06 | P1: Primitivos (AC 11) | Tasks | Pending |
| FIN-01 | P1: Abas do menu (AC 1–2) | Tasks | Pending |
| FIN-02 | P1: Abas do menu (AC 3–6) | Tasks | Pending |
| FIN-03 | P1: Abas do menu (AC 7–9) | Tasks | Pending |
| FIN-04 | P1: Abas do menu (AC 10) | Tasks | Pending |
| LST-01 | P1: Listas (AC 1–5) — Categorias e Formas | Tasks | Pending |
| LST-02 | P1: Listas (AC 6–8, 12) — Movimentações | Tasks | Pending |
| LST-03 | P1: Listas (AC 9–11, 13) — carregamento das listas | Tasks | Pending |
| CTA-01 | P1: Conta e usuários (AC 1–5) + edge cases de perfil | Tasks | Pending |
| CTA-02 | P1: Conta e usuários (AC 6–7) | Tasks | Pending |
| MRC-01 | P1: Marca (AC 1–2, 4) | Tasks | Pending |
| MRC-02 | P1: Marca (AC 3) | Tasks | Pending |
| DAT-01 | P1: Data com calendário nativo (AC 1–5) | Tasks | Pending |
| REL-01 | P1: Build de release (AC 1–4) | Tasks | Pending |
| HAP-01 | P2: Haptics (AC 1–4) | Tasks | Pending |
| ANI-01 | P2: Motion contido (AC 1–4) | Tasks | Pending |
| TAB-01 | P2: Tablet (AC 1–3) | Tasks | Pending |
| NTB-01 | P2: Spike de NativeTabs (AC 1) | Tasks | Pending |
| PRF-01 | P2: Performance medida (AC 1–3) | Tasks | Pending |
| AUD-01 | P2: Auditoria final (AC 1–3) | Tasks | Pending |

**Coverage:** 29 total, 29 mapped to tasks, 0 unmapped.

---

## Success Criteria

- [ ] Ensaio do roteiro do EIX-55 no build de release sem nenhuma tela de teste, placeholder no Financeiro ou tela sem header — até 09/10.
- [ ] `npm run typecheck`, `npm run lint` e `npm run test` verdes em cada PR do épico.
- [ ] `grep -rn "headerShown: false"` só encontra o layout raiz, os grupos `(auth)`/`(pendente)` e a tab bar.
- [ ] Zero valor visual hardcoded nas telas (checklist DESIGN_CYAN §10).
