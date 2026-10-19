import * as Network from 'expo-network';

import * as syncModule from '../sync';
import { startNetworkSyncListener, useSyncStore } from '../syncStore';

jest.mock('../sync', () => ({
  drenarOutboxViagens: jest.fn().mockResolvedValue({
    total: 0,
    sincronizados: 0,
    falhas: 0,
    conflitos: 0,
    itens: [],
  }),
  obterStatusOutboxViagens: jest.fn().mockReturnValue({
    pendentes: 2,
    comErro: 0,
    conflitos: 0,
  }),
}));

describe('syncStore e startNetworkSyncListener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSyncStore.setState({
      isOnline: true,
      pendentes: 0,
      comErro: 0,
      conflitos: 0,
      sincronizando: false,
    });
  });

  it('atualizarStatus lê contagens de outbox da função de sync', () => {
    useSyncStore.getState().atualizarStatus();

    expect(syncModule.obterStatusOutboxViagens).toHaveBeenCalled();
    expect(useSyncStore.getState().pendentes).toBe(2);
  });

  it('setOnline altera o estado de conectividade', () => {
    useSyncStore.getState().setOnline(false);
    expect(useSyncStore.getState().isOnline).toBe(false);

    useSyncStore.getState().setOnline(true);
    expect(useSyncStore.getState().isOnline).toBe(true);
  });

  it('sincronizar dispara drenarOutboxViagens quando online e atualiza status ao terminar', async () => {
    await useSyncStore.getState().sincronizar();

    expect(syncModule.drenarOutboxViagens).toHaveBeenCalled();
    expect(useSyncStore.getState().sincronizando).toBe(false);
  });

  it('sincronizar não executa se o aparelho estiver offline', async () => {
    useSyncStore.getState().setOnline(false);

    await useSyncStore.getState().sincronizar();

    expect(syncModule.drenarOutboxViagens).not.toHaveBeenCalled();
  });

  it('startNetworkSyncListener registra listener e dispara drenagem quando a internet volta', async () => {
    let callbackListener: ((estado: { isConnected: boolean; isInternetReachable: boolean }) => Promise<void>) | null = null;

    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });

    const mockRemove = jest.fn();
    (Network.addNetworkStateListener as jest.Mock).mockImplementation((cb) => {
      callbackListener = cb;
      return { remove: mockRemove };
    });

    const unsubscribe = startNetworkSyncListener();

    // Aguarda promise inicial resolver
    await Promise.resolve();

    expect(useSyncStore.getState().isOnline).toBe(false);

    // Simula a internet voltando (offline -> online)
    expect(callbackListener).not.toBeNull();
    const listener = callbackListener as unknown as (estado: { isConnected: boolean; isInternetReachable: boolean }) => Promise<void>;
    if (listener) {
      await listener({ isConnected: true, isInternetReachable: true });
    }

    expect(useSyncStore.getState().isOnline).toBe(true);
    expect(syncModule.drenarOutboxViagens).toHaveBeenCalled();

    // Limpa o listener
    unsubscribe();
    expect(mockRemove).toHaveBeenCalled();
  });
});
