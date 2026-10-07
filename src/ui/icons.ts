import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

// Mapa único de ícones do app (DESIGN_CYAN §7). A tela pede pelo nome semântico ("financeiro") e nunca
// escreve nome de símbolo: trocar um ícone é mudar uma linha aqui. Android usa Material Symbols e iOS
// usa SF Symbols, uma família por plataforma.
export const icons = {
  // Abas do menu (US17)
  dashboards: { android: 'dashboard', ios: 'square.grid.2x2' },
  financeiro: { android: 'account_balance_wallet', ios: 'banknote' },
  frota: { android: 'local_shipping', ios: 'truck.box' },
  viagens: { android: 'route', ios: 'map' },
  configuracoes: { android: 'settings', ios: 'gearshape' },
  // Telas do Financeiro
  movimentacoes: { android: 'swap_vert', ios: 'arrow.up.arrow.down' },
  saldo: { android: 'monitoring', ios: 'chart.line.uptrend.xyaxis' },
  categorias: { android: 'category', ios: 'tag' },
  formasPagamento: { android: 'credit_card', ios: 'creditcard' },
  usuarios: { android: 'group', ios: 'person.2' },
  // Ações
  adicionar: { android: 'add', ios: 'plus' },
  avancar: { android: 'chevron_right', ios: 'chevron.right' },
  voltarMes: { android: 'chevron_left', ios: 'chevron.left' },
  avancarMes: { android: 'chevron_right', ios: 'chevron.right' },
  maisOpcoes: { android: 'more_vert', ios: 'ellipsis' },
  calendario: { android: 'calendar_today', ios: 'calendar' },
  limpar: { android: 'close', ios: 'xmark' },
  alerta: { android: 'warning', ios: 'exclamationmark.triangle' },
  sair: { android: 'logout', ios: 'rectangle.portrait.and.arrow.right' },
  versao: { android: 'info', ios: 'info.circle' },
} as const satisfies Record<string, { android: AndroidSymbol; ios: SFSymbol }>;

export type IconName = keyof typeof icons;
