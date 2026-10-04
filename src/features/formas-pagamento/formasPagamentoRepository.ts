import { z } from 'zod';

import { supabase } from '@/supabase/client';

import type { FormaPagamento } from './types';

export type Resultado<T> = { ok: true; data: T } | { ok: false; mensagem: string };

const COLUNAS = 'id, nome, ativa';
const LIMITE_LISTA = 500;

const MENSAGEM_DUPLICADA = 'Já existe uma forma de pagamento com esse nome.';
const MENSAGEM_NAO_ENCONTRADA = 'Forma de pagamento não encontrada.';
const MENSAGEM_DADOS_INVALIDOS = 'Os dados recebidos são inválidos. Tente novamente.';

const dbSchema = z.object({
  id: z.string(),
  nome: z.string(),
  ativa: z.boolean(),
});

type ErroSupabase = { code: string };

function traduzirErro(error: ErroSupabase, mensagemPadrao: string): string {
  if (error.code === '23505') return MENSAGEM_DUPLICADA;
  if (error.code === '42501') return 'Você não tem permissão para alterar formas de pagamento.';
  return mensagemPadrao;
}

function normalizarNome(nome: string): string {
  return nome.trim().toLowerCase();
}

async function existeDuplicada(
  nome: string,
  ignorarId?: string,
): Promise<Resultado<boolean>> {
  const { data, error } = await supabase.from('forma_pagamento').select('id, nome');

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível salvar a forma de pagamento. Tente novamente.') };
  }

  const normalizado = normalizarNome(nome);
  const duplicada = data.some(
    (item) => item.id !== ignorarId && normalizarNome(item.nome) === normalizado,
  );
  return { ok: true, data: duplicada };
}

function validar(data: unknown): Resultado<FormaPagamento> {
  const parsed = dbSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  }
  return { ok: true, data: parsed.data };
}

export async function buscarFormaPagamentoPorId(id: string): Promise<Resultado<FormaPagamento>> {
  const { data, error } = await supabase.from('forma_pagamento').select(COLUNAS).eq('id', id).maybeSingle();

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível carregar a forma de pagamento. Tente novamente.') };
  }
  if (!data) {
    return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADA };
  }

  return validar(data);
}

export async function listarFormasPagamento(): Promise<Resultado<FormaPagamento[]>> {
  const { data, error } = await supabase
    .from('forma_pagamento')
    .select(COLUNAS)
    .order('nome')
    .limit(LIMITE_LISTA);

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível carregar as formas de pagamento. Tente novamente.') };
  }

  const parsed = z.array(dbSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  }

  return { ok: true, data: parsed.data };
}

export async function criarFormaPagamento(input: { nome: string }): Promise<Resultado<FormaPagamento>> {
  const duplicada = await existeDuplicada(input.nome);
  if (!duplicada.ok) return duplicada;
  if (duplicada.data) {
    return { ok: false, mensagem: MENSAGEM_DUPLICADA };
  }

  const { data, error } = await supabase
    .from('forma_pagamento')
    .insert({ nome: input.nome.trim() })
    .select(COLUNAS)
    .single();

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível criar a forma de pagamento. Tente novamente.') };
  }

  return validar(data);
}

export async function atualizarFormaPagamento(
  id: string,
  input: { nome: string },
): Promise<Resultado<FormaPagamento>> {
  const duplicada = await existeDuplicada(input.nome, id);
  if (!duplicada.ok) return duplicada;
  if (duplicada.data) {
    return { ok: false, mensagem: MENSAGEM_DUPLICADA };
  }

  const { data, error } = await supabase
    .from('forma_pagamento')
    .update({ nome: input.nome.trim() })
    .eq('id', id)
    .select(COLUNAS)
    .maybeSingle();

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível atualizar a forma de pagamento. Tente novamente.') };
  }
  if (!data) {
    return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADA };
  }

  return validar(data);
}

export async function definirAtivaFormaPagamento(id: string, ativa: boolean): Promise<Resultado<FormaPagamento>> {
  const { data, error } = await supabase
    .from('forma_pagamento')
    .update({ ativa })
    .eq('id', id)
    .select(COLUNAS)
    .maybeSingle();

  if (error) {
    const acao = ativa ? 'reativar' : 'desativar';
    return { ok: false, mensagem: traduzirErro(error, `Não foi possível ${acao} a forma de pagamento. Tente novamente.`) };
  }
  if (!data) {
    return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADA };
  }

  return validar(data);
}
