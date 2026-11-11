import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { ViagemLancamentosView } from '../ViagemLancamentosView';
import {
  buscarViagemVinculavel,
  desvincularLancamento,
  listarLancamentosDaViagem,
  type LancamentoDaViagem,
  type ViagemVinculavel,
} from '../ponteRepository';

// O runner do GitHub Actions é mais lento que a máquina local.
jest.setTimeout(15000);

const mockPush = jest.fn();
const mockBack = jest.fn();

// Jest hoista jest.mock() acima dos imports: a fábrica só pode usar variáveis com prefixo "mock".
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush, back: mockBack }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]),
  };
});

// Só as chamadas ao banco são falsas; rótulo e descrição da viagem são os reais.
jest.mock('@/supabase/client', () => ({ supabase: {} }));
jest.mock('../ponteRepository', () => ({
  ...jest.requireActual('../ponteRepository'),
  buscarViagemVinculavel: jest.fn(),
  listarLancamentosDaViagem: jest.fn(),
  desvincularLancamento: jest.fn(),
}));

const mockBuscarViagem = buscarViagemVinculavel as jest.MockedFunction<typeof buscarViagemVinculavel>;
const mockListar = listarLancamentosDaViagem as jest.MockedFunction<typeof listarLancamentosDaViagem>;
const mockDesvincular = desvincularLancamento as jest.MockedFunction<typeof desvincularLancamento>;

const VIAGEM: ViagemVinculavel = {
  id: 'v-1',
  placa: 'ABC1D23',
  cidade_origem: 'São Paulo',
  uf_origem: 'SP',
  cidade_destino: 'Curitiba',
  uf_destino: 'PR',
  status: 'EmAndamento',
  data_inicio: '2026-11-09T13:00:00+00:00',
  data_fim: null,
};

const FRETE: LancamentoDaViagem = {
  id: 'm-frete',
  descricao: 'Frete SP–Curitiba',
  valorCentavos: 850000,
  litros: null,
  categoria: { titulo: 'Frete', tipo: 'Entrada' },
};
const DIESEL: LancamentoDaViagem = {
  id: 'm-diesel',
  descricao: 'Diesel Registro',
  valorCentavos: 245050,
  litros: 412.5,
  categoria: { titulo: 'Combustível', tipo: 'Saida' },
};
const PEDAGIO: LancamentoDaViagem = {
  id: 'm-pedagio',
  descricao: 'Pedágio Régis',
  valorCentavos: 4320,
  litros: null,
  categoria: { titulo: 'Pedágio', tipo: 'Saida' },
};

async function renderDetalhe() {
  render(<ViagemLancamentosView viagemId="v-1" />);
  await screen.findByText('ABC1D23');
}

beforeEach(() => {
  mockPush.mockReset();
  mockBack.mockReset();
  mockBuscarViagem.mockReset();
  mockBuscarViagem.mockResolvedValue({ ok: true, data: VIAGEM });
  mockListar.mockReset();
  mockListar.mockResolvedValue({ ok: true, data: [FRETE, DIESEL, PEDAGIO] });
  mockDesvincular.mockReset();
});

describe('ViagemLancamentosView', () => {
  // DETALHE-02
  it('mostra placa, rota, status e data de início da viagem', async () => {
    await renderDetalhe();

    expect(mockBuscarViagem).toHaveBeenCalledWith('v-1');
    expect(screen.getByText('São Paulo/SP → Curitiba/PR')).toBeOnTheScreen();
    expect(screen.getByText('Em andamento · início 09/11/2026')).toBeOnTheScreen();
  });

  // DETALHE-03
  it('separa os lançamentos em Entradas e Saídas, com sinal no valor', async () => {
    await renderDetalhe();

    expect(mockListar).toHaveBeenCalledWith('v-1');
    expect(screen.getByText('Entradas')).toBeOnTheScreen();
    expect(screen.getByText('Saídas')).toBeOnTheScreen();

    // Os blocos do ListSection na ordem da tela: Entradas primeiro, Saídas depois. O frete vem
    // no primeiro; diesel e pedágio, no segundo.
    const [blocoEntradas, blocoSaidas] = screen.getAllByTestId('bloco-secao');
    const secaoEntradas = within(blocoEntradas!);
    expect(secaoEntradas.getByText('Frete SP–Curitiba')).toBeOnTheScreen();
    expect(secaoEntradas.queryByText('Diesel Registro')).not.toBeOnTheScreen();
    const secaoSaidas = within(blocoSaidas!);
    expect(secaoSaidas.getByText('Diesel Registro')).toBeOnTheScreen();
    expect(secaoSaidas.getByText('Pedágio Régis')).toBeOnTheScreen();
    expect(secaoSaidas.queryByText('Frete SP–Curitiba')).not.toBeOnTheScreen();

    expect(screen.getByText('+ R$ 8.500,00')).toBeOnTheScreen();
    expect(screen.getByText('− R$ 2.450,50')).toBeOnTheScreen();
    expect(screen.getByText('Combustível · 412,5 L')).toBeOnTheScreen();
    expect(screen.getByText('Pedágio')).toBeOnTheScreen();
  });

  // DETALHE-04
  it('Desvincular tira a linha e mostra "Lançamento desvinculado."', async () => {
    mockDesvincular.mockResolvedValue({ ok: true, data: 'm-pedagio' });
    await renderDetalhe();

    const botoes = screen.getAllByRole('button', { name: 'Desvincular' });
    // Ordem na tela: Frete (Entradas), Diesel e Pedágio (Saídas).
    await act(async () => fireEvent.press(botoes[2]!));

    expect(mockDesvincular).toHaveBeenCalledWith('m-pedagio');
    expect(screen.queryByText('Pedágio Régis')).not.toBeOnTheScreen();
    expect(screen.getByText('Diesel Registro')).toBeOnTheScreen();
    expect(screen.getByText('Lançamento desvinculado.')).toBeOnTheScreen();
  });

  // DETALHE-05
  it('falha no desvínculo mantém a linha e mostra a mensagem de erro', async () => {
    mockDesvincular.mockResolvedValue({ ok: false, mensagem: 'Não foi possível desvincular. Tente novamente.' });
    await renderDetalhe();

    await act(async () => fireEvent.press(screen.getAllByRole('button', { name: 'Desvincular' })[0]!));

    expect(screen.getByText('Frete SP–Curitiba')).toBeOnTheScreen();
    expect(screen.getByText('Não foi possível desvincular. Tente novamente.')).toBeOnTheScreen();
  });

  // DETALHE-06
  it('sem lançamentos mostra o vazio, e "Nova movimentação" abre o formulário com a viagem', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [] });
    await renderDetalhe();

    expect(screen.getByText('Nenhum lançamento vinculado')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Nova movimentação' }));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/movimentacoes/nova', params: { viagemId: 'v-1' } });
  });

  // DETALHE-07
  it('mostra o carregando enquanto busca', () => {
    mockBuscarViagem.mockReturnValue(new Promise(() => undefined));

    render(<ViagemLancamentosView viagemId="v-1" />);

    expect(screen.getByLabelText('Carregando viagem')).toBeOnTheScreen();
  });

  // DETALHE-07
  it('erro na carga mostra a mensagem e "Tentar novamente" busca de novo', async () => {
    mockListar.mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar os lançamentos. Tente novamente.' });
    render(<ViagemLancamentosView viagemId="v-1" />);

    expect(await screen.findByText('Não foi possível carregar os lançamentos. Tente novamente.')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' })));

    expect(await screen.findByText('ABC1D23')).toBeOnTheScreen();
    expect(mockListar).toHaveBeenCalledTimes(2);
  });

  // DETALHE-08
  it('tocar numa linha abre a edição do lançamento', async () => {
    await renderDetalhe();

    fireEvent.press(screen.getByRole('button', { name: 'Editar Diesel Registro' }));

    expect(mockPush).toHaveBeenCalledWith('/movimentacoes/m-diesel/editar');
  });
});
