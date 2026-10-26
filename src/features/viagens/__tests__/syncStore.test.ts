import * as Network from 'expo-network';

import { definirUsuarioLocal } from '../sessaoLocal';
import * as syncModule from '../sync';
import { startNetworkSyncListener, useSyncStore } from '../syncStore';
import * as repo from '../viagensRepository';

jest.mock('../sync', () => ({
  sincronizarViagens: jest.fn().mockResolvedValue({
    ok: true,
    semConexao: false,
    viagensBaixadas: 0,
    drenagem: {
      total: 0,
      sincronizados: 0,
      falhas: 0,
      conflitos: 0,
      semConexao: false,
      itens: [],
    },
  }),
  drenarOutboxViagens: jest.fn().mockResolvedValue({
    total: 0,
    sincronizados: 0,
    falhas: 0,
    conflitos: 0,
    semConexao: false,
    itens: [],
  }),
  obterStatusOutboxViagens: jest.fn().mockReturnValue({
    pendentes: 2,
    comErro: 1,
    conflitos: 3,
    emRevisao: 3,
  }),
}));

jest.mock('../viagensRepository', () => ({
  prepararSessaoLocal: jest.fn().mockResolvedValue({ ok: true, data: true }),
}));

describe('syncStore e startNetworkSyncListener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    definirUsuarioLocal('usuario-1');
    useSyncStore.setState({
      isOnline: true,
      pendentes: 0,
      comErro: 0,
      emRevisao: 0,
      conflitos: 0,
      sincronizando: false,
      ultimoErro: null,
      sessaoLocalUsuario: null,
      sessaoLocalErro: null,
      ultimaSincronizacaoEm: null,
    });
    (repo.prepararSessaoLocal as jest.Mock).mockReset();
    (repo.prepararSessaoLocal as jest.Mock).mockResolvedValue({ ok: true, data: true });
  });

  afterEach(() => {
    definirUsuarioLocal(null);
  });

  it('atualizarStatus lê contagens da outbox do usuário logado', () => {
    useSyncStore.getState().atualizarStatus();

    expect(syncModule.obterStatusOutboxViagens).toHaveBeenCalledWith(undefined, 'usuario-1');
    expect(useSyncStore.getState().pendentes).toBe(2);
    expect(useSyncStore.getState().comErro).toBe(1);
    expect(useSyncStore.getState().emRevisao).toBe(3);
  });

  it('setOnline altera o estado de conectividade', () => {
    useSyncStore.getState().setOnline(false);
    expect(useSyncStore.getState().isOnline).toBe(false);

    useSyncStore.getState().setOnline(true);
    expect(useSyncStore.getState().isOnline).toBe(true);
  });

  it('sincronizarTudo chama a sincronização completa (pull + outbox) e marca o sucesso', async () => {
    await useSyncStore.getState().sincronizarTudo();

    expect(syncModule.sincronizarViagens).toHaveBeenCalledWith('usuario-1', {
      geracaoLocal: expect.any(Number),
    });
    expect(useSyncStore.getState().sincronizando).toBe(false);
    expect(useSyncStore.getState().ultimaSincronizacaoEm).not.toBeNull();
    expect(useSyncStore.getState().ultimoErro).toBeNull();
  });

  it('sincronizarOutbox drena apenas a fila do usuário logado', async () => {
    await useSyncStore.getState().sincronizarOutbox();

    expect(syncModule.drenarOutboxViagens).toHaveBeenCalledWith({
      usuarioId: 'usuario-1',
      geracaoLocal: expect.any(Number),
    });
  });

  it('sincronizarTudo não executa se o aparelho estiver offline', async () => {
    useSyncStore.getState().setOnline(false);

    await useSyncStore.getState().sincronizarTudo();

    expect(syncModule.sincronizarViagens).not.toHaveBeenCalled();
    expect(syncModule.drenarOutboxViagens).not.toHaveBeenCalled();
  });

  it('sincronizarTudo não executa sem usuário local', async () => {
    definirUsuarioLocal(null);

    await useSyncStore.getState().sincronizarTudo();

    expect(syncModule.sincronizarViagens).not.toHaveBeenCalled();
  });

  it('startNetworkSyncListener prepara a sessão, registra listener e sincroniza quando a internet volta', async () => {
    let callbackListener:
      | ((estado: { isConnected: boolean; isInternetReachable: boolean }) => Promise<void>)
      | null = null;

    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });

    const mockRemove = jest.fn();
    (Network.addNetworkStateListener as jest.Mock).mockImplementation((cb) => {
      callbackListener = cb;
      return { remove: mockRemove };
    });

    const unsubscribe = startNetworkSyncListener('usuario-1');

    // Aguarda o preparo local e a checagem inicial de rede.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(repo.prepararSessaoLocal).toHaveBeenCalledWith('usuario-1');
    expect(useSyncStore.getState().isOnline).toBe(false);
    expect(syncModule.sincronizarViagens).not.toHaveBeenCalled();

    // Simula a internet voltando (offline -> online).
    expect(callbackListener).not.toBeNull();
    const listener = callbackListener as unknown as (estado: {
      isConnected: boolean;
      isInternetReachable: boolean;
    }) => Promise<void>;
    await listener({ isConnected: true, isInternetReachable: true });

    expect(useSyncStore.getState().isOnline).toBe(true);
    expect(syncModule.sincronizarViagens).toHaveBeenCalledWith('usuario-1', {
      geracaoLocal: expect.any(Number),
    });

    unsubscribe();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('só libera a sessão e sincroniza depois que o preparo local termina', async () => {
    let concluirPreparo:
      | ((resultado: { ok: true; data: true }) => void)
      | undefined;
    (repo.prepararSessaoLocal as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        concluirPreparo = resolve;
      }),
    );
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    const unsubscribe = startNetworkSyncListener('usuario-1');

    for (let i = 0; i < 8; i += 1) await Promise.resolve();

    // Enquanto a limpeza/preparo da conta roda, o layout não pode liberar as telas nem o pull.
    expect(useSyncStore.getState().sessaoLocalUsuario).toBeNull();
    expect(syncModule.sincronizarViagens).not.toHaveBeenCalled();

    concluirPreparo?.({ ok: true, data: true });
    for (let i = 0; i < 12; i += 1) await Promise.resolve();

    expect(useSyncStore.getState().sessaoLocalUsuario).toBe('usuario-1');
    expect(syncModule.sincronizarViagens).toHaveBeenCalledWith('usuario-1', {
      geracaoLocal: expect.any(Number),
    });

    unsubscribe();
  });

  it('expõe o erro do preparo local e mantém a sessão bloqueada', async () => {
    (repo.prepararSessaoLocal as jest.Mock).mockResolvedValue({
      ok: false,
      mensagem: 'Não foi possível preparar os dados locais.',
    });
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    const unsubscribe = startNetworkSyncListener('usuario-1');

    for (let i = 0; i < 10; i += 1) await Promise.resolve();

    expect(useSyncStore.getState().sessaoLocalUsuario).toBeNull();
    expect(useSyncStore.getState().sessaoLocalErro).toEqual({
      usuarioId: 'usuario-1',
      mensagem: 'Não foi possível preparar os dados locais.',
    });
    expect(syncModule.sincronizarViagens).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('startNetworkSyncListener agenda drenagem depois de uma escrita local', async () => {
    jest.useFakeTimers();
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    const unsubscribe = startNetworkSyncListener('usuario-1');
    for (let i = 0; i < 8; i += 1) await Promise.resolve();

    // A escrita local dispara o debounce de 800ms.
    const { notificarEscritaLocal } = jest.requireActual<typeof import('../syncBus')>('../syncBus');
    notificarEscritaLocal();
    jest.advanceTimersByTime(800);
    for (let i = 0; i < 8; i += 1) await Promise.resolve();

    expect(syncModule.drenarOutboxViagens).toHaveBeenCalledWith({
      usuarioId: 'usuario-1',
      geracaoLocal: expect.any(Number),
    });

    unsubscribe();
    jest.useRealTimers();
  });
});
