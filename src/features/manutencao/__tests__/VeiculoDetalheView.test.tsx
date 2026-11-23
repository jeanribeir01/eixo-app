import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { segurarPrimeiraCarga } from '@/testing/eventos';
import { porTipo, todosPorTipo } from '@/testing/componentes';
import { ListItem, spacing } from '@/ui';

import { VeiculoDetalheView } from '../VeiculoDetalheView';
import { buscarVeiculoComHistorico } from '../manutencaoRepository';
import type { VeiculoComHistorico } from '../types';

// Largura da janela controlada pelo teste: 412 é celular, 800 é tablet (EIX-94).
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 900, scale: 1, fontScale: 1 })),
}));

function mockLargura(width: number) {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

// O runner do GitHub Actions é mais lento que a máquina local: o padrão de 5s estourava no CI.
jest.setTimeout(15000);

const mockBack = jest.fn();

// Jest hoista jest.mock() acima dos imports: a fábrica só pode usar variáveis com prefixo "mock".
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: jest.fn(), back: mockBack }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]),
  };
});

jest.mock('../manutencaoRepository', () => ({
  buscarVeiculoComHistorico: jest.fn(),
}));

const mockBuscar = buscarVeiculoComHistorico as jest.MockedFunction<typeof buscarVeiculoComHistorico>;

// O repositório já entrega o histórico da data mais recente para a mais antiga (T5).
const volvo: VeiculoComHistorico = {
  id: 'v1',
  placa: 'ABC1234',
  marca: 'Volvo',
  modelo: 'FH 540',
  status: 'EmManutencao',
  manutencoes: [
    {
      id: 'm2',
      veiculo_id: 'v1',
      descricao: 'Troca de pneus',
      data_manutencao: '2026-10-16',
      data_conclusao: null,
      valorCentavos: 113,
    },
    {
      id: 'm1',
      veiculo_id: 'v1',
      descricao: 'Revisão dos freios',
      data_manutencao: '2026-09-01',
      data_conclusao: '2026-09-02T10:00:00Z',
      valorCentavos: 250000,
    },
  ],
};

beforeEach(() => {
  mockBack.mockReset();
  mockBuscar.mockReset();
});

describe('VeiculoDetalheView', () => {
  // MAN-34, MAN-37
  it('carrega o veículo do id e mostra placa, "Marca Modelo", status e a seção do histórico', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: volvo });
    // Segura a primeira carga: o render async esperaria a resposta e pularia o "carregando".
    const liberarCarga = segurarPrimeiraCarga(mockBuscar);
    await render(<VeiculoDetalheView veiculoId="v1" />);

    expect(screen.getByLabelText('Carregando veículo')).toBeOnTheScreen();
    await liberarCarga();
    expect(await screen.findByText('ABC-1234')).toBeOnTheScreen();
    expect(mockBuscar).toHaveBeenCalledWith('v1');
    expect(screen.getByText('Volvo FH 540')).toBeOnTheScreen();
    expect(screen.getByText('Em Manutenção')).toBeOnTheScreen();
    expect(screen.getByText('Histórico de manutenções')).toBeOnTheScreen();
    // Tela interna: o header nativo protege o topo.
    expect(porTipo(SafeAreaView).props.edges).not.toContain('top');
  });

  // MAN-35
  it('lista o histórico na ordem recebida, com data, descrição, valor e situação', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: volvo });
    await render(<VeiculoDetalheView veiculoId="v1" />);
    await screen.findByText('ABC-1234');

    const linhas = todosPorTipo(ListItem);
    expect(linhas.map((linha) => linha.props.title)).toEqual(['Troca de pneus', 'Revisão dos freios']);
    expect(linhas.map((linha) => linha.props.subtitle)).toEqual(['16/10/2026 · Em aberto', '01/09/2026 · Concluída']);
    expect(screen.getByText('R$ 1,13')).toBeOnTheScreen();
    expect(screen.getByText('R$ 2.500,00')).toBeOnTheScreen();
  });

  // MAN-36
  it('veículo sem manutenção mostra o aviso de histórico vazio', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: { ...volvo, status: 'Disponivel', manutencoes: [] } });
    await render(<VeiculoDetalheView veiculoId="v1" />);

    expect(await screen.findByText('Nenhuma manutenção registrada para este veículo.')).toBeOnTheScreen();
    expect(screen.getByText('Disponível')).toBeOnTheScreen();
  });

  // MAN-38
  it('veículo inexistente mostra "Veículo não encontrado." e "Voltar" navega para trás', async () => {
    mockBuscar.mockResolvedValue({ ok: false, mensagem: 'Veículo não encontrado.' });
    await render(<VeiculoDetalheView veiculoId="x" />);

    expect(await screen.findByText('Veículo não encontrado.')).toBeOnTheScreen();
    expect(porTipo(SafeAreaView).props.edges).not.toContain('top');
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  // Falha de rede se resolve tentando de novo, sem precisar voltar à lista.
  it('falha na carga mostra a mensagem e "Tentar novamente" carrega de novo', async () => {
    mockBuscar
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar o veículo. Tente novamente.' })
      .mockResolvedValueOnce({ ok: true, data: volvo });
    await render(<VeiculoDetalheView veiculoId="v1" />);

    expect(await screen.findByText('Não foi possível carregar o veículo. Tente novamente.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('ABC-1234')).toBeOnTheScreen();
    expect(mockBuscar).toHaveBeenCalledTimes(2);
  });

  it('pull-to-refresh recarrega o histórico', async () => {
    mockBuscar
      .mockResolvedValueOnce({ ok: true, data: { ...volvo, manutencoes: [] } })
      .mockResolvedValueOnce({ ok: true, data: volvo });
    await render(<VeiculoDetalheView veiculoId="v1" />);
    expect(await screen.findByText('Nenhuma manutenção registrada para este veículo.')).toBeOnTheScreen();

    await act(async () => porTipo(RefreshControl).props.onRefresh!());

    expect(screen.getByText('Troca de pneus')).toBeOnTheScreen();
    expect(mockBuscar).toHaveBeenCalledTimes(2);
  });

  it('recarga que falha com o histórico na tela mostra o Snackbar e mantém os dados', async () => {
    mockBuscar
      .mockResolvedValueOnce({ ok: true, data: volvo })
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar o veículo. Tente novamente.' });
    await render(<VeiculoDetalheView veiculoId="v1" />);
    await screen.findByText('ABC-1234');

    await act(async () => porTipo(RefreshControl).props.onRefresh!());

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o veículo. Tente novamente.');
    expect(screen.getByText('Troca de pneus')).toBeOnTheScreen();
  });
});

describe('VeiculoDetalheView — tablet (EIX-94)', () => {
  afterEach(() => mockLargura(412));

  function estiloDoConteudo() {
    return StyleSheet.flatten(screen.getByTestId('screen-conteudo').props.style);
  }

  function estiloDaLista() {
    return StyleSheet.flatten(porTipo(FlatList).props.contentContainerStyle);
  }

  it('412: nada muda, o respiro lateral continua no Screen e a lista não ganha coluna', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: volvo });
    await render(<VeiculoDetalheView veiculoId="v1" />);
    await screen.findByText('ABC-1234');

    expect(estiloDoConteudo()).toMatchObject({ paddingHorizontal: spacing.base });
    expect(estiloDaLista()?.maxWidth).toBeUndefined();
  });

  it('800: a lista rola na largura toda e o conteúdo fica na coluna de 720', async () => {
    mockLargura(800);
    mockBuscar.mockResolvedValue({ ok: true, data: volvo });
    await render(<VeiculoDetalheView veiculoId="v1" />);
    await screen.findByText('ABC-1234');

    expect(estiloDoConteudo().maxWidth).toBeUndefined();
    expect(estiloDoConteudo().paddingHorizontal).toBeUndefined();
    expect(estiloDaLista()).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
    // O cartão do veículo é o cabeçalho da lista: fica na mesma coluna do histórico.
    expect(screen.getByText('Histórico de manutenções')).toBeOnTheScreen();
  });
});
