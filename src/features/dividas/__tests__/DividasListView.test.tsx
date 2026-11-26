import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { porTipo } from '@/testing/componentes';
import { FAB_ALTURA_RESERVADA, spacing } from '@/ui';

import { DividasListView } from '../components/DividasListView';
import { listarDividas } from '../dividasRepository';
import type { Divida } from '../types';

// Largura da janela controlada pelo teste: 412 é celular, 800 é tablet (EIX-94).
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 900, scale: 1, fontScale: 1 })),
}));

function mockLargura(width: number) {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

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
    saldoPendenteCentavos: 6900000,
    proximaParcela: { numero: 3, dataVencimento: '2026-03-15', valorCentavos: 150000 },
    ativa: true,
    ...sobrescrever,
  };
}

beforeEach(() => {
  mockPush.mockReset();
  mockListar.mockReset();
});

describe('DividasListView (EIX-50)', () => {
  it('carregando: indicador enquanto a lista não chega', async () => {
    mockListar.mockReturnValue(new Promise(() => {}));
    await render(<DividasListView />);

    expect(screen.getByLabelText('Carregando dívidas')).toBeOnTheScreen();
  });

  it('mostra descrição, saldo pendente, parcelas pagas e a próxima parcela de cada dívida', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [divida()] });
    await render(<DividasListView />);

    expect(await screen.findByText('Ativas · 1')).toBeOnTheScreen();
    // A descrição aparece na linha e no próximo vencimento do cartão.
    expect(screen.getAllByText('Financiamento do caminhão')).toHaveLength(2);
    // O saldo aparece no cartão de resumo e na linha da dívida.
    expect(screen.getAllByText('R$ 69.000,00')).toHaveLength(2);
    expect(screen.getByText('2 de 48 pagas · venceu 15/03')).toBeOnTheScreen();
  });

  it('título no header nativo: a tela não repete "Dívidas" nem "Eixo Certo" (NAV-02)', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [divida()] });
    await render(<DividasListView />);
    await screen.findByText('Ativas · 1');

    expect(screen.queryByText('Dívidas')).not.toBeOnTheScreen();
    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
    expect(porTipo(SafeAreaView).props.edges).not.toContain('top');
  });

  it('tocar na dívida abre o detalhe dela', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [divida()] });
    await render(<DividasListView />);

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Financiamento do caminhão, falta pagar R$ 69.000,00, 2 de 48 parcelas pagas' }),
    );

    expect(mockPush).toHaveBeenCalledWith('/dividas/div-1');
  });

  it('o FAB "Nova dívida" abre o cadastro', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [divida()] });
    await render(<DividasListView />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Nova dívida' }));

    expect(mockPush).toHaveBeenCalledWith('/dividas/nova');
  });

  it('a lista reserva o espaço do FAB no fim, para ele não cobrir a última dívida', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [divida()] });
    await render(<DividasListView />);
    await screen.findByText('Ativas · 1');

    expect(StyleSheet.flatten(porTipo(FlatList).props.contentContainerStyle)).toMatchObject({
      paddingBottom: FAB_ALTURA_RESERVADA,
    });
  });

  it('vazio: explica o que fazer, e o FAB continua na tela', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [] });
    await render(<DividasListView />);

    expect(await screen.findByText('Nenhuma dívida cadastrada')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Nova dívida' })).toBeOnTheScreen();
  });

  it('erro: mostra a mensagem e "Tentar novamente" carrega de novo', async () => {
    mockListar
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as dívidas. Tente novamente.' })
      .mockResolvedValueOnce({ ok: true, data: [divida()] });
    await render(<DividasListView />);

    expect(await screen.findByText('Não foi possível carregar as dívidas. Tente novamente.')).toBeOnTheScreen();
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' })));

    expect(mockListar).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Ativas · 1')).toBeOnTheScreen();
  });
});

describe('DividasListView — tablet (EIX-94)', () => {
  afterEach(() => mockLargura(412));

  function estiloDoConteudo() {
    return StyleSheet.flatten(screen.getByTestId('screen-conteudo').props.style);
  }

  function estiloDaLista() {
    return StyleSheet.flatten(porTipo(FlatList).props.contentContainerStyle);
  }

  it('412: nada muda, o respiro lateral continua no Screen e a lista não ganha coluna', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [divida()] });
    await render(<DividasListView />);
    await screen.findByText('Ativas · 1');

    expect(estiloDoConteudo()).toMatchObject({ paddingHorizontal: spacing.base });
    expect(estiloDaLista()?.maxWidth).toBeUndefined();
  });

  it('800: a lista rola na largura toda e o conteúdo fica na coluna de 720', async () => {
    mockLargura(800);
    mockListar.mockResolvedValue({ ok: true, data: [divida()] });
    await render(<DividasListView />);
    await screen.findByText('Ativas · 1');

    expect(estiloDoConteudo().maxWidth).toBeUndefined();
    expect(estiloDoConteudo().paddingHorizontal).toBeUndefined();
    expect(estiloDaLista()).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
    expect(screen.queryByTestId('screen-coluna')).toBeNull();
  });

describe('DividasListView: resumo no topo', () => {
  it('soma o saldo das dívidas ativas e mostra o próximo vencimento entre todas', async () => {
    mockListar.mockResolvedValue({
      ok: true,
      data: [
        divida({ proximaParcela: { numero: 3, dataVencimento: '2099-03-15', valorCentavos: 150000 } }),
        divida({
          id: 'div-2',
          descricao: 'Seguro da frota',
          quantidadeParcelas: 12,
          parcelasPagas: 0,
          saldoPendenteCentavos: 960000,
          proximaParcela: { numero: 1, dataVencimento: '2099-01-10', valorCentavos: 80000 },
        }),
      ],
    });
    await render(<DividasListView />);

    expect(await screen.findByText('Saldo pendente')).toBeOnTheScreen();
    expect(screen.getByText('R$ 78.600,00')).toBeOnTheScreen();
    expect(screen.getByText('58 parcelas em aberto em 2 dívidas')).toBeOnTheScreen();
    expect(screen.getByText('Próximo vencimento')).toBeOnTheScreen();
    expect(screen.getAllByText('Seguro da frota').length).toBeGreaterThan(0);
    expect(screen.getByText('Vence 10/01 · R$ 800,00')).toBeOnTheScreen();
    expect(screen.queryByText('Em atraso')).not.toBeOnTheScreen();
    expect(screen.getByText('Ativas · 2')).toBeOnTheScreen();
  });

  it('parcela vencida e não paga aparece como "Em atraso"', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [divida()] });
    await render(<DividasListView />);

    expect(await screen.findByText('Em atraso')).toBeOnTheScreen();
    expect(screen.getByText('Venceu 15/03 · R$ 1.500,00')).toBeOnTheScreen();
  });

  it('dívida quitada mostra o selo no lugar do valor e fica fora do próximo vencimento', async () => {
    mockListar.mockResolvedValue({
      ok: true,
      data: [divida({ parcelasPagas: 48, saldoPendenteCentavos: 0, proximaParcela: null })],
    });
    await render(<DividasListView />);

    expect(await screen.findByText('Quitada')).toBeOnTheScreen();
    expect(screen.getByText('Quitada · 48 de 48 pagas')).toBeOnTheScreen();
    expect(screen.queryByText('Próximo vencimento')).not.toBeOnTheScreen();
  });
});
});
