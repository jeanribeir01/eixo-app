# ADR 0005 — Motion com Reanimated e uma leitura única de "remover animações"

- **Status:** Aceito
- **Data:** 2026-11-09
- **US:** EIX-68 (ANI-01)
- **Decisões relacionadas:** `.specs/STATE.md` AD-009 (as skills `expo-*` mandam em motion); lição L-026 em `.specs/LESSONS.md`

## Contexto

A EIX-68 pede motion contido em dois lugares: o `Skeleton` pulsa enquanto a tela carrega, e as
listas acomodam a linha que entra ou sai em até 250 ms (ANI-01). Nos dois casos o movimento precisa
parar quando a pessoa liga "remover animações" no sistema, inclusive com o app aberto.

O `Animated` do React Native, que o `Snackbar` já usa, anima valores, mas não anima o layout: ele não
acomoda as outras linhas quando uma linha sai da `FlatList`. O `LayoutAnimation` do React Native é
global: anima tudo o que mudar de layout no próximo commit, não só a lista. A EIX-61 tentou declarar o Reanimated em
06/10 e desistiu, porque as versões escolhidas (4.6.0 e Worklets 0.12.2) fizeram o npm aninhar um
segundo Worklets dentro de `expo/`. Duas cópias de um módulo nativo quebram o build.

## Decisão

1. **`react-native-reanimated` 4.5.1 + `react-native-worklets` 0.10.1**, as versões que o Expo SDK 57
   espera (`expo/bundledNativeModules.json`). Com elas o lockfile tem uma cópia só de cada pacote.
2. **A lista anima pela célula, não pela linha.** `List` (em `src/ui/List.tsx`) é uma
   `Animated.FlatList` com `itemLayoutAnimation`, a única peça que move o espaço da linha removida.
   O `ListItem` continua um `Pressable` ou `View` comum, sem `layout`. Embrulhar o `Pressable` com
   `createAnimatedComponent` quebra o `style` em função (o Reanimated passa a função dentro de um
   array e o `Pressable` deixa de chamá-la), e daria movimento a todas as telas que usam `ListItem`
   fora de uma lista.
3. **Sem `entering`/`exiting`.** `skipEnteringExitingAnimations` evita que a virtualização ou uma nova
   visita à tela dispare uma entrada por linha.
4. **Uma leitura única da preferência.** `useReducedMotion` (em `src/ui/useReducedMotion.ts`) guarda o
   valor numa store do módulo (`useSyncExternalStore`): uma chamada a `isReduceMotionEnabled()` e um
   listener de `reduceMotionChanged`, não importa quantos componentes leiam. Enquanto a resposta não
   chega, o hook responde "sem movimento". A transição usa `ReduceMotion.Never` porque o hook já
   decide: o `ReduceMotion.System` do Reanimated usa o valor lido quando o app abriu, que fica velho
   se a pessoa muda a preferência com o app aberto (L-026).
5. **Duração e curva são tokens** (`motion` em `src/ui/tokens.ts`), como cor e espaçamento.

## Dependências introduzidas

| Pacote | Por quê |
|---|---|
| `react-native-reanimated` | Transição de layout da célula da `FlatList` e animação CSS do `Skeleton`, rodando na thread de UI |
| `react-native-worklets` | Runtime de worklets exigido pelo Reanimated 4. Também traz o resolver de Jest usado na config `app` |

Os dois são módulos nativos. **O development build precisa ser gerado de novo**
(`eas build --profile development`), senão o app não encontra o módulo nativo.

## Alternativas consideradas

- **`Animated` do React Native:** já está no projeto, mas não anima o layout da lista. Rejeitada para
  as listas. Continua no `Snackbar`, que só anima opacidade e deslocamento.
- **`LayoutAnimation`:** global (anima qualquer mudança de layout no próximo commit, não só a lista)
  e não respeita sozinho a preferência de movimento. Rejeitada.
- **`layout` em cada `ListItem`:** foi a primeira versão do PR. Quebrava o estilo das linhas tocáveis
  e animava telas de detalhe, hubs e o modal do `Select`. Rejeitada.
- **Um listener por componente:** cada linha e cada `Skeleton` fazia a própria chamada nativa ao
  montar. Rejeitada em favor da store única.

## Consequências

- A preferência é lida uma vez enquanto houver algum componente animado na tela. Quando o último
  desmonta, a assinatura fecha e o valor volta a "não sei". O próximo componente que montar passa um
  instante sem movimento, até a resposta chegar.
- O mock do Reanimated no Jest devolve o componente sem mudança, então os testes não reproduzem
  bugs da camada nativa (como o do `style` em função). Mudança de motion se confere também no
  aparelho, com a preferência ligada e desligada.
- O `Snackbar` continua com a própria leitura da preferência e com o `Animated` do React Native. Migrar
  para o hook compartilhado fica para outra task, porque ele precisa saber a preferência antes de
  começar a entrada.

## Links

- Linear: EIX-68
- `.specs/features/eix58-design-app/spec.md` (ANI-01) e `validation.md`
- `.specs/LESSONS.md` (L-026)
- Segue o formato de [`docs/adr/0004-offline-first.md`](./0004-offline-first.md)
