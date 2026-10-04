import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, radius, spacing } from './tokens';

export type SnackbarTone = 'success' | 'error';

export type SnackbarProps = {
  message: string;
  tone: SnackbarTone;
  onDismiss: () => void;
  duration?: number;
};

// Feedback obrigatório de toda ação do usuário (AGENTS.md §2.1). Some sozinho depois de `duration`;
// a tela decide quando mostrar, limpando o estado que controla a mensagem.
export function Snackbar({ message, tone, onDismiss, duration = 3000 }: SnackbarProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, tone, duration, onDismiss]);

  const indicatorColor = tone === 'success' ? colors.success : colors.danger;

  return (
    <View style={styles.wrapper} accessible accessibilityRole="alert" accessibilityLiveRegion="polite">
      {/* Sinal visual acompanha o texto — cor nunca é o único indicador (DESIGN_CYAN §1). */}
      <View style={[styles.indicator, { backgroundColor: indicatorColor }]} />
      <Text tone="onAccent" weight="medium" style={styles.text}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.inverted,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  indicator: {
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: radius.pill,
  },
  text: {
    flex: 1,
  },
});
