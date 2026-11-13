import type * as GoogleSigninModulo from '@react-native-google-signin/google-signin';

import { env } from '@/lib/env';
import { supabase } from '@/supabase/client';

import type { AuthErrorCode } from './errors';

export type SignInResult = { ok: true } | { ok: false; code: AuthErrorCode };

// O módulo nativo do Google é carregado só quando uma função daqui é chamada, nunca no import.
// No Expo Go ele não existe, e avaliá-lo lança na hora ("'RNGoogleSignin' could not be found"):
// com import no topo, o app inteiro cairia antes de o layout mostrar o aviso em português (EIX-73).
function google(): typeof GoogleSigninModulo {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- carregamento sob demanda, explicado acima
  return require('@react-native-google-signin/google-signin');
}

// Precisa rodar uma vez antes do primeiro signIn. Usamos o client **Web** (não o Android):
// é ele que emite o idToken que o Supabase aceita. O client Android só autoriza package + SHA-1.
export function configureGoogleSignIn() {
  google().GoogleSignin.configure({ webClientId: env.googleWebClientId });
}

// Retorna um resultado em vez de lançar exceção: assim a tela decide o que mostrar
// sem precisar conhecer os erros nativos do Google nem do Supabase.
export async function signInWithGoogle(): Promise<SignInResult> {
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = google();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      return { ok: false, code: 'cancelled' };
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      return { ok: false, code: 'no_id_token' };
    }

    // O Supabase valida o token com o Google e cria/recupera o usuário em auth.users.
    // A sessão resultante é gravada pelo próprio supabase-js no SecureStore.
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) {
      return { ok: false, code: 'unknown' };
    }

    return { ok: true };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return { ok: false, code: 'cancelled' };
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return { ok: false, code: 'play_services' };
    }
    return { ok: false, code: 'unknown' };
  }
}

export async function signOut(): Promise<void> {
  try {
    // Sem isso, o próximo login entraria direto na mesma conta Google, sem mostrar o seletor.
    await google().GoogleSignin.signOut();
  } catch {
    // Falha no Google não pode impedir o usuário de sair do app: seguimos para o Supabase.
  }
  // Remove a sessão do SecureStore e dispara SIGNED_OUT, que leva o layout de volta ao Login.
  await supabase.auth.signOut();
}
