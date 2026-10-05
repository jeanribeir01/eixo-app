import type { BottomTabNavigationOptions } from 'expo-router/tabs';

import { colors, fontFamily, touchTarget, typography } from '@/ui';

// Visual da tab bar só com tokens (DESIGN_CYAN §7 Navegação): superfície branca com hairline no topo,
// sem preenchimento cyan — o único cyan da tela é a ação primária dela, não o menu.
// Não há biblioteca de ícones no projeto, então a aba é só texto; o ícone fica escondido.
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
  tabBarIcon: () => null,
  tabBarIconStyle: { display: 'none' },
  tabBarLabelStyle: { ...typography.caption, fontFamily: fontFamily.medium },
  // Alvo de toque mínimo de 44pt mesmo com o rótulo pequeno.
  tabBarItemStyle: { minHeight: touchTarget, justifyContent: 'center' },
};
