import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import { FAB_ALTURA_RESERVADA, colors } from '@/ui';

import { ViagensListView } from '../ViagensListView';
import * as repo from '../viagensRepository';

const mockPush = jest.fn();
let mockAoFocar: (() => void) | null = null;

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => {
      mockAoFocar = callback;
      react.useEffect(callback, [callback]);
    },
  };
});

const mockViagens = [
  {
    id: 'viagem-1',
    veiculo_id: 'veic-1',
    rota_id: 'rota-1',
    motorista_id: 'mot-1',
    hodometro_inicial: 10000,
    hodometro_final: null,
    data_inicio: '2026-10-18T08:00:00Z',
    data_fim: null,
    status: 'EmAndamento' as const,
    km_rodado: null,
    data_inclusao: '2026-10-18T08:00:00Z',
    data_atualizacao: '2026-10-18T08:00:00Z',
    veiculo: {
      id: 'veic-1',
      placa: 'BRA2E19',
      marca: 'Mercedes-Benz',
      modelo: 'Actros',
      status: 'EmViagem' as const,
    },
    rota: {
      id: 'rota-1',
      cidade_origem: 'São Paulo',
      uf_origem: 'SP' as const,
      cidade_destino: 'Campinas',
      uf_destino: 'SP' as const,
      distancia_estimada_km: 100,
    },
    motorista: {
      id: 'mot-1',
      nome: 'João Silva',
      email: 'joao@transportadora.com',
    },
  },
  {
    id: 'viagem-2',
    veiculo_id: 'veic-2',
    rota_id: 'rota-2',
    motorista_id: 'mot-2',
    hodometro_inicial: 20000,
    hodometro_final: 20500, // 500 km rodados, rota estimada é 350 km (excede > 20%)
    data_inicio: '2026-10-17T08:00:00Z',
    data_fim: '2026-10-17T18:00:00Z',
    status: 'Finalizada' as const,
    km_rodado: null, // Sem km_rodado do banco para provar o cálculo offline
    data_inclusao: '2026-10-17T08:00:00Z',
    data_atualizacao: '2026-10-17T18:00:00Z',
    veiculo: {
      id: 'veic-2',
      placa: 'XYZ9K88',
      marca: 'Volvo',
      modelo: 'FH',
      status: 'Disponivel' as const,
    },
    rota: {
      id: 'rota-2',
      cidade_origem: 'São Paulo',
      uf_origem: 'SP' as const,
      cidade_destino: 'Ribeirão Preto',
      uf_destino: 'SP' as const,
      distancia_estimada_km: 350,
    },
    motorista: {
      id: 'mot-2',
      nome: 'Pedro Santos',
      email: 'pedro@transportadora.com',
    },
  },
];

describe('ViagensListView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAoFocar = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renderiza viagens, calcula quilometragem offline e exibe aviso de discrepância', async () => {
    jest.spyOn(repo, 'listarViagens').mockResolvedValue({
      ok: true,
      data: mockViagens,
    });

    render(<ViagensListView />);

    expect(await screen.findByText('BRA2E19 • Actros')).toBeTruthy();
    expect(screen.getByText('Viagens')).toBeTruthy();
    expect(screen.getByText('XYZ9K88 • FH')).toBeTruthy();

    // Prova cálculo offline: 20500 - 20000 = 500 km rodados (mesmo com km_rodado nulo)
    expect(screen.getByText('Distância rodada: 500 km')).toBeTruthy();

    // Prova aviso visual de discrepância: 500 km > 350 km * 1.2
    expect(screen.getByText(/acima da rota/i)).toBeTruthy();

    // Prova botão de fechar para viagem EmAndamento
    const botaoFechar = screen.getByRole('button', { name: 'Fechar viagem' });
    fireEvent.press(botaoFechar);
    expect(mockPush).toHaveBeenCalledWith('/viagens/viagem-1/fechar');
  });

  it('navega para nova viagem ao tocar no FAB', async () => {
    jest.spyOn(repo, 'listarViagens').mockResolvedValue({
      ok: true,
      data: mockViagens,
    });

    render(<ViagensListView />);

    await screen.findByText('BRA2E19 • Actros');

    const fab = screen.getByRole('button', { name: 'Abrir viagem' });
    fireEvent.press(fab);

    expect(mockPush).toHaveBeenCalledWith('/viagens/nova');
  });

  it('filtro de status consulta o banco com o status escolhido', async () => {
    const mockListar = jest.spyOn(repo, 'listarViagens').mockResolvedValue({
      ok: true,
      data: mockViagens,
    });

    render(<ViagensListView />);
    await screen.findByText('BRA2E19 • Actros');

    mockListar.mockResolvedValueOnce({ ok: true, data: [mockViagens[0]] });

    fireEvent.press(screen.getByRole('tab', { name: 'Em andamento' }));

    await waitFor(() => expect(mockListar).toHaveBeenLastCalledWith({ status: 'EmAndamento' }));

    expect(await screen.findByText('BRA2E19 • Actros')).toBeOnTheScreen();
    expect(screen.queryByText('XYZ9K88 • FH')).not.toBeOnTheScreen();
  });

  it('erro numa recarga mantém a lista e mostra o Snackbar', async () => {
    const mockListar = jest.spyOn(repo, 'listarViagens').mockResolvedValue({
      ok: true,
      data: mockViagens,
    });

    render(<ViagensListView />);
    await screen.findByText('BRA2E19 • Actros');

    mockListar.mockResolvedValueOnce({ ok: false, mensagem: 'Sem conexão com o servidor.' });

    await act(async () => {
      mockAoFocar?.();
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão com o servidor.');
    expect(screen.getByText('BRA2E19 • Actros')).toBeOnTheScreen();
  });

  it('erro na primeira carga mostra o estado de erro e "Tentar novamente" recarrega', async () => {
    const mockListar = jest
      .spyOn(repo, 'listarViagens')
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as viagens.' })
      .mockResolvedValueOnce({ ok: true, data: mockViagens });

    render(<ViagensListView />);

    expect(await screen.findByText('Não foi possível carregar as viagens')).toBeOnTheScreen();
    expect(screen.getByText('Não foi possível carregar as viagens.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('BRA2E19 • Actros')).toBeOnTheScreen();
    expect(mockListar).toHaveBeenCalledTimes(2);
  });

  it('mostra o estado vazio quando não há viagens', async () => {
    jest.spyOn(repo, 'listarViagens').mockResolvedValue({ ok: true, data: [] });

    render(<ViagensListView />);

    expect(await screen.findByText('Nenhuma viagem encontrada')).toBeOnTheScreen();
    expect(
      screen.getByText('Nenhuma viagem registrada ainda. Abra a primeira viagem.'),
    ).toBeOnTheScreen();
    // O vazio fica dentro da FlatList para o pull-to-refresh continuar disponível.
    expect(screen.UNSAFE_getByType(RefreshControl)).toBeTruthy();
  });

  it('estado vazio de um filtro oferece "Ver todas" e volta para Todos', async () => {
    const mockListar = jest.spyOn(repo, 'listarViagens').mockImplementation(async (filtro = {}) => {
      if (filtro.status === 'EmAndamento') {
        return { ok: true, data: [] };
      }
      return { ok: true, data: mockViagens };
    });

    render(<ViagensListView />);
    await screen.findByText('BRA2E19 • Actros');

    fireEvent.press(screen.getByRole('tab', { name: 'Em andamento' }));

    expect(await screen.findByText('Nenhuma viagem com esse status no momento.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Ver todas' }));

    await waitFor(() => expect(mockListar).toHaveBeenLastCalledWith({ status: 'Todos' }));
    expect(await screen.findByText('BRA2E19 • Actros')).toBeOnTheScreen();
  });

  it('limpa o Snackbar de erro ao trocar de filtro', async () => {
    const mockListar = jest
      .spyOn(repo, 'listarViagens')
      .mockResolvedValueOnce({ ok: true, data: mockViagens })
      .mockResolvedValueOnce({ ok: false, mensagem: 'Sem conexão com o servidor.' })
      .mockResolvedValueOnce({ ok: true, data: mockViagens });

    render(<ViagensListView />);
    await screen.findByText('BRA2E19 • Actros');

    const refresh = screen.UNSAFE_getByType(RefreshControl);
    await act(async () => {
      await refresh.props.onRefresh();
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão com o servidor.');

    fireEvent.press(screen.getByRole('tab', { name: 'Em andamento' }));

    await waitFor(() => expect(mockListar).toHaveBeenLastCalledWith({ status: 'EmAndamento' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeOnTheScreen());
  });

  it('usa FlatList com pull-to-refresh, atualiza os dados e reserva espaço para o FAB', async () => {
    const mockListar = jest
      .spyOn(repo, 'listarViagens')
      .mockResolvedValueOnce({ ok: true, data: mockViagens })
      .mockResolvedValueOnce({ ok: true, data: [mockViagens[0]] });

    render(<ViagensListView />);
    await screen.findByText('BRA2E19 • Actros');

    const refresh = screen.UNSAFE_getByType(RefreshControl);
    expect(refresh.props.colors).toEqual([colors.accent]);
    expect(
      StyleSheet.flatten(screen.UNSAFE_getByType(FlatList).props.contentContainerStyle),
    ).toMatchObject({
      paddingBottom: FAB_ALTURA_RESERVADA,
    });

    // Executa o onRefresh de verdade: a integração com `puxarParaAtualizar` refaz a consulta.
    await act(async () => {
      await refresh.props.onRefresh();
    });

    expect(mockListar).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('BRA2E19 • Actros')).toBeOnTheScreen();
    expect(screen.queryByText('XYZ9K88 • FH')).not.toBeOnTheScreen();
  });
});
