import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from './Icon';
import type { IconName } from './icons';
import { MensagemErro } from './MensagemErro';
import { Text } from './Text';
import { colors, controlHeight, fontFamily, iconSize, radius, spacing, typography } from './tokens';

export type InputProps = Omit<TextInputProps, 'style'> & {
  label: string;
  // Mensagem em português, mostrada abaixo do campo com accessibilityRole="alert".
  // Nunca é só a borda: cor sozinha falha para daltônicos e sob sol forte na cabine (DESIGN_CYAN §1).
  error?: string;
  // Ícone à esquerda, dentro do campo (e-mail, senha). Decorativo: o rótulo continua sendo o nome.
  icone?: IconName;
};

export function Input({ label, error, icone, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text variant="bodySm" weight="medium">
        {label}
      </Text>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textBody}
          style={[styles.input, !!icone && styles.comIcone, focused && styles.focused, !!error && styles.error]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...rest}
        />
        {/* Por cima do campo, e não ao lado: a borda, o foco e o erro continuam no próprio TextInput. */}
        {icone && (
          <View style={styles.icone} pointerEvents="none">
            <Icon name={icone} tone="body" />
          </View>
        )}
      </View>
      {!!error && <MensagemErro>{error}</MensagemErro>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  input: {
    ...typography.body,
    fontFamily: fontFamily.regular,
    color: colors.textPrimary,
    minHeight: controlHeight,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  // Espaço do ícone: o respiro de sempre, o ícone e mais um respiro até o texto.
  comIcone: {
    paddingLeft: spacing.md + iconSize.md + spacing.sm,
  },
  icone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: spacing.md,
    justifyContent: 'center',
  },
  // Anel de foco de 2px em accent (DESIGN_CYAN §7 — Campo de texto).
  focused: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  // Borda em danger reforça; a mensagem abaixo, com ícone, é o indicador real.
  error: {
    borderColor: colors.danger,
  },
});
