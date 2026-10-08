import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { GoogleLogo } from './GoogleLogo';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';
import { colors, radius, shadow, spacing, touchTarget } from './tokens';

export type ButtonVariant = 'primary' | 'ghost' | 'google' | 'icon';

type ButtonBaseProps = {
  // Na variante icon o rótulo não aparece: é o nome que o leitor de tela anuncia ("Mês anterior").
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export type ButtonProps =
  // primary = o único elemento cyan preenchido da tela; ghost = ações secundárias;
  // google = CTA de "Continuar com Google", com estilo próprio das diretrizes de branding do Google.
  | (ButtonBaseProps & { variant?: 'primary' | 'ghost' | 'google'; icon?: never })
  // icon = ação secundária só com ícone (Mais opções, mês anterior): alvo de 44pt, sem borda.
  | (ButtonBaseProps & { variant: 'icon'; icon: IconName });

export function Button(props: ButtonProps) {
  const { label, onPress, variant = 'primary', loading = false, disabled = false } = props;
  // Carregando conta como desabilitado: impede o duplo toque que dispararia duas tentativas de login.
  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';
  const isGoogle = variant === 'google';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        (pressed || isDisabled) && styles.dimmed,
      ]}
    >
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator testID="button-loading" size="small" color={isPrimary ? colors.onAccent : colors.accent} />
        )}
        {isGoogle && !loading && <GoogleLogo size={18} />}
        {props.variant === 'icon' ? (
          !loading && <Icon name={props.icon} tone="body" />
        ) : (
          <Text weight="medium" tone={isPrimary ? 'onAccent' : 'primary'}>
            {label}
          </Text>
        )}
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
  google: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...shadow.subtle,
  },
  // Só o ícone, sem borda nem fundo: a área de toque continua 44×44.
  icon: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    minWidth: touchTarget,
    paddingHorizontal: 0,
    alignItems: 'center',
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
