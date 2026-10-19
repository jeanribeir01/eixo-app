# EIX-80 · Mapa da rota — Validação

## Validation: eix80-mapa-rota — PASS

**Date**: 2026-10-18
**Spec**: `.specs/features/eix80-mapa-rota/spec.md`
**Diff range**: `343f3a6..HEAD` (`e9c7fda`, branch `feat/eix-80-us07b-mapa-rota`, 10 commits)
**Verifier**: sub-agente independente (autor ≠ verificador)
**Rodada**: nova verificação, iteração 1 de 3 do ciclo correção → verificação

A rodada anterior (sobre `e8cbad1`) deu FAIL por dois mutantes não equivalentes vivos: M2 (caixa montada pelos cantos) e M16 (sem `key` no `MapaRota`). O commit `e9c7fda` só mexe em testes e no texto de MAPA-20. Nesta rodada os dois mutantes morrem, os 23 requisitos têm asserção no valor da spec e o gate passa. O veredito é PASS.

---

## Task Completion

| Task | Status | Notes |
| --- | --- | --- |
| T1 | ✅ Done | `app.config.ts` com o plugin; versão 11.5.0 no `package.json` |
| T2 | ✅ Done | `municipios.json` + gerador + licença MIT |
| T3 | ✅ Done | `coordenadas.ts` |
| T4 | ✅ Done | `MapaRota.tsx` |
| T5 | ✅ Done | `RotaDetalheView.tsx` |
| T6 | ✅ Done | `app/(app)/rotas/[id]/index.tsx` + título no layout |
| T7 | ✅ Done | `RotasListView.tsx` |
| Fix 1 / Fix 2 da rodada anterior | ✅ Done | `e9c7fda`: testes de MAPA-02 (diagonal noroeste) e MAPA-20 (remontagem) |

Nenhuma caixa `- [ ]` aberta em `tasks.md`.

---

## Spec-Anchored Acceptance Criteria

Citações refeitas sobre `e9c7fda` (o `MapaRota.test.tsx` ganhou 14 linhas e o `RotaDetalheView.test.tsx` ganhou 19, então os números mudaram desde a rodada anterior).

| ID | Resultado definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| MAPA-01 | Ponto na origem, ponto no destino, linha origem→destino | `src/features/rotas/mapa/__tests__/MapaRota.test.tsx:65` - `expect(lista).toContainEqual({... Point, coordinates: CURITIBA ... papel: 'origem'})`; `:66` destino `SAO_PAULO`; `:67` `LineString [CURITIBA, SAO_PAULO]` | ✅ PASS |
| MAPA-02 | Caixa [oeste, sul, leste, norte] = [min lon, min lat, max lon, max lat] + padding `spacing.xl` nos 4 lados | `src/features/rotas/mapa/__tests__/MapaRota.test.tsx:78` - `initialViewState).toEqual({ bounds: [CURITIBA[0], CURITIBA[1], SAO_PAULO[0], SAO_PAULO[1]], padding: { top: spacing.xl, right: spacing.xl, bottom: spacing.xl, left: spacing.xl } })` (origem a sudoeste); `:88` mesma caixa com o destino a sudoeste; `:101` - `bounds).toEqual([CURITIBA[0], JOINVILLE[1], JOINVILLE[0], CURITIBA[1]])` (origem a noroeste: oeste e norte vêm de pontos diferentes) | ✅ PASS (as duas diagonais; M2, M26, M29, M30 mortos) |
| MAPA-03 | Mesma UF + `chaveCidade` (acento, maiúscula, espaços) | `src/features/rotas/mapa/__tests__/coordenadas.test.ts:11` - `buscarCoordenadas('  sao   PAULO ', 'SP')).toEqual([-46.6395, -23.5329])`; `:15` `('Curitiba', 'SP')).toBeNull()`; `:7` Curitiba/PR; `:19` "Curitba"/PR `toBeNull()` | ✅ PASS |
| MAPA-04 | Linha `accentEdge`; origem miolo `surface`; destino `accent`; borda `accentEdge`; nenhuma outra cor | `src/features/rotas/mapa/__tests__/MapaRota.test.tsx:114` - `linha['line-color']).toBe(colors.accentEdge)`; `:117` `toEqual(['match', ['get', 'papel'], 'origem', colors.surface, colors.accent])`; `:118` stroke `accentEdge`; `:132` toda cor ∈ {accent, accentEdge, surface} | ✅ PASS |
| MAPA-05 | Legenda "Origem: <Cidade>/<UF>" e "Destino: <Cidade>/<UF>" | `src/features/rotas/mapa/__tests__/MapaRota.test.tsx:140` - `getByText('Origem: Curitiba/PR')`; `:141` `getByText('Destino: São Paulo/SP')` | ✅ PASS |
| MAPA-06 | Skeleton "Carregando mapa" até carregar | `src/features/rotas/mapa/__tests__/MapaRota.test.tsx:188` - `getByLabelText('Carregando mapa')`; `:192` some depois de `didFinishLoadingMap` | ✅ PASS |
| MAPA-07 | Esconde o mapa; "Não foi possível carregar o mapa", "Verifique a conexão e tente de novo.", botão "Tentar novamente" | `src/features/rotas/mapa/__tests__/MapaRota.test.tsx:202` - `queryByTestId('maplibre-map')).not.toBeOnTheScreen()`; `:203-205` os três textos exatos | ✅ PASS |
| MAPA-08 | Monta o mapa de novo e volta ao carregando | `src/features/rotas/mapa/__tests__/MapaRota.test.tsx:215` - `getByTestId('maplibre-map')`; `:216` `getByLabelText('Carregando mapa')` | ✅ PASS (M9 equivalente; ver sensor) |
| MAPA-09 | Sem mapa; uma mensagem por cidade, origem primeiro, texto exato | `src/features/rotas/mapa/__tests__/MapaRota.test.tsx:236` - `mensagens).toEqual(['Não encontramos Curitba/PR no mapa. Confira o nome da cidade na edição da rota.', ...])`; `:240` sem `maplibre-map`; `:225-229` só a origem | ✅ PASS |
| MAPA-10 | Arrastar, pinça, toque duplo, girar e inclinar desligados | `src/features/rotas/mapa/__tests__/MapaRota.test.tsx:149-154` - `dragPan`, `touchZoom`, `doubleTapZoom`, `doubleTapHoldZoom`, `touchRotate`, `touchPitch` `.toBe(false)` | ✅ PASS |
| MAPA-11 | 4:3 abaixo de 600 pt; 16:9 a partir de 600 pt | `src/features/rotas/mapa/__tests__/MapaRota.test.tsx:172` - largura 390 → `toHaveStyle({ aspectRatio: 4 / 3 })`; `:179` largura 600 → `aspectRatio: 16 / 9` | ✅ PASS (limiar exato testado; "largura disponível" `width: '100%'` sem asserção, como na rodada anterior) |
| MAPA-12 | `https://tiles.openfreemap.org/styles/positron` numa constante única | `src/features/rotas/mapa/__tests__/MapaRota.test.tsx:162` - `mapa.mapStyle).toBe('https://tiles.openfreemap.org/styles/positron')`; constante única conferida por grep: só `src/features/rotas/mapa/MapaRota.tsx:13` | ✅ PASS |
| MAPA-13 | Linha da lista abre `/rotas/<id>` | `src/features/rotas/__tests__/RotasListView.test.tsx:171` - `expect(mockPush).toHaveBeenCalledWith('/rotas/r2')` | ✅ PASS |
| MAPA-14 | Trecho "<C>/<UF> → <C>/<UF>", "<n> km" com vírgula, mapa | `src/features/rotas/__tests__/RotaDetalheView.test.tsx:68` - `getByText('Curitiba/PR → São Paulo/SP')`; `:69` `getByText('408,5 km')`; `:70` `maplibre-map` | ✅ PASS |
| MAPA-15 | "<n> km · Inativa" | `src/features/rotas/__tests__/RotaDetalheView.test.tsx:78` - `getByText('408,5 km · Inativa')` | ✅ PASS |
| MAPA-16 | "Editar" abre `/rotas/<id>/editar` | `src/features/rotas/__tests__/RotaDetalheView.test.tsx:87` - `toHaveBeenCalledWith('/rotas/r1/editar')` | ✅ PASS |
| MAPA-17 | Indicador "Carregando rota" | `src/features/rotas/__tests__/RotaDetalheView.test.tsx:130` - `getByLabelText('Carregando rota')` | ✅ PASS |
| MAPA-18 | "Não foi possível carregar" + mensagem do repositório + "Tentar novamente" busca de novo | `src/features/rotas/__tests__/RotaDetalheView.test.tsx:138-139` - os dois textos; `:144-145` trecho volta e `toHaveBeenCalledTimes(2)` | ✅ PASS |
| MAPA-19 | Título "Rota" no header, dentro do guard de Frota | `__tests__/routes/navegacaoPorPerfil.test.tsx:430` - `['/rotas/r1', 'Tela Rota', 'Rota']` → título do header; `:255` Financeiro e Motorista voltam para a home; `:280` Gestor abre; `__tests__/routes/rotasDaS5.test.tsx:38` - `['rotas/[id]/index', RotaDetalheRoute, 'RotaDetalheView {"id":"id-1"}']` | ✅ PASS |
| MAPA-20 | Busca de novo e mostra o trecho novo; se o trecho mudou, o mapa é montado de novo, volta ao carregando e enquadra o trecho novo | `src/features/rotas/__tests__/RotaDetalheView.test.tsx:99` - `toHaveBeenCalledTimes(2)`; `:100` `'Curitiba/PR → Joinville/SC'`; `:109` mapa já carregado antes do foco; `:116` - `getByLabelText('Carregando mapa')).toBeOnTheScreen()` depois da recarga (remontou); `:118` - `bounds).toEqual([-49.2646, -26.3045, -48.8487, -25.4195])` (caixa Curitiba → Joinville) | ✅ PASS (M16 e M27 mortos por `:116`) |
| MAPA-21 | Mesmo ponto: centro no ponto, zoom 10 | `src/features/rotas/mapa/__tests__/MapaRota.test.tsx:248` - `initialViewState).toEqual({ center: CURITIBA, zoom: 10 })` | ✅ PASS |
| MAPA-22 | Mostra "Rota não encontrada." | `src/features/rotas/__tests__/RotaDetalheView.test.tsx:153` - `findByText('Rota não encontrada.')` | ✅ PASS |
| MAPA-23 | Sem coordenada ou com falha do mapa: trecho, distância e "Editar" continuam | `src/features/rotas/__tests__/RotaDetalheView.test.tsx:161-165` (cidade fora do dataset) e `:173-176` (falha do mapa) | ✅ PASS |

**Status**: 23/23 com asserção no valor da spec e discriminante. Nenhum spec-precision gap aberto: o texto novo de MAPA-20 diz o que é "mapa atualizado" (remonta, volta ao carregando, enquadra o trecho novo), e o teste novo confere as três coisas.

Observação sobre `RotaDetalheView.test.tsx:118`: no mock do MapLibre a `Camera` recebe as props novas a cada render, então essa asserção sozinha passaria mesmo sem remontar. Quem prova a remontagem é `:116` (o estado `pronto` não sobrevive à troca de `key`). As duas juntas cobrem a spec; não é lacuna.

Conferi o dado do teste novo de MAPA-02 contra o dataset: `municipios.json` traz `"Joinville",-26.3045,-48.8487` ([nome, latitude, longitude]), então `JOINVILLE = [-48.8487, -26.3045]` está certo. Curitiba (-49.2646, -25.4195) fica a oeste e ao norte de Joinville: a diagonal noroeste que faltava.

---

## Discrimination Sensor

Worktree temporária (`git worktree add --detach`) em `scratchpad/wt` sobre `e9c7fda`, com junção para o `node_modules` do repositório (criada com `New-Item -ItemType Junction`). Cada mutante foi aplicado com `perl`, conferido no `git diff`, testado com `npx jest src/features/rotas --selectProjects app` e revertido com `git checkout`. Depois: junção removida primeiro (`cmd /c rmdir`, sem apagar o `node_modules` real, conferido), `git worktree remove --force`, `git worktree prune`. `git status --porcelain` do repositório real, antes e depois, idêntico:

```
 M .specs/LESSONS.md
 M .specs/lessons.json
?? .specs/features/eix80-mapa-rota/validation.md
```

### Mutantes desta rodada

| Mutante | Arquivo | Falha injetada | Morto por |
| --- | --- | --- | --- |
| M2 | `src/features/rotas/mapa/MapaRota.tsx:52-57` | Caixa pelos cantos: `origem[0] <= destino[0] ? [origem.lon, origem.lat, destino.lon, destino.lat] : [destino..., origem...]` (latitude acompanha a longitude) | ✅ `MapaRota.test.tsx:101`; `RotaDetalheView.test.tsx:118` |
| M16 | `src/features/rotas/RotaDetalheView.tsx:68` | Remove a `key` do `<MapaRota>` | ✅ `RotaDetalheView.test.tsx:116` |
| M9 | `src/features/rotas/mapa/MapaRota.tsx:99` | "Tentar novamente" sem `setTentativa` | ⚪ Sobreviveu (114/114) — **equivalente**, mesma razão da rodada anterior: no estado `erro` o componente retorna antes de renderizar o `<Map>` (`MapaRota.tsx:90-104`), então voltar a `carregando` monta um `<Map>` novo com ou sem troca de `key` |
| M26 | `src/features/rotas/mapa/MapaRota.tsx:54-56` | Sul e norte trocados: `[min lon, max lat, max lon, min lat]` | ✅ `MapaRota.test.tsx:78`, `:88`, `:101`; `RotaDetalheView.test.tsx:118` |
| M27 | `src/features/rotas/RotaDetalheView.tsx:68` | `key` só com a origem (`${cidade_origem}/${uf_origem}`): troca de destino não remonta | ✅ `RotaDetalheView.test.tsx:116` |
| M28 | `src/features/rotas/mapa/MapaRota.tsx:58` | Folga só em cima e embaixo (`right: 0`, `left: 0`) | ✅ `MapaRota.test.tsx:78` |
| M29 | `src/features/rotas/mapa/MapaRota.tsx:56` | Norte = latitude do destino (sem `max`) | ✅ `MapaRota.test.tsx:88`, `:101`; `RotaDetalheView.test.tsx:118` |
| M30 | `src/features/rotas/mapa/MapaRota.tsx:54` | Sul = latitude da origem (sem `min`) | ✅ `MapaRota.test.tsx:88`, `:101`; `RotaDetalheView.test.tsx:118` |

### Mutantes da rodada anterior

Os outros 22 mortos (M1, M3-M8, M10-M15, M17-M25) foram rodados na rodada anterior, sobre `e8cbad1`. O código de produção não mudou desde então: `git diff e8cbad1..e9c7fda --stat` lista só `.specs/features/eix80-mapa-rota/spec.md`, `src/features/rotas/__tests__/RotaDetalheView.test.tsx` e `src/features/rotas/mapa/__tests__/MapaRota.test.tsx`. Como `e9c7fda` só acrescenta testes (nenhuma asserção removida ou afrouxada), aqueles mutantes continuam mortos.

**Sensor depth**: expandido (8 mutantes nesta rodada; 30 no total das duas rodadas).
**Result**: nesta rodada, 7 mortos e 1 equivalente (M9). Nenhum sobrevivente não equivalente — PASS

---

## Code Quality

Escopo do `e9c7fda`: dois testes novos e uma linha da spec.

| Princípio | Status |
| --- | --- |
| Código mínimo | ✅ Um teste por lacuna, sem helper novo |
| Mudanças cirúrgicas (só testes e a linha de MAPA-20; nada em `src/ui/`, migration ou produção) | ✅ |
| Sem escopo extra | ✅ |
| Segue os padrões (`render` + `getByTestId('maplibre-camera')`, `mockAoFocar` em `act`, coordenadas reais do dataset) | ✅ |
| Asserções no valor da spec | ✅ Caixa com valores exatos; remontagem pelo carregando |
| Cobertura por camada (domínio 1:1; telas com caminho feliz, borda e erro) | ✅ |
| Todo teste mapeia um requisito | ✅ Os dois testes novos trazem `// MAPA-02` e `// MAPA-20` |
| Diretrizes: `AGENTS.md` §2.5, skill `teste-componente` | ✅ |
| Achado menor | O teste antigo de MAPA-20 (`RotaDetalheView.test.tsx:91`) e o novo (`:106`) se sobrepõem na recarga; o antigo confere trecho e legenda, o novo a remontagem. Pode ficar. `tentativa`/`key` no `<Map>` continua redundante (M9), inofensivo |

---

## Edge Cases

- [x] Mesmo ponto: centro com zoom 10 (`MapaRota.test.tsx:248`)
- [x] "Rota não encontrada." no erro do detalhe (`RotaDetalheView.test.tsx:153`)
- [x] Resto da tela usável sem mapa (`RotaDetalheView.test.tsx:158`, `:168`)

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test`
- **Result**: typecheck exit 0; lint exit 0; app 977/977 (96 suítes), supabase 298/298 (16 suítes); 0 falhas, 0 pulados
- **Test count before feature**: app 940 (tasks.md T1)
- **Test count after feature**: app 977 (975 na rodada anterior + 2 do `e9c7fda`)
- **Delta**: +37
- **Skipped tests**: nenhum
- **Failures**: nenhuma

---

## Fix Plans

Nenhum. Fix 1 (MAPA-02) e Fix 2 (MAPA-20) da rodada anterior foram resolvidos no `e9c7fda`, e o spec-precision gap de MAPA-20 foi fechado com o texto novo da spec.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| MAPA-01..MAPA-23 | Implementing | ✅ Verified |

A tabela de rastreabilidade de `spec.md` ainda mostra "Implementing" nos 23; atualizar para "Verified" fica com o orquestrador (este Verifier só escreve `validation.md`).

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 23/23 discriminantes; 0 spec-precision gaps
**Sensor**: 7/8 mortos nesta rodada, 1 equivalente (M9); 0 sobreviventes não equivalentes
**Gate**: typecheck e lint ok; 977 + 298 testes passando

**What works**: mapa com marcadores, linha e enquadramento certo nas duas diagonais; estados carregando, erro e sem coordenada; detalhe da rota com recarga que remonta o mapa quando o trecho muda; navegação da lista e guard de Frota.

**Next steps**: atualizar a rastreabilidade em `spec.md` e seguir para o PR.
