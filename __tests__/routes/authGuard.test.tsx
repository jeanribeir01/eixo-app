import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { useSessionStore } from '@/features/auth/sessionStore';
import { supabase } from '@/supabase/client';

import AppLayout from '../../app/(app)/_layout';
import AuthLayout from '../../app/(auth)/_layout';
import RootLayout from '../../app/_layout';

// Testa o layout raiz de verdade. As telas são stubs para o teste não depender do visual de Login/Home.
jest.mock('@/supabase/client', () => ({
  supabase: { auth: { onAuthStateChange: jest.fn() } },
}));
jest.mock('@/features/auth/googleAuth', () => ({ configureGoogleSignIn: jest.fn() }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

type Listener = (event: AuthChangeEvent, session: Session | null) => void;
let emit: Listener = () => undefined;

const session = { access_token: 'token', user: { id: 'user-1' } } as unknown as Session;

const routes = {
  _layout: RootLayout,
  '(app)/_layout': AppLayout,
  '(app)/index': () => <Text>Tela Home</Text>,
  '(auth)/_layout': AuthLayout,
  '(auth)/login': () => <Text>Tela Login</Text>,
};

beforeEach(() => {
  useSessionStore.setState({ session: null, isRestoring: true });
  (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((listener: Listener) => {
    emit = listener;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
});

describe('proteção de rotas por sessão', () => {
  it('enquanto a sessão salva é lida, não renderiza Login nem Home (AUTH-09)', () => {
    renderRouter(routes, { initialUrl: '/' });

    expect(screen.queryByText('Tela Login')).not.toBeOnTheScreen();
    expect(screen.queryByText('Tela Home')).not.toBeOnTheScreen();
  });

  it('sem sessão salva, abre no Login (AUTH-01)', async () => {
    const router = renderRouter(routes, { initialUrl: '/' });

    act(() => emit('INITIAL_SESSION', null));

    expect(await screen.findByText('Tela Login')).toBeOnTheScreen();
    expect(screen.queryByText('Tela Home')).not.toBeOnTheScreen();
    expect(router.getPathname()).toBe('/login');
  });

  it('com sessão salva, abre direto na Home (AUTH-08)', async () => {
    const router = renderRouter(routes, { initialUrl: '/' });

    act(() => emit('INITIAL_SESSION', session));

    expect(await screen.findByText('Tela Home')).toBeOnTheScreen();
    expect(screen.queryByText('Tela Login')).not.toBeOnTheScreen();
    expect(router.getPathname()).toBe('/');
  });

  it('ao receber a sessão do login, sai do Login e vai para a Home (AUTH-02)', async () => {
    renderRouter(routes, { initialUrl: '/' });
    act(() => emit('INITIAL_SESSION', null));
    await screen.findByText('Tela Login');

    act(() => emit('SIGNED_IN', session));

    expect(await screen.findByText('Tela Home')).toBeOnTheScreen();
    expect(screen.queryByText('Tela Login')).not.toBeOnTheScreen();
  });

  it('SIGNED_OUT (Sair ou refresh falho) volta ao Login (AUTH-15)', async () => {
    renderRouter(routes, { initialUrl: '/' });
    act(() => emit('INITIAL_SESSION', session));
    await screen.findByText('Tela Home');

    act(() => emit('SIGNED_OUT', null));

    expect(await screen.findByText('Tela Login')).toBeOnTheScreen();
    expect(screen.queryByText('Tela Home')).not.toBeOnTheScreen();
  });
});
