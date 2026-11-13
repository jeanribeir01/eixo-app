// DEV-03 (EIX-73): no Expo Go o módulo nativo do Google não existe, e avaliá-lo lança
// "TurboModuleRegistry.getEnforcing(...): 'RNGoogleSignin' could not be found". Se isso acontecer no
// import de googleAuth, o app inteiro cai antes de o layout conseguir mostrar o aviso em português.
// Arquivo separado porque o mock abaixo derruba o módulo do Google para o arquivo todo.

const ERRO_EXPO_GO = "TurboModuleRegistry.getEnforcing(...): 'RNGoogleSignin' could not be found";

jest.mock('@/supabase/client', () => ({ supabase: { auth: {} } }));
jest.mock('@react-native-google-signin/google-signin', () => {
  throw new Error(ERRO_EXPO_GO);
});

describe('googleAuth sem o módulo nativo do Google (Expo Go)', () => {
  // jest.requireActual carrega o arquivo de verdade; o mock acima continua valendo para o que ele importa.
  it('DEV-03: importar o arquivo não avalia o módulo do Google', () => {
    expect(() => jest.requireActual('../googleAuth')).not.toThrow();
  });

  it('DEV-03: o módulo do Google só é carregado quando uma função de login é chamada', () => {
    const { configureGoogleSignIn } = jest.requireActual<typeof import('../googleAuth')>('../googleAuth');

    expect(() => configureGoogleSignIn()).toThrow(ERRO_EXPO_GO);
  });
});
