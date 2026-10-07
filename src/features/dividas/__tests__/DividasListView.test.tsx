import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { DividasListView } from '../components/DividasListView';
import { listarDividas } from '../dividasRepository';
import type { Divida } from '../types';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useFocusEffect: (cb: any) => {
    require('react').useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [cb]);
  },
}));

jest.mock('../dividasRepository', () => ({
  listarDividas: jest.fn(),
}));

const mockPush = jest.fn();
(useRouter as jest.Mock).mockReturnValue({ push: mockPush });
const mockListar = listarDividas as jest.MockedFunction<typeof listarDividas>;

beforeEach(() => {
  mockPush.mockClear();
  mockListar.mockReset();
});

const dividaMock: Divida = {
  id: 'divida-123',
  descricao: 'Financiamento do Caminhão',
  categoria: { titulo: 'Financiamento' },
  quantidadeParcelas: 48,
  valorParcelaCentavos: 150000,
  somaTotalCentavos: 72000000, // 48 * 150000
  valorQuitacaoCentavos: null,
  dataVencimentoPrimeira: '2026-01-15',
  parcelasPagas: 2,
  ativa: true,
};

describe('DividasListView', () => {
  it('exibe tela de carregamento inicialmente', async () => {
    // Pendura a promise para verificar o loading
    mockListar.mockImplementation(() => new Promise(() => {}));
    
    render(<DividasListView />);
    expect(screen.getByLabelText('Carregando dívidas')).toBeOnTheScreen();
  });

  it('exibe empty state quando não há dívidas', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [] });
    
    render(<DividasListView />);
    
    await waitFor(() => {
      expect(screen.getByText('Nenhuma dívida encontrada')).toBeOnTheScreen();
    });
  });

  it('exibe lista de dívidas e navega para detalhes', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [dividaMock] });
    
    render(<DividasListView />);
    
    await waitFor(() => {
      expect(screen.getByText('Financiamento do Caminhão')).toBeOnTheScreen();
    });

    expect(screen.getByText('R$ 720.000,00')).toBeOnTheScreen();
    expect(screen.getByText('2 de 48 parcelas pagas')).toBeOnTheScreen();

    // Testa navegação para detalhes
    fireEvent.press(screen.getByLabelText('Dívida Financiamento do Caminhão'));
    expect(mockPush).toHaveBeenCalledWith('/dividas/divida-123');
  });

  it('navega para nova dívida ao pressionar o botão', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [] });
    
    render(<DividasListView />);
    
    await waitFor(() => {
      expect(screen.getByText('Nova Dívida')).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByText('Nova Dívida'));
    expect(mockPush).toHaveBeenCalledWith('/dividas/nova');
  });

  it('exibe mensagem de erro se a busca falhar', async () => {
    mockListar.mockResolvedValue({ ok: false, mensagem: 'Erro ao buscar dados do servidor.' });
    
    render(<DividasListView />);
    
    await waitFor(() => {
      expect(screen.getByText('Não foi possível carregar')).toBeOnTheScreen();
    });
    
    expect(screen.getByText('Erro ao buscar dados do servidor.')).toBeOnTheScreen();
  });
});
