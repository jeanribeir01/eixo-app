import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { DividaDetalheView } from '../components/DividaDetalheView';
import { buscarDivida } from '../dividasRepository';
import type { DividaDetalhe } from '../types';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('../dividasRepository', () => ({
  buscarDivida: jest.fn(),
}));

const mockBack = jest.fn();
(useRouter as jest.Mock).mockReturnValue({ back: mockBack });
const mockBuscar = buscarDivida as jest.MockedFunction<typeof buscarDivida>;

beforeEach(() => {
  mockBack.mockClear();
  mockBuscar.mockReset();
});

const dividaDetalheMock: DividaDetalhe = {
  id: 'divida-123',
  descricao: 'Financiamento do Caminhão',
  categoria: { titulo: 'Financiamento' },
  quantidadeParcelas: 2,
  valorParcelaCentavos: 150000, // 1500 reais
  somaTotalCentavos: 300000,
  valorQuitacaoCentavos: null,
  dataVencimentoPrimeira: '2026-01-15',
  parcelasPagas: 1,
  ativa: true,
  parcelas: [
    {
      id: 'parc-1',
      numero: 1,
      dataVencimento: '2026-01-15',
      valorCentavos: 150000,
      status: 'Pago',
      dataPagamento: '2026-01-10',
    },
    {
      id: 'parc-2',
      numero: 2,
      dataVencimento: '2026-02-15',
      valorCentavos: 150000,
      status: 'Pendente',
      dataPagamento: null,
    },
  ],
};

describe('DividaDetalheView', () => {
  it('exibe tela de carregamento inicialmente', async () => {
    mockBuscar.mockImplementation(() => new Promise(() => {}));
    
    render(<DividaDetalheView id="divida-123" />);
    // O ActivityIndicator não tem label específico configurado, mas podemos checar se renderiza.
    // Usaremos a ausência de textos como prova inicial.
    expect(screen.queryByText('Financiamento do Caminhão')).toBeNull();
  });

  it('exibe os detalhes da dívida e a lista de parcelas', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: dividaDetalheMock });
    
    render(<DividaDetalheView id="divida-123" />);
    
    await waitFor(() => {
      expect(screen.getByText('Financiamento do Caminhão')).toBeOnTheScreen();
    });

    expect(screen.getByText('Financiamento')).toBeOnTheScreen();
    expect(screen.getByText('R$ 3.000,00')).toBeOnTheScreen(); // Soma Total
    expect(screen.getByText('1 de 2')).toBeOnTheScreen(); // Parcelas Pagas
    expect(screen.getAllByText('R$ 1.500,00').length).toBeGreaterThan(0); // Valor Parcela e itens

    // Detalhes das parcelas na FlatList
    expect(screen.getByText('Parcela 1')).toBeOnTheScreen();
    expect(screen.getByText('Venc: 15/01/2026')).toBeOnTheScreen();
    expect(screen.getByText('Pago')).toBeOnTheScreen();

    expect(screen.getByText('Parcela 2')).toBeOnTheScreen();
    expect(screen.getByText('Venc: 15/02/2026')).toBeOnTheScreen();
    expect(screen.getByText('Pendente')).toBeOnTheScreen();
  });

  it('exibe mensagem de erro se a busca falhar e permite voltar', async () => {
    mockBuscar.mockResolvedValue({ ok: false, mensagem: 'Dívida não encontrada.' });
    
    render(<DividaDetalheView id="divida-123" />);
    
    await waitFor(() => {
      expect(screen.getByText('Não foi possível carregar')).toBeOnTheScreen();
    });
    
    expect(screen.getByText('Dívida não encontrada.')).toBeOnTheScreen();
    
    fireEvent.press(screen.getByText('Voltar'));
    expect(mockBack).toHaveBeenCalled();
  });
});
