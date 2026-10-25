import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors, motion, radius, spacing } from './tokens';
import { useReducedMotion } from './useReducedMotion';

export type SkeletonProps = {
  // Altura sempre de um token: o bloco imita o tamanho do conteúdo que ainda vai chegar.
  height?: keyof typeof spacing;
  accessibilityLabel?: string;
};

// Estado "carregando" com a forma da tela (DESIGN_CYAN §8): o usuário já vê onde cada bloco vai
// aparecer, em vez de um spinner solto. Pulso de opacidade na thread de UI, sem cor de acento.
// Leitor de tela anuncia o rótulo, não o desenho.
export function Skeleton({ height = 'lg', accessibilityLabel }: SkeletonProps) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      style={[styles.bloco, { height: spacing[height] }, !reduced && pulse]}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'progressbar' : undefined}
    />
  );
}

const pulse = {
  animationName: {
    from: { opacity: 1 },
    '50%': { opacity: motion.skeletonMinOpacity },
    to: { opacity: 1 },
  },
  animationDuration: motion.skeletonCycle,
  animationIterationCount: 'infinite',
  animationTimingFunction: 'ease-in-out',
} as const;

const styles = StyleSheet.create({
  bloco: {
    opacity: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
    borderRadius: radius.card,
  },
});
