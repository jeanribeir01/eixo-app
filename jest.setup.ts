// Valores fictícios para os testes: src/lib/env.ts valida as variáveis ao ser importado,
// e nenhum teste deve depender do .env real de quem está rodando.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://projeto-de-teste.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-de-teste';
process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id-de-teste.apps.googleusercontent.com';

// expo-symbols desenha o ícone com fonte nativa (Material Symbols) ou view nativa (SF Symbols), o que
// não existe no Jest. O mock troca por um Text vazio, como o próprio expo-symbols faz no Android, que
// expõe o nome Android (testID), o tamanho e a cor para os testes afirmarem qual ícone a tela pediu.
jest.mock('expo-symbols', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  type MockSymbolProps = { name: { android: string }; size: number; tintColor: string };
  return {
    SymbolView: ({ name, size, tintColor }: MockSymbolProps) =>
      createElement(Text, { testID: `simbolo-${name.android}`, style: { width: size, height: size, color: tintColor } }),
  };
});
