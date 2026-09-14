import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/supabase/client';

type SessionState = {
  session: Session | null;
  // true até o supabase-js terminar de ler a sessão salva no SecureStore.
  // Enquanto isso, o app não sabe se deve mostrar Login ou Home, então não mostra nenhum dos dois.
  isRestoring: boolean;
};

export const useSessionStore = create<SessionState>(() => ({
  session: null,
  isRestoring: true,
}));

// Liga o store aos eventos do Supabase. O primeiro evento (INITIAL_SESSION) chega depois de ler o
// SecureStore; os seguintes cobrem login (SIGNED_IN), refresh (TOKEN_REFRESHED) e saída (SIGNED_OUT).
// Retorna a função que cancela a inscrição, para usar no cleanup do useEffect.
export function startSessionSync(): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    // Só atualiza estado aqui: chamar outras funções do supabase dentro deste callback pode travar o client.
    useSessionStore.setState({ session, isRestoring: false });
  });

  return () => data.subscription.unsubscribe();
}
