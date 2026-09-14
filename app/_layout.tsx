import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { configureGoogleSignIn } from '@/features/auth/googleAuth';
import { startSessionSync, useSessionStore } from '@/features/auth/sessionStore';
import { fontAssets } from '@/ui';

// Mantém a splash nativa até sabermos se há sessão salva e as fontes carregarem (AUTH-09).
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontAssets);
  const session = useSessionStore((state) => state.session);
  const isRestoring = useSessionStore((state) => state.isRestoring);

  useEffect(() => {
    configureGoogleSignIn();
    return startSessionSync();
  }, []);

  const isReady = fontsLoaded && !isRestoring;

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  if (!isReady) return null;

  // O layout nunca navega "na mão": ele só diz quais grupos existem para a sessão atual.
  // Quando a sessão muda (login/logout), o expo-router redireciona sozinho para a rota permitida.
  // Lembrete (CLAUDE.md): esconder rota é usabilidade, não segurança — quem protege dado é o RLS.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={session !== null}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={session === null}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
