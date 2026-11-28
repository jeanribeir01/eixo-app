import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Animated, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { porTipo } from '@/testing/componentes';
import { spacing } from '@/ui';

import { DividaDetalheView } from '../components/DividaDetalheView';
import { buscarDivida, excluirDivida } from '../dividasRepository';
import type { DividaDetalhe, Parcela } from '../types';

// Largura da janela controlada pelo teste: 412 é celular, 800 é tablet (EIX-94).
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 900, scale: 1, fontScale: 1 })),
}));

function mockLargura(width: number) {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

jest.setTimeout(15000);

jest.mock('../dividasRepository', () => ({ buscarDivida: jest.fn(), excluirDivida: jest.fn() }));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));

const mockBuscar = buscarDivida as jest.MockedFunction<typeof buscarDivida>;
const mockExcluir = excluirDivida as jest.MockedFunction<typeof excluirDivida>;

const detalhe: DividaDetalhe = {
  id: 'div-1',
  descricao: 'Financiamento do caminhão',
  categoria: { titulo: 'Financiamento' },
  quantidadeParcelas: 3,
  valorParcelaCentavos: 150000,
  somaTotalCentavos: 450000,
  valorQuitacaoCentavos: null,
  dataVencimentoPrimeira: '2026-01-15',
  parcelasPagas: 1,
  saldoPendenteCentavos: 300000,
  proximaParcela: { numero: 2, dataVencimento: '2026-02-15', valorCentavos: 150000 },
  ativa: true,
  // O repositório já devolve as parcelas ordenadas e numeradas.
  parcelas: [
    { id: 'p1', numero: 1, dataVencimento: '2026-01-15', valorCentavos: 150000, status: 'Pago', dataPagamento: '2026-01-14' },
    { id: 'p2', numero: 2, dataVencimento: '2026-02-15', valorCentavos: 150000, status: 'Pendente', dataPagamento: null },
    { id: 'p3', numero: 3, dataVencimento: '2026-03-15', valorCentavos: 150000, status: 'Pendente', dataPagamento: null },
  ],
};

beforeEach(() => {
  mockBuscar.mockReset();
  mockExcluir.mockReset();
  mockBack.mockReset();
});

describe('DividaDetalheView (EIX-50)', () => {
  it('busca a dívida pelo id da rota', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: detalhe });
    await render(<DividaDetalheView id="div-1" />);

    await screen.findByText('Financiamento do caminhão');
    expect(mockBuscar).toHaveBeenCalledWith('div-1');
  });

  it('carregando: indicador sob o header', async () => {
    mockBuscar.mockReturnValue(new Promise(() => {}));
    await render(<DividaDetalheView id="div-1" />);

    expect(screen.getByLabelText('Carregando dívida')).toBeOnTheScreen();
    expect(porTipo(SafeAreaView).props.edges).not.toContain('top');
  });

  it('resumo: categoria, descrição, soma total, parcelas pagas e valor da parcela', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: detalhe });
    await render(<DividaDetalheView id="div-1" />);

    expect(await screen.findByText('Financiamento do caminhão')).toBeOnTheScreen();
    expect(screen.getByText('Financiamento')).toBeOnTheScreen();
    expect(screen.getByText('R$ 4.500,00')).toBeOnTheScreen();
    expect(screen.getByText('1 de 3')).toBeOnTheScreen();
    expect(screen.getAllByText('R$ 1.500,00').length).toBeGreaterThan(0);
    expect(screen.queryByText('Quitação antecipada')).not.toBeOnTheScreen();
  });

  it('com quitação antecipada, mostra o valor dela', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: { ...detalhe, valorQuitacaoCentavos: 400000 } });
    await render(<DividaDetalheView id="div-1" />);

    expect(await screen.findByText('Quitação antecipada')).toBeOnTheScreen();
    expect(screen.getByText('R$ 4.000,00')).toBeOnTheScreen();
  });

  it('lista as parcelas geradas com número, vencimento, status e valor (prova do vídeo)', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: detalhe });
    await render(<DividaDetalheView id="div-1" />);

    expect(await screen.findByText('Parcela 1 de 3')).toBeOnTheScreen();
    expect(screen.getByText('Paga em 14/01/2026')).toBeOnTheScreen();
    expect(screen.getByText('Parcela 3 de 3')).toBeOnTheScreen();
    expect(screen.getByText('Venceu em 15/03/2026 · em atraso')).toBeOnTheScreen();
  });

  it('o título "Dívida" fica no header; a tela não o repete', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: detalhe });
    await render(<DividaDetalheView id="div-1" />);
    await screen.findByText('Financiamento do caminhão');

    expect(screen.queryByText('Dívida')).not.toBeOnTheScreen();
    expect(porTipo(SafeAreaView).props.edges).not.toContain('top');
  });

  it('erro: mostra a mensagem e "Tentar novamente" busca de novo', async () => {
    mockBuscar
      .mockResolvedValueOnce({ ok: false, mensagem: 'Dívida não encontrada ou já excluída.' })
      .mockResolvedValueOnce({ ok: true, data: detalhe });
    await render(<DividaDetalheView id="div-1" />);

    expect(await screen.findByText('Dívida não encontrada ou já excluída.')).toBeOnTheScreen();
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' })));

    expect(mockBuscar).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Financiamento do caminhão')).toBeOnTheScreen();
  });
});

describe('DividaDetalheView — tablet (EIX-94)', () => {
  afterEach(() => mockLargura(412));

  function estiloDoConteudo() {
    return StyleSheet.flatten(screen.getByTestId('screen-conteudo').props.style);
  }

  function estiloDaLista() {
    return StyleSheet.flatten(porTipo(FlatList).props.contentContainerStyle);
  }

  it('412: nada muda, o respiro lateral continua no Screen e a lista não ganha coluna', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: detalhe });
    await render(<DividaDetalheView id="div-1" />);
    await screen.findByText('Financiamento do caminhão');

    expect(estiloDoConteudo()).toMatchObject({ paddingHorizontal: spacing.base });
    expect(estiloDaLista()?.maxWidth).toBeUndefined();
  });

  it('800: a lista rola na largura toda e o conteúdo fica na coluna de 720', async () => {
    mockLargura(800);
    mockBuscar.mockResolvedValue({ ok: true, data: detalhe });
    await render(<DividaDetalheView id="div-1" />);
    await screen.findByText('Financiamento do caminhão');

    expect(estiloDoConteudo().maxWidth).toBeUndefined();
    expect(estiloDoConteudo().paddingHorizontal).toBeUndefined();
    expect(estiloDaLista()).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
    // O cartão da dívida é o cabeçalho da lista: fica na mesma coluna das parcelas.
    expect(screen.getByText('Em aberto · 2')).toBeOnTheScreen();
  });

describe('DividaDetalheView: saldo e grupos de parcelas', () => {
  it('mostra o saldo pendente e separa as parcelas em aberto das pagas', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: detalhe });
    await render(<DividaDetalheView id="div-1" />);

    expect(await screen.findByText('Saldo pendente')).toBeOnTheScreen();
    expect(screen.getByText('R$ 3.000,00')).toBeOnTheScreen();
    expect(screen.getByText('2 de 3 parcelas em aberto · R$ 1.500,00 por parcela')).toBeOnTheScreen();
    expect(screen.getByText('Em aberto · 2')).toBeOnTheScreen();
    expect(screen.getByText('Pagas · 1')).toBeOnTheScreen();
    expect(screen.getByText('Parcela 2 de 3 · próxima')).toBeOnTheScreen();
  });

  it('parcela que ainda vai vencer diz "Vence em", com o ícone de relógio', async () => {
    const futura: Parcela = { id: 'p9', numero: 1, dataVencimento: '2099-05-10', valorCentavos: 150000, status: 'Pendente', dataPagamento: null };
    mockBuscar.mockResolvedValue({ ok: true, data: { ...detalhe, quantidadeParcelas: 1, parcelasPagas: 0, parcelas: [futura] } });
    await render(<DividaDetalheView id="div-1" />);

    expect(await screen.findByText('Vence em 10/05/2099')).toBeOnTheScreen();
    expect(screen.getByTestId('icone-aguardando', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByText('Pagas · 0')).not.toBeOnTheScreen();
  });

  it('dívida quitada: o cartão diz "Dívida quitada" e não há grupo em aberto', async () => {
    const pagas = detalhe.parcelas.map((parcela) => ({ ...parcela, status: 'Pago' as const, dataPagamento: parcela.dataVencimento }));
    mockBuscar.mockResolvedValue({
      ok: true,
      data: { ...detalhe, parcelasPagas: 3, saldoPendenteCentavos: 0, proximaParcela: null, parcelas: pagas },
    });
    await render(<DividaDetalheView id="div-1" />);

    expect(await screen.findByText('Dívida quitada')).toBeOnTheScreen();
    expect(screen.getByText('Pagas · 3')).toBeOnTheScreen();
    expect(screen.queryByText(/^Em aberto/)).not.toBeOnTheScreen();
  });
});
});

// Toca num botão da folha de confirmação, que aparece na árvore como qualquer botão.
async function tocarNaFolha(rotulo: 'Excluir' | 'Cancelar') {
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: rotulo })));
}

describe('DividaDetalheView: excluir dívida (DIV-05)', () => {
  beforeEach(() => {
    mockBuscar.mockResolvedValue({ ok: true, data: detalhe });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('avisa antes o que a exclusão faz com as parcelas em aberto e as pagas', async () => {
    await render(<DividaDetalheView id="div-1" />);

    expect(await screen.findByText('Ao excluir esta dívida')).toBeOnTheScreen();
    expect(screen.getByText('2 parcelas em aberto saem do caixa. A paga continua no histórico.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Excluir dívida' })).toBeOnTheScreen();
  });

  it('confirma na folha, com o que vai acontecer, e não exclui se a pessoa cancelar', async () => {
    await render(<DividaDetalheView id="div-1" />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir dívida' }));

    expect(screen.getByText('Excluir dívida?')).toBeOnTheScreen();
    expect(
      screen.getByText('Financiamento do caminhão. 2 parcelas em aberto saem do caixa. A paga continua no histórico.'),
    ).toBeOnTheScreen();

    await tocarNaFolha('Cancelar');

    expect(screen.queryByText('Excluir dívida?')).not.toBeOnTheScreen();
    expect(mockExcluir).not.toHaveBeenCalled();
  });

  it('exclui, mostra o que aconteceu e volta para a lista quando o Snackbar fecha', async () => {
    jest.useFakeTimers();
    jest.spyOn(Animated, 'timing');
    mockExcluir.mockResolvedValue({ ok: true, data: { parcelasRemovidas: 2, parcelasPreservadas: 1 } });
    await render(<DividaDetalheView id="div-1" />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir dívida' }));
    await tocarNaFolha('Excluir');

    expect(mockExcluir).toHaveBeenCalledWith('div-1');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Dívida excluída. 2 parcelas em aberto removidas. 1 paga continua no caixa.',
    );
    // Segue em loading até sair da tela: um segundo toque não chama a RPC de novo.
    expect(screen.getByRole('button', { name: 'Excluir dívida' })).toBeDisabled();
    await waitFor(() => expect(Animated.timing).toHaveBeenCalled());
    expect(mockBack).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('erro da RPC: mostra a mensagem, reabilita o botão e fica na tela', async () => {
    mockExcluir.mockResolvedValue({ ok: false, mensagem: 'Dívida não encontrada ou já excluída.' });
    await render(<DividaDetalheView id="div-1" />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir dívida' }));
    await tocarNaFolha('Excluir');

    expect(screen.getByRole('alert')).toHaveTextContent('Dívida não encontrada ou já excluída.');
    expect(screen.getByRole('button', { name: 'Excluir dívida' })).not.toBeDisabled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('tocar de novo durante a exclusão não chama a RPC outra vez', async () => {
    let resolver: (valor: Awaited<ReturnType<typeof excluirDivida>>) => void = () => {};
    mockExcluir.mockReturnValue(new Promise((resolve) => (resolver = resolve)));
    await render(<DividaDetalheView id="div-1" />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir dívida' }));
    await tocarNaFolha('Excluir');
    // Com a exclusão em andamento o botão fica em loading: tocar de novo nem abre a folha.
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir dívida' }));

    expect(screen.queryByText('Excluir dívida?')).not.toBeOnTheScreen();
    expect(mockExcluir).toHaveBeenCalledTimes(1);
    await act(async () => resolver({ ok: true, data: { parcelasRemovidas: 2, parcelasPreservadas: 1 } }));
  });

  it('dívida quitada: avisa que só sai da lista', async () => {
    const pagas = detalhe.parcelas.map((parcela) => ({ ...parcela, status: 'Pago' as const }));
    mockBuscar.mockResolvedValue({
      ok: true,
      data: { ...detalhe, parcelasPagas: 3, saldoPendenteCentavos: 0, proximaParcela: null, parcelas: pagas },
    });
    await render(<DividaDetalheView id="div-1" />);

    expect(
      await screen.findByText('Nenhuma parcela em aberto: a dívida só sai da lista, e as pagas continuam no caixa.'),
    ).toBeOnTheScreen();
  });
});
