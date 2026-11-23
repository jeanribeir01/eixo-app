import type { BottomTabNavigationOptions } from 'expo-router/tabs';

import { colors, fontFamily, indicatorSize, touchTarget, typography } from '@/ui';

// Visual da tab bar só com tokens (DESIGN_CYAN §7 Navegação): superfície branca com hairline no topo,
// sem azul cheio — o único azul cheio da tela é a ação primária dela; a aba ativa usa accentSoft.
// O ícone de cada aba é definido no layout das abas, a partir do menu.
export const tabBarOptions: BottomTabNavigationOptions = {
  headerShown: false,
  sceneStyle: { backgroundColor: colors.canvas },
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  tabBarActiveTintColor: colors.textPrimary,
  tabBarInactiveTintColor: colors.textBody,
  tabBarLabelStyle: { ...typography.caption, fontFamily: fontFamily.medium },
  // O ícone vem dentro da pílula de aba ativa (TabBarIcon); a caixa do ícone precisa ter o tamanho
  // dela, senão a pílula encosta no rótulo.
  tabBarIconStyle: { width: indicatorSize.tabWidth, height: indicatorSize.tabHeight },
  // Ícone em cima e rótulo embaixo em qualquer largura; sem isso, a partir de 768 (tablet) o rótulo
  // vai para o lado do ícone.
  tabBarLabelPosition: 'below-icon',
  // Alvo de toque mínimo de 44pt mesmo com o rótulo pequeno.
  tabBarItemStyle: { minHeight: touchTarget, justifyContent: 'center' },
};
