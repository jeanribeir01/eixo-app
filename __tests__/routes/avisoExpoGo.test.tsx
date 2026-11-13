import { isRunningInExpoGo } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { configureGoogleSignIn } from '@/features/auth/googleAuth';

import RootLayout from '../../app/_layout';

// EIX-73: aberto no Expo Go, o app mostra um aviso em português em vez da tela vermelha.
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

function renderizar() {
  renderRouter({ _layout: RootLayout, index: () => <Text>Tela Inicial</Text> }, { initialUrl: '/' });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('layout raiz no Expo Go', () => {
  it('DEV-01: mostra o aviso em português com o caminho do README', () => {
    mockIsRunningInExpoGo.mockReturnValue(true);

    renderizar();

    expect(screen.getByText('Este app não abre no Expo Go')).toBeOnTheScreen();
    expect(screen.getByText(/instale o app de desenvolvimento/i)).toBeOnTheScreen();
    expect(screen.getByText(/"Rodar no celular"/)).toBeOnTheScreen();
    expect(screen.queryByText('Tela Inicial')).not.toBeOnTheScreen();
  });

  it('DEV-02: esconde a splash e não configura o Google', () => {
    mockIsRunningInExpoGo.mockReturnValue(true);

    renderizar();

    expect(SplashScreen.hideAsync).toHaveBeenCalled();
    expect(configureGoogleSignIn).not.toHaveBeenCalled();
  });

  it('DEV-04: fora do Expo Go segue o fluxo normal, sem o aviso', () => {
    mockIsRunningInExpoGo.mockReturnValue(false);

    renderizar();

    expect(configureGoogleSignIn).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Este app não abre no Expo Go')).not.toBeOnTheScreen();
  });
});
