// Tokens do design system (docs: .claude/docs/DESIGN-CYAN.md, adaptado para mobile no CLAUDE.md §8).
// Telas NUNCA usam hex, spacing ou radius soltos: tudo sai daqui, através dos primitivos de src/ui.

// DESIGN_CYAN 2.0 (direção A · Contido, 23/11/2026). Os contrastes citados são WCAG sobre `canvas`
// ou `surface`; o mínimo para texto é 4,5:1 e para borda de controle é 3:1.
export const colors = {
  canvas: '#fafaf9', // fundo de página — nunca use #ffffff como fundo
  surface: '#ffffff', // cartões e superfícies elevadas
  surfaceSunken: '#f5f5f4', // fundo de ícone em círculo, trilho de abas, superfície rebaixada
  border: '#e8e6e5', // hairline 1px — o principal recurso estrutural
  borderMuted: '#d6d3d1', // borda de campo e de botão secundário
  textMuted: '#a8a29e', // SÓ desabilitado e decoração (2,4:1 — não passa como texto que se lê)
  textBody: '#6b6560', // corpo, labels secundários, ajuda de campo (5,5:1)
  textPrimary: '#0c0a09', // títulos e ênfase
  inverted: '#1c1917', // superfícies invertidas (uso raro: snackbar)
  accentWash: '#c1e1f7', // fundo do highlight de título
  accentSoft: '#e6f3fd', // fundo de chip/aba ativa, badge informativo, indicador da tab bar
  accentText: '#0b5a94', // texto e ícone sobre accentSoft/accentWash e links (6,4:1)
  accent: '#3ba6f1', // a cor da marca: gráfico, rota no mapa, foco, decoração — nunca fundo de texto branco
  accentStrong: '#1677c2', // preenchimento da ação primária (botão e FAB): branco sobre ele dá 4,7:1
  accentEdge: '#3398e1', // traço da marca (logo)
  onAccent: '#ffffff', // texto sobre accentStrong
  // Exceção semântica do DESIGN_CYAN (financeiro e estado): só no valor, ícone ou chip —
  // nunca em cartão, borda ou fundo inteiro, e nunca como único indicador (acompanhar de sinal/rótulo).
  success: '#1a7f4f',
  successWash: '#dcf5e6',
  danger: '#b42318',
  dangerWash: '#fde8e6',
  // "Pede atenção": vence em breve, aguardando aprovação, manutenção aberta (4,8:1 sobre o wash).
  warning: '#b54708',
  warningWash: '#fef0c7',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, base: 16, lg: 24, xl: 32, xxl: 48 } as const;

// listEasing são os pontos de controle do cubic-bezier (Easing.bezier); skeletonEasing é a curva da
// animação CSS do Reanimated, que aceita os nomes do CSS.
export const motion = {
  listDuration: 200,
  listEasing: [0.77, 0, 0.175, 1],
  skeletonCycle: 1000,
  skeletonMinOpacity: 0.5,
  skeletonEasing: 'ease-in-out',
} as const;

export const layout = { tablet: 768, contentMaxWidth: 720 } as const;

// `sheet` é o canto de cima da folha inferior (seletor, criação rápida) e do login.
export const radius = { icon: 4, input: 10, card: 14, feature: 20, sheet: 24, pill: 9999 } as const;

// Sombra é exceção, não regra. RN pede shadow* (iOS) + elevation (Android) separados.
// - subtle: botão do Google (rgba(0,0,0,0.05) 0 1px 2px do guia web).
// - card: o cartão de destaque, uma vez por tela (Card variant="feature").
// - float: o que flutua sobre o conteúdo que rola (FAB, snackbar).
export const shadow = {
  subtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  card: {
    shadowColor: '#0c0a09',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  float: {
    shadowColor: '#0c0a09',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 6,
  },
} as const;

// Alvo de toque mínimo (44×44pt): o guia foi feito para mouse, o app é usado com o dedo.
export const touchTarget = 44;

// Altura confortável de botão e campo: acima do mínimo de 44, para o dedo na cabine do caminhão.
export const controlHeight = 48;

// Tamanhos de ícone: sm dentro de texto pequeno, md em linha de lista e aba, lg em estado vazio.
export const iconSize = { sm: 16, md: 20, lg: 24 } as const;

// Indicadores que não são ícone: o ponto do Badge e o indicador da aba ativa da tab bar
// (uma pílula de fundo accentSoft atrás do ícone).
export const indicatorSize = { dot: 6, tabWidth: 56, tabHeight: 30 } as const;

// Nomes das fontes registradas no layout raiz via expo-font (@expo-google-fonts/inter).
// semibold (600) é para número em destaque (saldo, KPI) e título de seção — nunca para título de tela.
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

// Escala tipográfica mobile do CLAUDE.md. React Native usa lineHeight em pontos,
// então convertemos a proporção (ex.: 1.15) multiplicando pelo tamanho.
// Títulos grandes usam tracking negativo no lugar da fonte Roobert (proprietária).
function textStyle(fontSize: number, lineHeightRatio: number, letterSpacing = 0) {
  return { fontSize, lineHeight: Math.round(fontSize * lineHeightRatio), letterSpacing };
}

// `numeric` é o valor grande do cartão de destaque (saldo, KPI principal); `title` é o título de
// seção e de cartão ("Pede atenção"). caption subiu de 11 para 12: 11 era pequeno demais na cabine.
export const typography = {
  numeric: textStyle(40, 1.1, -1.2),
  display: textStyle(32, 1.15, -0.8),
  heading: textStyle(24, 1.25, -0.5),
  subheading: textStyle(20, 1.2, -0.1),
  title: textStyle(17, 1.3, -0.2),
  body: textStyle(15, 1.55),
  bodySm: textStyle(13, 1.5),
  caption: textStyle(12, 1.35),
} as const;

export type TypographyVariant = keyof typeof typography;
