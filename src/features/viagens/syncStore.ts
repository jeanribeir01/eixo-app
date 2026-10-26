import * as Network from 'expo-network';
import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';

import { prepararSessaoLocal } from './viagensRepository';
import { definirUsuarioLocal, obterGeracaoLocal, obterUsuarioLocal } from './sessaoLocal';
import { aoEscreverLocal } from './syncBus';
import { drenarOutboxViagens, obterStatusOutboxViagens, sincronizarViagens } from './sync';
import { MENSAGEM_SEM_CONEXAO } from './syncErros';

export type SyncState = {
  isOnline: boolean;
  pendentes: number;
  comErro: number;
  emRevisao: number;
  conflitos: number;
  sincronizando: boolean;
  ultimoErro: string | null;
  // Conta cujo cache local já foi preparado. O layout raiz só monta as telas quando este valor
  // é igual à sessão atual, para nunca exibir o cache da conta anterior durante uma troca.
  sessaoLocalUsuario: string | null;
  sessaoLocalErro: { usuarioId: string; mensagem: string } | null;
  // Marca temporal da última sincronização bem-sucedida. As telas locais usam isso para reler o
  // cache quando o pull termina, sem depender de a tela ter ganhado foco de novo.
  ultimaSincronizacaoEm: number | null;
  setOnline: (isOnline: boolean) => void;
  setSincronizando: (sincronizando: boolean) => void;
  atualizarStatus: () => void;
  limparErro: () => void;
  sincronizar: () => Promise<void>;
  sincronizarTudo: () => Promise<void>;
  sincronizarOutbox: () => Promise<void>;
};

let timerNovaTentativa: ReturnType<typeof setTimeout> | null = null;
let tentativasConsecutivas = 0;
let sincronizacaoExtraPendente = false;

function limparTimerNovaTentativa(): void {
  if (timerNovaTentativa) {
    clearTimeout(timerNovaTentativa);
    timerNovaTentativa = null;
  }
}

function agendarNovaTentativa(): void {
  limparTimerNovaTentativa();
  const atraso = Math.min(5_000 * 2 ** Math.min(tentativasConsecutivas, 6), 5 * 60_000);
  timerNovaTentativa = setTimeout(() => {
    timerNovaTentativa = null;
    if (useSyncStore.getState().isOnline) {
      void useSyncStore.getState().sincronizarTudo();
    }
  }, atraso);
}

function finalizarComFalha(mensagem: string | undefined, semConexao: boolean): void {
  tentativasConsecutivas += 1;
  useSyncStore.setState({
    ultimoErro: mensagem ?? MENSAGEM_SEM_CONEXAO,
  });
  if (!semConexao) {
    agendarNovaTentativa();
  }
}

function finalizarComSucesso(): void {
  tentativasConsecutivas = 0;
  limparTimerNovaTentativa();
  useSyncStore.setState({ ultimoErro: null, ultimaSincronizacaoEm: Date.now() });
}

export const useSyncStore = create<SyncState>((set, get) => ({
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

  setOnline: (isOnline: boolean) => set({ isOnline }),

  setSincronizando: (sincronizando: boolean) => set({ sincronizando }),

  atualizarStatus: () => {
    try {
      const status = obterStatusOutboxViagens(undefined, obterUsuarioLocal());
      set({
        pendentes: status.pendentes,
        comErro: status.comErro,
        emRevisao: status.emRevisao,
        conflitos: status.conflitos,
      });
    } catch {
      // Ignora erro se o banco ainda não estiver pronto (ex.: migrations em execução).
    }
  },

  limparErro: () => set({ ultimoErro: null }),

  sincronizar: async () => get().sincronizarTudo(),

  sincronizarTudo: async () => {
    if (get().sincronizando) {
      sincronizacaoExtraPendente = true;
      return;
    }
    const usuarioId = obterUsuarioLocal();
    if (!usuarioId || !get().isOnline) return;

    const geracaoLocal = obterGeracaoLocal();
    set({ sincronizando: true });
    try {
      const resultado = await sincronizarViagens(usuarioId, { geracaoLocal });
      if (obterGeracaoLocal() !== geracaoLocal) return;
      if (!resultado.ok) {
        if (resultado.sessaoAlterada) return;
        finalizarComFalha(resultado.mensagem, resultado.semConexao);
      } else {
        finalizarComSucesso();
      }
    } catch {
      if (obterGeracaoLocal() !== geracaoLocal) return;
      finalizarComFalha('Não foi possível sincronizar. Tente novamente.', false);
    } finally {
      if (obterGeracaoLocal() !== geracaoLocal) return;
      set({ sincronizando: false });
      get().atualizarStatus();
      if (sincronizacaoExtraPendente) {
        sincronizacaoExtraPendente = false;
        void get().sincronizarOutbox();
      }
    }
  },

  sincronizarOutbox: async () => {
    if (get().sincronizando) {
      sincronizacaoExtraPendente = true;
      return;
    }
    const usuarioId = obterUsuarioLocal();
    if (!usuarioId || !get().isOnline) return;

    const geracaoLocal = obterGeracaoLocal();
    set({ sincronizando: true });
    try {
      const resultado = await drenarOutboxViagens({ usuarioId, geracaoLocal });
      if (obterGeracaoLocal() !== geracaoLocal) return;
      get().atualizarStatus();
      if (resultado.sessaoAlterada) return;
      if (resultado.semConexao) {
        finalizarComFalha(MENSAGEM_SEM_CONEXAO, true);
      } else if (resultado.falhas > 0) {
        finalizarComFalha('Alguns registros não foram enviados. Nova tentativa em instantes.', false);
      } else {
        finalizarComSucesso();
      }
    } catch {
      if (obterGeracaoLocal() !== geracaoLocal) return;
      finalizarComFalha('Não foi possível sincronizar. Tente novamente.', false);
    } finally {
      if (obterGeracaoLocal() !== geracaoLocal) return;
      set({ sincronizando: false });
      get().atualizarStatus();
      if (sincronizacaoExtraPendente) {
        sincronizacaoExtraPendente = false;
        void get().sincronizarOutbox();
      }
    }
  },
}));

export function startNetworkSyncListener(usuarioId: string): () => void {
  definirUsuarioLocal(usuarioId);
  const geracaoLocal = obterGeracaoLocal();
  tentativasConsecutivas = 0;
  limparTimerNovaTentativa();
  useSyncStore.setState({ sessaoLocalUsuario: null, sessaoLocalErro: null });

  let encerrado = false;
  let preparoConcluido = false;
  let timerEscrita: ReturnType<typeof setTimeout> | null = null;

  const sessaoAtual = () => !encerrado && obterGeracaoLocal() === geracaoLocal;

  const sincronizarSeOnline = async () => {
    if (!sessaoAtual() || !preparoConcluido) return;
    try {
      const estado = await Network.getNetworkStateAsync();
      if (!sessaoAtual()) return;
      const online = Boolean(estado.isConnected && estado.isInternetReachable !== false);
      useSyncStore.getState().setOnline(online);
      if (online) await useSyncStore.getState().sincronizarTudo();
    } catch {
      // Sem certeza da rede, tenta; o erro do Supabase decide.
      if (sessaoAtual()) await useSyncStore.getState().sincronizarTudo();
    }
  };

  // Prepara o banco para a conta antes de qualquer leitura de tela. A limpeza de uma conta
  // anterior é feita aqui, e não só no logout, para nunca apagar dado se o logout falhar.
  void prepararSessaoLocal(usuarioId)
    .then((preparo) => {
      if (!sessaoAtual()) return;
      if (!preparo.ok) {
        useSyncStore.setState({
          sessaoLocalErro: { usuarioId, mensagem: preparo.mensagem },
          ultimoErro: preparo.mensagem,
        });
        return;
      }

      preparoConcluido = true;
      useSyncStore.setState({ sessaoLocalUsuario: usuarioId, sessaoLocalErro: null });
      useSyncStore.getState().atualizarStatus();
      void sincronizarSeOnline();
    })
    .catch(() => {
      if (!sessaoAtual()) return;
      useSyncStore.setState({
        sessaoLocalErro: {
          usuarioId,
          mensagem: 'Não foi possível preparar os dados locais. Tente novamente.',
        },
      });
    });

  const inscricaoRede = Network.addNetworkStateListener((estado) => {
    if (!sessaoAtual()) return;
    const online = Boolean(estado.isConnected && estado.isInternetReachable !== false);
    const estavaOffline = !useSyncStore.getState().isOnline;
    useSyncStore.getState().setOnline(online);
    if (!preparoConcluido) return;
    useSyncStore.getState().atualizarStatus();
    if (online && estavaOffline) {
      void useSyncStore.getState().sincronizarTudo();
    }
  });

  const inscricaoApp = AppState.addEventListener('change', (estado: AppStateStatus) => {
    if (estado === 'active' && preparoConcluido && sessaoAtual()) {
      if (timerNovaTentativa) {
        limparTimerNovaTentativa();
        tentativasConsecutivas = 0;
      }
      void sincronizarSeOnline();
    }
  });

  // Escrita local não espera o app voltar ao primeiro plano: drena depois de um pequeno debounce
  // para o caso de abertura/fechamento acontecerem em sequência.
  const cancelarEscutaEscrita = aoEscreverLocal(() => {
    if (!sessaoAtual() || !preparoConcluido) return;
    if (timerEscrita) clearTimeout(timerEscrita);
    timerEscrita = setTimeout(() => {
      timerEscrita = null;
      if (sessaoAtual()) void useSyncStore.getState().sincronizarOutbox();
    }, 800);
  });

  return () => {
    encerrado = true;
    preparoConcluido = false;
    if (timerEscrita) clearTimeout(timerEscrita);
    timerEscrita = null;
    limparTimerNovaTentativa();
    inscricaoRede?.remove?.();
    inscricaoApp.remove();
    cancelarEscutaEscrita();
    definirUsuarioLocal(null);
    sincronizacaoExtraPendente = false;
    useSyncStore.setState({
      sincronizando: false,
      ultimoErro: null,
      sessaoLocalUsuario: null,
      sessaoLocalErro: null,
    });
  };
}
