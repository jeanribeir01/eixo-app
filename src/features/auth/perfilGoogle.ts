import type { Session } from '@supabase/supabase-js';
import { z } from 'zod';

// user_metadata vem do provedor (Google) sem tipo garantido: validamos na borda com Zod (CLAUDE.md §12).
// O Supabase preenche full_name/name e avatar_url/picture a partir do perfil Google.
const googleMetadataSchema = z.object({
  full_name: z.string().optional().catch(undefined),
  name: z.string().optional().catch(undefined),
  avatar_url: z.string().optional().catch(undefined),
  picture: z.string().optional().catch(undefined),
});

export type PerfilGoogle = { email: string; displayName: string; photoUrl: string | null };

// Nome, e-mail e foto de quem está logado. Usado pela Conta e pelo cabeçalho do Início, para os dois
// mostrarem a mesma foto.
export function profileFromSession(session: Session): PerfilGoogle {
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
