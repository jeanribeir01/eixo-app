import { act } from '@testing-library/react-native';
import * as Network from 'expo-network';

import * as syncModule from '../sync';
import { INTERVALO_RETENTATIVA_MS, pedirSincronizacao, startNetworkSyncListener, useSyncStore } from '../syncStore';

jest.mock('../sync', () => ({
  sincronizarViagens: jest.fn().mockResolvedValue(null),
  obterStatusOutbox: jest.fn().mockReturnValue({ pendentes: 2, falhas: 1, conflitos: 0 }),
}));

type EstadoRede = { isConnected: boolean; isInternetReachable: boolean };

const mockSincronizar = syncModule.sincronizarViagens as jest.Mock;
const mockStatus = syncModule.obterStatusOutbox as jest.Mock;

// Captura o callback que o listener registra, para o teste simular a rede mudando.
function capturarListener() {
  let callback: ((estado: EstadoRede) => void) | null = null;
  const remove = jest.fn();
  (Network.addNetworkStateListener as jest.Mock).mockImplementation((cb: (estado: EstadoRede) => void) => {
    callback = cb;
    return { remove };
  });
  return {
    remove,
    mudarRede: (estado: EstadoRede) => {
      if (!callback) throw new Error('listener não registrado');
      callback(estado);
    },
  };
}

describe('syncStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSyncStore.setState({ isOnline: true, pendentes: 0, falhas: 0, conflitos: 0, sincronizando: false });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('atualizarStatus lê pendentes, falhas e conflitos da outbox', () => {
    useSyncStore.getState().atualizarStatus();

    expect(useSyncStore.getState()).toMatchObject({ pendentes: 2, falhas: 1, conflitos: 0 });
  });

  it('atualizarStatus mantém os números se o banco ainda não abriu', () => {
    mockStatus.mockImplementationOnce(() => {
      throw new Error('no such table: outbox');
    });

    useSyncStore.getState().atualizarStatus();

    expect(useSyncStore.getState().pendentes).toBe(0);
  });

  it('sincronizar chama o sync, repassa as opções e atualiza o status ao terminar', async () => {
    await useSyncStore.getState().sincronizar({ baixar: false });

    expect(mockSincronizar).toHaveBeenCalledWith({ baixar: false });
    expect(useSyncStore.getState()).toMatchObject({ sincronizando: false, pendentes: 2 });
  });

  it('sincronizar não faz nada offline', async () => {
    useSyncStore.getState().setOnline(false);

    await useSyncStore.getState().sincronizar();

    expect(mockSincronizar).not.toHaveBeenCalled();
  });

  it('pedido no meio de uma sincronização espera a mesma, sem disparar outra', async () => {
    let terminar: () => void = () => {};
    mockSincronizar.mockReturnValueOnce(new Promise<null>((resolve) => (terminar = () => resolve(null))));

    const primeira = useSyncStore.getState().sincronizar();
    const segunda = useSyncStore.getState().sincronizar();
    expect(useSyncStore.getState().sincronizando).toBe(true);

    terminar();
    await Promise.all([primeira, segunda]);

    expect(mockSincronizar).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState().sincronizando).toBe(false);
  });

  it('erro inesperado no sync não deixa a store presa em "sincronizando"', async () => {
    mockSincronizar.mockRejectedValueOnce(new Error('falhou'));

    await useSyncStore.getState().sincronizar();

    expect(useSyncStore.getState().sincronizando).toBe(false);
  });

  it('pedirSincronizacao atualiza o contador e sincroniza', async () => {
    pedirSincronizacao();
    await act(async () => {});

    expect(useSyncStore.getState().pendentes).toBe(2);
    expect(mockSincronizar).toHaveBeenCalledTimes(1);
  });

  describe('startNetworkSyncListener', () => {
    it('na abertura do app, com internet, sincroniza', async () => {
      capturarListener();
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValueOnce({ isConnected: true, isInternetReachable: true });

      const parar = startNetworkSyncListener();
      await act(async () => {});

      expect(mockSincronizar).toHaveBeenCalledTimes(1);
      parar();
    });

    it('quando a internet volta, sincroniza; enquanto continua online, não repete', async () => {
      const { mudarRede, remove } = capturarListener();
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValueOnce({ isConnected: false, isInternetReachable: false });

      const parar = startNetworkSyncListener();
      await act(async () => {});
      expect(useSyncStore.getState().isOnline).toBe(false);
      expect(mockSincronizar).not.toHaveBeenCalled();

      mudarRede({ isConnected: true, isInternetReachable: true });
      await act(async () => {});
      mudarRede({ isConnected: true, isInternetReachable: true });
      await act(async () => {});

      expect(useSyncStore.getState().isOnline).toBe(true);
      expect(mockSincronizar).toHaveBeenCalledTimes(1);

      parar();
      expect(remove).toHaveBeenCalled();
    });

    it('tenta de novo de tempos em tempos só quando há pendência, e só enviando', async () => {
      jest.useFakeTimers();
      capturarListener();
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValueOnce({ isConnected: true, isInternetReachable: true });
      mockStatus.mockReturnValue({ pendentes: 0, falhas: 0, conflitos: 0 });

      const parar = startNetworkSyncListener();
      await act(async () => {});
      mockSincronizar.mockClear();

      await act(async () => {
        jest.advanceTimersByTime(INTERVALO_RETENTATIVA_MS);
      });
      expect(mockSincronizar).not.toHaveBeenCalled();

      useSyncStore.setState({ pendentes: 1 });
      await act(async () => {
        jest.advanceTimersByTime(INTERVALO_RETENTATIVA_MS);
      });
      expect(mockSincronizar).toHaveBeenCalledWith({ baixar: false });

      parar();
      mockSincronizar.mockClear();
      useSyncStore.setState({ pendentes: 1 });
      await act(async () => {
        jest.advanceTimersByTime(INTERVALO_RETENTATIVA_MS);
      });
      expect(mockSincronizar).not.toHaveBeenCalled();
      mockStatus.mockReturnValue({ pendentes: 2, falhas: 1, conflitos: 0 });
    });
  });
});
