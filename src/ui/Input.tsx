import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { MensagemErro } from './MensagemErro';
import { Text } from './Text';
import { colors, controlHeight, fontFamily, radius, spacing, typography } from './tokens';

export type InputProps = Omit<TextInputProps, 'style'> & {
  label: string;
  // Mensagem em português, mostrada abaixo do campo com accessibilityRole="alert".
  // Nunca é só a borda: cor sozinha falha para daltônicos e sob sol forte na cabine (DESIGN_CYAN §1).
  error?: string;
};

export function Input({ label, error, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text variant="bodySm" weight="medium">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textBody}
        style={[styles.input, focused && styles.focused, !!error && styles.error]}
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
