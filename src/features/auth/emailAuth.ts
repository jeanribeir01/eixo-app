import { supabase } from '@/supabase/client';

import type { SignInResult } from './googleAuth';

// Login por e-mail e senha existe só para testar os 4 perfis com contas criadas no painel do
// Supabase — o login oficial do app é o Google (US15). Por isso ele fica desligado por padrão e
// só aparece com EXPO_PUBLIC_LOGIN_EMAIL_HABILITADO=true no .env de quem está testando.
export const loginEmailHabilitado = process.env.EXPO_PUBLIC_LOGIN_EMAIL_HABILITADO === 'true';

export async function signInWithEmail(email: string, senha: string): Promise<SignInResult> {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      // Não dizemos se o erro foi no e-mail ou na senha: isso revelaria quais e-mails têm conta.
      if (error.code === 'invalid_credentials') return { ok: false, code: 'invalid_credentials' };
      return { ok: false, code: 'unknown' };
    }
    // Sessão nova dispara o redirect no layout raiz, igual ao login com Google.
    return { ok: true };
  } catch {
    return { ok: false, code: 'unknown' };
  }
}
