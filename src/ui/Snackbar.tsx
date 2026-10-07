import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, radius, spacing } from './tokens';

export type SnackbarTone = 'success' | 'error';

export type SnackbarProps = {
  message: string;
  tone: SnackbarTone;
  onDismiss: () => void;
  duration?: number;
};

// Entrada (UIP-04): fade e deslize de 8pt para cima em 200 ms, com ease-out forte. Só a entrada
// anima; a saída é a tela desmontando o Snackbar, para o onDismiss não atrasar.
const DURACAO_ENTRADA = 200;
const DESLIZE = spacing.sm;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// Feedback obrigatório de toda ação do usuário (AGENTS.md §2.1). Some sozinho depois de `duration`;
// a tela decide quando mostrar, limpando o estado que controla a mensagem. A posição vem do
// `overlay` do Screen, que o deixa no rodapé e acima do FAB.
export function Snackbar({ message, tone, onDismiss, duration = 3000 }: SnackbarProps) {
  const [entrada] = useState(() => new Animated.Value(0));
  // Parte do caso comum (pode deslizar). Se o sistema pede menos movimento, o deslize sai antes de
  // a animação começar; a opacidade ainda é 0, então a troca não aparece. Com "remover animações"
  // ligado fica só o fade, que ainda mostra que algo chegou.
  const [comDeslize, setComDeslize] = useState(true);

  useEffect(() => {
    let cancelado = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduzir) => {
        if (cancelado) return;
        // Só muda o estado quando precisa: no caso comum, nenhuma renderização a mais.
        if (reduzir) setComDeslize(false);
        // Driver nativo: opacidade e transform rodam na thread de UI, sem depender do JS.
        Animated.timing(entrada, {
          toValue: 1,
          duration: DURACAO_ENTRADA,
          easing: EASE_OUT,
          useNativeDriver: true,
        }).start();
      });
    return () => {
      cancelado = true;
    };
  }, [entrada]);

  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, tone, duration, onDismiss]);

  const indicatorColor = tone === 'success' ? colors.success : colors.danger;
  const translateY = comDeslize ? entrada.interpolate({ inputRange: [0, 1], outputRange: [DESLIZE, 0] }) : 0;

  return (
    <Animated.View
      style={[styles.wrapper, { opacity: entrada, transform: [{ translateY }] }]}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {/* Sinal visual acompanha o texto — cor nunca é o único indicador (DESIGN_CYAN §1). */}
      <View style={[styles.indicator, { backgroundColor: indicatorColor }]} />
      <Text tone="onAccent" weight="medium" style={styles.text}>
        {message}
      </Text>
    </Animated.View>
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
