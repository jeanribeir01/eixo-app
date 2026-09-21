import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing, touchTarget } from './tokens';

export type ListItemProps = {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
};

// Linha de lista genérica: borda hairline como separador, sem sombra (DESIGN_CYAN §5).
// O conteúdo é livre (children) para caber título+chip, ações etc. sem estilo próprio na tela.
export function ListItem({ children, onPress, accessibilityLabel }: ListItemProps) {
  if (!onPress) {
    return <View style={styles.item}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    minHeight: touchTarget,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
});
