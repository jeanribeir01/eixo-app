# EIX-77 · Navegação da S5 — hub de Frota e rotas de Rotas, Manutenção e Viagens

## Problem Statement

Na S5 três telas de frota entram em paralelo (Rotas e Manutenção com o Diogo, Viagens com o Eduardo), e todas precisam mexer nos mesmos arquivos compartilhados: `app/(app)/_layout.tsx` (título + guard), a aba Frota e `src/navigation/menu.ts`. Se cada um fizer isso na própria branch, vira conflito de merge em código de outra pessoa (AGENTS.md §3). Hoje a aba Frota abre direto na lista de veículos, Rotas e Manutenção não têm por onde entrar e a aba Viagens é um `ModuloEmBreveView`. Esta task faz a parte compartilhada uma vez só e deixa cada dev mexendo apenas na pasta da própria feature.

## Goals

- [ ] O Diogo (EIX-38, EIX-39) e o Eduardo (EIX-40) trocam um placeholder dentro de `src/features/<feature>/` sem editar `app/(app)/_layout.tsx`, `src/navigation/**` nem a aba Frota.
- [ ] A aba Frota vira um hub com entradas para Veículos, Rotas e Manutenções, e Motorista e Financeiro não alcançam nenhuma dessas telas, nem digitando a URL.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Conteúdo de Rotas, Manutenção e Viagens (lista, formulário, repositório) | EIX-38, EIX-39 e EIX-40 |
| Detalhe do veículo com histórico de manutenções (`frota/[id]`) | Critério da EIX-39; a rota nasce lá, junto da tela |
| Rota de detalhe de viagem e correção do hodômetro final pelo gestor | Nenhum AC da EIX-40 pede; decidido com o usuário em 16/10/2026 |
| FAB ou cartão de destaque no hub de Frota | Nenhum AC pede; a ação primária de criar mora em cada lista |
| Botão "Inativar" e ano de fabricação na lista de veículos | EIX-79 (Diogo) |
| Corrigir caminhos `src/app/(app)/...` nas descrições do Linear | Já feito (critério marcado na task) |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Lista de veículos | `app/(app)/frota/veiculos.tsx` (URL `/frota/veiculos`), não `frota/index` como diz a task | Testado em 16/10/2026: com `frota/index`, a URL `/frota` passa a abrir a lista e a aba Frota (home do Gestor) fica inalcançável pela URL. `frota/veiculos` fica junto de `frota/novo` e `frota/[id]/editar` | y |
| Lista de viagens | A própria aba `(tabs)/viagens` renderiza `ViagensListView`; nada de `viagens/index` | Mesma colisão com a URL da aba `/viagens` | y |
| Rotas de viagem | `viagens/nova` (abrir) e `viagens/[id]/fechar` (hodômetro final) | Cobre os critérios da EIX-40; decidido com o usuário | y |
| Ícones do hub | Acrescentar `rotas` e `manutencoes` em `src/ui/icons.ts`; Veículos reusa `frota` | Área compartilhada: autorizado pelo usuário em 16/10/2026; só acrescenta linhas | y |
| Título duplicado na lista de veículos | `VeiculosListView` perde o título "Frota" do conteúdo e passa a usar `Screen underHeader` | Como tela interna ela ganha o header "Veículos" e o DESIGN_CYAN §7 proíbe repetir o título; autorizado pelo usuário, avisar o Diogo (EIX-79) no PR | y |
| Agrupamento do hub | Seção "Operação" com Manutenções; seção "Cadastros" com Veículos e Rotas | Mesmo critério do hub Financeiro: o dia a dia primeiro, o que muda pouco embaixo | n |
| Guard de Viagens nas telas internas | `podeVerViagens` em `useMenu()`, com a mesma regra da aba Viagens (Admin, Gestor de Frota, Motorista) | A task manda "Viagens segue a aba"; uma regra só evita a aba e as telas divergirem | n |
| Conteúdo dos placeholders | Cada view placeholder é um `EmptyState` com o ícone do módulo e uma frase do que a tela vai fazer; as internas usam `Screen underHeader` | Mesmo espírito do `ModuloEmBreveView`; o dev substitui o arquivo inteiro | n |
| Estados de dados no hub | O hub não carrega dado: não tem carregando, vazio nem erro | Diferente do hub Financeiro, não há saldo nem KPI de frota nos AC | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Hub de Frota ⭐ MVP

**User Story**: As a gestor de frota, I want the Frota tab to list Veículos, Rotas and Manutenções so that I reach every fleet screen from one place.

**Why P1**: Sem o hub, Rotas e Manutenção não têm por onde entrar.

**Acceptance Criteria**:

1. WHEN o usuário abre a aba Frota THEN o sistema SHALL mostrar o título "Frota" e as entradas "Veículos", "Rotas" e "Manutenções".
2. WHEN o usuário toca em "Veículos" THEN o sistema SHALL navegar para `/frota/veiculos`.
3. WHEN o usuário toca em "Rotas" THEN o sistema SHALL navegar para `/rotas`.
4. WHEN o usuário toca em "Manutenções" THEN o sistema SHALL navegar para `/manutencoes`.
5. WHEN o Gestor de Frota entra no app THEN o sistema SHALL abrir em `/frota` mostrando o hub, não a lista de veículos.

**Independent Test**: Entrar como Gestor, ver o hub em `/frota`, tocar cada entrada e cair na tela certa.

---

### P1: Rotas internas com título e guard ⭐ MVP

**User Story**: As a dev da S5, I want the routes, titles and guards of my screens to exist already so that I only edit my feature folder.

**Why P1**: É o motivo da task: tirar os arquivos compartilhados das branches das tasks de tela.

**Acceptance Criteria**:

1. WHEN um Admin abre `/frota/veiculos`, `/rotas`, `/rotas/nova`, `/rotas/r1/editar`, `/manutencoes`, `/manutencoes/nova`, `/viagens/nova` ou `/viagens/v1/fechar` THEN o sistema SHALL mostrar a tela com o header nativo de título "Veículos", "Rotas", "Nova rota", "Editar rota", "Manutenções", "Nova manutenção", "Abrir viagem" e "Fechar viagem", respectivamente.
2. IF um Motorista ou um Financeiro navega para `/frota/veiculos`, `/rotas`, `/rotas/nova` ou `/manutencoes` THEN o sistema SHALL levá-lo de volta à tela inicial do perfil sem mostrar a tela pedida.
3. WHEN um Gestor de Frota navega para `/frota/veiculos`, `/rotas` ou `/manutencoes` THEN o sistema SHALL mostrar a tela pedida.
4. WHEN um Motorista navega para `/viagens/nova` THEN o sistema SHALL mostrar a tela de abrir viagem.
5. IF um Financeiro navega para `/viagens/nova` THEN o sistema SHALL levá-lo de volta à tela inicial do perfil.
6. The system SHALL render, em cada rota nova, uma view exportada de `src/features/rotas/`, `src/features/manutencao/` ou `src/features/viagens/`, e a aba Viagens SHALL render `ViagensListView` de `src/features/viagens/`.
7. The system SHALL NOT ter, em `app/(app)/`, uma rota interna com a mesma URL de uma aba (arquivo `<aba>/index.tsx` ou `<aba>.tsx` fora de `(tabs)`).

**Independent Test**: Entrar como Admin, abrir cada URL e ver o header; entrar como Motorista e Financeiro, digitar as URLs de frota e voltar para a home.

---

### P2: Placeholders e lista de veículos como tela interna

**User Story**: As a usuário, I want the not-yet-built screens to say what they will do and the vehicle list to show its title once.

**Why P2**: Visual correto até as tasks de tela entrarem; não bloqueia ninguém.

**Acceptance Criteria**:

1. WHEN uma tela placeholder de Rotas, Manutenção ou Viagens é renderizada THEN o sistema SHALL mostrar um estado vazio com título e uma frase do que a tela vai fazer.
2. WHEN a lista de veículos é renderizada THEN o sistema SHALL NOT mostrar o título "Frota" no conteúdo.

**Independent Test**: Render de cada placeholder e da `VeiculosListView`.

---

## Edge Cases

- IF uma URL de rota interna é aberta direto, sem passar pelo hub, THEN o sistema SHALL aplicar o mesmo guard (coberto por NAV5-07 a NAV5-10).
- WHEN o usuário volta de `/frota/veiculos` THEN o sistema SHALL retornar ao hub de Frota.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| NAV5-01 | P1: Hub de Frota — AC1 | Tasks | Verified |
| NAV5-02 | P1: Hub de Frota — AC2 | Tasks | Verified |
| NAV5-03 | P1: Hub de Frota — AC3 | Tasks | Verified |
| NAV5-04 | P1: Hub de Frota — AC4 | Tasks | Verified |
| NAV5-05 | P1: Hub de Frota — AC5 | Tasks | Verified |
| NAV5-06 | P1: Rotas internas — AC1 | Tasks | Verified |
| NAV5-07 | P1: Rotas internas — AC2 | Tasks | Verified |
| NAV5-08 | P1: Rotas internas — AC3 | Tasks | Verified |
| NAV5-09 | P1: Rotas internas — AC4 | Tasks | Verified |
| NAV5-10 | P1: Rotas internas — AC5 | Tasks | Verified |
| NAV5-11 | P1: Rotas internas — AC6 | Tasks | Verified |
| NAV5-12 | P1: Rotas internas — AC7 | Tasks | Verified |
| NAV5-13 | P2: Placeholders — AC1 | Tasks | Verified |
| NAV5-14 | P2: Placeholders — AC2 | Tasks | Verified |
| NAV5-15 | Edge: voltar de Veículos | Tasks | Verified |

**Coverage:** 15 total, 15 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] As branches da EIX-38, EIX-39 e EIX-40 não precisam editar `app/(app)/_layout.tsx`, `src/navigation/**` nem `app/(app)/(tabs)/frota.tsx`.
- [ ] `npm run typecheck`, `npm run lint` e `npm run test` verdes.
