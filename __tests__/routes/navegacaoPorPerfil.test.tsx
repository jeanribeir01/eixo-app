import type { Session } from '@supabase/supabase-js';
import { router as navegador, type Href } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { StyleSheet, Text } from 'react-native';

import { limparPerfil } from '@/features/auth/profileStore';
import { useSessionStore } from '@/features/auth/sessionStore';
import type { PerfilNome } from '@/features/auth/permissions';
import { colors } from '@/ui';

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
  '(app)/frota/novo': () => <Text>Tela Novo Veiculo</Text>,
  '(app)/frota/[id]/editar': () => <Text>Tela Editar Veiculo</Text>,
  '(app)/caixa/index': () => <Text>Tela Caixa</Text>,
  '(app)/formas-pagamento/index': () => <Text>Tela Formas</Text>,
  '(app)/formas-pagamento/nova': () => <Text>Tela Nova Forma</Text>,
  '(app)/formas-pagamento/[id]/editar': () => <Text>Tela Editar Forma</Text>,
  '(app)/movimentacoes/index': () => <Text>Tela Movimentacoes</Text>,
  '(app)/movimentacoes/nova': () => <Text>Tela Nova Movimentacao</Text>,
  '(app)/movimentacoes/[id]/editar': () => <Text>Tela Editar Movimentacao</Text>,
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

const rotaDaAba: Record<string, Href> = {
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

  it.each(['Financeiro', 'Motorista'] as const)('%s digitando /frota/novo volta para a home do perfil', async (perfil) => {
    const { telaInicial, rotaInicial } = cenarios.find((c) => c.perfil === perfil)!;
    const router = await entrarComo(perfil);
    await screen.findByText(telaInicial);

    act(() => navegador.push('/frota/novo'));

    expect(await screen.findByText(telaInicial)).toBeOnTheScreen();
    expect(screen.queryByText('Tela Novo Veiculo')).not.toBeOnTheScreen();
    expect(router.getPathname()).toBe(rotaInicial);
  });

  it('Gestor de Frota abre /frota/novo', async () => {
    await entrarComo('Gestor de Frota');

    act(() => navegador.push('/frota/novo'));

    expect(await screen.findByText('Tela Novo Veiculo')).toBeOnTheScreen();
  });

  // Saldo e projeção (EIX-51): só Financeiro e Admin. O RLS de `movimentacao` é quem garante.
  it.each(['Gestor de Frota', 'Motorista'] as const)('%s digitando /caixa volta para a home do perfil', async (perfil) => {
    const { telaInicial, rotaInicial } = cenarios.find((c) => c.perfil === perfil)!;
    const router = await entrarComo(perfil);
    await screen.findByText(telaInicial);

    act(() => navegador.push('/caixa'));

    expect(await screen.findByText(telaInicial)).toBeOnTheScreen();
    expect(screen.queryByText('Tela Caixa')).not.toBeOnTheScreen();
    expect(router.getPathname()).toBe(rotaInicial);
  });

  it.each(['Admin', 'Financeiro'] as const)('%s abre /caixa', async (perfil) => {
    await entrarComo(perfil);

    act(() => navegador.push('/caixa'));

    expect(await screen.findByText('Tela Caixa')).toBeOnTheScreen();
  });

  it('Motorista que abre o app já numa URL financeira cai em Viagens', async () => {
    const router = await entrarComo('Motorista', '/financeiro');

    expect(await screen.findByText('Tela Viagens')).toBeOnTheScreen();
    expect(screen.queryByText('Tela Financeiro')).not.toBeOnTheScreen();
    expect(router.getPathname()).toBe('/viagens');
  });
});

// Ícone Material Symbols de cada aba, direto do critério de aceite NAV-01.
const simboloDaAba: Record<string, string> = {
  Dashboards: 'dashboard',
  Financeiro: 'account_balance_wallet',
  Frota: 'local_shipping',
  Viagens: 'route',
  Configurações: 'settings',
};

// O ícone é decorativo (o rótulo da aba já diz o que é), por isso as buscas incluem elementos escondidos
// do leitor de tela.
function simbolos(nome: string) {
  return screen.getAllByTestId(`simbolo-${nome}`, { includeHiddenElements: true });
}

// A tab bar desenha duas cópias de cada ícone (ativa e inativa) e alterna pela opacidade. Só vale a
// cópia que o usuário vê: opacidade efetiva, somando os ancestrais, maior que zero.
type NoDaArvore = ReturnType<typeof simbolos>[number];
function opacidadeEfetiva(no: NoDaArvore | null): number {
  let opacidade = 1;
  for (let atual = no; atual; atual = atual.parent) {
    const estilo = StyleSheet.flatten(atual.props.style) as { opacity?: number } | undefined;
    if (typeof estilo?.opacity === 'number') opacidade *= estilo.opacity;
  }
  return opacidade;
}

describe('tab bar com ícones (NAV-01)', () => {
  it('Admin vê um ícone em cada uma das 5 abas', async () => {
    await entrarComo('Admin');

    for (const simbolo of Object.values(simboloDaAba)) {
      expect(simbolos(simbolo).length).toBeGreaterThan(0);
    }
  });

  it('Motorista só vê os ícones das abas dele', async () => {
    await entrarComo('Motorista');

    expect(simbolos('route').length).toBeGreaterThan(0);
    expect(simbolos('settings').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('simbolo-account_balance_wallet', { includeHiddenElements: true })).toHaveLength(0);
  });

  it('aba ativa em textPrimary; as outras em textBody', async () => {
    await entrarComo('Admin');
    act(() => navegador.push('/financeiro'));
    await screen.findByText('Tela Financeiro');

    for (const [aba, simbolo] of Object.entries(simboloDaAba)) {
      const visiveis = simbolos(simbolo).filter((icone) => opacidadeEfetiva(icone) > 0);
      expect(visiveis).toHaveLength(1);
      expect(visiveis[0]).toHaveStyle({ color: aba === 'Financeiro' ? colors.textPrimary : colors.textBody });
    }
  });
});

// O header do Stack nativo é configurado pelo react-native-screens: no Jest ele aparece como o elemento
// RNSScreenStackHeaderConfig, com o título e as flags nas props (a seta em si é desenhada pelo sistema).
function headersVisiveis() {
  return screen.root
    .findAll((no) => (no.type as unknown) === 'RNSScreenStackHeaderConfig')
    .filter((header) => header.props.hidden === false);
}

describe('header nativo nas telas internas (NAV-02)', () => {
  it.each([
    ['/caixa', 'Tela Caixa', 'Saldo e projeção'],
    ['/categorias', 'Tela Categorias', 'Categorias'],
    ['/categorias/nova', 'Tela Nova Categoria', 'Nova categoria'],
    ['/categorias/c1/editar', 'Tela Editar Categoria', 'Editar categoria'],
    ['/formas-pagamento', 'Tela Formas', 'Formas de pagamento'],
    ['/formas-pagamento/nova', 'Tela Nova Forma', 'Nova forma de pagamento'],
    ['/formas-pagamento/f1/editar', 'Tela Editar Forma', 'Editar forma de pagamento'],
    ['/movimentacoes', 'Tela Movimentacoes', 'Movimentações'],
    ['/movimentacoes/nova', 'Tela Nova Movimentacao', 'Nova movimentação'],
    ['/movimentacoes/m1/editar', 'Tela Editar Movimentacao', 'Editar movimentação'],
    ['/frota/novo', 'Tela Novo Veiculo', 'Novo veículo'],
    ['/frota/v1/editar', 'Tela Editar Veiculo', 'Editar veículo'],
    ['/usuarios', 'Tela Usuarios', 'Usuários'],
    ['/usuarios/u1', 'Tela Usuario', 'Usuário'],
  ] as const)('%s mostra o header "%s" com o botão voltar', async (rota, tela, titulo) => {
    await entrarComo('Admin');

    act(() => navegador.push(rota as Href));
    await screen.findByText(tela);

    const header = headersVisiveis().find((h) => h.props.title === titulo);
    expect(header).toBeDefined();
    expect(header?.props.hideBackButton).toBe(false);
  });

  it('as abas não têm header nativo: o título delas fica no conteúdo', async () => {
    await entrarComo('Admin');
    act(() => navegador.push('/financeiro'));
    await screen.findByText('Tela Financeiro');

    expect(headersVisiveis()).toHaveLength(0);
  });

  it('voltar de uma tela interna retorna para a aba de onde ela foi aberta', async () => {
    const router = await entrarComo('Admin');
    act(() => navegador.push('/financeiro'));
    await screen.findByText('Tela Financeiro');
    act(() => navegador.push('/categorias'));
    await screen.findByText('Tela Categorias');

    act(() => navegador.back());

    expect(await screen.findByText('Tela Financeiro')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/financeiro');
  });
});
