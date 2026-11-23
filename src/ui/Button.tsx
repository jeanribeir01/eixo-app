import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { GoogleLogo } from './GoogleLogo';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';
import { colors, controlHeight, radius, shadow, spacing, touchTarget } from './tokens';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'google' | 'icon';

type ButtonBaseProps = {
  // Na variante icon o rótulo não aparece: é o nome que o leitor de tela anuncia ("Mês anterior").
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  // Nome para o leitor de tela quando o rótulo visível se repete na tela (ex.: "Reativar" em cada
  // linha da lista vira "Reativar GHI-1234"). Sem ele, o leitor anuncia o próprio `label`.
  accessibilityLabel?: string;
};

export type ButtonProps =
  // primary = o único elemento azul preenchido da tela; ghost = ações secundárias; danger = ação grave
  // (bloquear, excluir); google = "Continuar com Google", no estilo das diretrizes de marca do Google.
  | (ButtonBaseProps & { variant?: 'primary' | 'ghost' | 'danger' | 'google'; icon?: never })
  // icon = ação secundária só com ícone (Mais opções, mês anterior): alvo de 44pt, sem borda.
  | (ButtonBaseProps & { variant: 'icon'; icon: IconName });

export function Button(props: ButtonProps) {
  const { label, onPress, variant = 'primary', loading = false, disabled = false, accessibilityLabel } = props;
  // Carregando conta como desabilitado: impede o duplo toque que dispararia duas tentativas de login.
  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';
  const isGoogle = variant === 'google';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
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
          <Text weight="medium" tone={isPrimary ? 'onAccent' : variant === 'danger' ? 'danger' : 'primary'}>
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: controlHeight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  // accentStrong, não accent: branco sobre o ciano da marca dá 2,6:1 e some ao sol; sobre o azul
  // mais fundo dá 4,7:1 (DESIGN_CYAN 2.0).
  primary: {
    backgroundColor: colors.accentStrong,
    borderColor: colors.accentStrong,
  },
  // Secundário: superfície branca com borda, para não sumir sobre o canvas como o antigo transparente.
  ghost: {
    backgroundColor: colors.surface,
    borderColor: colors.borderMuted,
  },
  // Ação grave (bloquear, excluir): fundo claro e texto vermelho, nunca vermelho cheio.
  danger: {
    backgroundColor: colors.dangerWash,
    borderColor: colors.dangerWash,
  },
  google: {
    backgroundColor: colors.surface,
    borderColor: colors.borderMuted,
    ...shadow.subtle,
  },
  // Só o ícone, sem borda nem fundo: a área de toque continua 44×44.
  icon: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    minHeight: touchTarget,
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
