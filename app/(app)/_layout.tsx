import { Stack } from 'expo-router';

// Área de usuário autenticado. Provisória: na US17 vira (gestor) e (motorista), conforme o perfil.
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
