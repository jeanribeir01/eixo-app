import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Avatar, Aviso, Button, Column, EmptyState, Logo, Screen, Text, colors, spacing } from '@/ui';

import { signOut } from './googleAuth';
import { profileFromSession } from './perfilGoogle';
import { useProfile, useProfileStore } from './profileStore';
import { useSessionStore } from './sessionStore';

// Única área de quem está logado mas não tem acesso: perfil ainda carregando, falha ao
// carregar, conta aguardando aprovação ou bloqueada (US16). O layout raiz só manda para cá
// quem não está com status Ativo; nenhuma tela de módulo fica registrada para essa pessoa.
export function AguardandoLiberacaoView() {
  const { usuario, estado, recarregar } = useProfile();
  const session = useSessionStore((state) => state.session);
  const [verificando, setVerificando] = useState(false);
  const [aindaAguardando, setAindaAguardando] = useState(false);

  // Nome e foto do Google: quem ainda não tem linha em `usuario` também se reconhece na tela.
  const google = session ? profileFromSession(session) : null;
  const nome = usuario?.nome || google?.displayName || '';
  const email = usuario?.email || google?.email || '';

  async function handleVerificar() {
    setVerificando(true);
    setAindaAguardando(false);
    await recarregar();
    setVerificando(false);
    // Aprovado, o layout raiz troca de tela sozinho. Se esta tela continua, a resposta aparece no
    // próprio aviso: sem ela, o toque parece não ter feito nada.
    const atual = useProfileStore.getState();
    setAindaAguardando(atual.estado === 'pronto' && atual.usuario?.status !== 'Ativo');
  }

  if (estado === 'carregando' && !verificando) {
    return (
      <Screen align="center">
        <Column align="center">
          <ActivityIndicator size="small" color={colors.accentStrong} accessibilityLabel="Carregando seu perfil" />
        </Column>
      </Screen>
    );
  }

  if (estado === 'erro') {
    return (
      <Screen align="center">
        <EmptyState
          title="Não foi possível carregar seu perfil."
          description="Verifique sua conexão e tente de novo."
          actionLabel="Tentar novamente"
          onAction={recarregar}
        />
        <Button label="Sair da conta" variant="ghost" onPress={signOut} />
      </Screen>
    );
  }

  const bloqueado = usuario?.status === 'Bloqueado';

  return (
    <Screen scroll>
      <Logo withWordmark compacto />

      <Column gap="xs">
        <Text variant="display" accessibilityRole="header">
          {bloqueado ? 'Acesso bloqueado' : 'Aguardando aprovação'}
        </Text>
        <Text tone="body">{bloqueado ? 'Sua conta existe, mas está sem acesso.' : 'Sua conta foi criada.'}</Text>
      </Column>

      {!!nome && (
        <View style={styles.pessoa}>
          <Avatar name={nome} photoUrl={google?.photoUrl ?? null} size="sm" />
          <Column gap="xs">
            <Text weight="medium">{nome}</Text>
            {!!email && email !== nome && (
              <Text variant="bodySm" tone="body">
                {email}
              </Text>
            )}
          </Column>
        </View>
      )}

      {bloqueado ? (
        <Aviso tom="danger" icone="bloqueado" titulo="Seu acesso foi bloqueado">
          Se achar que é engano, fale com quem administra o Eixo Certo na sua empresa.
        </Aviso>
      ) : (
        <Aviso tom="info" icone="aguardando" titulo="Falta liberar seu acesso">
          <Text variant="bodySm">
            Quem administra o Eixo Certo na sua empresa precisa aprovar a conta e escolher o seu perfil.
          </Text>
          {aindaAguardando && (
            <Text variant="bodySm" weight="medium">
              Verificado agora: a aprovação ainda não saiu.
            </Text>
          )}
        </Aviso>
      )}

      <Column gap="sm">
        {!bloqueado && <Button label="Verificar aprovação" loading={verificando} onPress={handleVerificar} />}
        <Button label="Sair da conta" variant="ghost" onPress={signOut} />
      </Column>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pessoa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
