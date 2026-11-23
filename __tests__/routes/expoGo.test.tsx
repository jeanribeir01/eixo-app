import { isRunningInExpoGo } from 'expo';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { configureGoogleSignIn } from '@/features/auth/googleAuth';

import RootLayout from '../../app/_layout';

// No Expo Go o app abre normalmente, só sem o Google Sign-In (o módulo nativo não existe lá): é o
// jeito de rodar num iPhone sem conta de desenvolvedor da Apple. O login vira só por e-mail (LoginView).
// O jest.setup.ts mocka isRunningInExpoGo com false para todos os testes; aqui cada caso escolhe o valor.
jest.mock('@/supabase/client', () => ({
  supabase: { auth: { onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })) } },
}));
jest.mock('@/features/auth/googleAuth', () => ({ configureGoogleSignIn: jest.fn() }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

const mockIsRunningInExpoGo = isRunningInExpoGo as jest.Mock;

async function renderizar() {
  await renderRouter({ _layout: RootLayout, index: () => <Text>Tela Inicial</Text> }, { initialUrl: '/' });
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  mockIsRunningInExpoGo.mockReturnValue(false);
});

describe('layout raiz no Expo Go', () => {
  it('não mostra mais o aviso de bloqueio da EIX-73', async () => {
    mockIsRunningInExpoGo.mockReturnValue(true);

    await renderizar();

    expect(screen.queryByText('Este app não abre no Expo Go')).not.toBeOnTheScreen();
  });

  it('não configura o Google Sign-In, que não existe no Expo Go', async () => {
    mockIsRunningInExpoGo.mockReturnValue(true);

    await renderizar();

    expect(configureGoogleSignIn).not.toHaveBeenCalled();
  });

  it('fora do Expo Go configura o Google Sign-In uma vez', async () => {
    mockIsRunningInExpoGo.mockReturnValue(false);

    await renderizar();

    expect(configureGoogleSignIn).toHaveBeenCalledTimes(1);
  });
});
