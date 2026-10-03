import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import { z } from 'zod';

import { Avatar, Button, Card, Column, Screen, Text } from '@/ui';

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
    // Sem nome no Google, mostramos o e-mail para a Home nunca ficar com um título vazio.
    displayName: fullName || email,
    photoUrl: metadata.avatar_url || metadata.picture || null,
  };
}

export function HomeView() {
  const router = useRouter();
  const session = useSessionStore((state) => state.session);
  const { isAdmin } = useProfile();

  // O layout só renderiza esta tela com sessão; o retorno nulo é apenas proteção de tipo.
  if (!session) return null;

  const profile = profileFromSession(session);

  return (
    <Screen>
      <Text variant="bodySm" weight="medium">
        Eixo Certo
      </Text>

      <Column gap="xs">
        <Text variant="heading">Login confirmado</Text>
        <Text tone="body">Esta é uma tela de teste da autenticação com Google.</Text>
      </Column>

      <Card>
        <Avatar name={profile.displayName} photoUrl={profile.photoUrl} />
        <Column gap="xs">
          <Text variant="subheading">{profile.displayName}</Text>
          <Text tone="body">{profile.email}</Text>
        </Column>
      </Card>

      {/* Só o Admin vê o atalho; a rota também não existe para os outros perfis (US16). */}
      {isAdmin && <Button label="Usuários" variant="ghost" onPress={() => router.push('/usuarios')} />}

      <Button label="Sair" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
