import * as Network from 'expo-network';
import { create } from 'zustand';

import { obterStatusOutbox, sincronizarViagens } from './sync';

// De quanto em quanto tempo, com internet, o app tenta de novo o que ficou pendente (item que
// esperava o backoff, ou que falhou por instabilidade). Só roda se houver pendência.
export const INTERVALO_RETENTATIVA_MS = 30_000;

export type SyncState = {
  isOnline: boolean;
  pendentes: number;
  falhas: number;
  conflitos: number;
  sincronizando: boolean;
  setOnline: (isOnline: boolean) => void;
  atualizarStatus: () => void;
  sincronizar: (opcoes?: { baixar?: boolean }) => Promise<void>;
};

// A sincronização em andamento. Quem pede de novo no meio dela espera a mesma, em vez de voltar
// na hora: a lista que pede "sincronize e depois leia" não pode ler o banco antes de terminar.
let emAndamento: Promise<void> | null = null;

function estaOnline(estado: Network.NetworkState): boolean {
  return Boolean(estado.isConnected && estado.isInternetReachable !== false);
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: true,
  pendentes: 0,
  falhas: 0,
  conflitos: 0,
  sincronizando: false,

  setOnline: (isOnline) => set({ isOnline }),

  atualizarStatus: () => {
    try {
      set(obterStatusOutbox());
    } catch {
      // Banco ainda não aberto (migrations rodando na abertura do app): mantém os números atuais.
    }
  },

  sincronizar: (opcoes) => {
    if (emAndamento) return emAndamento;
    if (!get().isOnline) return Promise.resolve();

    set({ sincronizando: true });
    emAndamento = sincronizarViagens(opcoes)
      .then(() => undefined)
      .catch(() => {
        // O que não subiu continua na outbox com o motivo; a tela mostra pelos contadores.
      })
      .finally(() => {
        emAndamento = null;
        set({ sincronizando: false });
        get().atualizarStatus();
      });
    return emAndamento;
  },
}));

// Para a tela chamar depois de abrir ou fechar uma viagem: com internet, sobe na hora, sem
// esperar a conexão cair e voltar. Sem internet, só atualiza o contador de pendências.
export function pedirSincronizacao(): void {
  useSyncStore.getState().atualizarStatus();
  void useSyncStore.getState().sincronizar();
}

export function startNetworkSyncListener(): () => void {
  // Estado inicial na abertura do app.
  Network.getNetworkStateAsync()
    .then((estado) => {
      useSyncStore.getState().setOnline(estaOnline(estado));
      pedirSincronizacao();
    })
    .catch(() => {
      useSyncStore.getState().atualizarStatus();
    });

  // A internet voltou: sobe o que ficou guardado.
  const subscription = Network.addNetworkStateListener((estado) => {
    const isOnline = estaOnline(estado);
    const estavaOffline = !useSyncStore.getState().isOnline;

    useSyncStore.getState().setOnline(isOnline);
    useSyncStore.getState().atualizarStatus();

    if (isOnline && estavaOffline) {
      void useSyncStore.getState().sincronizar();
    }
  });

  // Retentativa: só envia (não baixa tudo de novo) e só quando há o que enviar.
  const timer = setInterval(() => {
    const { isOnline, pendentes, sincronizar } = useSyncStore.getState();
    if (isOnline && pendentes > 0) {
      void sincronizar({ baixar: false });
    }
  }, INTERVALO_RETENTATIVA_MS);

  return () => {
    subscription.remove();
    clearInterval(timer);
  };
}
