import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { configureGoogleSignIn } from '@/features/auth/googleAuth';
import { carregarPerfil, limparPerfil, useProfile } from '@/features/auth/profileStore';
import { startSessionSync, useSessionStore } from '@/features/auth/sessionStore';
import { startNetworkSyncListener } from '@/features/viagens/syncStore';
import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { EmptyState, fontAssets, Screen } from '@/ui';

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
    const unsubscribeSession = startSessionSync();
    const unsubscribeNetwork = startNetworkSyncListener();

    return () => {
      unsubscribeSession();
      unsubscribeNetwork();
    };
  }, []);

  // Perfil acompanha a conta logada: carrega no login e é descartado no logout, para a
  // próxima conta não herdar o acesso da anterior (US16).
  useEffect(() => {
    if (usuarioId) carregarPerfil(usuarioId);
    else limparPerfil();
  }, [usuarioId]);

  // O banco local precisa estar com o schema em dia antes de qualquer tela ler dele (RNF01).
  const { success: dbPronto, error: dbErro } = useMigrations(db, migrations);

  const isReady = fontsLoaded && !isRestoring && dbPronto;
  // Só entra na área do app quem está com status Ativo (aprovado). Enquanto o perfil carrega, falha ou não está
  // aprovado, a única rota registrada é (pendente) — que mostra o estado certo para cada caso.
  const temAcesso = session !== null && estado === 'pronto' && isAprovado;

  // Com erro na migration o banco nunca ficará pronto: esconde a splash também nesse caso, senão o
  // usuário ficaria preso nela sem saber o que houve.
  const falhouNoBanco = dbErro !== undefined && fontsLoaded;

  useEffect(() => {
    if (isReady || falhouNoBanco) SplashScreen.hideAsync();
  }, [isReady, falhouNoBanco]);

  // Sem retry: erro de migration não é passageiro (SQL ou disco), repetir não resolve.
  if (falhouNoBanco) {
    return (
      <Screen align="center">
        <EmptyState
          icon="alerta"
          title="Não foi possível preparar o banco local"
          description="Feche e abra o app novamente. Se o problema continuar, reinstale o app ou fale com o suporte."
        />
      </Screen>
    );
  }

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
