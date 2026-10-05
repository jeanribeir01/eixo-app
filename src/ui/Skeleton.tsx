import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from './tokens';

export type SkeletonProps = {
  // Altura sempre de um token: o bloco imita o tamanho do conteúdo que ainda vai chegar.
  height?: keyof typeof spacing;
  accessibilityLabel?: string;
};

// Estado "carregando" com a forma da tela (DESIGN_CYAN §8): o usuário já vê onde cada bloco vai
// aparecer, em vez de um spinner solto. Bloco neutro na cor da hairline, sem animação nem cor de
// acento — contenção do guia. Leitor de tela anuncia o rótulo, não o desenho.
export function Skeleton({ height = 'lg', accessibilityLabel }: SkeletonProps) {
  return (
    <View
      style={[styles.bloco, { height: spacing[height] }]}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'progressbar' : undefined}
    />
  );
}

const styles = StyleSheet.create({
  bloco: {
    alignSelf: 'stretch',
    backgroundColor: colors.border,
    borderRadius: radius.card,
  },
});
