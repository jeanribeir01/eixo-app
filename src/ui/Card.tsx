import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from './tokens';

type CardProps = {
  children: ReactNode;
  // `feature` é o cartão de destaque do topo da tela (ex.: saldo no hub Financeiro), com o radius
  // maior do guia. Uma vez por tela (DESIGN_CYAN §4).
  variant?: 'default' | 'feature';
  // Com onPress o cartão inteiro vira um botão, em vez de um link pequeno escondido dentro dele.
  onPress?: () => void;
  // Nome anunciado pelo leitor de tela. Sem ele, o leitor lê os textos de dentro do cartão.
  accessibilityLabel?: string;
};

// Flat Content Card do guia: a borda hairline É a estrutura, sem sombra pesada.
export function Card({ children, variant = 'default', onPress, accessibilityLabel }: CardProps) {
  const estilo = [styles.card, variant === 'feature' && styles.feature];

  if (!onPress) return <View style={estilo}>{children}</View>;

  // Mesmo retorno de toque do ListItem: ripple na cor da hairline no Android, fundo no iOS.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [...estilo, styles.tocavel, pressed && Platform.OS === 'ios' && styles.pressedIos]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  feature: {
    borderRadius: radius.feature,
  },
  // Corta o ripple do Android nos cantos arredondados, para ele não vazar para fora do cartão.
  tocavel: {
    overflow: 'hidden',
  },
  pressedIos: {
    backgroundColor: colors.border,
  },
});
