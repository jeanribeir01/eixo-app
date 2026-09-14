import { GoogleSignin, statusCodes, type User } from '@react-native-google-signin/google-signin';

import { supabase } from '@/supabase/client';

import { configureGoogleSignIn, signInWithGoogle, signOut } from '../googleAuth';

// O módulo nativo do Google é simulado pelo setup oficial da lib (ver package.json → jest.setupFiles),
// então helpers como isSuccessResponse/isErrorWithCode rodam de verdade. Aqui controlamos só as respostas.
jest.mock('@/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithIdToken: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

const signInWithIdToken = supabase.auth.signInWithIdToken as jest.Mock;
const supabaseSignOut = supabase.auth.signOut as jest.Mock;

function googleUser(idToken: string | null): User {
  return {
    idToken,
    serverAuthCode: null,
    scopes: [],
    user: {
      id: 'google-id',
      name: 'Maria Silva',
      email: 'maria@example.com',
      photo: null,
      familyName: 'Silva',
      givenName: 'Maria',
    },
  };
}

function nativeError(code: string) {
  return Object.assign(new Error(code), { code });
}

beforeEach(() => {
  jest.restoreAllMocks();
  signInWithIdToken.mockReset().mockResolvedValue({ data: { session: {} }, error: null });
  supabaseSignOut.mockReset().mockResolvedValue({ error: null });
  jest.spyOn(GoogleSignin, 'hasPlayServices').mockResolvedValue(true);
  jest.spyOn(GoogleSignin, 'signIn').mockResolvedValue({ type: 'success', data: googleUser('id-token-123') });
});

describe('configureGoogleSignIn', () => {
  it('configura o Google com o client Web das variáveis de ambiente', () => {
    const configure = jest.spyOn(GoogleSignin, 'configure').mockImplementation(() => undefined);

    configureGoogleSignIn();

    expect(configure).toHaveBeenCalledWith({
      webClientId: 'web-client-id-de-teste.apps.googleusercontent.com',
    });
  });
});

describe('signInWithGoogle', () => {
  it('troca o idToken do Google por sessão no Supabase (AUTH-02)', async () => {
    const result = await signInWithGoogle();

    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'id-token-123' });
    expect(result).toEqual({ ok: true });
  });

  it('seletor cancelado (resposta "cancelled") → cancelled, sem chamar o Supabase (AUTH-04)', async () => {
    jest.spyOn(GoogleSignin, 'signIn').mockResolvedValue({ type: 'cancelled', data: null });

    const result = await signInWithGoogle();

    expect(result).toEqual({ ok: false, code: 'cancelled' });
    expect(signInWithIdToken).not.toHaveBeenCalled();
  });

  it('seletor cancelado (erro SIGN_IN_CANCELLED) → cancelled (AUTH-04)', async () => {
    jest.spyOn(GoogleSignin, 'signIn').mockRejectedValue(nativeError(statusCodes.SIGN_IN_CANCELLED));

    expect(await signInWithGoogle()).toEqual({ ok: false, code: 'cancelled' });
  });

  it('Play Services indisponível → play_services, sem abrir o seletor (AUTH-05)', async () => {
    jest.spyOn(GoogleSignin, 'hasPlayServices').mockRejectedValue(nativeError(statusCodes.PLAY_SERVICES_NOT_AVAILABLE));

    const result = await signInWithGoogle();

    expect(result).toEqual({ ok: false, code: 'play_services' });
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();
  });

  it('Google sem idToken → no_id_token, sem chamar o Supabase (AUTH-06)', async () => {
    jest.spyOn(GoogleSignin, 'signIn').mockResolvedValue({ type: 'success', data: googleUser(null) });

    const result = await signInWithGoogle();

    expect(result).toEqual({ ok: false, code: 'no_id_token' });
    expect(signInWithIdToken).not.toHaveBeenCalled();
  });

  it('Supabase rejeita o token → unknown (AUTH-07)', async () => {
    signInWithIdToken.mockResolvedValue({ data: { session: null }, error: new Error('invalid token') });

    expect(await signInWithGoogle()).toEqual({ ok: false, code: 'unknown' });
  });

  it('erro inesperado (sem código) → unknown (AUTH-07)', async () => {
    jest.spyOn(GoogleSignin, 'signIn').mockRejectedValue(new Error('falha de rede'));

    expect(await signInWithGoogle()).toEqual({ ok: false, code: 'unknown' });
  });

  it('erro do Google com outro código → unknown (AUTH-07)', async () => {
    jest.spyOn(GoogleSignin, 'signIn').mockRejectedValue(nativeError(statusCodes.IN_PROGRESS));

    expect(await signInWithGoogle()).toEqual({ ok: false, code: 'unknown' });
  });
});

describe('signOut (AUTH-15)', () => {
  it('encerra a sessão no Google e no Supabase', async () => {
    const googleSignOut = jest.spyOn(GoogleSignin, 'signOut').mockResolvedValue(null);

    await signOut();

    expect(googleSignOut).toHaveBeenCalledTimes(1);
    expect(supabaseSignOut).toHaveBeenCalledTimes(1);
  });

  it('encerra a sessão do Supabase mesmo se o signOut do Google falhar', async () => {
    jest.spyOn(GoogleSignin, 'signOut').mockRejectedValue(new Error('google indisponível'));

    await expect(signOut()).resolves.toBeUndefined();
    expect(supabaseSignOut).toHaveBeenCalledTimes(1);
  });
});
