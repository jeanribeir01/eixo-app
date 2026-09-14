import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { supabase } from '@/supabase/client';

import { startSessionSync, useSessionStore } from '../sessionStore';

jest.mock('@/supabase/client', () => ({
  supabase: { auth: { onAuthStateChange: jest.fn() } },
}));

type Listener = (event: AuthChangeEvent, session: Session | null) => void;

const onAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;
const unsubscribe = jest.fn();
let emit: Listener = () => undefined;

const session = { access_token: 'token', user: { id: 'user-1' } } as unknown as Session;

beforeEach(() => {
  useSessionStore.setState({ session: null, isRestoring: true });
  unsubscribe.mockReset();
  onAuthStateChange.mockReset().mockImplementation((listener: Listener) => {
    emit = listener;
    return { data: { subscription: { unsubscribe } } };
  });
});

describe('sessionStore', () => {
  it('começa restaurando, sem sessão (AUTH-09)', () => {
    expect(useSessionStore.getState()).toEqual({ session: null, isRestoring: true });
  });

  it('INITIAL_SESSION com sessão salva encerra a restauração com a sessão (AUTH-08)', () => {
    startSessionSync();

    emit('INITIAL_SESSION', session);

    expect(useSessionStore.getState()).toEqual({ session, isRestoring: false });
  });

  it('INITIAL_SESSION sem sessão encerra a restauração sem sessão (AUTH-01)', () => {
    startSessionSync();

    emit('INITIAL_SESSION', null);

    expect(useSessionStore.getState()).toEqual({ session: null, isRestoring: false });
  });

  it('SIGNED_OUT limpa a sessão (AUTH-15 / refresh falho)', () => {
    startSessionSync();
    emit('SIGNED_IN', session);

    emit('SIGNED_OUT', null);

    expect(useSessionStore.getState().session).toBeNull();
  });

  it('a função retornada cancela a inscrição', () => {
    const stop = startSessionSync();

    stop();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
