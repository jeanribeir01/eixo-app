# EIX-80 · US07-b — Mapa da rota (origem → destino)

## Problem Statement

O gestor cadastra trechos padrão (US07, EIX-38), mas só vê nomes de cidade em texto. Ele quer conferir no mapa o trecho de uma rota cadastrada: onde fica a origem, onde fica o destino e a linha entre os dois. O professor confirmou o requisito em 18/10/2026. O ADR 0005 decidiu MapLibre com tiles do OpenFreeMap e coordenadas de uma tabela de municípios do IBGE embarcada no app, sem migration.

A EIX-38 não criou tela de detalhe da rota. Esta task cria a tela de detalhe (decidido com o usuário em 18/10/2026), e tocar numa rota da lista passa a abrir o detalhe em vez da edição.

## Goals

- [ ] O gestor abre uma rota e vê, no mapa, a origem, o destino e a linha reta entre eles, com os dois pontos enquadrados.
- [ ] Sem coordenada ou sem mapa, a tela de detalhe continua mostrando o trecho e a distância e deixa editar.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Rota real por estrada (directions API) | Fora do escopo da EIX-80 |
| Rastreamento GPS em tempo real | Fora do escopo da EIX-80 |
| Latitude/longitude em `rota` (migration) | ADR 0005: as coordenadas vêm do dataset embarcado; migration é só do Jean |
| Escolher a cidade de uma lista no formulário | Decisão da EIX-38 / Jean (ADR 0005, ponto em aberto 3) |
| Mapa offline (tiles baixados) | A política do OSM proíbe pré-carga; sem rede, o mapa cai no estado de erro |
| Alterações em `src/ui/` | `Card`, `Button`, `Skeleton`, `EmptyState` e `Text` já atendem |
| Interação com o mapa (arrastar, zoom, girar) | O mapa é só de conferência; gesto ligado disputaria a rolagem da tela |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Onde o mapa aparece | Nova tela de detalhe `/rotas/[id]`, com botão "Editar" que abre `/rotas/[id]/editar` | Não existia detalhe; decidido com o usuário em 18/10/2026 | y |
| Toque na linha da lista | Abre o detalhe, não mais a edição. Substitui o ROTA-23 da EIX-38 | Consequência da decisão acima, aceita pelo usuário | y |
| Marcadores | Origem: círculo com miolo `surface` e borda `accentEdge`. Destino: círculo preenchido `accent` com borda `accentEdge`. Linha em `accentEdge` | Diferença por forma, não só por cor; decidido com o usuário em 18/10/2026 | y |
| Um único cyan preenchido por tela | O botão "Editar" do detalhe é `ghost`, para o destino ser o único elemento preenchido de cyan | DESIGN_CYAN §1 | y |
| Como achar a cidade no dataset | Mesma UF e mesma `chaveCidade` (sem acento, sem maiúscula, sem espaço sobrando) | Mesma regra de `normaliza_cidade()` do banco, já usada pela EIX-38 | y |
| Mensagem sem coordenada | "Não encontramos <Cidade>/<UF> no mapa. Confira o nome da cidade na edição da rota." (uma por cidade não encontrada, origem primeiro) | Diz qual cidade e o que fazer | n |
| Mensagem de falha do mapa | Título "Não foi possível carregar o mapa", descrição "Verifique a conexão e tente de novo." e botão "Tentar novamente" | Padrão de erro do DESIGN_CYAN §8 | n |
| Proporção do mapa | 4:3 abaixo de 600 pt de largura; 16:9 a partir de 600 pt (tablet ou paisagem) | Sem px fixo (RNF02); em tela larga, 4:3 empurraria o resto da tela para baixo | n |
| Origem e destino no mesmo ponto | Centraliza no ponto com zoom de cidade (10), em vez de enquadrar uma caixa de tamanho zero | O banco não proíbe origem = destino | n |
| Atribuição | "© OpenStreetMap" visível (atribuição padrão do MapLibre ligada) | Exigência da licença dos tiles (ADR 0005) | y |
| Rota inativa | O detalhe abre normalmente e mostra "Inativa" junto da distância | Mesmo texto da lista; o histórico continua consultável | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Ver o trecho da rota no mapa ⭐ MVP

**User Story**: As a gestor de frota, I want to see a registered route on a map from origin to destination so that I can check the standard leg visually.

**Why P1**: É o pedido da EIX-80.

**Acceptance Criteria**:

1. WHEN as duas cidades da rota são encontradas no dataset THEN o sistema SHALL mostrar o mapa com um marcador na coordenada da origem, um marcador na coordenada do destino e uma linha reta da origem até o destino.
2. WHEN o mapa abre THEN o sistema SHALL enquadrar a caixa que contém os dois pontos (oeste, sul, leste, norte), com folga de `spacing.xl` em cada lado.
3. The system SHALL achar a cidade no dataset pela mesma UF e pela `chaveCidade`, ignorando maiúscula, acento e espaços sobrando ("sao paulo"/SP acha São Paulo/SP).
4. The system SHALL pintar a linha com `colors.accentEdge`, a origem com miolo `colors.surface` e borda `colors.accentEdge`, e o destino com preenchimento `colors.accent` e borda `colors.accentEdge`, sem nenhuma outra cor.
5. The system SHALL mostrar abaixo do mapa a legenda "Origem: <Cidade>/<UF>" e "Destino: <Cidade>/<UF>", para a cor não ser o único indicador.
6. WHILE o mapa não terminou de carregar the system SHALL mostrar o skeleton com o rótulo "Carregando mapa".
7. IF o mapa falha ao carregar THEN o sistema SHALL esconder o mapa e mostrar "Não foi possível carregar o mapa", "Verifique a conexão e tente de novo." e o botão "Tentar novamente".
8. WHEN o usuário toca em "Tentar novamente" no erro do mapa THEN o sistema SHALL montar o mapa de novo e voltar ao estado carregando.
9. IF a origem ou o destino não está no dataset THEN o sistema SHALL não montar o mapa e mostrar, para cada cidade não encontrada, "Não encontramos <Cidade>/<UF> no mapa. Confira o nome da cidade na edição da rota."
10. The system SHALL desligar arrastar, zoom por pinça, zoom por toque duplo, girar e inclinar o mapa.
11. The system SHALL dar ao mapa a largura disponível e altura proporcional: 4:3 com a tela abaixo de 600 pt de largura e 16:9 a partir de 600 pt.
12. The system SHALL usar o estilo `https://tiles.openfreemap.org/styles/positron`, definido numa constante única.

**Independent Test**: Renderizar o componente com Curitiba/PR → São Paulo/SP e ver o mapa com os dois pontos e a linha; renderizar com "Curitba"/PR e ver a mensagem de cidade não encontrada sem mapa.

---

### P1: Abrir o detalhe da rota ⭐ MVP

**User Story**: As a gestor de frota, I want to open a route from the list and see its data with the map so that I can check it before editing.

**Why P1**: Sem tela de detalhe, o mapa não tem onde aparecer.

**Acceptance Criteria**:

1. WHEN o usuário toca numa rota da lista THEN o sistema SHALL abrir `/rotas/<id>` (detalhe), e não mais a edição.
2. WHEN o detalhe carrega THEN o sistema SHALL mostrar o trecho "<Cidade>/<UF> → <Cidade>/<UF>", a distância "<n> km" com vírgula decimal e o mapa da rota.
3. IF a rota está inativa THEN o sistema SHALL mostrar "<n> km · Inativa".
4. WHEN o usuário toca em "Editar" THEN o sistema SHALL abrir `/rotas/<id>/editar`.
5. WHILE a rota está carregando the system SHALL mostrar o indicador com o rótulo "Carregando rota".
6. IF a carga da rota falha THEN o sistema SHALL mostrar "Não foi possível carregar", a mensagem do repositório e o botão "Tentar novamente", que busca de novo.
7. The system SHALL declarar o título "Rota" no header, em `app/(app)/_layout.tsx`, dentro do guard de Frota (Admin e Gestor de Frota).
8. WHEN o usuário volta da edição para o detalhe THEN o sistema SHALL buscar a rota de novo, para mostrar o trecho e o mapa atualizados.

**Independent Test**: Tocar numa rota da lista, ver o trecho, a distância e o mapa; tocar em "Editar" e cair no formulário.

---

## Edge Cases

- WHEN origem e destino caem na mesma coordenada THEN o sistema SHALL centralizar o mapa nesse ponto com zoom 10, em vez de enquadrar uma caixa.
- IF o repositório devolve "Rota não encontrada." THEN o sistema SHALL mostrar essa mensagem no estado de erro do detalhe.
- WHEN o mapa falha, ou alguma cidade não é encontrada, THEN o sistema SHALL continuar mostrando o trecho, a distância e o botão "Editar".

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| MAPA-01 | P1: Mapa — AC1 (marcadores e linha) | Execute | Implementing |
| MAPA-02 | P1: Mapa — AC2 (enquadramento) | Execute | Implementing |
| MAPA-03 | P1: Mapa — AC3 (busca no dataset) | Execute | Implementing |
| MAPA-04 | P1: Mapa — AC4 (cores dos tokens) | Execute | Implementing |
| MAPA-05 | P1: Mapa — AC5 (legenda) | Execute | Implementing |
| MAPA-06 | P1: Mapa — AC6 (carregando) | Execute | Implementing |
| MAPA-07 | P1: Mapa — AC7 (erro do mapa) | Execute | Implementing |
| MAPA-08 | P1: Mapa — AC8 (tentar novamente) | Execute | Implementing |
| MAPA-09 | P1: Mapa — AC9 (sem coordenadas) | Execute | Implementing |
| MAPA-10 | P1: Mapa — AC10 (gestos desligados) | Execute | Implementing |
| MAPA-11 | P1: Mapa — AC11 (proporção, RNF02) | Execute | Implementing |
| MAPA-12 | P1: Mapa — AC12 (estilo em constante) | Execute | Implementing |
| MAPA-13 | P1: Detalhe — AC1 (lista abre o detalhe) | Tasks | Pending |
| MAPA-14 | P1: Detalhe — AC2 (trecho, distância, mapa) | Execute | Implementing |
| MAPA-15 | P1: Detalhe — AC3 (inativa) | Execute | Implementing |
| MAPA-16 | P1: Detalhe — AC4 (Editar) | Execute | Implementing |
| MAPA-17 | P1: Detalhe — AC5 (carregando) | Execute | Implementing |
| MAPA-18 | P1: Detalhe — AC6 (erro da carga) | Execute | Implementing |
| MAPA-19 | P1: Detalhe — AC7 (título e guard) | Execute | Implementing |
| MAPA-20 | P1: Detalhe — AC8 (recarrega ao voltar) | Execute | Implementing |
| MAPA-21 | Edge: mesmo ponto | Execute | Implementing |
| MAPA-22 | Edge: rota não encontrada | Execute | Implementing |
| MAPA-23 | Edge: resto da tela usável sem mapa | Execute | Implementing |

**Coverage:** 23 total, 23 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] Detalhe da rota com mapa, sem tocar em `src/ui/` nem em `supabase/migrations/`.
- [ ] `npm run typecheck`, `npm run lint` e `npm run test` verdes.
