import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { configureGoogleSignIn } from '@/features/auth/googleAuth';
import { carregarPerfil, limparPerfil, useProfile } from '@/features/auth/profileStore';
import { startSessionSync, useSessionStore } from '@/features/auth/sessionStore';
import { fontAssets } from '@/ui';

// Mantém a splash nativa até sabermos se há sessão salva e as fontes carregarem (AUTH-09).
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontAssets);
  const session = useSessionStore((state) => state.session);
  const isRestoring = useSessionStore((state) => state.isRestoring);
  const usuarioId = session?.user.id ?? null;
  const { estado, isAprovado } = useProfile();

  useEffect(() => {
    configureGoogleSignIn();
    return startSessionSync();
  }, []);

  // Perfil acompanha a conta logada: carrega no login e é descartado no logout, para a
  // próxima conta não herdar o acesso da anterior (US16).
  useEffect(() => {
    if (usuarioId) carregarPerfil(usuarioId);
    else limparPerfil();
  }, [usuarioId]);

  const isReady = fontsLoaded && !isRestoring;
  // Só entra na área do app quem está com status Ativo (aprovado). Enquanto o perfil carrega, falha ou não está
  // aprovado, a única rota registrada é (pendente) — que mostra o estado certo para cada caso.
  const temAcesso = session !== null && estado === 'pronto' && isAprovado;

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  if (!isReady) return null;

  // O layout nunca navega "na mão": ele só diz quais grupos existem para a sessão atual.
  // Quando a sessão muda (login/logout), o expo-router redireciona sozinho para a rota permitida.
  // Lembrete (CLAUDE.md): esconder rota é usabilidade, não segurança — quem protege dado é o RLS.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={temAcesso}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={session !== null && !temAcesso}>
        <Stack.Screen name="(pendente)" />
      </Stack.Protected>
      <Stack.Protected guard={session === null}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
