import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, fontFamily, typography, type TypographyVariant } from './tokens';

// Exportada para o Icon usar a mesma tabela: ícone e texto do mesmo tom têm sempre a mesma cor.
export const toneColors = {
  primary: colors.textPrimary,
  body: colors.textBody,
  muted: colors.textMuted,
  // Link e texto sobre accentSoft. Era accentEdge (3:1 sobre canvas); o accentText passa de 6:1.
  accent: colors.accentText,
  onAccent: colors.onAccent,
  // Só para valor de entrada/saída e estado, sempre junto do sinal + / − ou de um rótulo
  // (DESIGN_CYAN, cores semânticas).
  success: colors.success,
  danger: colors.danger,
  warning: colors.warning,
} as const;

export type TextTone = keyof typeof toneColors;

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
  // Títulos de tela ficam em 400 (regra do guia). "medium" é para rótulos de botão e ênfase curta;
  // "semibold" é para número em destaque (saldo, KPI) e título de seção.
  weight?: 'regular' | 'medium' | 'semibold';
};

export function Text({ variant = 'body', tone = 'primary', weight = 'regular', style, ...rest }: TextProps) {
  return (
    <RNText
      style={[typography[variant], { color: toneColors[tone], fontFamily: fontFamily[weight] }, style]}
      {...rest}
    />
  );
}
