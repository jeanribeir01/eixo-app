import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import { Avatar, Badge, Button, Card, Column, ListItem, ListSection, Screen, Text } from '@/ui';

import { signOut } from './googleAuth';
import { profileFromSession } from './perfilGoogle';
import { useProfile } from './profileStore';
import { useSessionStore } from './sessionStore';

// Aba Conta (EIX-64; antes "Configurações"): quem está logado, os atalhos de administração e o Sair. Substitui a
// Home de teste da US15.
export function ContaView() {
  const router = useRouter();
  const session = useSessionStore((state) => state.session);
  const { usuario, isAdmin } = useProfile();

  // O layout só renderiza esta tela com sessão; o retorno nulo é apenas proteção de tipo.
  if (!session) return null;

  const profile = profileFromSession(session);
  const versao = Constants.expoConfig?.version ?? '—';

  return (
    <Screen scroll>
      {/* Aba não tem header nativo: o título fica no conteúdo. */}
      <Text variant="heading">Conta</Text>

      <Card>
        <Avatar name={profile.displayName} photoUrl={profile.photoUrl} />
        <Column gap="xs">
          <Text variant="subheading">{profile.displayName}</Text>
          <Text tone="body">{profile.email}</Text>
        </Column>
        {/* Enquanto o perfil carrega, sem Badge: melhor nada do que um perfil errado. */}
        {usuario && <Badge label={usuario.perfil} />}
      </Card>

      {/* Só o Admin vê a seção; a rota de Usuários também não existe para os outros perfis (US16). */}
      {isAdmin && (
        <ListSection label="Administração">
          <ListItem title="Usuários" icon="usuarios" onPress={() => router.push('/usuarios')} />
        </ListSection>
      )}

      <ListSection label="Aplicativo">
        <ListItem title="Versão" icon="versao" trailing={<Text tone="body">{versao}</Text>} />
      </ListSection>

      {/* Sem confirmação: sair é reversível (é só entrar de novo), e o roteiro do vídeo sai duas vezes. */}
      <Button label="Sair" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
