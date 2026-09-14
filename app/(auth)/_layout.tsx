import { Stack } from 'expo-router';

// Área pública: só telas que não exigem sessão.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
