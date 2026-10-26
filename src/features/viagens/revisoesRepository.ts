import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { supabase } from '@/supabase/client';
import type { Database } from '@/types/database';

import { resolverRevisaoSchema, revisaoViagemSchema } from './schema';
import type { Resultado, RevisaoViagem } from './types';

// Fila de revisão das viagens que o servidor recusou (EIX-41). O RLS de `viagem_revisao` decide
// quem lê e quem resolve: o app só oferece a tela para Admin/Gestor.
const COLUNAS =
  'id, viagem_id, solicitante_id, motorista_id, motorista_nome, veiculo_id, veiculo_placa, rota_id, rota_trecho, codigo, mensagem, payload, status, observacao, resolvido_por, resolvido_em, data_inclusao, data_atualizacao';

const MENSAGEM_FALHA_LISTA = 'Não foi possível carregar as revisões. Tente novamente.';
const MENSAGEM_FALHA_CONTAGEM = 'Não foi possível contar as revisões pendentes.';
const MENSAGEM_FALHA_RESOLVER = 'Não foi possível salvar a decisão da revisão. Tente novamente.';
const MENSAGEM_NAO_ENCONTRADA = 'Revisão não encontrada ou já resolvida.';

type ErroSupabase = { code?: string; message?: string } | null;

function falha(error: ErroSupabase, mensagemPadrao: string): { ok: false; mensagem: string } {
  if (error && ehAcessoNegado({ code: error.code ?? '' })) {
    return { ok: false, mensagem: MENSAGEM_ACESSO_NEGADO };
  }
  return { ok: false, mensagem: mensagemPadrao };
}

export async function contarRevisoesPendentes(): Promise<Resultado<number>> {
  try {
    const { count, error } = await supabase
      .from('viagem_revisao')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Pendente');

    if (error) return falha(error, MENSAGEM_FALHA_CONTAGEM);
    return { ok: true, data: count ?? 0 };
  } catch {
    return { ok: false, mensagem: MENSAGEM_FALHA_CONTAGEM };
  }
}

export async function listarRevisoesPendentes(): Promise<Resultado<RevisaoViagem[]>> {
  try {
    const { data, error } = await supabase
      .from('viagem_revisao')
      .select(COLUNAS)
      .eq('status', 'Pendente')
      .order('data_inclusao', { ascending: false })
      .limit(100);

    if (error) return falha(error, MENSAGEM_FALHA_LISTA);

    const revisoes: RevisaoViagem[] = [];
    for (const linha of data ?? []) {
      const parsed = revisaoViagemSchema.safeParse(linha);
      if (!parsed.success) {
        return { ok: false, mensagem: 'Os dados recebidos das revisões são inválidos.' };
      }
      revisoes.push(parsed.data);
    }

    return { ok: true, data: revisoes };
  } catch {
    return { ok: false, mensagem: MENSAGEM_FALHA_LISTA };
  }
}

export async function buscarRevisao(id: string): Promise<Resultado<RevisaoViagem>> {
  try {
    const { data, error } = await supabase
      .from('viagem_revisao')
      .select(COLUNAS)
      .eq('id', id)
      .maybeSingle();

    if (error) return falha(error, MENSAGEM_FALHA_LISTA);
    if (!data) return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADA };

    const parsed = revisaoViagemSchema.safeParse(data);
    return parsed.success
      ? { ok: true, data: parsed.data }
      : { ok: false, mensagem: 'Os dados recebidos da revisão são inválidos.' };
  } catch {
    return { ok: false, mensagem: MENSAGEM_FALHA_LISTA };
  }
}

export type ResolverRevisaoInput = {
  status: Extract<Database['public']['Enums']['status_revisao'], 'Resolvida' | 'Descartada'>;
  observacao?: string;
};

export async function resolverRevisao(
  id: string,
  input: ResolverRevisaoInput,
): Promise<Resultado<RevisaoViagem>> {
  const parsed = resolverRevisaoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      mensagem: parsed.error.issues[0]?.message ?? 'Decisão inválida para a revisão.',
    };
  }

  try {
    const { data, error } = await supabase
      .from('viagem_revisao')
      .update({
        status: parsed.data.status,
        observacao: parsed.data.observacao?.trim() ? parsed.data.observacao.trim() : null,
      })
      .eq('id', id)
      .eq('status', 'Pendente')
      .select(COLUNAS)
      .maybeSingle();

    if (error) return falha(error, MENSAGEM_FALHA_RESOLVER);
    if (!data) return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADA };

    const validado = revisaoViagemSchema.safeParse(data);
    return validado.success
      ? { ok: true, data: validado.data }
      : { ok: false, mensagem: 'Os dados recebidos da revisão são inválidos.' };
  } catch {
    return { ok: false, mensagem: MENSAGEM_FALHA_RESOLVER };
  }
}

export const revisoesRepository = {
  contarRevisoesPendentes,
  listarRevisoesPendentes,
  buscarRevisao,
  resolverRevisao,
};
