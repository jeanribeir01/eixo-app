// Valores fictícios para os testes: src/lib/env.ts valida as variáveis ao ser importado,
// e nenhum teste deve depender do .env real de quem está rodando.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://projeto-de-teste.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-de-teste';
process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id-de-teste.apps.googleusercontent.com';

// Worklets nativos não existem no Jest; os mocks oficiais preservam as props visíveis dos componentes.
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<typeof import('react-native-reanimated')>('react-native-reanimated/mock'),
  useReducedMotion: jest.fn(() => false),
}));

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

// `app/_layout.tsx` importa `@/db/client`, que chama `openDatabaseSync` já no import, e roda o
// `useMigrations` com esse banco. Nada disso existe no Jest (módulo nativo), então os testes de tela
// recebem um banco falso e migrations "já aplicadas". O banco REAL dos testes vem de
// `criarBancoDeTeste()` (src/db/testing.ts, better-sqlite3). Quem quiser SQLite real num teste não
// pode importar `@/db/client`: importe só `@/db/schema` e o helper.
jest.mock('expo-sqlite', () => ({ openDatabaseSync: () => ({}) }));
jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: jest.fn(() => ({ success: true, error: undefined })),
}));
