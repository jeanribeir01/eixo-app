import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, fontFamily, typography, type TypographyVariant } from './tokens';

const toneColors = {
  primary: colors.textPrimary,
  body: colors.textBody,
  muted: colors.textMuted,
  accent: colors.accentEdge,
  onAccent: colors.onAccent,
  // Exceção semântica do financeiro (DESIGN_CYAN §1): só em valor de entrada/saída ou saldo, e
  // sempre com sinal (+/−) ou rótulo junto — cor nunca é o único indicador.
  success: colors.success,
  danger: colors.danger,
} as const;

export type TextTone = keyof typeof toneColors;

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
  // Títulos ficam em 400 (regra do guia). "medium" é para rótulos de botão e ênfase curta.
  weight?: 'regular' | 'medium';
};

export function Text({ variant = 'body', tone = 'primary', weight = 'regular', style, ...rest }: TextProps) {
  return (
    <RNText
      style={[typography[variant], { color: toneColors[tone], fontFamily: fontFamily[weight] }, style]}
      {...rest}
    />
  );
}
