import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, indicatorSize, radius, spacing } from './tokens';

// neutral = informação da marca (status de viagem, "Admin"); muted = estado sem ênfase (inativo);
// success/danger = entrada/saída e estado bom/ruim; warning = pede atenção (vence logo, aguardando).
export type BadgeTone = 'neutral' | 'muted' | 'success' | 'danger' | 'warning';

// Todos os pares passam de 4,5:1. O neutral era accentEdge sobre accentWash (2,3:1).
const toneStyles: Record<BadgeTone, { background: string; text: string }> = {
  neutral: { background: colors.accentSoft, text: colors.accentText },
  muted: { background: colors.surfaceSunken, text: colors.textBody },
  success: { background: colors.successWash, text: colors.success },
  danger: { background: colors.dangerWash, text: colors.danger },
  warning: { background: colors.warningWash, text: colors.warning },
};

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const { background, text } = toneStyles[tone];

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      {/* O ponto repete a cor do tom; cor nunca é o único indicador: o rótulo acompanha sempre. */}
      <View testID="badge-ponto" style={[styles.ponto, { backgroundColor: text }]} />
      <Text variant="caption" weight="medium" style={{ color: text }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
  },
  ponto: {
    width: indicatorSize.dot,
    height: indicatorSize.dot,
    borderRadius: radius.pill,
  },
});
