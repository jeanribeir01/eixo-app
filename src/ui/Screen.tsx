import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from './tokens';

type ScreenProps = {
  children: ReactNode;
  // "center" para telas curtas (Login); "top" para conteúdo que cresce para baixo.
  align?: 'top' | 'center';
};

// Fundo canvas + padding lateral de 16: sem largura fixa, o conteúdo flui em celular e tablet (RNF02).
export function Screen({ children, align = 'top' }: ScreenProps) {
  return (
    <SafeAreaView style={[styles.screen, align === 'center' && styles.center]}>{children}</SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  center: {
    justifyContent: 'center',
  },
});
