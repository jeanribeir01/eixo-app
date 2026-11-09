import type { FlatListProps } from 'react-native';
import Animated from 'react-native-reanimated';

import { useListTransition } from './useListTransition';

// A célula da FlatList controla a posição da linha. Animar só o filho não anima o espaço removido.
// Sem entering/exiting: virtualizar e voltar à tela não dispara uma entrada por linha.
export function List<Item>(props: Omit<FlatListProps<Item>, 'CellRendererComponent'>) {
  const transition = useListTransition();
  return <Animated.FlatList {...props} itemLayoutAnimation={transition} skipEnteringExitingAnimations />;
}
