import { and, desc, eq, gt, isNotNull, lt } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

import { db } from '@/db/client';
import * as schema from '@/db/schema';
import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { Constants } from '@/types/database';

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

export type ViagensDb = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

let dbAtual: ViagensDb = db as unknown as ViagensDb;

export function setDb(instancia: ViagensDb): void {
  dbAtual = instancia;
}

export function getDb(): ViagensDb {
  return dbAtual;
}

export function gerarUUID(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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

export function traduzirErroSqlite(error: unknown, mensagemPadrao: string): Falha {
  const msg = error instanceof Error ? error.message : String(error);

  if (
    msg.includes('UNIQUE constraint failed: viagem.veiculo_id') ||
    msg.includes('viagem_um_andamento_por_veiculo')
  ) {
    return {
      ok: false,
      mensagem: MENSAGENS_ERRO_VIAGEM.VG001,
      campo: 'veiculo_id',
      codigo: 'VG001',
    };
  }

  if (msg.includes('FOREIGN KEY constraint failed')) {
    return {
      ok: false,
      mensagem: 'Veículo ou rota não encontrada.',
      codigo: '23503',
    };
  }

  return { ok: false, mensagem: mensagemPadrao };
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
  try {
    const database = getDb();
    const condicoes = [];

    if (filtro.status && filtro.status !== 'Todos') {
      condicoes.push(eq(schema.viagem.status, filtro.status));
    }
    if (filtro.veiculo_id) {
      condicoes.push(eq(schema.viagem.veiculo_id, filtro.veiculo_id));
    }
    if (filtro.motorista_id) {
      condicoes.push(eq(schema.viagem.motorista_id, filtro.motorista_id));
    }

    const query = database
      .select({
        viagem: schema.viagem,
        veiculo: schema.veiculo,
        rota: schema.rota,
      })
      .from(schema.viagem)
      .leftJoin(schema.veiculo, eq(schema.viagem.veiculo_id, schema.veiculo.id))
      .leftJoin(schema.rota, eq(schema.viagem.rota_id, schema.rota.id))
      .orderBy(desc(schema.viagem.data_inclusao))
      .limit(filtro.limite ?? 100);

    const rows = condicoes.length > 0 ? query.where(and(...condicoes)).all() : query.all();

    const viagens: ViagemDetalhada[] = [];
    for (const item of rows) {
      const detalhada: ViagemDetalhada = {
        ...item.viagem,
        veiculo: item.veiculo
          ? {
              id: item.veiculo.id,
              placa: item.veiculo.placa,
              marca: item.veiculo.marca,
              modelo: item.veiculo.modelo,
              status: item.veiculo.status,
            }
          : null,
        rota: item.rota
          ? {
              id: item.rota.id,
              cidade_origem: item.rota.cidade_origem,
              uf_origem: item.rota.uf_origem,
              cidade_destino: item.rota.cidade_destino,
              uf_destino: item.rota.uf_destino,
              distancia_estimada_km: item.rota.distancia_estimada_km,
            }
          : null,
        motorista: null,
      };

      const validado = validarViagemDetalhada(detalhada);
      if (!validado.ok) {
        return validado;
      }
      viagens.push(validado.data);
    }

    return { ok: true, data: viagens };
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível carregar as viagens. Tente novamente.');
  }
}

export async function buscarViagemPorId(id: string): Promise<Resultado<ViagemDetalhada>> {
  try {
    const database = getDb();
    const row = database
      .select({
        viagem: schema.viagem,
        veiculo: schema.veiculo,
        rota: schema.rota,
      })
      .from(schema.viagem)
      .leftJoin(schema.veiculo, eq(schema.viagem.veiculo_id, schema.veiculo.id))
      .leftJoin(schema.rota, eq(schema.viagem.rota_id, schema.rota.id))
      .where(eq(schema.viagem.id, id))
      .get();

    if (!row) {
      return { ok: false, mensagem: 'Viagem não encontrada.' };
    }

    const viagemDetalhada: ViagemDetalhada = {
      ...row.viagem,
      veiculo: row.veiculo
        ? {
            id: row.veiculo.id,
            placa: row.veiculo.placa,
            marca: row.veiculo.marca,
            modelo: row.veiculo.modelo,
            status: row.veiculo.status,
          }
        : null,
      rota: row.rota
        ? {
            id: row.rota.id,
            cidade_origem: row.rota.cidade_origem,
            uf_origem: row.rota.uf_origem,
            cidade_destino: row.rota.cidade_destino,
            uf_destino: row.rota.uf_destino,
            distancia_estimada_km: row.rota.distancia_estimada_km,
          }
        : null,
      motorista: null,
    };

    return validarViagemDetalhada(viagemDetalhada);
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível carregar a viagem. Tente novamente.');
  }
}

export async function buscarUltimoHodometro(veiculo_id: string): Promise<Resultado<number | null>> {
  try {
    const database = getDb();
    const row = database
      .select({ hodometro_final: schema.viagem.hodometro_final })
      .from(schema.viagem)
      .where(and(eq(schema.viagem.veiculo_id, veiculo_id), isNotNull(schema.viagem.hodometro_final)))
      .orderBy(desc(schema.viagem.hodometro_final))
      .limit(1)
      .get();

    if (!row || row.hodometro_final === null) {
      return { ok: true, data: null };
    }

    return { ok: true, data: Number(row.hodometro_final) };
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível consultar o último hodômetro do veículo.');
  }
}

export async function buscarViagemEmAndamento(veiculo_id: string): Promise<Resultado<Viagem | null>> {
  try {
    const database = getDb();
    const row = database
      .select()
      .from(schema.viagem)
      .where(and(eq(schema.viagem.veiculo_id, veiculo_id), eq(schema.viagem.status, 'EmAndamento')))
      .get();

    if (!row) {
      return { ok: true, data: null };
    }

    return validarViagem(row);
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível consultar as viagens do veículo.');
  }
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

  const database = getDb();

  try {
    const resultado = database.transaction((tx) => {
      // 1. Veículo em manutenção (VG002) ou inativo (VG003) no cache local
      const veic = tx
        .select()
        .from(schema.veiculo)
        .where(eq(schema.veiculo.id, input.veiculo_id))
        .get();

      if (veic) {
        if (veic.status === 'EmManutencao') {
          return {
            ok: false as const,
            mensagem: MENSAGENS_ERRO_VIAGEM.VG002,
            campo: 'veiculo_id' as CampoErroViagem,
            codigo: 'VG002',
          };
        }
        if (veic.status === 'Inativo') {
          return {
            ok: false as const,
            mensagem: MENSAGENS_ERRO_VIAGEM.VG003,
            campo: 'veiculo_id' as CampoErroViagem,
            codigo: 'VG003',
          };
        }
      }

      // 2. Veículo já possui viagem em andamento (VG001)
      const emAndamento = tx
        .select({ id: schema.viagem.id })
        .from(schema.viagem)
        .where(
          and(
            eq(schema.viagem.veiculo_id, input.veiculo_id),
            eq(schema.viagem.status, 'EmAndamento'),
          ),
        )
        .limit(1)
        .get();

      if (emAndamento) {
        return {
          ok: false as const,
          mensagem: MENSAGENS_ERRO_VIAGEM.VG001,
          campo: 'veiculo_id' as CampoErroViagem,
          codigo: 'VG001',
        };
      }

      // 3. Hodômetro inicial menor que o último final do veículo (VG004)
      const ultimoHodometro = tx
        .select({ hodometro_final: schema.viagem.hodometro_final })
        .from(schema.viagem)
        .where(
          and(
            eq(schema.viagem.veiculo_id, input.veiculo_id),
            isNotNull(schema.viagem.hodometro_final),
          ),
        )
        .orderBy(desc(schema.viagem.hodometro_final))
        .limit(1)
        .get();

      if (
        ultimoHodometro?.hodometro_final !== null &&
        ultimoHodometro?.hodometro_final !== undefined
      ) {
        if (input.hodometro_inicial < Number(ultimoHodometro.hodometro_final)) {
          return {
            ok: false as const,
            mensagem: MENSAGENS_ERRO_VIAGEM.VG004,
            campo: 'hodometro_inicial' as CampoErroViagem,
            codigo: 'VG004',
          };
        }
      }

      const id = input.id ?? gerarUUID();
      const agora = new Date().toISOString();
      const data_inicio = input.data_inicio ?? agora;

      const novaViagemLocal: schema.NovaViagem = {
        id,
        veiculo_id: input.veiculo_id,
        rota_id: input.rota_id,
        motorista_id: input.motorista_id,
        hodometro_inicial: input.hodometro_inicial,
        hodometro_final: null,
        data_inicio,
        data_fim: null,
        status: 'EmAndamento',
        km_rodado: null,
        data_inclusao: agora,
        data_atualizacao: agora,
      };

      // REGRA CRÍTICA: km_rodado NUNCA entra no payload do outbox (erro 428C9 no Postgres)
      const outboxPayload = {
        id,
        veiculo_id: input.veiculo_id,
        rota_id: input.rota_id,
        motorista_id: input.motorista_id,
        hodometro_inicial: input.hodometro_inicial,
        data_inicio,
        status: 'EmAndamento',
        data_inclusao: agora,
        data_atualizacao: agora,
      };

      const outboxItem: schema.NovoOutboxItem = {
        id: gerarUUID(),
        entidade: 'viagem',
        operacao: 'insert',
        payload: JSON.stringify(outboxPayload),
        tentativas: 0,
        criado_em: agora,
        ultimo_erro: null,
      };

      tx.insert(schema.viagem).values(novaViagemLocal).run();
      tx.insert(schema.outbox).values(outboxItem).run();

      return { ok: true as const, data: novaViagemLocal as Viagem };
    });

    if (!resultado.ok) {
      return resultado;
    }

    return validarViagem(resultado.data);
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível abrir a viagem. Tente novamente.');
  }
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

  const database = getDb();

  try {
    const resultado = database.transaction((tx) => {
      const viagemAtual = tx
        .select()
        .from(schema.viagem)
        .where(eq(schema.viagem.id, id))
        .get();

      if (!viagemAtual) {
        return { ok: false as const, mensagem: 'Viagem não encontrada.' };
      }

      if (viagemAtual.status !== 'EmAndamento') {
        return {
          ok: false as const,
          mensagem: MENSAGENS_ERRO_VIAGEM.VG005,
          campo: 'status' as CampoErroViagem,
          codigo: 'VG005',
        };
      }

      if (input.hodometro_final <= viagemAtual.hodometro_inicial) {
        return {
          ok: false as const,
          mensagem: MENSAGENS_ERRO_VIAGEM['23514'],
          campo: 'hodometro_final' as CampoErroViagem,
          codigo: '23514',
        };
      }

      const agora = new Date().toISOString();
      const data_fim = input.data_fim ?? agora;
      const km_rodado = input.hodometro_final - viagemAtual.hodometro_inicial;

      tx.update(schema.viagem)
        .set({
          status: 'Finalizada',
          hodometro_final: input.hodometro_final,
          data_fim,
          km_rodado,
          data_atualizacao: agora,
        })
        .where(eq(schema.viagem.id, id))
        .run();

      // REGRA CRÍTICA: km_rodado NUNCA entra no payload do outbox (erro 428C9 no Postgres)
      const outboxPayload = {
        id,
        status: 'Finalizada',
        hodometro_final: input.hodometro_final,
        data_fim,
        data_atualizacao: agora,
      };

      const outboxItem: schema.NovoOutboxItem = {
        id: gerarUUID(),
        entidade: 'viagem',
        operacao: 'update',
        payload: JSON.stringify(outboxPayload),
        tentativas: 0,
        criado_em: agora,
        ultimo_erro: null,
      };

      tx.insert(schema.outbox).values(outboxItem).run();

      const viagemAtualizada: Viagem = {
        ...viagemAtual,
        status: 'Finalizada',
        hodometro_final: input.hodometro_final,
        data_fim,
        km_rodado,
        data_atualizacao: agora,
      };

      return { ok: true as const, data: viagemAtualizada };
    });

    if (!resultado.ok) {
      return resultado;
    }

    return validarViagem(resultado.data);
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível fechar a viagem. Tente novamente.');
  }
}

export async function cancelarViagem(
  id: string,
  options?: { hodometro_final?: number | null },
): Promise<Resultado<Viagem>> {
  const database = getDb();

  try {
    const resultado = database.transaction((tx) => {
      const viagemAtual = tx
        .select()
        .from(schema.viagem)
        .where(eq(schema.viagem.id, id))
        .get();

      if (!viagemAtual) {
        return { ok: false as const, mensagem: 'Viagem não encontrada.' };
      }

      if (viagemAtual.status !== 'EmAndamento') {
        return {
          ok: false as const,
          mensagem: MENSAGENS_ERRO_VIAGEM.VG005,
          campo: 'status' as CampoErroViagem,
          codigo: 'VG005',
        };
      }

      const agora = new Date().toISOString();
      const data_fim = agora;
      const hodometro_final =
        options?.hodometro_final !== undefined ? options.hodometro_final : viagemAtual.hodometro_final;
      const km_rodado =
        hodometro_final !== null && hodometro_final !== undefined && hodometro_final > viagemAtual.hodometro_inicial
          ? hodometro_final - viagemAtual.hodometro_inicial
          : null;

      tx.update(schema.viagem)
        .set({
          status: 'Cancelada',
          hodometro_final,
          data_fim,
          km_rodado,
          data_atualizacao: agora,
        })
        .where(eq(schema.viagem.id, id))
        .run();

      // REGRA CRÍTICA: km_rodado NUNCA entra no payload do outbox (erro 428C9 no Postgres)
      const outboxPayload: Record<string, unknown> = {
        id,
        status: 'Cancelada',
        data_fim,
        data_atualizacao: agora,
      };

      if (options?.hodometro_final !== undefined) {
        outboxPayload.hodometro_final = options.hodometro_final;
      }

      const outboxItem: schema.NovoOutboxItem = {
        id: gerarUUID(),
        entidade: 'viagem',
        operacao: 'update',
        payload: JSON.stringify(outboxPayload),
        tentativas: 0,
        criado_em: agora,
        ultimo_erro: null,
      };

      tx.insert(schema.outbox).values(outboxItem).run();

      const viagemAtualizada: Viagem = {
        ...viagemAtual,
        status: 'Cancelada',
        hodometro_final,
        data_fim,
        km_rodado,
        data_atualizacao: agora,
      };

      return { ok: true as const, data: viagemAtualizada };
    });

    if (!resultado.ok) {
      return resultado;
    }

    return validarViagem(resultado.data);
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível cancelar a viagem. Tente novamente.');
  }
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

  const database = getDb();

  try {
    const resultado = database.transaction((tx) => {
      const viagemAtual = tx
        .select()
        .from(schema.viagem)
        .where(eq(schema.viagem.id, id))
        .get();

      if (!viagemAtual) {
        return { ok: false as const, mensagem: 'Viagem não encontrada.' };
      }

      if (dados.hodometro_final <= viagemAtual.hodometro_inicial) {
        return {
          ok: false as const,
          mensagem: MENSAGENS_ERRO_VIAGEM['23514'],
          campo: 'hodometro_final' as CampoErroViagem,
          codigo: '23514',
        };
      }

      // VG007: hodometro final corrigido não pode ser maior que o inicial de viagem posterior
      const viagemPosterior = tx
        .select()
        .from(schema.viagem)
        .where(
          and(
            eq(schema.viagem.veiculo_id, viagemAtual.veiculo_id),
            gt(schema.viagem.hodometro_inicial, viagemAtual.hodometro_inicial),
            lt(schema.viagem.hodometro_inicial, dados.hodometro_final),
          ),
        )
        .limit(1)
        .get();

      if (viagemPosterior) {
        return {
          ok: false as const,
          mensagem: MENSAGENS_ERRO_VIAGEM.VG007,
          campo: 'hodometro_final' as CampoErroViagem,
          codigo: 'VG007',
        };
      }

      const agora = new Date().toISOString();
      const km_rodado = dados.hodometro_final - viagemAtual.hodometro_inicial;

      tx.update(schema.viagem)
        .set({
          hodometro_final: dados.hodometro_final,
          km_rodado,
          data_atualizacao: agora,
        })
        .where(eq(schema.viagem.id, id))
        .run();

      // REGRA CRÍTICA: km_rodado NUNCA entra no payload do outbox (erro 428C9 no Postgres)
      const outboxPayload = {
        id,
        hodometro_final: dados.hodometro_final,
        data_atualizacao: agora,
      };

      const outboxItem: schema.NovoOutboxItem = {
        id: gerarUUID(),
        entidade: 'viagem',
        operacao: 'update',
        payload: JSON.stringify(outboxPayload),
        tentativas: 0,
        criado_em: agora,
        ultimo_erro: null,
      };

      tx.insert(schema.outbox).values(outboxItem).run();

      const viagemAtualizada: Viagem = {
        ...viagemAtual,
        hodometro_final: dados.hodometro_final,
        km_rodado,
        data_atualizacao: agora,
      };

      return { ok: true as const, data: viagemAtualizada };
    });

    if (!resultado.ok) {
      return resultado;
    }

    return validarViagem(resultado.data);
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível corrigir o hodômetro final. Tente novamente.');
  }
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
