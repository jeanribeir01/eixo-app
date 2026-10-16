import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as SplashScreen from 'expo-splash-screen';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import RootLayout from '../../app/_layout';

// Cobre o ramo de erro de migration do layout raiz. O jest.setup.ts mocka `useMigrations` com sucesso
// para todos os testes; aqui só este arquivo força a falha.
jest.mock('@/supabase/client', () => ({
  supabase: { auth: { onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })) } },
}));
jest.mock('@/features/auth/googleAuth', () => ({ configureGoogleSignIn: jest.fn() }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

const mockUseMigrations = useMigrations as jest.Mock;

afterEach(() => {
  // Volta ao padrão do jest.setup.ts para não vazar a falha para outros testes do arquivo.
  mockUseMigrations.mockImplementation(() => ({ success: true, error: undefined }));
});

describe('erro de migration no layout raiz', () => {
  it('mostra a mensagem em português e esconde a splash', () => {
    mockUseMigrations.mockImplementation(() => ({ success: false, error: new Error('falha') }));

    renderRouter({ _layout: RootLayout, index: () => <Text>Tela Inicial</Text> }, { initialUrl: '/' });

    expect(screen.getByText('Não foi possível preparar o banco local')).toBeOnTheScreen();
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });
});
