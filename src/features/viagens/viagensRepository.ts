import { z } from 'zod';

import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { supabase } from '@/supabase/client';
import type { Database } from '@/types/database';

import {
  abrirViagemSchema,
  fecharViagemSchema,
  motoristaResumoSchema,
  rotaResumoSchema,
  viagemDetalhadaSchema,
  viagemSchema,
} from './schema';
import type {
  CampoErroViagem,
  FecharViagemInput,
  FiltroViagens,
  MotoristaResumo,
  NovaViagemInput,
  Resultado,
  RotaResumo,
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

// Seletores do formulário de abertura: cadastro pequeno por natureza; o limite só impede uma
// resposta sem teto (skill supabase-query). Os filtros vão para o banco para o limite valer
// sobre o que a tela mostra, e não sobre a tabela inteira.
const LIMITE_SELETOR = 500;

// Mensagens amigáveis para cada erro do banco (EIX-76 / migrations 20260924000300_frota.sql e
// 20261015000100_viagem_regras.sql). O texto técnico do banco ou SQLSTATE nunca é exposto
// diretamente ao usuário.
export const MENSAGENS_ERRO_VIAGEM = {
  VG001: 'Este veículo já está em uma viagem em andamento.',
  VG002: 'Veículo em manutenção não pode sair em viagem.',
  VG003: 'Veículo inativo não pode sair em viagem.',
  VG004: 'O hodômetro inicial não pode ser menor que o último hodômetro final do veículo.',
  VG005: 'Viagem encerrada não pode ser alterada.',
  VG006: 'O veículo de uma viagem não pode ser trocado.',
  VG007: 'O hodômetro final corrigido não pode ser maior que o hodômetro inicial de uma viagem posterior.',
  '23505': 'Não foi possível salvar a viagem: registro duplicado.',
  '23514': 'Os dados do hodômetro são inválidos.',
  '42501': MENSAGEM_ACESSO_NEGADO,
  '428C9': 'A quilometragem rodada é calculada automaticamente e não pode ser informada.',
} as const;

// 23505 e 23514 são códigos genéricos do Postgres. O nome da constraint que falhou vem no
// texto técnico do erro; ele é usado só para escolher a mensagem e o campo, nunca é exibido.
// As constraints estão em supabase/migrations/20260924000300_frota.sql (checks de hodômetro) e
// supabase/migrations/20261015000100_viagem_regras.sql (índice de viagem em andamento).
//
// Um mapa só (código, mensagem e campo) evita que uma constraint nova entre no texto do erro
// sem ganhar mensagem ou campo em uma das estruturas antigas.
type DetalheConstraintViagem = {
  codigo: '23505' | '23514';
  mensagem: string;
  campo: CampoErroViagem | undefined;
};

const CONSTRAINTS_VIAGEM = {
  viagem_pkey: {
    codigo: '23505',
    mensagem: 'Já existe uma viagem com este identificador.',
    campo: undefined,
  },
  viagem_um_andamento_por_veiculo: {
    codigo: '23505',
    mensagem: 'Este veículo já está em uma viagem em andamento.',
    campo: 'veiculo_id',
  },
  viagem_hodometro_inicial_nao_negativo: {
    codigo: '23514',
    mensagem: 'O hodômetro inicial não pode ser negativo.',
    campo: 'hodometro_inicial',
  },
  viagem_hodometro_final_maior: {
    codigo: '23514',
    mensagem: 'O hodômetro final deve ser maior que o hodômetro inicial.',
    campo: 'hodometro_final',
  },
  viagem_finalizada_tem_hodometro_final: {
    codigo: '23514',
    mensagem: 'Informe o hodômetro final para concluir a viagem.',
    campo: 'hodometro_final',
  },
} as const satisfies Record<string, DetalheConstraintViagem>;

type NomeConstraintViagem = keyof typeof CONSTRAINTS_VIAGEM;

// Exportado para os testes conferirem o texto que chega ao usuário sem conhecer o mapa interno.
export const MENSAGENS_ERRO_CONSTRAINT_VIAGEM = Object.fromEntries(
  Object.entries(CONSTRAINTS_VIAGEM).map(([nome, detalhe]) => [nome, detalhe.mensagem]),
) as { [K in NomeConstraintViagem]: (typeof CONSTRAINTS_VIAGEM)[K]['mensagem'] };

export const CAMPOS_ERRO_VIAGEM: Record<string, CampoErroViagem> = {
  VG001: 'veiculo_id',
  VG002: 'veiculo_id',
  VG003: 'veiculo_id',
  VG004: 'hodometro_inicial',
  VG005: 'status',
  VG006: 'veiculo_id',
  VG007: 'hodometro_final',
};

export const MENSAGEM_VIAGEM_NAO_ABERTA = 'Esta viagem já foi encerrada ou não foi encontrada.';

type ErroSupabase = { code: string; message?: string; details?: string };
type Falha = Extract<Resultado<never>, { ok: false }>;

function nomeDaConstraint(
  error: ErroSupabase,
  codigo: '23505' | '23514',
): NomeConstraintViagem | null {
  const texto = `${error.message ?? ''} ${error.details ?? ''}`;
  return (
    (Object.keys(CONSTRAINTS_VIAGEM) as NomeConstraintViagem[]).find(
      (nome) => CONSTRAINTS_VIAGEM[nome].codigo === codigo && texto.includes(nome),
    ) ?? null
  );
}

function falhaDaConstraint(nome: NomeConstraintViagem, codigo: string): Falha {
  const detalhe = CONSTRAINTS_VIAGEM[nome];
  return {
    ok: false,
    mensagem: detalhe.mensagem,
    campo: detalhe.campo,
    codigo,
  };
}

export function traduzirErroBanco(error: ErroSupabase, mensagemPadrao: string): Falha {
  if (ehAcessoNegado(error)) {
    return { ok: false, mensagem: MENSAGEM_ACESSO_NEGADO, codigo: '42501' };
  }

  // 23505 pode ser o id gerado no cliente (idempotência) ou o índice que barra uma segunda
  // viagem em andamento. Só a segunda vira "veículo em andamento".
  if (error.code === '23505') {
    const constraint = nomeDaConstraint(error, '23505');
    if (constraint) {
      return falhaDaConstraint(constraint, error.code);
    }
    return { ok: false, mensagem: MENSAGENS_ERRO_VIAGEM['23505'], codigo: error.code };
  }

  // 23514 cobre três checks diferentes: inicial negativo, final não maior que o inicial e
  // viagem Finalizada sem final. Cada uma tem mensagem e campo próprios.
  if (error.code === '23514') {
    const constraint = nomeDaConstraint(error, '23514');
    if (constraint) {
      return falhaDaConstraint(constraint, error.code);
    }
    return { ok: false, mensagem: MENSAGENS_ERRO_VIAGEM['23514'], codigo: error.code };
  }

  if (Object.prototype.hasOwnProperty.call(MENSAGENS_ERRO_VIAGEM, error.code)) {
    const codigo = error.code as keyof typeof MENSAGENS_ERRO_VIAGEM;
    return {
      ok: false,
      mensagem: MENSAGENS_ERRO_VIAGEM[codigo],
      campo: CAMPOS_ERRO_VIAGEM[error.code],
      codigo: error.code,
    };
  }

  return { ok: false, mensagem: mensagemPadrao, codigo: error.code };
}

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

// Consulta sujeita ao RLS: para o Motorista, o máximo considera só as viagens dele. A tela
// só usa esse valor para Admin/Gestor; para o Motorista, o banco devolve VG004 sem expor o
// hodômetro de uma viagem que ele não enxerga.
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

// Só rotas ativas: uma rota desativada some do seletor, mas continua nas viagens antigas.
export async function listarRotasAtivas(): Promise<Resultado<RotaResumo[]>> {
  const { data, error } = await supabase
    .from('rota')
    .select('id, cidade_origem, uf_origem, cidade_destino, uf_destino, distancia_estimada_km')
    .eq('ativa', true)
    .order('cidade_origem')
    .order('cidade_destino')
    .limit(LIMITE_SELETOR);

  if (error) {
    return traduzirErroBanco(error, 'Não foi possível carregar as rotas. Tente novamente.');
  }

  const parsed = z.array(rotaResumoSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: 'Os dados das rotas recebidos são inválidos.' };
  }

  return { ok: true, data: parsed.data };
}

// Motoristas ativos para o Admin/Gestor escolher o responsável. O `!inner` faz o filtro de
// perfil valer sobre a linha de `usuario` (sem ele, o PostgREST só esvaziaria a relação).
// O RLS de `usuario` deixa Admin e Gestor de Frota lerem todos (20260924000500_rls.sql).
export async function listarMotoristasAtivos(): Promise<Resultado<MotoristaResumo[]>> {
  const { data, error } = await supabase
    .from('usuario')
    .select('id, nome, email, perfil:perfil_id!inner(nome)')
    .eq('status', 'Ativo')
    .eq('perfil.nome', 'Motorista')
    .order('nome')
    .limit(LIMITE_SELETOR);

  if (error) {
    return traduzirErroBanco(error, 'Não foi possível carregar os motoristas. Tente novamente.');
  }

  const parsed = z.array(motoristaResumoSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: 'Os dados dos motoristas recebidos são inválidos.' };
  }

  return { ok: true, data: parsed.data };
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
    veiculo_id: parsed.data.veiculo_id,
    rota_id: parsed.data.rota_id,
    motorista_id: parsed.data.motorista_id,
    hodometro_inicial: parsed.data.hodometro_inicial,
    data_inicio: parsed.data.data_inicio ?? new Date().toISOString(),
    status: 'EmAndamento',
  };

  if (parsed.data.id) {
    payload.id = parsed.data.id;
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
    hodometro_final: parsed.data.hodometro_final,
    data_fim: parsed.data.data_fim ?? new Date().toISOString(),
  };

  // Só fecha o que ainda está em andamento. Sem esse filtro, o Admin/Gestor com a tela aberta
  // "fecharia" de novo uma viagem que o motorista já fechou: o trigger aceita isso como correção
  // do hodômetro final e a leitura do motorista e a data_fim seriam trocadas sem aviso.
  const { data, error } = await supabase
    .from('viagem')
    .update(payload)
    .eq('id', id)
    .eq('status', 'EmAndamento')
    .select(COLUNAS_VIAGEM)
    .maybeSingle();

  if (error) {
    return traduzirErroBanco(error, 'Não foi possível fechar a viagem. Tente novamente.');
  }

  // Nenhuma linha: a viagem não existe, o RLS a esconde ou ela já foi encerrada.
  if (!data) {
    return { ok: false, mensagem: MENSAGEM_VIAGEM_NAO_ABERTA, campo: 'status' };
  }

  return validarViagem(data);
}

export const viagensRepository: ViagensRepository = {
  listarViagens,
  buscarViagemPorId,
  buscarUltimoHodometro,
  listarRotasAtivas,
  listarMotoristasAtivos,
  abrirViagem,
  fecharViagem,
};
