import { z } from 'zod';
import { create } from 'zustand';

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

export async function carregarPerfil(usuarioId: string): Promise<void> {
  useProfileStore.setState({ usuarioId, estado: 'carregando' });

  // A policy usuario_select deixa cada conta ler a própria linha mesmo sem aprovação — é
  // assim que a tela de "aguardando liberação" sabe se está pendente ou bloqueada.
  const { data, error } = await supabase
    .from('usuario')
    .select('id, nome, email, status, perfil:perfil_id(nome)')
    .eq('id', usuarioId)
    .maybeSingle();

  // Logout (ou troca de conta) durante a requisição: a resposta não é mais desta sessão.
  if (useProfileStore.getState().usuarioId !== usuarioId) return;

  if (error) {
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
