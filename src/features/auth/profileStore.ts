import * as Network from 'expo-network';
import { z } from 'zod';
import { create } from 'zustand';

import { ehErroConexao } from '@/features/viagens/syncErros';
import { lerPerfilDoCacheLocal } from '@/features/viagens/viagensRepository';
import { supabase } from '@/supabase/client';
import { Constants } from '@/types/database';

import { canSeeFinanceiro, canSeeFrota, isAdmin, isAprovado, type PerfilNome, type StatusUsuario } from './permissions';

export type UsuarioLogado = {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilNome;
  status: StatusUsuario;
};

export type EstadoPerfil = 'carregando' | 'pronto' | 'erro';

type ProfileState = {
  // id da conta cujo perfil está (ou estava sendo) carregado; serve para descartar respostas
  // atrasadas de uma conta que já saiu.
  usuarioId: string | null;
  usuario: UsuarioLogado | null;
  estado: EstadoPerfil;
};

const estadoInicial: ProfileState = { usuarioId: null, usuario: null, estado: 'carregando' };

export const useProfileStore = create<ProfileState>(() => estadoInicial);

// O perfil chega pela relação usuario.perfil_id → perfil; o Zod garante o formato e que o
// nome do perfil e o status são valores conhecidos dos enums gerados.
const usuarioSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string(),
  status: z.enum(Constants.public.Enums.status_usuario),
  perfil: z.object({ nome: z.enum(Constants.public.Enums.perfil_nome) }),
});

// Perfil carregado do cache local (sem internet) é revalidado assim que a rede volta: um bloqueio
// feito pelo Admin enquanto o aparelho estava offline passa a valer na reconexão.
let cancelarRevalidacao: (() => void) | null = null;

function pararRevalidacao(): void {
  cancelarRevalidacao?.();
  cancelarRevalidacao = null;
}

function revalidarQuandoOnline(usuarioId: string): void {
  pararRevalidacao();
  const inscricao = Network.addNetworkStateListener((estado) => {
    if (!estado.isConnected || estado.isInternetReachable === false) return;
    pararRevalidacao();
    void carregarPerfil(usuarioId, { silencioso: true });
  });
  cancelarRevalidacao = () => inscricao?.remove?.();
}

function usarPerfilDoCache(usuarioId: string): boolean {
  const cache = lerPerfilDoCacheLocal(usuarioId);
  if (!cache) return false;

  const parsed = usuarioSchema.safeParse({ ...cache, perfil: { nome: cache.perfil } });
  if (!parsed.success) return false;

  const { perfil, ...resto } = parsed.data;
  useProfileStore.setState({ usuario: { ...resto, perfil: perfil.nome }, estado: 'pronto' });
  revalidarQuandoOnline(usuarioId);
  return true;
}

/**
 * Carrega o perfil da conta. Sem internet, usa o perfil salvo no último sync (RNF01): o motorista
 * que abre o app na cabine, sem sinal, continua entrando na rotina de viagem. A decisão de acesso
 * no cliente é só navegação; o RLS segue decidindo no servidor.
 *
 * `silencioso` revalida sem voltar a tela para "carregando" (a área do app não desmonta) e, se a
 * rede cair de novo, mantém o perfil que já estava em uso.
 */
export async function carregarPerfil(
  usuarioId: string,
  opcoes: { silencioso?: boolean } = {},
): Promise<void> {
  if (!opcoes.silencioso) {
    pararRevalidacao();
    useProfileStore.setState({ usuarioId, estado: 'carregando' });
  }

  // A policy usuario_select deixa cada conta ler a própria linha mesmo sem aprovação — é
  // assim que a tela de "aguardando liberação" sabe se está pendente ou bloqueada.
  let data: unknown = null;
  let error: { code?: string; message?: string } | null = null;
  try {
    const resposta = await supabase
      .from('usuario')
      .select('id, nome, email, status, perfil:perfil_id(nome)')
      .eq('id', usuarioId)
      .maybeSingle();
    data = resposta.data;
    error = resposta.error;
  } catch (erro) {
    error = { message: erro instanceof Error ? erro.message : String(erro) };
  }

  // Logout (ou troca de conta) durante a requisição: a resposta não é mais desta sessão.
  if (useProfileStore.getState().usuarioId !== usuarioId) return;

  if (error) {
    const semConexao = ehErroConexao(error);
    if (opcoes.silencioso) {
      // Revalidação: a rede caiu de novo. Mantém o perfil em uso e espera a próxima reconexão.
      if (semConexao) revalidarQuandoOnline(usuarioId);
      return;
    }
    if (semConexao && usarPerfilDoCache(usuarioId)) return;
    useProfileStore.setState({ usuario: null, estado: 'erro' });
    return;
  }

  // Sem linha em usuario: trata como não aprovado (deny-by-default), não como erro.
  if (!data) {
    useProfileStore.setState({ usuario: null, estado: 'pronto' });
    return;
  }

  const parsed = usuarioSchema.safeParse(data);
  if (!parsed.success) {
    useProfileStore.setState({ usuario: null, estado: 'erro' });
    return;
  }

  const { perfil, ...resto } = parsed.data;
  useProfileStore.setState({ usuario: { ...resto, perfil: perfil.nome }, estado: 'pronto' });
}

// Chamado no logout: a próxima conta não pode herdar o perfil da anterior.
export function limparPerfil(): void {
  pararRevalidacao();
  useProfileStore.setState(estadoInicial);
}

export async function recarregarPerfil(): Promise<void> {
  const { usuarioId } = useProfileStore.getState();
  if (usuarioId) await carregarPerfil(usuarioId);
}

// API de perfil que as telas (e as US17/US18) consomem. Seleciona campos separados do store:
// devolver um objeto novo no seletor faria o Zustand re-renderizar em loop.
export function useProfile() {
  const usuario = useProfileStore((state) => state.usuario);
  const estado = useProfileStore((state) => state.estado);

  return {
    usuario,
    estado,
    isAprovado: isAprovado(usuario),
    isAdmin: isAdmin(usuario),
    canSeeFinanceiro: canSeeFinanceiro(usuario),
    canSeeFrota: canSeeFrota(usuario),
    recarregar: recarregarPerfil,
  };
}
