import type { Session } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { z } from 'zod';

import { Avatar, Badge, Button, Card, Column, ListItem, ListSection, Screen, Text } from '@/ui';

import { signOut } from './googleAuth';
import { useProfile } from './profileStore';
import { useSessionStore } from './sessionStore';

// user_metadata vem do provedor (Google) sem tipo garantido: validamos na borda com Zod (CLAUDE.md §12).
// O Supabase preenche full_name/name e avatar_url/picture a partir do perfil Google.
const googleMetadataSchema = z.object({
  full_name: z.string().optional().catch(undefined),
  name: z.string().optional().catch(undefined),
  avatar_url: z.string().optional().catch(undefined),
  picture: z.string().optional().catch(undefined),
});

function profileFromSession(session: Session) {
  const metadata = googleMetadataSchema.parse(session.user.user_metadata ?? {});
  const email = session.user.email ?? '';
  const fullName = (metadata.full_name || metadata.name || '').trim();

  return {
    email,
    // Sem nome no Google, mostramos o e-mail para o cartão nunca ficar com um título vazio.
    displayName: fullName || email,
    photoUrl: metadata.avatar_url || metadata.picture || null,
  };
}

// Aba Configurações (EIX-64): quem está logado, os atalhos de administração e o Sair. Substitui a
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
      <Text variant="heading">Configurações</Text>

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
