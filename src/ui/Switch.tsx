import { Switch as RNSwitch, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, spacing, touchTarget } from './tokens';

export type SwitchProps = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  // Enquanto a mudança salva, o switch não aceita outro toque.
  disabled?: boolean;
  // Nome para o leitor de tela quando o rótulo visível sozinho não basta: numa lista, "Ativa" vira
  // "Ativa: Combustível", para quem não enxerga saber de qual linha é o switch.
  accessibilityLabel?: string;
};

// Usado no filtro "mostrar desativadas" e no "Ativa" das linhas de lista (DESIGN_CYAN §6).
export function Switch({ label, value, onValueChange, disabled = false, accessibilityLabel }: SwitchProps) {
  return (
    <View style={styles.row}>
      <Text tone="body">{label}</Text>
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.accent, false: colors.borderMuted }}
        thumbColor={colors.surface}
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ checked: value, disabled }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTarget,
    gap: spacing.md,
  },
});
