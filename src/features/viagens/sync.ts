import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';
import * as Network from 'expo-network';

import * as schema from '@/db/schema';
import { supabase } from '@/supabase/client';

import { obterGeracaoLocal } from './sessaoLocal';
import {
  MENSAGEM_SEM_CONEXAO,
  MENSAGEM_SESSAO_ALTERADA,
  ehErroConexao,
} from './syncErros';
import {
  aplicarViagemServidor,
  baixarVeiculos,
  baixarViagens,
  sincronizarCatalogos,
  type ResultadoCatalogos,
  type ViagemApi,
  viagemApiSchema,
} from './syncPull';
import {
  COLUNAS_VIAGEM,
  getDb,
  MENSAGENS_ERRO_VIAGEM,
  type ViagensDb,
} from './viagensRepository';

export { ehErroConexao } from './syncErros';

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
  semConexao: boolean;
  sessaoAlterada?: boolean;
  itens: ResultadoItemSync[];
};

export type OpcoesDrenagem = {
  usuarioId: string;
  limite?: number;
  maxTentativas?: number;
  agora?: Date;
  geracaoLocal?: number;
};

export type ResultadoSincronizacao = {
  ok: boolean;
  semConexao: boolean;
  mensagem?: string;
  catalogos?: ResultadoCatalogos;
  viagensBaixadas: number;
  drenagem: ResultadoDrenagem;
  sessaoAlterada?: boolean;
};

type DepsSync = {
  db?: ViagensDb;
  supabase?: typeof supabase;
  network?: typeof Network;
  geracaoLocal?: number;
};

type ErroSupabase = { code?: string; message?: string; details?: string } | null;

const MAX_TENTATIVAS_PADRAO = 8;
const LIMITE_PADRAO = 50;

// Códigos que representam uma recusa definitiva do servidor. Continuar tentando não muda o
// resultado e esconderia o conflito do gestor.
const CODIGOS_REVISAO = new Set([
  'VG001',
  'VG002',
  'VG003',
  'VG004',
  'VG005',
  'VG006',
  'VG007',
  '23503',
  '23505',
  '23514',
  '42501',
  '428C9',
  'P0001',
]);

function drenagemVazia(): ResultadoDrenagem {
  return {
    total: 0,
    sincronizados: 0,
    falhas: 0,
    conflitos: 0,
    semConexao: false,
    itens: [],
  };
}

function sessaoLocalAtual(geracaoLocal?: number): boolean {
  return geracaoLocal === undefined || obterGeracaoLocal() === geracaoLocal;
}

function resultadoSessaoAlterada(
  drenagem: ResultadoDrenagem,
  catalogos?: ResultadoCatalogos,
  viagensBaixadas = 0,
): ResultadoSincronizacao {
  return {
    ok: false,
    semConexao: false,
    mensagem: MENSAGEM_SESSAO_ALTERADA,
    sessaoAlterada: true,
    catalogos,
    viagensBaixadas,
    drenagem: { ...drenagem, sessaoAlterada: true },
  };
}

function mensagemDoErro(error: ErroSupabase, code?: string): string {
  const codigo = code ?? error?.code;
  if (codigo && codigo in MENSAGENS_ERRO_VIAGEM) {
    return MENSAGENS_ERRO_VIAGEM[codigo as keyof typeof MENSAGENS_ERRO_VIAGEM];
  }
  return 'Não foi possível sincronizar esta operação. Tente novamente.';
}

function proximaTentativa(agora: Date, tentativas: number): string {
  const segundos = Math.min(5 * 2 ** Math.min(tentativas, 6), 300);
  return new Date(agora.getTime() + segundos * 1000).toISOString();
}

function atualizarErroTemporario(
  database: ViagensDb,
  item: schema.OutboxItem,
  mensagem: string,
  codigo: string | null,
  tentativas: number,
  proxima: string,
): void {
  database
    .update(schema.outbox)
    .set({
      tentativas,
      ultimo_erro: mensagem,
      codigo_erro: codigo,
      proxima_tentativa_em: proxima,
    })
    .where(eq(schema.outbox.id, item.id))
    .run();
}

function montarRevisao(
  database: ViagensDb,
  item: schema.OutboxItem,
  usuarioId: string,
  payload: Record<string, unknown>,
  codigo: string,
  mensagem: string,
) {
  const viagemId = typeof payload.id === 'string' ? payload.id : item.id;
  const local = database
    .select()
    .from(schema.viagem)
    .where(eq(schema.viagem.id, viagemId))
    .get();
  const veiculo = local
    ? database
        .select()
        .from(schema.veiculo)
        .where(eq(schema.veiculo.id, local.veiculo_id))
        .get()
    : undefined;
  const rota = local
    ? database
        .select()
        .from(schema.rota)
        .where(eq(schema.rota.id, local.rota_id))
        .get()
    : undefined;
  const motorista = local
    ? database
        .select()
        .from(schema.usuarioCache)
        .where(eq(schema.usuarioCache.id, local.motorista_id))
        .get()
    : undefined;

  const motoristaId =
    local?.motorista_id ??
    (typeof payload.motorista_id === 'string' ? payload.motorista_id : null);

  return {
    id: item.id,
    viagem_id: viagemId,
    solicitante_id: usuarioId,
    motorista_id: motoristaId,
    motorista_nome: motorista?.nome ?? null,
    veiculo_id: local?.veiculo_id ?? (typeof payload.veiculo_id === 'string' ? payload.veiculo_id : null),
    veiculo_placa: veiculo?.placa ?? null,
    rota_id: local?.rota_id ?? (typeof payload.rota_id === 'string' ? payload.rota_id : null),
    rota_trecho: rota
      ? `${rota.cidade_origem}/${rota.uf_origem} → ${rota.cidade_destino}/${rota.uf_destino}`
      : null,
    codigo,
    mensagem,
    payload,
    status: 'Pendente' as const,
  };
}

async function buscarViagemNoServidor(
  cliente: typeof supabase,
  id: string,
): Promise<{ ok: true; data: ViagemApi | null } | { ok: false; conexao: boolean }> {
  try {
    const { data, error } = await cliente
      .from('viagem')
      .select(COLUNAS_VIAGEM)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return { ok: false, conexao: ehErroConexao(error) };
    }
    if (!data) return { ok: true, data: null };

    const parsed = viagemApiSchema.safeParse(data);
    return parsed.success ? { ok: true, data: parsed.data } : { ok: true, data: null };
  } catch {
    return { ok: false, conexao: true };
  }
}

async function enviarParaRevisao(
  cliente: typeof supabase,
  database: ViagensDb,
  item: schema.OutboxItem,
  usuarioId: string,
  payload: Record<string, unknown>,
  codigo: string,
  mensagem: string,
  opcoes: { buscarServidor?: boolean; agora: Date; geracaoLocal?: number },
): Promise<{ tipo: 'revisao' | 'falha' | 'conexao' | 'cancelada'; mensagem: string }> {
  const viagemId = typeof payload.id === 'string' ? payload.id : item.id;

  if (!sessaoLocalAtual(opcoes.geracaoLocal)) {
    return { tipo: 'cancelada', mensagem: MENSAGEM_SESSAO_ALTERADA };
  }

  // VG005/zero-row: o servidor já tem uma versão da viagem. Ela vence, mas o conflito continua
  // visível para o gestor e a linha local é reconciliada para não mostrar dado que não existe.
  if (opcoes.buscarServidor) {
    const servidor = await buscarViagemNoServidor(cliente, viagemId);
    if (!sessaoLocalAtual(opcoes.geracaoLocal)) {
      return { tipo: 'cancelada', mensagem: MENSAGEM_SESSAO_ALTERADA };
    }
    if (!servidor.ok && servidor.conexao) {
      const proxima = proximaTentativa(opcoes.agora, item.tentativas);
      atualizarErroTemporario(database, item, MENSAGEM_SEM_CONEXAO, 'CONEXAO', item.tentativas, proxima);
      return { tipo: 'conexao', mensagem: MENSAGEM_SEM_CONEXAO };
    }
    if (servidor.ok && servidor.data) {
      database.transaction((tx) => {
        aplicarViagemServidor(tx as ViagensDb, servidor.data as ViagemApi, { emRevisao: true });
      });
    }
  }

  const revisao = montarRevisao(database, item, usuarioId, payload, codigo, mensagem);

  try {
    if (!sessaoLocalAtual(opcoes.geracaoLocal)) {
      return { tipo: 'cancelada', mensagem: MENSAGEM_SESSAO_ALTERADA };
    }

    const { error } = await cliente
      .from('viagem_revisao')
      // O id da outbox é a chave de idempotência da revisão: repetir o envio após uma queda não
      // cria uma segunda linha para o gestor. `ignoreDuplicates` usa `on conflict do nothing`, que
      // exige só a policy de insert: o motorista não pode atualizar (nem "resolver") a revisão.
      .upsert(revisao as never, { onConflict: 'id', ignoreDuplicates: true });

    if (!sessaoLocalAtual(opcoes.geracaoLocal)) {
      return { tipo: 'cancelada', mensagem: MENSAGEM_SESSAO_ALTERADA };
    }

    if (error) {
      if (ehErroConexao(error)) {
        const proxima = proximaTentativa(opcoes.agora, item.tentativas);
        atualizarErroTemporario(database, item, MENSAGEM_SEM_CONEXAO, 'CONEXAO', item.tentativas, proxima);
        return { tipo: 'conexao', mensagem: MENSAGEM_SEM_CONEXAO };
      }

      const tentativas = item.tentativas + 1;
      atualizarErroTemporario(
        database,
        item,
        'Não foi possível enviar o conflito para a revisão do gestor.',
        error.code ?? 'REVISAO',
        tentativas,
        proximaTentativa(opcoes.agora, tentativas),
      );
      return { tipo: 'falha', mensagem: 'Não foi possível enviar o conflito para a revisão do gestor.' };
    }
  } catch {
    if (!sessaoLocalAtual(opcoes.geracaoLocal)) {
      return { tipo: 'cancelada', mensagem: MENSAGEM_SESSAO_ALTERADA };
    }
    const proxima = proximaTentativa(opcoes.agora, item.tentativas);
    atualizarErroTemporario(database, item, MENSAGEM_SEM_CONEXAO, 'CONEXAO', item.tentativas, proxima);
    return { tipo: 'conexao', mensagem: MENSAGEM_SEM_CONEXAO };
  }

  if (!sessaoLocalAtual(opcoes.geracaoLocal)) {
    return { tipo: 'cancelada', mensagem: MENSAGEM_SESSAO_ALTERADA };
  }

  database.transaction((tx) => {
    tx.update(schema.outbox)
      .set({
        status: 'revisao',
        codigo_erro: codigo,
        ultimo_erro: mensagem,
        proxima_tentativa_em: null,
      })
      .where(eq(schema.outbox.id, item.id))
      .run();
    tx.update(schema.viagem)
      .set({ em_revisao: true })
      .where(eq(schema.viagem.id, viagemId))
      .run();
  });

  return { tipo: 'revisao', mensagem };
}

async function tratarErroDoServidor(
  cliente: typeof supabase,
  database: ViagensDb,
  item: schema.OutboxItem,
  usuarioId: string,
  payload: Record<string, unknown>,
  error: NonNullable<ErroSupabase>,
  opcoes: { maxTentativas: number; agora: Date; geracaoLocal?: number },
): Promise<{ tipo: 'revisao' | 'falha' | 'conexao' | 'cancelada'; mensagem: string }> {
  if (!sessaoLocalAtual(opcoes.geracaoLocal)) {
    return { tipo: 'cancelada', mensagem: MENSAGEM_SESSAO_ALTERADA };
  }

  const codigo = error.code ?? 'SERVIDOR';
  const mensagem = mensagemDoErro(error, codigo);

  if (ehErroConexao(error)) {
    const proxima = proximaTentativa(opcoes.agora, item.tentativas);
    atualizarErroTemporario(database, item, MENSAGEM_SEM_CONEXAO, 'CONEXAO', item.tentativas, proxima);
    return { tipo: 'conexao', mensagem: MENSAGEM_SEM_CONEXAO };
  }

  if (CODIGOS_REVISAO.has(codigo)) {
    return enviarParaRevisao(cliente, database, item, usuarioId, payload, codigo, mensagem, {
      buscarServidor: codigo === 'VG005',
      agora: opcoes.agora,
      geracaoLocal: opcoes.geracaoLocal,
    });
  }

  const tentativas = item.tentativas + 1;
  if (tentativas >= opcoes.maxTentativas) {
    return enviarParaRevisao(
      cliente,
      database,
      item,
      usuarioId,
      payload,
      codigo,
      `${mensagem} A operação foi encaminhada para revisão após ${tentativas} tentativas.`,
      { agora: opcoes.agora, geracaoLocal: opcoes.geracaoLocal },
    );
  }

  atualizarErroTemporario(
    database,
    item,
    mensagem,
    codigo,
    tentativas,
    proximaTentativa(opcoes.agora, tentativas),
  );
  return { tipo: 'falha', mensagem };
}

function viagemIdDoPayload(payload: string): string | null {
  try {
    const dado = JSON.parse(payload) as { id?: unknown };
    return typeof dado.id === 'string' && dado.id.length > 0 ? dado.id : null;
  } catch {
    return null;
  }
}

function aplicarSucessoLocal(
  database: ViagensDb,
  item: schema.OutboxItem,
  data: ViagemApi,
): void {
  // Outra operação da mesma viagem pode já estar na fila de revisão. Nesse caso o sucesso desta
  // operação não pode apagar o selo "Em revisão" da viagem.
  const emRevisao = database
    .select({ id: schema.outbox.id, payload: schema.outbox.payload })
    .from(schema.outbox)
    .where(eq(schema.outbox.status, 'revisao'))
    .all()
    .some((linha) => linha.id !== item.id && viagemIdDoPayload(linha.payload) === data.id);

  database.transaction((tx) => {
    tx.delete(schema.outbox).where(eq(schema.outbox.id, item.id)).run();
    aplicarViagemServidor(tx as ViagensDb, data, { emRevisao });
  });
}

export async function drenarOutboxViagens(
  opcoes: OpcoesDrenagem,
  deps: DepsSync = {},
): Promise<ResultadoDrenagem> {
  const database = deps.db ?? getDb();
  const cliente = deps.supabase ?? supabase;
  const limite = opcoes.limite ?? LIMITE_PADRAO;
  const maxTentativas = opcoes.maxTentativas ?? MAX_TENTATIVAS_PADRAO;
  const agora = opcoes.agora ?? new Date();
  const agoraIso = agora.toISOString();
  const geracaoLocal = opcoes.geracaoLocal ?? obterGeracaoLocal();

  if (!database || typeof database.select !== 'function') {
    return drenagemVazia();
  }

  const itens = database
    .select()
    .from(schema.outbox)
    .where(
      and(
        eq(schema.outbox.entidade, 'viagem'),
        eq(schema.outbox.usuario_id, opcoes.usuarioId),
        eq(schema.outbox.status, 'pendente'),
        or(
          isNull(schema.outbox.proxima_tentativa_em),
          lte(schema.outbox.proxima_tentativa_em, agoraIso),
        ),
      ),
    )
    .orderBy(asc(schema.outbox.criado_em), asc(schema.outbox.id))
    .limit(limite)
    .all();

  const resultado: ResultadoDrenagem = {
    total: itens.length,
    sincronizados: 0,
    falhas: 0,
    conflitos: 0,
    semConexao: false,
    itens: [],
  };

  for (const item of itens) {
    // A conta pode ter mudado enquanto a página/requisição anterior estava em voo. A fila da
    // conta anterior fica preservada; nenhuma escrita local pode acontecer depois dessa troca.
    if (!sessaoLocalAtual(geracaoLocal)) {
      resultado.sessaoAlterada = true;
      break;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(item.payload) as Record<string, unknown>;
    } catch {
      const revisao = await enviarParaRevisao(
        cliente,
        database,
        item,
        opcoes.usuarioId,
        {},
        'PAYLOAD_INVALIDO',
        'A operação local está corrompida e precisa de revisão.',
        { agora, geracaoLocal },
      );
      if (revisao.tipo === 'cancelada') {
        resultado.sessaoAlterada = true;
        break;
      }
      if (revisao.tipo === 'conexao') {
        resultado.semConexao = true;
        resultado.falhas += 1;
        resultado.itens.push({
          id: item.id,
          status: 'falha',
          operacao: item.operacao,
          erro: revisao.mensagem,
          codigo: 'CONEXAO',
        });
        break;
      }
      resultado.conflitos += 1;
      resultado.itens.push({
        id: item.id,
        status: 'conflito',
        operacao: item.operacao,
        erro: revisao.mensagem,
        codigo: 'PAYLOAD_INVALIDO',
      });
      continue;
    }

    // REGRA CRÍTICA: km_rodado NUNCA é enviado ao Supabase (coluna gerada, erro 428C9).
    delete payload.km_rodado;

    if (typeof payload.id !== 'string' || payload.id.length === 0) {
      const revisao = await enviarParaRevisao(
        cliente,
        database,
        item,
        opcoes.usuarioId,
        payload,
        'PAYLOAD_SEM_ID',
        'A operação local não tem identificador e precisa de revisão.',
        { agora, geracaoLocal },
      );
      if (revisao.tipo === 'cancelada') {
        resultado.sessaoAlterada = true;
        break;
      }
      if (revisao.tipo === 'conexao') {
        resultado.semConexao = true;
        resultado.falhas += 1;
        resultado.itens.push({
          id: item.id,
          status: 'falha',
          operacao: item.operacao,
          erro: revisao.mensagem,
          codigo: 'CONEXAO',
        });
        break;
      }
      resultado.conflitos += 1;
      resultado.itens.push({
        id: item.id,
        status: 'conflito',
        operacao: item.operacao,
        erro: revisao.mensagem,
        codigo: 'PAYLOAD_SEM_ID',
      });
      continue;
    }

    if (item.tentativas >= maxTentativas) {
      const revisao = await enviarParaRevisao(
        cliente,
        database,
        item,
        opcoes.usuarioId,
        payload,
        'MAX_TENTATIVAS',
        `A operação não sincronizou após ${item.tentativas} tentativas e foi encaminhada para revisão.`,
        { agora, geracaoLocal },
      );
      if (revisao.tipo === 'cancelada') {
        resultado.sessaoAlterada = true;
        break;
      }
      if (revisao.tipo === 'conexao') {
        resultado.semConexao = true;
        resultado.falhas += 1;
        resultado.itens.push({
          id: item.id,
          status: 'falha',
          operacao: item.operacao,
          erro: revisao.mensagem,
          codigo: 'CONEXAO',
        });
        break;
      }
      resultado.conflitos += 1;
      resultado.itens.push({
        id: item.id,
        status: 'conflito',
        operacao: item.operacao,
        erro: revisao.mensagem,
        codigo: 'MAX_TENTATIVAS',
      });
      continue;
    }

    try {
      if (item.operacao === 'insert') {
        const { data, error } = await cliente
          .from('viagem')
          .upsert(payload as never, { onConflict: 'id' })
          .select(COLUNAS_VIAGEM)
          .maybeSingle();

        if (!sessaoLocalAtual(geracaoLocal)) {
          resultado.sessaoAlterada = true;
          break;
        }

        if (error) {
          const tratado = await tratarErroDoServidor(
            cliente,
            database,
            item,
            opcoes.usuarioId,
            payload,
            error,
            { maxTentativas, agora, geracaoLocal },
          );
          if (tratado.tipo === 'cancelada') {
            resultado.sessaoAlterada = true;
            break;
          }
          if (tratado.tipo === 'conexao') {
            resultado.semConexao = true;
            resultado.falhas += 1;
            resultado.itens.push({
              id: item.id,
              status: 'falha',
              operacao: 'insert',
              erro: tratado.mensagem,
              codigo: 'CONEXAO',
            });
            break;
          }
          if (tratado.tipo === 'revisao') {
            resultado.conflitos += 1;
            resultado.itens.push({
              id: item.id,
              status: 'conflito',
              operacao: 'insert',
              erro: tratado.mensagem,
              codigo: error.code,
            });
          } else {
            resultado.falhas += 1;
            resultado.itens.push({
              id: item.id,
              status: 'falha',
              operacao: 'insert',
              erro: tratado.mensagem,
              codigo: error.code,
            });
          }
          continue;
        }

        const parsed = data ? viagemApiSchema.safeParse(data) : null;
        if (!parsed?.success) {
          const motivo = data
            ? 'O servidor devolveu uma viagem inválida.'
            : 'O servidor não confirmou a gravação da viagem.';
          const revisao = await enviarParaRevisao(
            cliente,
            database,
            item,
            opcoes.usuarioId,
            payload,
            data ? 'RESPOSTA_INVALIDA' : 'SEM_RESPOSTA',
            motivo,
            { buscarServidor: true, agora, geracaoLocal },
          );
          if (revisao.tipo === 'cancelada') {
            resultado.sessaoAlterada = true;
            break;
          }
          if (revisao.tipo === 'conexao') {
            resultado.semConexao = true;
            resultado.falhas += 1;
            resultado.itens.push({
              id: item.id,
              status: 'falha',
              operacao: 'insert',
              erro: revisao.mensagem,
              codigo: 'CONEXAO',
            });
            break;
          }
          resultado.conflitos += 1;
          resultado.itens.push({
            id: item.id,
            status: 'conflito',
            operacao: 'insert',
            erro: revisao.mensagem,
            codigo: data ? 'RESPOSTA_INVALIDA' : 'SEM_RESPOSTA',
          });
          continue;
        }

        aplicarSucessoLocal(database, item, parsed.data);
        resultado.sincronizados += 1;
        resultado.itens.push({ id: item.id, status: 'sucesso', operacao: 'insert' });
      } else {
        const idViagem = payload.id;
        const { id: _ignorado, ...dadosParaAtualizar } = payload;

        const { data, error } = await cliente
          .from('viagem')
          .update(dadosParaAtualizar as never)
          .eq('id', idViagem)
          .select(COLUNAS_VIAGEM)
          .maybeSingle();

        if (!sessaoLocalAtual(geracaoLocal)) {
          resultado.sessaoAlterada = true;
          break;
        }

        if (error) {
          const tratado = await tratarErroDoServidor(
            cliente,
            database,
            item,
            opcoes.usuarioId,
            payload,
            error,
            { maxTentativas, agora, geracaoLocal },
          );
          if (tratado.tipo === 'cancelada') {
            resultado.sessaoAlterada = true;
            break;
          }
          if (tratado.tipo === 'conexao') {
            resultado.semConexao = true;
            resultado.falhas += 1;
            resultado.itens.push({
              id: item.id,
              status: 'falha',
              operacao: 'update',
              erro: tratado.mensagem,
              codigo: 'CONEXAO',
            });
            break;
          }
          if (tratado.tipo === 'revisao') {
            resultado.conflitos += 1;
            resultado.itens.push({
              id: item.id,
              status: 'conflito',
              operacao: 'update',
              erro: tratado.mensagem,
              codigo: error.code,
            });
          } else {
            resultado.falhas += 1;
            resultado.itens.push({
              id: item.id,
              status: 'falha',
              operacao: 'update',
              erro: tratado.mensagem,
              codigo: error.code,
            });
          }
          continue;
        }

        if (!data) {
          // Zero linhas sem erro: a viagem não existe mais (ou o RLS escondeu). Nunca deletar
          // a outbox silenciosamente — o dado local é preservado e o conflito vai para revisão.
          const revisao = await enviarParaRevisao(
            cliente,
            database,
            item,
            opcoes.usuarioId,
            payload,
            'VIAGEM_AUSENTE',
            'A viagem não foi encontrada no servidor. A alteração local foi mantida para revisão.',
            { buscarServidor: true, agora, geracaoLocal },
          );
          if (revisao.tipo === 'cancelada') {
            resultado.sessaoAlterada = true;
            break;
          }
          if (revisao.tipo === 'conexao') {
            resultado.semConexao = true;
            resultado.falhas += 1;
            resultado.itens.push({
              id: item.id,
              status: 'falha',
              operacao: 'update',
              erro: revisao.mensagem,
              codigo: 'CONEXAO',
            });
            break;
          }
          resultado.conflitos += 1;
          resultado.itens.push({
            id: item.id,
            status: 'conflito',
            operacao: 'update',
            erro: revisao.mensagem,
            codigo: 'VIAGEM_AUSENTE',
          });
          continue;
        }

        const parsed = viagemApiSchema.safeParse(data);
        if (!parsed.success) {
          const revisao = await enviarParaRevisao(
            cliente,
            database,
            item,
            opcoes.usuarioId,
            payload,
            'RESPOSTA_INVALIDA',
            'O servidor devolveu uma viagem inválida.',
            { buscarServidor: true, agora, geracaoLocal },
          );
          if (revisao.tipo === 'cancelada') {
            resultado.sessaoAlterada = true;
            break;
          }
          if (revisao.tipo === 'conexao') {
            resultado.semConexao = true;
            resultado.falhas += 1;
            resultado.itens.push({
              id: item.id,
              status: 'falha',
              operacao: 'update',
              erro: revisao.mensagem,
              codigo: 'CONEXAO',
            });
            break;
          }
          resultado.conflitos += 1;
          resultado.itens.push({
            id: item.id,
            status: 'conflito',
            operacao: 'update',
            erro: revisao.mensagem,
            codigo: 'RESPOSTA_INVALIDA',
          });
          continue;
        }

        aplicarSucessoLocal(database, item, parsed.data);
        resultado.sincronizados += 1;
        resultado.itens.push({ id: item.id, status: 'sucesso', operacao: 'update' });
      }
    } catch (erro) {
      // A troca de conta durante a requisição não pode gravar erro nem aplicar nada na sessão nova.
      if (!sessaoLocalAtual(geracaoLocal)) {
        resultado.sessaoAlterada = true;
        break;
      }

      const mensagem = erro instanceof Error ? erro.message : 'Falha ao sincronizar com o servidor.';
      const erroNormalizado = {
        message: mensagem,
        code: erro instanceof Error ? (erro as Error & { code?: string }).code : undefined,
      };
      // Uma exceção de rede (fetch abortado, DNS, timeout) não pode queimar tentativa: o item
      // continua pendente e o backoff é aplicado quando a conexão voltar.
      if (ehErroConexao(erroNormalizado)) {
        const proxima = proximaTentativa(agora, item.tentativas);
        atualizarErroTemporario(
          database,
          item,
          MENSAGEM_SEM_CONEXAO,
          'CONEXAO',
          item.tentativas,
          proxima,
        );
        resultado.semConexao = true;
        resultado.falhas += 1;
        resultado.itens.push({
          id: item.id,
          status: 'falha',
          operacao: item.operacao,
          erro: MENSAGEM_SEM_CONEXAO,
          codigo: 'CONEXAO',
        });
        break;
      }

      const tentativas = item.tentativas + 1;
      atualizarErroTemporario(
        database,
        item,
        mensagem,
        'EXCECAO',
        tentativas,
        proximaTentativa(agora, tentativas),
      );
      resultado.falhas += 1;
      resultado.itens.push({
        id: item.id,
        status: 'falha',
        operacao: item.operacao,
        erro: mensagem,
        codigo: 'EXCECAO',
      });
      break;
    }
  }

  return resultado;
}

export async function sincronizarViagens(
  usuarioId: string,
  deps: DepsSync = {},
): Promise<ResultadoSincronizacao> {
  const geracaoLocal = deps.geracaoLocal ?? obterGeracaoLocal();
  const depsSessao = { ...deps, geracaoLocal };

  if (!sessaoLocalAtual(geracaoLocal)) {
    return resultadoSessaoAlterada(drenagemVazia());
  }

  const catalogos = await sincronizarCatalogos({ ...depsSessao, usuarioId });
  if (!sessaoLocalAtual(geracaoLocal) || (!catalogos.ok && catalogos.sessaoAlterada)) {
    return resultadoSessaoAlterada(drenagemVazia());
  }
  if (!catalogos.ok) {
    return {
      ok: false,
      semConexao: catalogos.mensagem === MENSAGEM_SEM_CONEXAO,
      mensagem: catalogos.mensagem,
      viagensBaixadas: 0,
      drenagem: drenagemVazia(),
    };
  }

  const primeiraCarga = await baixarViagens({ ...depsSessao, usuarioId });
  if (!sessaoLocalAtual(geracaoLocal) || (!primeiraCarga.ok && primeiraCarga.sessaoAlterada)) {
    return resultadoSessaoAlterada(drenagemVazia(), catalogos.data);
  }
  if (!primeiraCarga.ok) {
    return {
      ok: false,
      semConexao: primeiraCarga.mensagem === MENSAGEM_SEM_CONEXAO,
      mensagem: primeiraCarga.mensagem,
      catalogos: catalogos.data,
      viagensBaixadas: 0,
      drenagem: drenagemVazia(),
    };
  }

  const drenagem = await drenarOutboxViagens({ usuarioId, geracaoLocal }, depsSessao);
  if (!sessaoLocalAtual(geracaoLocal) || drenagem.sessaoAlterada) {
    return resultadoSessaoAlterada(drenagem, catalogos.data, primeiraCarga.data);
  }

  // O status do veículo e o km_rodado gerado mudam no servidor durante o dreno. A segunda
  // passada reconcilia o cache local, mas nunca sobrescreve outbox pendente.
  const veiculos = await baixarVeiculos(depsSessao);
  if (!sessaoLocalAtual(geracaoLocal) || (!veiculos.ok && veiculos.sessaoAlterada)) {
    return resultadoSessaoAlterada(drenagem, catalogos.data, primeiraCarga.data);
  }
  if (!veiculos.ok) {
    return {
      ok: false,
      semConexao: veiculos.mensagem === MENSAGEM_SEM_CONEXAO,
      mensagem: veiculos.mensagem,
      catalogos: catalogos.data,
      viagensBaixadas: primeiraCarga.data,
      drenagem,
    };
  }

  const segundaCarga = await baixarViagens({ ...depsSessao, usuarioId });
  if (!sessaoLocalAtual(geracaoLocal) || (!segundaCarga.ok && segundaCarga.sessaoAlterada)) {
    return resultadoSessaoAlterada(drenagem, catalogos.data, primeiraCarga.data);
  }
  if (!segundaCarga.ok) {
    return {
      ok: false,
      semConexao: segundaCarga.mensagem === MENSAGEM_SEM_CONEXAO,
      mensagem: segundaCarga.mensagem,
      catalogos: catalogos.data,
      viagensBaixadas: primeiraCarga.data,
      drenagem,
    };
  }

  return {
    ok: !drenagem.semConexao,
    semConexao: drenagem.semConexao,
    mensagem: drenagem.semConexao ? MENSAGEM_SEM_CONEXAO : undefined,
    catalogos: catalogos.data,
    viagensBaixadas: primeiraCarga.data + segundaCarga.data,
    drenagem,
  };
}

export async function sincronizarSeConectado(
  usuarioId: string,
  deps: DepsSync = {},
): Promise<ResultadoSincronizacao | null> {
  const net = deps.network ?? Network;
  const geracaoLocal = deps.geracaoLocal ?? obterGeracaoLocal();

  try {
    const estado = await net.getNetworkStateAsync();
    if (!sessaoLocalAtual(geracaoLocal)) return null;
    const conectado = Boolean(estado.isConnected && estado.isInternetReachable !== false);
    if (!conectado) return null;
  } catch {
    // Se a checagem falhar em algum ambiente, tenta sincronizar mesmo assim.
    if (!sessaoLocalAtual(geracaoLocal)) return null;
  }

  return sincronizarViagens(usuarioId, { ...deps, geracaoLocal });
}

export function obterStatusOutboxViagens(
  database: ViagensDb = getDb(),
  usuarioId?: string | null,
): { pendentes: number; comErro: number; conflitos: number; emRevisao: number } {
  if (!database || typeof database.select !== 'function') {
    return { pendentes: 0, comErro: 0, conflitos: 0, emRevisao: 0 };
  }

  const filtros = [eq(schema.outbox.entidade, 'viagem')];
  if (usuarioId && usuarioId.length > 0) {
    filtros.push(eq(schema.outbox.usuario_id, usuarioId));
  }

  const itens = database
    .select({
      status: schema.outbox.status,
      tentativas: schema.outbox.tentativas,
      ultimo_erro: schema.outbox.ultimo_erro,
      codigo_erro: schema.outbox.codigo_erro,
    })
    .from(schema.outbox)
    .where(and(...filtros))
    .all();

  const pendentes = itens.filter((item) => item.status === 'pendente');
  const emRevisao = itens.filter((item) => item.status === 'revisao').length;
  const comErro = pendentes.filter(
    (item) =>
      item.ultimo_erro !== null && item.codigo_erro !== null && item.codigo_erro !== 'CONEXAO',
  ).length;

  return {
    pendentes: pendentes.length,
    comErro,
    conflitos: emRevisao,
    emRevisao,
  };
}
