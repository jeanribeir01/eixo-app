import { Switch as RNSwitch, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, spacing, touchTarget } from './tokens';

export type SwitchProps = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

// Usado no filtro "mostrar desativadas" e para reativar uma categoria (DESIGN_CYAN §6).
export function Switch({ label, value, onValueChange }: SwitchProps) {
  return (
    <View style={styles.row}>
      <Text tone="body">{label}</Text>
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.accent, false: colors.borderMuted }}
        thumbColor={colors.surface}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value }}
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
