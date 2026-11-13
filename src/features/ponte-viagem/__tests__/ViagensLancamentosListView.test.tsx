import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ViagensLancamentosListView } from '../ViagensLancamentosListView';
import { listarViagensVinculaveis, type ViagemVinculavel } from '../ponteRepository';

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
    render(<ViagensLancamentosListView />);

    expect(await screen.findByText('ABC1D23 · São Paulo/SP → Curitiba/PR')).toBeOnTheScreen();
    expect(screen.getByText('XYZ9K88 · Campinas/SP → Belo Horizonte/MG')).toBeOnTheScreen();
    expect(screen.getByText('Concluída · início 02/11/2026')).toBeOnTheScreen();
  });

  // DETALHE-01
  it('tocar numa viagem abre o detalhe dela', async () => {
    render(<ViagensLancamentosListView />);

    fireEvent.press(await screen.findByRole('button', { name: 'XYZ9K88 · Campinas/SP → Belo Horizonte/MG' }));

    expect(mockPush).toHaveBeenCalledWith('/viagens/v-2');
  });

  it('mostra o carregando enquanto busca', () => {
    mockListar.mockReturnValue(new Promise(() => undefined));

    render(<ViagensLancamentosListView />);

    expect(screen.getByLabelText('Carregando viagens')).toBeOnTheScreen();
  });

  it('sem viagens mostra o estado vazio', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [] });

    render(<ViagensLancamentosListView />);

    expect(await screen.findByText('Nenhuma viagem por aqui')).toBeOnTheScreen();
  });

  it('erro mostra a mensagem e "Tentar novamente" busca de novo', async () => {
    mockListar.mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as viagens. Tente novamente.' });
    render(<ViagensLancamentosListView />);

    expect(await screen.findByText('Não foi possível carregar as viagens. Tente novamente.')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' })));

    expect(await screen.findByText('ABC1D23 · São Paulo/SP → Curitiba/PR')).toBeOnTheScreen();
  });
});
