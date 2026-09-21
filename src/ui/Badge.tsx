import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, radius, spacing } from './tokens';

export type BadgeTone = 'success' | 'danger' | 'neutral';

// Exceção semântica do DESIGN_CYAN: verde/vermelho só aparecem aqui, no chip de entrada/saída.
const toneStyles: Record<BadgeTone, { background: string; text: string }> = {
  success: { background: colors.successWash, text: colors.success },
  danger: { background: colors.dangerWash, text: colors.danger },
  neutral: { background: colors.accentWash, text: colors.accentEdge },
};

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const { background, text } = toneStyles[tone];

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      {/* Cor nunca é o único indicador: o rótulo textual ("Entrada"/"Saída") acompanha sempre. */}
      <Text variant="caption" weight="medium" style={{ color: text }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.icon,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
});
