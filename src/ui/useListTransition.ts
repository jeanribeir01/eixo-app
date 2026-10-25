import { useMemo } from 'react';
import { Easing, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { motion } from './tokens';
import { useReducedMotion } from './useReducedMotion';

export function useListTransition() {
  const reduced = useReducedMotion();
  const transition = useMemo(() => LinearTransition
    .duration(motion.listDuration)
    .easing(Easing.bezier(0.77, 0, 0.175, 1))
    // O hook acompanha a preferência atual; System conserva o snapshot de inicialização do Reanimated.
    .reduceMotion(ReduceMotion.Never), []);
  return reduced ? undefined : transition;
}
