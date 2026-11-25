import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions } from 'react-native';

import { porTipo } from '@/testing/componentes';
import { FAB_ALTURA_RESERVADA, colors, spacing } from '@/ui';

import { ViagensListView } from '../ViagensListView';
import * as repo from '../viagensRepository';
import { contarRevisoesPendentes } from '../revisoesRepository';
import { useSyncStore } from '../syncStore';

// Largura da janela controlada pelo teste: 412 é celular, 800 é tablet (EIX-94).
// O filtro de status é um chip: abre a folha e toca na opção.
async function escolherStatus(opcao: string) {
  await fireEvent.press(screen.getByRole('button', { name: /^Status: / }));
  await fireEvent.press(screen.getByRole('button', { name: opcao }));
}

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 900, scale: 1, fontScale: 1 })),
}));

function mockLargura(width: number) {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

const mockPush = jest.fn();
let mockAoFocar: (() => void) | null = null;
let mockCallbacksDeFoco: (() => void)[] = [];
let mockUsuario: { id: string; nome: string; email: string; perfil: string } | null = null;

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => {
      mockCallbacksDeFoco.push(callback);
      mockAoFocar = () => {
        for (const aoFocar of new Set(mockCallbacksDeFoco)) aoFocar();
      };
      react.useEffect(callback, [callback]);
    },
  };
});

jest.mock('@/features/auth/profileStore', () => ({
  useProfile: () => ({ usuario: mockUsuario }),
}));

jest.mock('../revisoesRepository', () => ({
  contarRevisoesPendentes: jest.fn(),
}));

const mockContarRevisoes = contarRevisoesPendentes as jest.Mock;

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
    em_revisao: false,
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
    hodometro_final: 20500,
    data_inicio: '2026-10-17T08:00:00Z',
    data_fim: '2026-10-17T18:00:00Z',
    status: 'Finalizada' as const,
    km_rodado: null,
    em_revisao: false,
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
    mockCallbacksDeFoco = [];
    mockUsuario = null;
    mockContarRevisoes.mockResolvedValue({ ok: true, data: 0 });
    useSyncStore.setState({ sincronizando: false, pendentes: 0, comErro: 0, emRevisao: 0 });
    jest.spyOn(useSyncStore.getState(), 'sincronizarTudo').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renderiza viagens, calcula quilometragem offline e exibe aviso de discrepância', async () => {
    jest.spyOn(repo, 'listarViagens').mockResolvedValue({ ok: true, data: mockViagens });

    await render(<ViagensListView />);

    expect(await screen.findByText('BRA2E19 • Actros')).toBeTruthy();
    expect(screen.getByText('Viagens')).toBeTruthy();
    expect(screen.getByText('XYZ9K88 • FH')).toBeTruthy();
    expect(screen.getByText('Concluída')).toBeTruthy();

    expect(screen.getByText('Distância rodada: 500 km')).toBeTruthy();
    expect(screen.getByText(/acima da rota/i)).toBeTruthy();

    const botaoFechar = screen.getByRole('button', { name: 'Finalizar viagem' });
    await fireEvent.press(botaoFechar);
    expect(mockPush).toHaveBeenCalledWith('/viagens/viagem-1/fechar');
  });

  it('exibe "Concluída" na viagem e no filtro, como na tela de fechamento', async () => {
    jest.spyOn(repo, 'listarViagens').mockResolvedValue({ ok: true, data: mockViagens });

    await render(<ViagensListView />);

    expect(await screen.findByText('Concluída')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Status: Todas' }));
    expect(screen.getByRole('button', { name: 'Concluídas' })).toBeOnTheScreen();
    expect(screen.queryByText(/Finalizada/)).not.toBeOnTheScreen();
  });

  it('mostra selo "Em revisão" quando a viagem local foi recusada pelo servidor', async () => {
    jest.spyOn(repo, 'listarViagens').mockResolvedValue({
      ok: true,
      data: [{ ...mockViagens[0], em_revisao: true }],
    });

    await render(<ViagensListView />);

    expect(await screen.findByText('Em revisão')).toBeOnTheScreen();
    expect(
      screen.getByText('Esta viagem tem uma operação aguardando revisão do gestor.'),
    ).toBeOnTheScreen();
  });

  it('navega para nova viagem ao tocar no FAB', async () => {
    jest.spyOn(repo, 'listarViagens').mockResolvedValue({ ok: true, data: mockViagens });

    await render(<ViagensListView />);
    await screen.findByText('BRA2E19 • Actros');

    await fireEvent.press(screen.getByRole('button', { name: 'Abrir viagem' }));

    expect(mockPush).toHaveBeenCalledWith('/viagens/nova');
  });

  it('filtro de status consulta o banco com o status escolhido', async () => {
    const mockListar = jest
      .spyOn(repo, 'listarViagens')
      .mockResolvedValue({ ok: true, data: mockViagens });

    await render(<ViagensListView />);
    await screen.findByText('BRA2E19 • Actros');

    mockListar.mockResolvedValueOnce({ ok: true, data: [mockViagens[0]] });
    await escolherStatus('Em andamento');

    await waitFor(() => expect(mockListar).toHaveBeenLastCalledWith({ status: 'EmAndamento' }));
    expect(await screen.findByText('BRA2E19 • Actros')).toBeOnTheScreen();
    expect(screen.queryByText('XYZ9K88 • FH')).not.toBeOnTheScreen();
  });

  it('Motorista lê só as próprias viagens no cache local', async () => {
    mockUsuario = {
      id: 'motorista-1',
      nome: 'João Silva',
      email: 'joao@transportadora.com',
      perfil: 'Motorista',
    };
    const mockListar = jest
      .spyOn(repo, 'listarViagens')
      .mockResolvedValue({ ok: true, data: mockViagens });

    await render(<ViagensListView />);
    await screen.findByText('BRA2E19 • Actros');

    expect(mockListar).toHaveBeenLastCalledWith({
      status: 'Todos',
      motorista_id: 'motorista-1',
    });
  });

  it('Admin vê o aviso de revisões e navega para a fila do gestor', async () => {
    mockUsuario = {
      id: 'admin-1',
      nome: 'Maria Gestora',
      email: 'maria@transportadora.com',
      perfil: 'Gestor de Frota',
    };
    mockContarRevisoes.mockResolvedValue({ ok: true, data: 2 });
    jest.spyOn(repo, 'listarViagens').mockResolvedValue({ ok: true, data: [] });

    await render(<ViagensListView />);

    expect(await screen.findByText('2 viagens precisam de revisão')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver revisões' }));

    expect(mockPush).toHaveBeenCalledWith('/viagens/revisoes');
  });

  it('erro numa recarga mantém a lista e mostra o Snackbar', async () => {
    const mockListar = jest
      .spyOn(repo, 'listarViagens')
      .mockResolvedValue({ ok: true, data: mockViagens });

    await render(<ViagensListView />);
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

    await render(<ViagensListView />);

    expect(await screen.findByText('Não foi possível carregar as viagens')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('BRA2E19 • Actros')).toBeOnTheScreen();
    expect(mockListar).toHaveBeenCalledTimes(2);
  });

  it('mostra o estado vazio quando não há viagens', async () => {
    jest.spyOn(repo, 'listarViagens').mockResolvedValue({ ok: true, data: [] });

    await render(<ViagensListView />);

    expect(await screen.findByText('Nenhuma viagem encontrada')).toBeOnTheScreen();
    expect(
      screen.getByText('Nenhuma viagem registrada ainda. Abra a primeira viagem.'),
    ).toBeOnTheScreen();
    expect(porTipo(RefreshControl)).toBeTruthy();
  });

  it('estado vazio de um filtro oferece "Ver todas" e volta para Todos', async () => {
    const mockListar = jest.spyOn(repo, 'listarViagens').mockImplementation(async (filtro = {}) => {
      if (filtro.status === 'EmAndamento') return { ok: true, data: [] };
      return { ok: true, data: mockViagens };
    });

    await render(<ViagensListView />);
    await screen.findByText('BRA2E19 • Actros');

    await escolherStatus('Em andamento');
    expect(await screen.findByText('Nenhuma viagem com esse status no momento.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Ver todas' }));

    await waitFor(() => expect(mockListar).toHaveBeenLastCalledWith({ status: 'Todos' }));
    expect(await screen.findByText('BRA2E19 • Actros')).toBeOnTheScreen();
  });

  it('limpa o Snackbar de erro ao trocar de filtro', async () => {
    const mockListar = jest
      .spyOn(repo, 'listarViagens')
      .mockResolvedValueOnce({ ok: true, data: mockViagens })
      .mockResolvedValueOnce({ ok: false, mensagem: 'Sem conexão com o servidor.' })
      .mockResolvedValueOnce({ ok: true, data: mockViagens });

    await render(<ViagensListView />);
    await screen.findByText('BRA2E19 • Actros');

    const refresh = porTipo(RefreshControl);
    await act(async () => {
      await refresh.props.onRefresh!();
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão com o servidor.');

    await escolherStatus('Em andamento');

    await waitFor(() => expect(mockListar).toHaveBeenLastCalledWith({ status: 'EmAndamento' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeOnTheScreen());
  });

  it('usa FlatList com pull-to-refresh, sincroniza e reserva espaço para o FAB', async () => {
    const mockListar = jest
      .spyOn(repo, 'listarViagens')
      .mockResolvedValueOnce({ ok: true, data: mockViagens })
      .mockResolvedValueOnce({ ok: true, data: [mockViagens[0]] });

    await render(<ViagensListView />);
    await screen.findByText('BRA2E19 • Actros');

    const refresh = porTipo(RefreshControl);
    expect(refresh.props.colors).toEqual([colors.accent]);
    expect(
      StyleSheet.flatten(porTipo(FlatList).props.contentContainerStyle),
    ).toMatchObject({ paddingBottom: FAB_ALTURA_RESERVADA });

    await act(async () => {
      await refresh.props.onRefresh!();
    });

    expect(useSyncStore.getState().sincronizarTudo).toHaveBeenCalled();
    expect(mockListar).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('BRA2E19 • Actros')).toBeOnTheScreen();
    expect(screen.queryByText('XYZ9K88 • FH')).not.toBeOnTheScreen();
  });

  describe('ViagensListView — tablet (EIX-94)', () => {
    afterEach(() => mockLargura(412));

    function estiloDoConteudo() {
      return StyleSheet.flatten(screen.getByTestId('screen-conteudo').props.style);
    }

    function estiloDaLista() {
      return StyleSheet.flatten(porTipo(FlatList).props.contentContainerStyle);
    }

    it('412: nada muda, o respiro lateral continua no Screen e a lista não ganha coluna', async () => {
      jest.spyOn(repo, 'listarViagens').mockResolvedValue({ ok: true, data: mockViagens });
      await render(<ViagensListView />);
      await screen.findByText('BRA2E19 • Actros');

      expect(estiloDoConteudo()).toMatchObject({ paddingHorizontal: spacing.base });
      expect(estiloDaLista()?.maxWidth).toBeUndefined();
    });

    it('800: a lista rola na largura toda e o conteúdo fica na coluna de 720', async () => {
      mockLargura(800);
      jest.spyOn(repo, 'listarViagens').mockResolvedValue({ ok: true, data: mockViagens });
      await render(<ViagensListView />);
      await screen.findByText('BRA2E19 • Actros');

      expect(estiloDoConteudo().maxWidth).toBeUndefined();
      expect(estiloDoConteudo().paddingHorizontal).toBeUndefined();
      expect(estiloDaLista()).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
      const coluna = screen.getByTestId('screen-coluna');
      expect(StyleSheet.flatten(coluna.props.style)).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
      expect(within(coluna).getByText('Viagens')).toBeOnTheScreen();
    });
  });
});
