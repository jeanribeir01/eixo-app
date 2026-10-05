import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Button, Column, EmptyState, Screen, Text, colors } from '@/ui';

import { signOut } from './googleAuth';
import { useProfile } from './profileStore';

// Única área de quem está logado mas não tem acesso: perfil ainda carregando, falha ao
// carregar, conta aguardando aprovação ou bloqueada (US16). O layout raiz só manda para cá
// quem não está com status Ativo; nenhuma tela de módulo fica registrada para essa pessoa.
export function AguardandoLiberacaoView() {
  const { usuario, estado, recarregar } = useProfile();
  const [verificando, setVerificando] = useState(false);

  async function handleVerificar() {
    setVerificando(true);
    await recarregar();
    setVerificando(false);
  }

  if (estado === 'carregando' && !verificando) {
    return (
      <Screen align="center">
        <Column align="center">
          <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando seu perfil" />
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
        <Button label="Sair" variant="ghost" onPress={signOut} />
      </Screen>
    );
  }

  const bloqueado = usuario?.status === 'Bloqueado';

  return (
    <Screen align="center">
      <Column gap="sm">
        <Text variant="bodySm" weight="medium">
          Eixo Certo
        </Text>
        <Text variant="heading">{bloqueado ? 'Acesso bloqueado' : 'Aguardando liberação'}</Text>
        <Text tone="body">
          {bloqueado
            ? 'Seu acesso foi bloqueado. Fale com o administrador.'
            : 'Sua conta foi criada. Um administrador precisa liberar o seu acesso antes de você usar o app.'}
        </Text>
        {!!usuario?.email && <Text tone="muted">{usuario.email}</Text>}
      </Column>

      <Column gap="sm">
        {!bloqueado && (
          <Button label="Verificar novamente" variant="ghost" loading={verificando} onPress={handleVerificar} />
        )}
        <Button label="Sair" variant="ghost" onPress={signOut} />
      </Column>
    </Screen>
  );
}
