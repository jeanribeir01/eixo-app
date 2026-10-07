import type { NativeStackNavigationOptions } from 'expo-router/native-stack';

import { colors, fontFamily, typography } from '@/ui';

// Header nativo das telas internas, só com tokens (DESIGN_CYAN §7 Navegação). Fundo canvas e sem
// sombra: o header se funde com a tela e quem faz a hierarquia é o título. O voltar mostra só a seta,
// como no Android. O conteúdo também fica em canvas para a transição entre telas não piscar branco.
export const stackOptions: NativeStackNavigationOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: colors.canvas },
  headerShadowVisible: false,
  headerTintColor: colors.textPrimary,
  headerTitleStyle: {
    fontFamily: fontFamily.regular,
    fontSize: typography.subheading.fontSize,
    color: colors.textPrimary,
  },
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: colors.canvas },
};
