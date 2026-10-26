import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { configureGoogleSignIn } from '@/features/auth/googleAuth';
import { carregarPerfil, limparPerfil, useProfile } from '@/features/auth/profileStore';
import { startSessionSync, useSessionStore } from '@/features/auth/sessionStore';
import { startNetworkSyncListener, useSyncStore } from '@/features/viagens/syncStore';
import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { EmptyState, fontAssets, Screen, colors } from '@/ui';

// Mantém a splash nativa até sabermos se há sessão salva e as fontes carregarem (AUTH-09).
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontAssets);
  const session = useSessionStore((state) => state.session);
  const isRestoring = useSessionStore((state) => state.isRestoring);
  const usuarioId = session?.user.id ?? null;
  const { estado, isAprovado } = useProfile();
  const sessaoLocalUsuario = useSyncStore((state) => state.sessaoLocalUsuario);
  const sessaoLocalErro = useSyncStore((state) => state.sessaoLocalErro);
  const [tentativaPreparo, setTentativaPreparo] = useState(0);

  useEffect(() => {
    configureGoogleSignIn();
    const unsubscribeSession = startSessionSync();

    return unsubscribeSession;
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
  const sessaoLocalPronta = Boolean(usuarioId && sessaoLocalUsuario === usuarioId);
  const preparoLocalFalhou = Boolean(
    usuarioId && sessaoLocalErro && sessaoLocalErro.usuarioId === usuarioId,
  );
  // O app só pode montar as telas depois que o cache da conta atual foi limpo/preparado. Sem essa
  // espera, uma troca de conta mostraria por um instante os dados da conta anterior.
  const aguardandoSessaoLocal = temAcesso && !sessaoLocalPronta && !preparoLocalFalhou;

  // Sincronização só depois do banco migrado e do perfil aprovado. O dono da outbox é a conta
  // atual: trocar de usuário reinicia o listener e nunca drena a fila de outra conta.
  useEffect(() => {
    if (!dbPronto || !temAcesso || !usuarioId) return;
    return startNetworkSyncListener(usuarioId);
  }, [dbPronto, temAcesso, usuarioId, tentativaPreparo]);

  // Com erro na migration o banco nunca ficará pronto: esconde a splash também nesse caso, senão o
  // usuário ficaria preso nela sem saber o que houve.
  const falhouNoBanco = dbErro !== undefined && fontsLoaded;
  const prontoParaEsconderSplash =
    isReady && (!temAcesso || sessaoLocalPronta || preparoLocalFalhou);

  useEffect(() => {
    if (prontoParaEsconderSplash || falhouNoBanco) SplashScreen.hideAsync();
  }, [prontoParaEsconderSplash, falhouNoBanco]);

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

  // A preparação local roda dentro do listener da conta. Enquanto ela não termina, nenhuma tela
  // de dados é montada. Se falhar, o usuário vê o erro e pode tentar de novo sem risco de cache
  // da conta anterior aparecer.
  if (aguardandoSessaoLocal) {
    return (
      <Screen align="center">
        <ActivityIndicator
          size="large"
          color={colors.accent}
          accessibilityLabel="Preparando os dados locais"
        />
      </Screen>
    );
  }

  if (temAcesso && preparoLocalFalhou) {
    return (
      <Screen align="center">
        <EmptyState
          icon="alerta"
          title="Não foi possível preparar os dados locais"
          description={
            sessaoLocalErro?.mensagem ??
            'Feche e abra o app novamente. Se o problema continuar, fale com o suporte.'
          }
          actionLabel="Tentar novamente"
          onAction={() => setTentativaPreparo((atual) => atual + 1)}
        />
      </Screen>
    );
  }

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
