import { z } from 'zod';

import type { StatusUsuario } from '@/features/auth/permissions';
import { supabase } from '@/supabase/client';
import { Constants } from '@/types/database';

import type { Perfil, Usuario } from './types';

// Acesso a dados da tela de usuários (US16). Só o Admin lê todos e grava: quem decide são as
// policies de `usuario` (EIX-27) e o trigger que impede alterar o próprio perfil/status (EIX-30).

export type Resultado<T> = { ok: true; data: T } | { ok: false; mensagem: string };

const COLUNAS = 'id, nome, email, status, perfil:perfil_id(id, nome)';

// Equipe de uma transportadora cabe folgado aqui; o limite só impede resposta sem teto.
const LIMITE_LISTA = 500;

const MENSAGEM_DADOS_INVALIDOS = 'Os dados recebidos são inválidos. Tente novamente.';
const MENSAGEM_NAO_ENCONTRADO = 'Usuário não encontrado.';

const perfilSchema = z.object({
  id: z.string(),
  nome: z.enum(Constants.public.Enums.perfil_nome),
});

const usuarioSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string(),
  status: z.enum(Constants.public.Enums.status_usuario),
  perfil: perfilSchema,
});

type ErroSupabase = { code: string };

// Nunca mostra `error.message` do Postgres: traduz o código que a tela sabe explicar.
function traduzirErro(error: ErroSupabase, mensagemPadrao: string): string {
  // 42501 = insufficient_privilege: o trigger da EIX-30 recusou alterar o próprio perfil/status.
  if (error.code === '42501') return 'Você não pode alterar o próprio perfil ou status.';
  return mensagemPadrao;
}

function validarUsuario(data: unknown): Resultado<Usuario> {
  const parsed = usuarioSchema.safeParse(data);
  if (!parsed.success) return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  return { ok: true, data: parsed.data };
}

export async function listarUsuarios(): Promise<Resultado<Usuario[]>> {
  const { data, error } = await supabase.from('usuario').select(COLUNAS).order('nome').limit(LIMITE_LISTA);

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível carregar os usuários. Tente novamente.') };
  }

  const parsed = z.array(usuarioSchema).safeParse(data);
  if (!parsed.success) return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };

  return { ok: true, data: parsed.data };
}

export async function buscarUsuarioPorId(id: string): Promise<Resultado<Usuario>> {
  const { data, error } = await supabase.from('usuario').select(COLUNAS).eq('id', id).maybeSingle();

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível carregar o usuário. Tente novamente.') };
  }
  // Sem linha também é o que o RLS devolve para quem não pode ler: para a tela, "não encontrado".
  if (!data) return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADO };

  return validarUsuario(data);
}

export async function listarPerfis(): Promise<Resultado<Perfil[]>> {
  const { data, error } = await supabase.from('perfil').select('id, nome').order('nome');

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível carregar os perfis. Tente novamente.') };
  }

  const parsed = z.array(perfilSchema).safeParse(data);
  if (!parsed.success) return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };

  return { ok: true, data: parsed.data };
}

// Update de uma linha só, sem efeito em outra tabela: vai direto pelo supabase-js (sem RPC).
async function atualizarUsuario(
  id: string,
  alteracao: { perfil_id: string } | { status: StatusUsuario },
  mensagemPadrao: string,
): Promise<Resultado<Usuario>> {
  const { data, error } = await supabase.from('usuario').update(alteracao).eq('id', id).select(COLUNAS).maybeSingle();

  if (error) return { ok: false, mensagem: traduzirErro(error, mensagemPadrao) };
  // Update recusado pelo RLS não dá erro: volta sem linha.
  if (!data) return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADO };

  return validarUsuario(data);
}

export function alterarPerfilUsuario(id: string, perfilId: string): Promise<Resultado<Usuario>> {
  return atualizarUsuario(id, { perfil_id: perfilId }, 'Não foi possível alterar o perfil. Tente novamente.');
}

export function alterarStatusUsuario(id: string, status: StatusUsuario): Promise<Resultado<Usuario>> {
  return atualizarUsuario(id, { status }, 'Não foi possível alterar o status. Tente novamente.');
}
