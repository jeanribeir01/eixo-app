import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DividaDetalheView } from '../components/DividaDetalheView';
import { buscarDivida } from '../dividasRepository';
import type { DividaDetalhe } from '../types';

jest.setTimeout(15000);

jest.mock('../dividasRepository', () => ({ buscarDivida: jest.fn() }));

const mockBuscar = buscarDivida as jest.MockedFunction<typeof buscarDivida>;

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
});

describe('DividaDetalheView (EIX-50)', () => {
  it('busca a dívida pelo id da rota', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: detalhe });
    render(<DividaDetalheView id="div-1" />);

    await screen.findByText('Financiamento do caminhão');
    expect(mockBuscar).toHaveBeenCalledWith('div-1');
  });

  it('carregando: indicador sob o header', () => {
    mockBuscar.mockReturnValue(new Promise(() => {}));
    render(<DividaDetalheView id="div-1" />);

    expect(screen.getByLabelText('Carregando dívida')).toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
  });

  it('resumo: categoria, descrição, soma total, parcelas pagas e valor da parcela', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: detalhe });
    render(<DividaDetalheView id="div-1" />);

    expect(await screen.findByText('Financiamento do caminhão')).toBeOnTheScreen();
    expect(screen.getByText('Financiamento')).toBeOnTheScreen();
    expect(screen.getByText('R$ 4.500,00')).toBeOnTheScreen();
    expect(screen.getByText('1 de 3')).toBeOnTheScreen();
    expect(screen.getAllByText('R$ 1.500,00').length).toBeGreaterThan(0);
    expect(screen.queryByText('Quitação antecipada')).not.toBeOnTheScreen();
  });

  it('com quitação antecipada, mostra o valor dela', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: { ...detalhe, valorQuitacaoCentavos: 400000 } });
    render(<DividaDetalheView id="div-1" />);

    expect(await screen.findByText('Quitação antecipada')).toBeOnTheScreen();
    expect(screen.getByText('R$ 4.000,00')).toBeOnTheScreen();
  });

  it('lista as parcelas geradas com número, vencimento, status e valor (prova do vídeo)', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: detalhe });
    render(<DividaDetalheView id="div-1" />);

    expect(await screen.findByText('Parcela 1')).toBeOnTheScreen();
    expect(screen.getByText('Vencimento 15/01/2026 · Pago')).toBeOnTheScreen();
    expect(screen.getByText('Parcela 3')).toBeOnTheScreen();
    expect(screen.getByText('Vencimento 15/03/2026 · Pendente')).toBeOnTheScreen();
  });

  it('o título "Dívida" fica no header; a tela não o repete', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: detalhe });
    render(<DividaDetalheView id="div-1" />);
    await screen.findByText('Financiamento do caminhão');

    expect(screen.queryByText('Dívida')).not.toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
  });

  it('erro: mostra a mensagem e "Tentar novamente" busca de novo', async () => {
    mockBuscar
      .mockResolvedValueOnce({ ok: false, mensagem: 'Dívida não encontrada ou já excluída.' })
      .mockResolvedValueOnce({ ok: true, data: detalhe });
    render(<DividaDetalheView id="div-1" />);

    expect(await screen.findByText('Dívida não encontrada ou já excluída.')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' })));

    expect(mockBuscar).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Financiamento do caminhão')).toBeOnTheScreen();
  });
});
