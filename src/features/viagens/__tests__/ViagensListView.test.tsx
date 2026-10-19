import { fireEvent, render, screen } from '@testing-library/react-native';

import * as syncModule from '../sync';
import { useSyncStore } from '../syncStore';
import { ViagensListView } from '../ViagensListView';
import * as repo from '../viagensRepository';

const mockPush = jest.fn();

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]),
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

  it('exibe indicador visual de offline e registros pendentes de sincronização', async () => {
    jest.spyOn(syncModule, 'obterStatusOutboxViagens').mockReturnValue({
      pendentes: 2,
      comErro: 0,
      conflitos: 0,
    });

    useSyncStore.setState({
      isOnline: false,
      pendentes: 2,
      comErro: 0,
      conflitos: 0,
      sincronizando: false,
    });

    jest.spyOn(repo, 'listarViagens').mockResolvedValue({
      ok: true,
      data: mockViagens,
    });

    render(<ViagensListView />);

    await screen.findByText('BRA2E19 • Actros');

    expect(screen.getByTestId('indicador-sincronizacao')).toBeTruthy();
    expect(screen.getByText('offline')).toBeTruthy();
    expect(screen.getByText('2 registos a aguardar sincronização')).toBeTruthy();
  });

  it('não exibe indicador de sincronização se estiver online e sem pendências', async () => {
    jest.spyOn(syncModule, 'obterStatusOutboxViagens').mockReturnValue({
      pendentes: 0,
      comErro: 0,
      conflitos: 0,
    });

    useSyncStore.setState({
      isOnline: true,
      pendentes: 0,
      comErro: 0,
      conflitos: 0,
      sincronizando: false,
    });

    jest.spyOn(repo, 'listarViagens').mockResolvedValue({
      ok: true,
      data: mockViagens,
    });

    render(<ViagensListView />);

    await screen.findByText('BRA2E19 • Actros');

    expect(screen.queryByTestId('indicador-sincronizacao')).toBeNull();
  });
});
