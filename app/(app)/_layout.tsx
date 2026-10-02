import { Stack } from 'expo-router';

import { useProfile } from '@/features/auth/profileStore';

// Área de usuário autenticado e aprovado. Provisória: na US17 vira (gestor) e (motorista), conforme o perfil.
export default function AppLayout() {
  const { isAdmin } = useProfile();

  // Gestão de usuários só existe na árvore de rotas do Admin (US16). O RLS de `usuario` é quem
  // garante de fato: esconder a rota é usabilidade, não segurança.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="usuarios/index" />
        <Stack.Screen name="usuarios/[id]" />
      </Stack.Protected>
    </Stack>
  );
}
