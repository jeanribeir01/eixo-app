import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FAB_ALTURA_RESERVADA } from '@/ui';

import { DividasListView } from '../components/DividasListView';
import { listarDividas } from '../dividasRepository';
import type { Divida } from '../types';

jest.setTimeout(15000);

const mockPush = jest.fn();

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]),
  };
});

jest.mock('../dividasRepository', () => ({ listarDividas: jest.fn() }));

const mockListar = listarDividas as jest.MockedFunction<typeof listarDividas>;

function divida(sobrescrever: Partial<Divida> = {}): Divida {
  return {
    id: 'div-1',
    descricao: 'Financiamento do caminhão',
    categoria: { titulo: 'Financiamento' },
    quantidadeParcelas: 48,
    valorParcelaCentavos: 150000,
    somaTotalCentavos: 7200000,
    valorQuitacaoCentavos: null,
    dataVencimentoPrimeira: '2026-01-15',
    parcelasPagas: 2,
    ativa: true,
    ...sobrescrever,
  };
}

beforeEach(() => {
  mockPush.mockReset();
  mockListar.mockReset();
});

describe('DividasListView (EIX-50)', () => {
  it('carregando: indicador enquanto a lista não chega', () => {
    mockListar.mockReturnValue(new Promise(() => {}));
    render(<DividasListView />);

    expect(screen.getByLabelText('Carregando dívidas')).toBeOnTheScreen();
  });

  it('mostra descrição, total e parcelas pagas de cada dívida', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [divida()] });
    render(<DividasListView />);

    expect(await screen.findByText('Financiamento do caminhão')).toBeOnTheScreen();
    expect(screen.getByText('R$ 72.000,00')).toBeOnTheScreen();
    expect(screen.getByText('2 de 48 parcelas pagas')).toBeOnTheScreen();
  });

  it('título no header nativo: a tela não repete "Dívidas" nem "Eixo Certo" (NAV-02)', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [divida()] });
    render(<DividasListView />);
    await screen.findByText('Financiamento do caminhão');

    expect(screen.queryByText('Dívidas')).not.toBeOnTheScreen();
    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
  });

  it('tocar na dívida abre o detalhe dela', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [divida()] });
    render(<DividasListView />);

    fireEvent.press(
      await screen.findByRole('button', { name: 'Financiamento do caminhão, total R$ 72.000,00, 2 de 48 parcelas pagas' }),
    );

    expect(mockPush).toHaveBeenCalledWith('/dividas/div-1');
  });

  it('o FAB "Nova dívida" abre o cadastro', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [divida()] });
    render(<DividasListView />);

    fireEvent.press(await screen.findByRole('button', { name: 'Nova dívida' }));

    expect(mockPush).toHaveBeenCalledWith('/dividas/nova');
  });

  it('a lista reserva o espaço do FAB no fim, para ele não cobrir a última dívida', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [divida()] });
    render(<DividasListView />);
    await screen.findByText('Financiamento do caminhão');

    expect(StyleSheet.flatten(screen.UNSAFE_getByType(FlatList).props.contentContainerStyle)).toMatchObject({
      paddingBottom: FAB_ALTURA_RESERVADA,
    });
  });

  it('vazio: explica o que fazer, e o FAB continua na tela', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [] });
    render(<DividasListView />);

    expect(await screen.findByText('Nenhuma dívida cadastrada')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Nova dívida' })).toBeOnTheScreen();
  });

  it('erro: mostra a mensagem e "Tentar novamente" carrega de novo', async () => {
    mockListar
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as dívidas. Tente novamente.' })
      .mockResolvedValueOnce({ ok: true, data: [divida()] });
    render(<DividasListView />);

    expect(await screen.findByText('Não foi possível carregar as dívidas. Tente novamente.')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' })));

    expect(mockListar).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Financiamento do caminhão')).toBeOnTheScreen();
  });
});
