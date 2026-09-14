import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, radius, spacing, touchTarget } from './tokens';

export type ButtonVariant = 'primary' | 'ghost';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  // primary = o único elemento cyan preenchido da tela; ghost = ações secundárias.
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', loading = false, disabled = false }: ButtonProps) {
  // Carregando conta como desabilitado: impede o duplo toque que dispararia duas tentativas de login.
  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.ghost,
        (pressed || isDisabled) && styles.dimmed,
      ]}
    >
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator testID="button-loading" size="small" color={isPrimary ? colors.onAccent : colors.accent} />
        )}
        <Text weight="medium" tone={isPrimary ? 'onAccent' : 'primary'}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accentEdge,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  dimmed: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
