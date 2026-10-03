import type { Session } from '@supabase/supabase-js';
import { router as navegador } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { limparPerfil } from '@/features/auth/profileStore';
import { useSessionStore } from '@/features/auth/sessionStore';
import type { PerfilNome } from '@/features/auth/permissions';

import InicioRoute from '../../app/(app)/(tabs)/index';
import TabsLayout from '../../app/(app)/(tabs)/_layout';
import AppLayout from '../../app/(app)/_layout';
import AuthLayout from '../../app/(auth)/_layout';
import PendenteLayout from '../../app/(pendente)/_layout';
import RootLayout from '../../app/_layout';

// Navegação contextual por perfil (US17 / EIX-31) com os layouts reais. As telas são stubs: o que
// está em teste é quais rotas existem e para onde cada perfil vai, não o visual dos módulos.
const mockLinhaUsuario = jest.fn();
jest.mock('@/supabase/client', () => ({
  supabase: {
    auth: { onAuthStateChange: jest.fn() },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => mockLinhaUsuario() }) }) }),
  },
}));
jest.mock('@/features/auth/googleAuth', () => ({ configureGoogleSignIn: jest.fn() }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const routes = {
  _layout: RootLayout,
  '(app)/_layout': AppLayout,
  '(app)/(tabs)/_layout': TabsLayout,
  '(app)/(tabs)/index': InicioRoute,
  '(app)/(tabs)/dashboards': () => <Text>Tela Dashboards</Text>,
  '(app)/(tabs)/financeiro': () => <Text>Tela Financeiro</Text>,
  '(app)/(tabs)/frota': () => <Text>Tela Frota</Text>,
  '(app)/(tabs)/viagens': () => <Text>Tela Viagens</Text>,
  '(app)/(tabs)/configuracoes': () => <Text>Tela Configuracoes</Text>,
  '(app)/categorias/index': () => <Text>Tela Categorias</Text>,
  '(app)/categorias/nova': () => <Text>Tela Nova Categoria</Text>,
  '(app)/categorias/[id]/editar': () => <Text>Tela Editar Categoria</Text>,
  '(app)/usuarios/index': () => <Text>Tela Usuarios</Text>,
  '(app)/usuarios/[id]': () => <Text>Tela Usuario</Text>,
  '(auth)/_layout': AuthLayout,
  '(auth)/login': () => <Text>Tela Login</Text>,
  '(pendente)/_layout': PendenteLayout,
  '(pendente)/aguardando': () => <Text>Tela Aguardando</Text>,
};

const session = { access_token: 'token', user: { id: 'user-1' } } as unknown as Session;

const todasAsAbas = ['Dashboards', 'Financeiro', 'Frota', 'Viagens', 'Configurações'];

// O que cada perfil deve enxergar e onde abre, direto dos critérios de aceite da EIX-31.
const cenarios: { perfil: PerfilNome; abas: string[]; telaInicial: string; rotaInicial: string }[] = [
  { perfil: 'Admin', abas: todasAsAbas, telaInicial: 'Tela Dashboards', rotaInicial: '/dashboards' },
  {
    perfil: 'Gestor de Frota',
    abas: ['Dashboards', 'Frota', 'Viagens', 'Configurações'],
    telaInicial: 'Tela Frota',
    rotaInicial: '/frota',
  },
  {
    perfil: 'Financeiro',
    abas: ['Dashboards', 'Financeiro', 'Configurações'],
    telaInicial: 'Tela Dashboards',
    rotaInicial: '/dashboards',
  },
  { perfil: 'Motorista', abas: ['Viagens', 'Configurações'], telaInicial: 'Tela Viagens', rotaInicial: '/viagens' },
];

// Login aprovado com o perfil pedido; o layout raiz busca o perfil e libera a área do app.
async function entrarComo(perfil: PerfilNome, initialUrl = '/') {
  mockLinhaUsuario.mockResolvedValue({
    data: { id: 'user-1', nome: 'Ana', email: 'ana@empresa.com', status: 'Ativo', perfil: { nome: perfil } },
    error: null,
  });
  const router = renderRouter(routes, { initialUrl });
  act(() => emit('INITIAL_SESSION', session));
  await screen.findByText('Configurações');
  return router;
}

type Listener = (event: string, session: Session | null) => void;
let emit: Listener = () => undefined;

beforeEach(() => {
  const { supabase } = jest.requireMock('@/supabase/client') as {
    supabase: { auth: { onAuthStateChange: jest.Mock } };
  };
  useSessionStore.setState({ session: null, isRestoring: true });
  limparPerfil();
  supabase.auth.onAuthStateChange.mockImplementation((listener: Listener) => {
    emit = listener;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
});

describe.each(cenarios)('menu do perfil $perfil (EIX-31)', ({ perfil, abas, telaInicial, rotaInicial }) => {
  it(`abre o app em ${rotaInicial}`, async () => {
    const router = await entrarComo(perfil);

    expect(await screen.findByText(telaInicial)).toBeOnTheScreen();
    expect(router.getPathname()).toBe(rotaInicial);
  });

  it('mostra só as abas do perfil; as outras ficam ocultas, não desabilitadas', async () => {
    await entrarComo(perfil);

    for (const aba of todasAsAbas) {
      if (abas.includes(aba)) expect(screen.getByText(aba)).toBeOnTheScreen();
      else expect(screen.queryByText(aba)).not.toBeOnTheScreen();
    }
  });
});

// Uma linha por (perfil, aba proibida). O Admin não aparece aqui: ele vê todas as abas.
const abasProibidas = cenarios.flatMap((cenario) =>
  todasAsAbas.filter((aba) => !cenario.abas.includes(aba)).map((aba) => ({ ...cenario, aba })),
);

const rotaDaAba: Record<string, string> = {
  Dashboards: '/dashboards',
  Financeiro: '/financeiro',
  Frota: '/frota',
  Viagens: '/viagens',
  Configurações: '/configuracoes',
};

describe('URL proibida digitada (EIX-31)', () => {
  it.each(abasProibidas)('$perfil em $aba é redirecionado para a home do perfil', async ({ perfil, aba, telaInicial, rotaInicial }) => {
    const router = await entrarComo(perfil);
    await screen.findByText(telaInicial);

    act(() => navegador.push(rotaDaAba[aba]));

    expect(await screen.findByText(telaInicial)).toBeOnTheScreen();
    expect(screen.queryByText(`Tela ${aba}`)).not.toBeOnTheScreen();
    expect(router.getPathname()).toBe(rotaInicial);
  });
});

describe('telas internas seguem o módulo (EIX-31)', () => {
  it.each(['Gestor de Frota', 'Motorista'] as const)('%s digitando /categorias volta para a home do perfil', async (perfil) => {
    const { telaInicial, rotaInicial } = cenarios.find((c) => c.perfil === perfil)!;
    const router = await entrarComo(perfil);
    await screen.findByText(telaInicial);

    act(() => navegador.push('/categorias'));

    expect(await screen.findByText(telaInicial)).toBeOnTheScreen();
    expect(screen.queryByText('Tela Categorias')).not.toBeOnTheScreen();
    expect(router.getPathname()).toBe(rotaInicial);
  });

  it.each(['Admin', 'Financeiro'] as const)('%s abre /categorias', async (perfil) => {
    await entrarComo(perfil);

    act(() => navegador.push('/categorias'));

    expect(await screen.findByText('Tela Categorias')).toBeOnTheScreen();
  });

  it('Motorista que abre o app já numa URL financeira cai em Viagens', async () => {
    const router = await entrarComo('Motorista', '/financeiro');

    expect(await screen.findByText('Tela Viagens')).toBeOnTheScreen();
    expect(screen.queryByText('Tela Financeiro')).not.toBeOnTheScreen();
    expect(router.getPathname()).toBe('/viagens');
  });
});
