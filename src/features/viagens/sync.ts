import { asc, eq } from 'drizzle-orm';
import * as Network from 'expo-network';

import * as schema from '@/db/schema';
import { supabase } from '@/supabase/client';
import {
  COLUNAS_VIAGEM,
  getDb,
  MENSAGENS_ERRO_VIAGEM,
  type ViagensDb,
} from './viagensRepository';

export type StatusSyncItem = 'sucesso' | 'falha' | 'conflito';

export type ResultadoItemSync = {
  id: string;
  status: StatusSyncItem;
  operacao: 'insert' | 'update';
  erro?: string;
  codigo?: string;
};

export type ResultadoDrenagem = {
  total: number;
  sincronizados: number;
  falhas: number;
  conflitos: number;
  itens: ResultadoItemSync[];
};

export type OpcoesDrenagem = {
  limite?: number;
  maxTentativas?: number;
};

type ErroSupabase = {
  code: string;
  message?: string;
};

export function ehErroConexao(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  const code = error.code ?? '';

  return (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('timeout') ||
    msg.includes('failed to fetch') ||
    msg.includes('connection') ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT'
  );
}

function processarErroBanco(
  error: ErroSupabase,
  item: schema.OutboxItem,
  database: ViagensDb,
): { tipo: StatusSyncItem; mensagem: string } {
  const codigo = error.code as keyof typeof MENSAGENS_ERRO_VIAGEM;
  const mensagemErro = codigo in MENSAGENS_ERRO_VIAGEM ? MENSAGENS_ERRO_VIAGEM[codigo] : error.message ?? 'Erro desconhecido';

  // VG005: A viagem já foi encerrada ou corrigida no servidor pelo Gestor (ADR 0004 / EIX-76).
  // O servidor vence; a operação é enviada para fila de revisão em vez de sobrescrever silenciosamente.
  if (codigo === 'VG005') {
    const mensagemRevisao = `Conflito (VG005): ${mensagemErro} Registro marcado para revisão do gestor.`;
    database
      .update(schema.outbox)
      .set({
        tentativas: item.tentativas + 1,
        ultimo_erro: mensagemRevisao,
      })
      .where(eq(schema.outbox.id, item.id))
      .run();

    return { tipo: 'conflito', mensagem: mensagemRevisao };
  }

  // Demais códigos de integridade e negócio (VG001-VG007, 23514, 42501)
  const ehRegraNegocio = codigo in MENSAGENS_ERRO_VIAGEM || error.code === '42501' || error.code === '23505';

  database
    .update(schema.outbox)
    .set({
      tentativas: item.tentativas + 1,
      ultimo_erro: mensagemErro,
    })
    .where(eq(schema.outbox.id, item.id))
    .run();

  return {
    tipo: ehRegraNegocio ? 'conflito' : 'falha',
    mensagem: mensagemErro,
  };
}

export async function drenarOutboxViagens(
  opcoes: OpcoesDrenagem = {},
  deps?: { db?: ViagensDb; supabase?: typeof supabase },
): Promise<ResultadoDrenagem> {
  const database = deps?.db ?? getDb();
  const supabaseClient = deps?.supabase ?? supabase;
  const limite = opcoes.limite ?? 50;
  const maxTentativas = opcoes.maxTentativas ?? 5;

  if (!database || typeof database.select !== 'function') {
    return {
      total: 0,
      sincronizados: 0,
      falhas: 0,
      conflitos: 0,
      itens: [],
    };
  }

  const itens = database
    .select()
    .from(schema.outbox)
    .where(eq(schema.outbox.entidade, 'viagem'))
    .orderBy(asc(schema.outbox.criado_em))
    .limit(limite)
    .all();

  const resultado: ResultadoDrenagem = {
    total: itens.length,
    sincronizados: 0,
    falhas: 0,
    conflitos: 0,
    itens: [],
  };

  for (const item of itens) {
    if (item.tentativas >= maxTentativas) {
      resultado.falhas++;
      resultado.itens.push({
        id: item.id,
        status: 'falha',
        operacao: item.operacao,
        erro: item.ultimo_erro ?? 'Número máximo de tentativas atingido.',
      });
      continue;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(item.payload) as Record<string, unknown>;
    } catch {
      database
        .update(schema.outbox)
        .set({
          tentativas: item.tentativas + 1,
          ultimo_erro: 'Payload JSON inválido.',
        })
        .where(eq(schema.outbox.id, item.id))
        .run();

      resultado.falhas++;
      resultado.itens.push({
        id: item.id,
        status: 'falha',
        operacao: item.operacao,
        erro: 'Payload JSON inválido.',
      });
      continue;
    }

    // REGRA CRÍTICA: km_rodado NUNCA é enviado no payload para o Supabase (Postgres coluna gerada 428C9)
    delete payload.km_rodado;

    try {
      if (item.operacao === 'insert') {
        const { data, error } = await supabaseClient
          .from('viagem')
          .upsert(payload as never, { onConflict: 'id' })
          .select(COLUNAS_VIAGEM)
          .maybeSingle();

        if (error) {
          const processado = processarErroBanco(error, item, database);
          if (processado.tipo === 'conflito') {
            resultado.conflitos++;
          } else {
            resultado.falhas++;
          }

          resultado.itens.push({
            id: item.id,
            status: processado.tipo,
            operacao: 'insert',
            erro: processado.mensagem,
            codigo: error.code,
          });

          if (ehErroConexao(error)) {
            break;
          }
          continue;
        }

        // Sucesso: atualiza local com dados do servidor (incluindo km_rodado calculado)
        if (data && 'km_rodado' in data && data.km_rodado !== null && data.km_rodado !== undefined) {
          database
            .update(schema.viagem)
            .set({
              km_rodado: Number(data.km_rodado),
              data_atualizacao: (data as { data_atualizacao?: string }).data_atualizacao ?? new Date().toISOString(),
            })
            .where(eq(schema.viagem.id, String(payload.id)))
            .run();
        }

        // Remove item processado da fila
        database.delete(schema.outbox).where(eq(schema.outbox.id, item.id)).run();

        resultado.sincronizados++;
        resultado.itens.push({
          id: item.id,
          status: 'sucesso',
          operacao: 'insert',
        });
      } else if (item.operacao === 'update') {
        const idViagem = String(payload.id);
        const { id: _ignoredId, ...dadosParaAtualizar } = payload;

        const { data, error } = await supabaseClient
          .from('viagem')
          .update(dadosParaAtualizar as never)
          .eq('id', idViagem)
          .select(COLUNAS_VIAGEM)
          .maybeSingle();

        if (error) {
          const processado = processarErroBanco(error, item, database);
          if (processado.tipo === 'conflito') {
            resultado.conflitos++;
          } else {
            resultado.falhas++;
          }

          resultado.itens.push({
            id: item.id,
            status: processado.tipo,
            operacao: 'update',
            erro: processado.mensagem,
            codigo: error.code,
          });

          if (ehErroConexao(error)) {
            break;
          }
          continue;
        }

        // Sucesso: atualiza local com km_rodado calculado pelo servidor
        if (data && 'km_rodado' in data && data.km_rodado !== null && data.km_rodado !== undefined) {
          database
            .update(schema.viagem)
            .set({
              km_rodado: Number(data.km_rodado),
              data_atualizacao: (data as { data_atualizacao?: string }).data_atualizacao ?? new Date().toISOString(),
            })
            .where(eq(schema.viagem.id, idViagem))
            .run();
        }

        database.delete(schema.outbox).where(eq(schema.outbox.id, item.id)).run();

        resultado.sincronizados++;
        resultado.itens.push({
          id: item.id,
          status: 'sucesso',
          operacao: 'update',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao sincronizar com servidor.';
      database
        .update(schema.outbox)
        .set({
          tentativas: item.tentativas + 1,
          ultimo_erro: msg,
        })
        .where(eq(schema.outbox.id, item.id))
        .run();

      resultado.falhas++;
      resultado.itens.push({
        id: item.id,
        status: 'falha',
        operacao: item.operacao,
        erro: msg,
      });

      break;
    }
  }

  return resultado;
}

export async function sincronizarSeConectado(
  opcoes?: OpcoesDrenagem,
  deps?: { db?: ViagensDb; supabase?: typeof supabase; network?: typeof Network },
): Promise<ResultadoDrenagem | null> {
  const net = deps?.network ?? Network;

  try {
    const estado = await net.getNetworkStateAsync();
    const conectado = Boolean(estado.isConnected && estado.isInternetReachable !== false);

    if (!conectado) {
      return null;
    }
  } catch {
    // Se a checagem falhar em algum ambiente, tenta drenar mesmo assim
  }

  return drenarOutboxViagens(opcoes, deps);
}

export function obterStatusOutboxViagens(
  database: ViagensDb = getDb(),
): { pendentes: number; comErro: number; conflitos: number } {
  if (!database || typeof database.select !== 'function') {
    return { pendentes: 0, comErro: 0, conflitos: 0 };
  }

  const itens = database
    .select({
      id: schema.outbox.id,
      tentativas: schema.outbox.tentativas,
      ultimo_erro: schema.outbox.ultimo_erro,
    })
    .from(schema.outbox)
    .where(eq(schema.outbox.entidade, 'viagem'))
    .all();

  const pendentes = itens.length;
  const comErro = itens.filter((i) => i.tentativas > 0 && i.ultimo_erro !== null).length;
  const conflitos = itens.filter((i) => i.ultimo_erro?.includes('Conflito')).length;

  return { pendentes, comErro, conflitos };
}
