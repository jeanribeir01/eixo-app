import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, radius, spacing, touchTarget } from './tokens';

export type TabOption = { label: string; value: string };

export type TabsProps = {
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel?: string;
};

// Tab Pill Group do DESIGN_CYAN §7 — usado nas abas Entrada/Saída de Categorias.
export function Tabs({ options, value, onChange, accessibilityLabel }: TabsProps) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={styles.row}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.tab, active ? styles.active : styles.inactive, pressed && styles.pressed]}
          >
            <Text weight={active ? 'medium' : 'regular'} tone={active ? 'onAccent' : 'primary'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  // Aba ativa usa a superfície invertida (uso raro do guia, reservado a este caso).
  active: {
    backgroundColor: colors.inverted,
    borderColor: colors.inverted,
  },
  inactive: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
});
