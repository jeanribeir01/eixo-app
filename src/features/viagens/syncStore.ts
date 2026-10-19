import * as Network from 'expo-network';
import { create } from 'zustand';

import { drenarOutboxViagens, obterStatusOutboxViagens } from './sync';

export type SyncState = {
  isOnline: boolean;
  pendentes: number;
  comErro: number;
  conflitos: number;
  sincronizando: boolean;
  setOnline: (isOnline: boolean) => void;
  setSincronizando: (sincronizando: boolean) => void;
  atualizarStatus: () => void;
  sincronizar: () => Promise<void>;
};

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: true,
  pendentes: 0,
  comErro: 0,
  conflitos: 0,
  sincronizando: false,

  setOnline: (isOnline: boolean) => set({ isOnline }),

  setSincronizando: (sincronizando: boolean) => set({ sincronizando }),

  atualizarStatus: () => {
    try {
      const status = obterStatusOutboxViagens();
      set({
        pendentes: status.pendentes,
        comErro: status.comErro,
        conflitos: status.conflitos,
      });
    } catch {
      // Ignora erro se o banco ainda não estiver pronto (ex.: migrations em execução)
    }
  },

  sincronizar: async () => {
    if (get().sincronizando || !get().isOnline) return;

    set({ sincronizando: true });
    try {
      await drenarOutboxViagens();
    } catch {
      // Ignora erro inesperado durante drenagem automática
    } finally {
      set({ sincronizando: false });
      get().atualizarStatus();
    }
  },
}));

export function startNetworkSyncListener(): () => void {
  // Estado inicial de conectividade na abertura da aplicação
  Network.getNetworkStateAsync()
    .then((estado) => {
      const isOnline = Boolean(estado.isConnected && estado.isInternetReachable !== false);
      useSyncStore.getState().setOnline(isOnline);
      useSyncStore.getState().atualizarStatus();

      if (isOnline) {
        useSyncStore.getState().sincronizar();
      }
    })
    .catch(() => {
      useSyncStore.getState().atualizarStatus();
    });

  // Listener para transições de conectividade
  const subscription = Network.addNetworkStateListener(async (estado) => {
    const isOnline = Boolean(estado.isConnected && estado.isInternetReachable !== false);
    const estavaOffline = !useSyncStore.getState().isOnline;

    useSyncStore.getState().setOnline(isOnline);
    useSyncStore.getState().atualizarStatus();

    // Dispara a sincronização automática quando a internet volta
    if (isOnline && estavaOffline) {
      await useSyncStore.getState().sincronizar();
    }
  });

  return () => {
    subscription?.remove?.();
  };
}
