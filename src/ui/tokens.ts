// Tokens do design system (docs: .claude/docs/DESIGN-CYAN.md, adaptado para mobile no CLAUDE.md §8).
// Telas NUNCA usam hex, spacing ou radius soltos: tudo sai daqui, através dos primitivos de src/ui.

export const colors = {
  canvas: '#fafaf9', // fundo de página — nunca use #ffffff como fundo
  surface: '#ffffff', // cartões e superfícies elevadas
  border: '#e8e6e5', // hairline 1px — o principal recurso estrutural
  borderMuted: '#d6d3d1',
  textMuted: '#a8a29e', // helper text, ícones desabilitados
  textBody: '#78716c', // corpo, labels secundários
  textPrimary: '#0c0a09', // títulos e ênfase
  inverted: '#1c1917', // superfícies invertidas (uso raro)
  accentWash: '#c1e1f7', // fundo do highlight
  accent: '#3ba6f1', // CTA primária e ícones — único acento cromático
  accentEdge: '#3398e1', // bordas de ação e links
  onAccent: '#ffffff', // texto sobre o botão cyan
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, base: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radius = { icon: 4, input: 6, card: 10, feature: 16, pill: 9999 } as const;

// Alvo de toque mínimo (44×44pt): o guia foi feito para mouse, o app é usado com o dedo.
export const touchTarget = 44;

// Nomes das fontes registradas no layout raiz via expo-font (@expo-google-fonts/inter).
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
} as const;

// Escala tipográfica mobile do CLAUDE.md. React Native usa lineHeight em pontos,
// então convertemos a proporção (ex.: 1.15) multiplicando pelo tamanho.
// Títulos grandes usam tracking negativo no lugar da fonte Roobert (proprietária).
function textStyle(fontSize: number, lineHeightRatio: number, letterSpacing = 0) {
  return { fontSize, lineHeight: Math.round(fontSize * lineHeightRatio), letterSpacing };
}

export const typography = {
  display: textStyle(32, 1.15, -0.8),
  heading: textStyle(24, 1.25, -0.5),
  subheading: textStyle(20, 1.2, -0.1),
  body: textStyle(15, 1.55),
  bodySm: textStyle(13, 1.5),
  caption: textStyle(11, 1.4),
} as const;

export type TypographyVariant = keyof typeof typography;
