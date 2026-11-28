import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList, StyleSheet, useWindowDimensions } from 'react-native';

import { porTipo } from '@/testing/componentes';
import { spacing } from '@/ui';

import { ViagensLancamentosListView } from '../ViagensLancamentosListView';
import { listarViagensVinculaveis, type ViagemVinculavel } from '../ponteRepository';

// Largura da janela controlada pelo teste: 412 é celular, 800 é tablet (EIX-94).
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 900, scale: 1, fontScale: 1 })),
}));

function mockLargura(width: number) {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

// O runner do GitHub Actions é mais lento que a máquina local.
jest.setTimeout(15000);

const mockPush = jest.fn();

// Jest hoista jest.mock() acima dos imports: a fábrica só pode usar variáveis com prefixo "mock".
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush, back: jest.fn() }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]),
  };
});

jest.mock('@/supabase/client', () => ({ supabase: {} }));
jest.mock('../ponteRepository', () => ({
  ...jest.requireActual('../ponteRepository'),
  listarViagensVinculaveis: jest.fn(),
}));

const mockListar = listarViagensVinculaveis as jest.MockedFunction<typeof listarViagensVinculaveis>;

const VIAGENS: ViagemVinculavel[] = [
  {
    id: 'v-1',
    placa: 'ABC1D23',
    cidade_origem: 'São Paulo',
    uf_origem: 'SP',
    cidade_destino: 'Curitiba',
    uf_destino: 'PR',
    status: 'EmAndamento',
    data_inicio: '2026-11-09T13:00:00+00:00',
    data_fim: null,
  },
  {
    id: 'v-2',
    placa: 'XYZ9K88',
    cidade_origem: 'Campinas',
    uf_origem: 'SP',
    cidade_destino: 'Belo Horizonte',
    uf_destino: 'MG',
    status: 'Finalizada',
    data_inicio: '2026-11-02T13:00:00+00:00',
    data_fim: '2026-11-03T18:00:00+00:00',
  },
];

beforeEach(() => {
  mockPush.mockReset();
  mockListar.mockReset();
  mockListar.mockResolvedValue({ ok: true, data: VIAGENS });
});

describe('ViagensLancamentosListView', () => {
  // DETALHE-01
  it('lista as viagens vinculáveis com placa, rota, status e início', async () => {
    await render(<ViagensLancamentosListView />);

    expect(await screen.findByText('ABC1D23 · São Paulo → Curitiba')).toBeOnTheScreen();
    expect(screen.getByText('XYZ9K88 · Campinas → Belo Horizonte')).toBeOnTheScreen();
    expect(screen.getByText('Concluída · início 02/11/2026')).toBeOnTheScreen();
  });

  // DETALHE-01
  it('tocar numa viagem abre o detalhe dela', async () => {
    await render(<ViagensLancamentosListView />);

    await fireEvent.press(await screen.findByRole('button', { name: 'XYZ9K88 · Campinas → Belo Horizonte' }));

    expect(mockPush).toHaveBeenCalledWith('/viagens/v-2/lancamentos');
  });

  it('mostra o carregando enquanto busca', async () => {
    mockListar.mockReturnValue(new Promise(() => undefined));

    await render(<ViagensLancamentosListView />);

    expect(screen.getByLabelText('Carregando viagens')).toBeOnTheScreen();
  });

  it('sem viagens mostra o estado vazio', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [] });

    await render(<ViagensLancamentosListView />);

    expect(await screen.findByText('Nenhuma viagem por aqui')).toBeOnTheScreen();
  });

  it('erro mostra a mensagem e "Tentar novamente" busca de novo', async () => {
    mockListar.mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as viagens. Tente novamente.' });
    await render(<ViagensLancamentosListView />);

    expect(await screen.findByText('Não foi possível carregar as viagens. Tente novamente.')).toBeOnTheScreen();
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' })));

    expect(await screen.findByText('ABC1D23 · São Paulo → Curitiba')).toBeOnTheScreen();
  });
});

describe('ViagensLancamentosListView — tablet (EIX-94)', () => {
  afterEach(() => mockLargura(412));

  function estiloDoConteudo() {
    return StyleSheet.flatten(screen.getByTestId('screen-conteudo').props.style);
  }

  function estiloDaLista() {
    return StyleSheet.flatten(porTipo(FlatList).props.contentContainerStyle);
  }

  it('412: nada muda, o respiro lateral continua no Screen e a lista não ganha coluna', async () => {
    await render(<ViagensLancamentosListView />);
    await screen.findByText('ABC1D23 · São Paulo → Curitiba');

    expect(estiloDoConteudo()).toMatchObject({ paddingHorizontal: spacing.base });
    expect(estiloDaLista()?.maxWidth).toBeUndefined();
  });

  it('800: a lista rola na largura toda e o conteúdo fica na coluna de 720', async () => {
    mockLargura(800);
    await render(<ViagensLancamentosListView />);
    await screen.findByText('ABC1D23 · São Paulo → Curitiba');

    expect(estiloDoConteudo().maxWidth).toBeUndefined();
    expect(estiloDoConteudo().paddingHorizontal).toBeUndefined();
    expect(estiloDaLista()).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
  });
});
