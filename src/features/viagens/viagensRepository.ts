import { z } from 'zod';

import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { supabase } from '@/supabase/client';
import { Constants, type Database } from '@/types/database';

import type {
  CampoErroViagem,
  CorrigirHodometroFinalInput,
  FecharViagemInput,
  FiltroViagens,
  NovaViagemInput,
  Resultado,
  Viagem,
  ViagemDetalhada,
  ViagensRepository,
} from './types';

// Camada de acesso a dados isolada da tela (AGENTS.md §2.3, skill supabase-query).
// As telas usam esta interface mantendo paridade exata com as colunas do banco,
// preparando a futura migração offline-first (EIX-41).

export const COLUNAS_VIAGEM =
  'id, veiculo_id, rota_id, motorista_id, hodometro_inicial, hodometro_final, data_inicio, data_fim, status, km_rodado, data_inclusao, data_atualizacao';

export const COLUNAS_DETALHADAS =
  `${COLUNAS_VIAGEM}, ` +
  'veiculo:veiculo_id (id, placa, marca, modelo, status), ' +
  'rota:rota_id (id, cidade_origem, uf_origem, cidade_destino, uf_destino, distancia_estimada_km), ' +
  'motorista:usuario!viagem_motorista_id_fkey (id, nome, email)';

// Mensagens amigáveis para cada erro do banco (EIX-76 / migration 20261015000100_viagem_regras.sql).
// O texto técnico do banco ou SQLSTATE nunca é exposto diretamente ao usuário.
export const MENSAGENS_ERRO_VIAGEM = {
  VG001: 'Este veículo já está em uma viagem em andamento.',
  '23505': 'Este veículo já está em uma viagem em andamento.',
  VG002: 'Veículo em manutenção não pode sair em viagem.',
  VG003: 'Veículo inativo não pode sair em viagem.',
  VG004: 'O hodômetro inicial não pode ser menor que o último hodômetro final do veículo.',
  VG005: 'Viagem encerrada não pode ser alterada.',
  VG006: 'O veículo de uma viagem não pode ser trocado.',
  VG007: 'O hodômetro final corrigido não pode ser maior que o hodômetro inicial de uma viagem posterior.',
  '23514': 'O hodômetro final deve ser maior que o hodômetro inicial.',
  '42501': MENSAGEM_ACESSO_NEGADO,
  '428C9': 'A quilometragem rodada é calculada automaticamente e não pode ser informada.',
} as const;

export const CAMPOS_ERRO_VIAGEM: Record<string, CampoErroViagem> = {
  VG001: 'veiculo_id',
  '23505': 'veiculo_id',
  VG002: 'veiculo_id',
  VG003: 'veiculo_id',
  VG004: 'hodometro_inicial',
  VG005: 'status',
  VG006: 'veiculo_id',
  VG007: 'hodometro_final',
  '23514': 'hodometro_final',
};

type ErroSupabase = { code: string; message?: string };
type Falha = Extract<Resultado<never>, { ok: false }>;

export function traduzirErroBanco(error: ErroSupabase, mensagemPadrao: string): Falha {
  const codigo = error.code as keyof typeof MENSAGENS_ERRO_VIAGEM;

  if (ehAcessoNegado(error)) {
    return { ok: false, mensagem: MENSAGEM_ACESSO_NEGADO, codigo: '42501' };
  }

  if (codigo in MENSAGENS_ERRO_VIAGEM) {
    return {
      ok: false,
      mensagem: MENSAGENS_ERRO_VIAGEM[codigo],
      campo: CAMPOS_ERRO_VIAGEM[error.code],
      codigo: error.code,
    };
  }

  return { ok: false, mensagem: mensagemPadrao, codigo: error.code };
}

// Schemas Zod com validação rigorosa e mensagens amigáveis em português
export const abrirViagemSchema = z.object({
  id: z.string().optional(),
  veiculo_id: z.string().min(1, 'Selecione um veículo.'),
  rota_id: z.string().min(1, 'Selecione uma rota.'),
  motorista_id: z.string().min(1, 'Motorista obrigatório.'),
  hodometro_inicial: z
    .number('Informe um número para o hodômetro inicial.')
    .nonnegative('O hodômetro inicial não pode ser negativo.'),
  data_inicio: z.string().optional().nullable(),
});

export const fecharViagemSchema = z.object({
  hodometro_final: z
    .number('Informe um número para o hodômetro final.')
    .positive('O hodômetro final deve ser maior que zero.'),
  data_fim: z.string().optional().nullable(),
});

export const corrigirHodometroFinalSchema = z.object({
  hodometro_final: z
    .number('Informe um número para o hodômetro final.')
    .positive('O hodômetro final deve ser maior que zero.'),
});

export const veiculoResumoSchema = z.object({
  id: z.string(),
  placa: z.string(),
  marca: z.string(),
  modelo: z.string(),
  status: z.enum(Constants.public.Enums.status_veiculo),
});

export const rotaResumoSchema = z.object({
  id: z.string(),
  cidade_origem: z.string(),
  uf_origem: z.enum(Constants.public.Enums.uf),
  cidade_destino: z.string(),
  uf_destino: z.enum(Constants.public.Enums.uf),
  distancia_estimada_km: z.number(),
});

export const motoristaResumoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string().optional().nullable(),
});

export const viagemSchema = z.object({
  id: z.string(),
  veiculo_id: z.string(),
  rota_id: z.string(),
  motorista_id: z.string(),
  hodometro_inicial: z.number(),
  hodometro_final: z.number().nullable(),
  data_inicio: z.string().nullable(),
  data_fim: z.string().nullable(),
  status: z.enum(Constants.public.Enums.status_viagem),
  km_rodado: z.number().nullable(),
  data_inclusao: z.string(),
  data_atualizacao: z.string(),
});

function normalizarRelacao<T>(valor: unknown): T | null | undefined {
  if (Array.isArray(valor)) {
    return (valor[0] as T) ?? null;
  }
  return (valor as T) ?? null;
}

export const viagemDetalhadaSchema = viagemSchema.extend({
  veiculo: z.preprocess(normalizarRelacao, veiculoResumoSchema.optional().nullable()),
  rota: z.preprocess(normalizarRelacao, rotaResumoSchema.optional().nullable()),
  motorista: z.preprocess(normalizarRelacao, motoristaResumoSchema.optional().nullable()),
});

function validarViagem(data: unknown): Resultado<Viagem> {
  const parsed = viagemSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: 'Os dados da viagem recebidos são inválidos.' };
  }
  return { ok: true, data: parsed.data };
}

function validarViagemDetalhada(data: unknown): Resultado<ViagemDetalhada> {
  const parsed = viagemDetalhadaSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: 'Os dados detalhados da viagem recebidos são inválidos.' };
  }
  return { ok: true, data: parsed.data };
}

export async function listarViagens(filtro: FiltroViagens = {}): Promise<Resultado<ViagemDetalhada[]>> {
  let query = supabase
    .from('viagem')
    .select(COLUNAS_DETALHADAS)
    .order('data_inclusao', { ascending: false })
    .limit(filtro.limite ?? 100);

  if (filtro.status && filtro.status !== 'Todos') {
    query = query.eq('status', filtro.status);
  }

  if (filtro.veiculo_id) {
    query = query.eq('veiculo_id', filtro.veiculo_id);
  }

  if (filtro.motorista_id) {
    query = query.eq('motorista_id', filtro.motorista_id);
  }

  const { data, error } = await query;

  if (error) {
    return traduzirErroBanco(error, 'Não foi possível carregar as viagens. Tente novamente.');
  }

  const viagens: ViagemDetalhada[] = [];
  for (const item of data ?? []) {
    const validado = validarViagemDetalhada(item);
    if (!validado.ok) {
      return validado;
    }
    viagens.push(validado.data);
  }

  return { ok: true, data: viagens };
}

export async function buscarViagemPorId(id: string): Promise<Resultado<ViagemDetalhada>> {
  const { data, error } = await supabase.from('viagem').select(COLUNAS_DETALHADAS).eq('id', id).maybeSingle();

  if (error) {
    return traduzirErroBanco(error, 'Não foi possível carregar a viagem. Tente novamente.');
  }

  if (!data) {
    return { ok: false, mensagem: 'Viagem não encontrada.' };
  }

  return validarViagemDetalhada(data);
}

export async function buscarUltimoHodometro(veiculo_id: string): Promise<Resultado<number | null>> {
  const { data, error } = await supabase
    .from('viagem')
    .select('hodometro_final')
    .eq('veiculo_id', veiculo_id)
    .not('hodometro_final', 'is', null)
    .order('hodometro_final', { ascending: false })
    .limit(1);

  if (error) {
    return traduzirErroBanco(error, 'Não foi possível consultar o último hodômetro do veículo.');
  }

  if (!data || data.length === 0 || data[0]?.hodometro_final === null) {
    return { ok: true, data: null };
  }

  return { ok: true, data: Number(data[0].hodometro_final) };
}

export async function buscarViagemEmAndamento(veiculo_id: string): Promise<Resultado<Viagem | null>> {
  const { data, error } = await supabase
    .from('viagem')
    .select(COLUNAS_VIAGEM)
    .eq('veiculo_id', veiculo_id)
    .eq('status', 'EmAndamento')
    .maybeSingle();

  if (error) {
    return traduzirErroBanco(error, 'Não foi possível consultar as viagens do veículo.');
  }

  if (!data) {
    return { ok: true, data: null };
  }

  return validarViagem(data);
}

export async function abrirViagem(input: NovaViagemInput): Promise<Resultado<Viagem>> {
  const parsed = abrirViagemSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      mensagem: issue?.message ?? 'Dados inválidos para abertura de viagem.',
      campo: issue?.path[0] as CampoErroViagem,
    };
  }

  const payload: Database['public']['Tables']['viagem']['Insert'] = {
    veiculo_id: input.veiculo_id,
    rota_id: input.rota_id,
    motorista_id: input.motorista_id,
    hodometro_inicial: input.hodometro_inicial,
    data_inicio: input.data_inicio ?? new Date().toISOString(),
    status: 'EmAndamento',
  };

  if (input.id) {
    payload.id = input.id;
  }

  const { data, error } = await supabase
    .from('viagem')
    .insert(payload)
    .select(COLUNAS_VIAGEM)
    .single();

  if (error) {
    return traduzirErroBanco(error, 'Não foi possível abrir a viagem. Tente novamente.');
  }

  return validarViagem(data);
}

export async function fecharViagem(id: string, input: FecharViagemInput): Promise<Resultado<Viagem>> {
  const parsed = fecharViagemSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      mensagem: issue?.message ?? 'Dados inválidos para fechamento de viagem.',
      campo: issue?.path[0] as CampoErroViagem,
    };
  }

  const payload = {
    status: 'Finalizada' as const,
    hodometro_final: input.hodometro_final,
    data_fim: input.data_fim ?? new Date().toISOString(),
  };

  const { data, error } = await supabase.from('viagem').update(payload).eq('id', id).select(COLUNAS_VIAGEM).maybeSingle();

  if (error) {
    return traduzirErroBanco(error, 'Não foi possível fechar a viagem. Tente novamente.');
  }

  if (!data) {
    return { ok: false, mensagem: 'Viagem não encontrada.' };
  }

  return validarViagem(data);
}

export async function cancelarViagem(
  id: string,
  options?: { hodometro_final?: number | null },
): Promise<Resultado<Viagem>> {
  const payload: Database['public']['Tables']['viagem']['Update'] = {
    status: 'Cancelada',
    data_fim: new Date().toISOString(),
  };

  if (options?.hodometro_final !== undefined) {
    payload.hodometro_final = options.hodometro_final;
  }

  const { data, error } = await supabase.from('viagem').update(payload).eq('id', id).select(COLUNAS_VIAGEM).maybeSingle();

  if (error) {
    return traduzirErroBanco(error, 'Não foi possível cancelar a viagem. Tente novamente.');
  }

  if (!data) {
    return { ok: false, mensagem: 'Viagem não encontrada.' };
  }

  return validarViagem(data);
}

export async function corrigirHodometroFinal(
  id: string,
  dados: CorrigirHodometroFinalInput,
): Promise<Resultado<Viagem>> {
  const parsed = corrigirHodometroFinalSchema.safeParse(dados);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      mensagem: issue?.message ?? 'Hodômetro final inválido.',
      campo: 'hodometro_final',
    };
  }

  const { data, error } = await supabase
    .from('viagem')
    .update({ hodometro_final: dados.hodometro_final })
    .eq('id', id)
    .select(COLUNAS_VIAGEM)
    .maybeSingle();

  if (error) {
    return traduzirErroBanco(error, 'Não foi possível corrigir o hodômetro final. Tente novamente.');
  }

  if (!data) {
    return { ok: false, mensagem: 'Viagem não encontrada.' };
  }

  return validarViagem(data);
}

export const viagensRepository: ViagensRepository = {
  listarViagens,
  buscarViagemPorId,
  buscarUltimoHodometro,
  buscarViagemEmAndamento,
  abrirViagem,
  fecharViagem,
  cancelarViagem,
  corrigirHodometroFinal,
};
