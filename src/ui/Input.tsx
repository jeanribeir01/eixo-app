import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from './Text';
import { colors, fontFamily, radius, spacing, touchTarget, typography } from './tokens';

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
      <Text variant="bodySm" tone="body" weight="medium">
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
      {!!error && (
        <Text accessibilityRole="alert" variant="bodySm">
          {error}
        </Text>
      )}
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
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  // Anel de foco de 2px em accent (DESIGN_CYAN §7 — Campo de texto).
  focused: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  // Sem cor nova: reforça com a cor de texto mais forte da paleta, a mensagem abaixo é o indicador real.
  error: {
    borderColor: colors.textPrimary,
  },
});
