import { and, asc, eq } from 'drizzle-orm';
import * as Network from 'expo-network';

import * as schema from '@/db/schema';
import { supabase } from '@/supabase/client';

import { viagemIdDoPayload } from './outboxLocal';
import { obterGeracaoLocal, sessaoLocalAtual } from './sessaoLocal';
import {
  MENSAGEM_SEM_CONEXAO,
  MENSAGEM_SESSAO_ALTERADA,
  ehErroConexao,
} from './syncErros';
import {
  aplicarViagemServidor,
  baixarRevisoesResolvidas,
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
  // Itens que continuam na outbox depois desta passada. Inclui os que estão em backoff e os que
  // ficaram fora do limite. O store usa isso para não encerrar o ciclo de retry sem agendamento.
  restantes: number;
  // Menor `proxima_tentativa_em` entre os itens restantes; null quando não há restante ou quando
  // algum item já pode ser tentado agora.
  proximaTentativaEm: string | null;
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
    restantes: 0,
    proximaTentativaEm: null,
  };
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

function aplicarSucessoLocal(
  database: ViagensDb,
  item: schema.OutboxItem,
  data: ViagemApi,
): void {
  // Outra operação da mesma viagem pode já estar na fila (ex.: viagem aberta e fechada offline).
  // Nesse caso a resposta do servidor é antiga em relação ao estado local: aplicar agora
  // sobrescreveria um fechamento que ainda será enviado. A linha local só é reconciliada quando a
  // última operação da viagem sair da outbox.
  const outras = database
    .select({
      id: schema.outbox.id,
      payload: schema.outbox.payload,
      status: schema.outbox.status,
    })
    .from(schema.outbox)
    .where(eq(schema.outbox.usuario_id, item.usuario_id))
    .all()
    .filter((linha) => linha.id !== item.id && viagemIdDoPayload(linha.payload) === data.id);

  const pendente = outras.some((linha) => linha.status === 'pendente');
  // O selo "Em revisão" não pode ser apagado pelo sucesso de outra operação da mesma viagem.
  const emRevisao = outras.some((linha) => linha.status === 'revisao');

  database.transaction((tx) => {
    tx.delete(schema.outbox).where(eq(schema.outbox.id, item.id)).run();
    if (pendente) {
      if (emRevisao) {
        tx.update(schema.viagem)
          .set({ em_revisao: true })
          .where(eq(schema.viagem.id, data.id))
          .run();
      }
      return;
    }
    aplicarViagemServidor(tx as ViagensDb, data, { emRevisao });
  });
}

// Fila da conta na ordem em que as operações foram gravadas. Inclui as linhas em revisão porque
// elas também seguram as operações seguintes da mesma viagem.
function lerFila(database: ViagensDb, usuarioId: string): schema.OutboxItem[] {
  return database
    .select()
    .from(schema.outbox)
    .where(and(eq(schema.outbox.entidade, 'viagem'), eq(schema.outbox.usuario_id, usuarioId)))
    .orderBy(asc(schema.outbox.criado_em), asc(schema.outbox.id))
    .all();
}

function resumirPendencias(
  database: ViagensDb,
  usuarioId: string,
): { restantes: number; proximaTentativaEm: string | null } {
  // Só a operação mais antiga de cada viagem conta para o agendamento: as seguintes sobem logo
  // depois dela, na mesma passada. As que esperam uma revisão do gestor não pedem retry — elas
  // saem da espera quando o pull baixa a decisão.
  const vistas = new Set<string>();
  let restantes = 0;
  let algumaProntaAgora = false;
  let proximaTentativaEm: string | null = null;

  for (const linha of lerFila(database, usuarioId)) {
    const viagemId = viagemIdDoPayload(linha.payload);
    const dependente = viagemId !== null && vistas.has(viagemId);
    if (viagemId) vistas.add(viagemId);
    if (linha.status !== 'pendente' || dependente) continue;

    restantes += 1;
    if (linha.proxima_tentativa_em === null) {
      // Um item sem backoff já pode ser tentado: o próximo ciclo não pode esperar por outro item.
      algumaProntaAgora = true;
    } else if (proximaTentativaEm === null || linha.proxima_tentativa_em < proximaTentativaEm) {
      proximaTentativaEm = linha.proxima_tentativa_em;
    }
  }

  return { restantes, proximaTentativaEm: algumaProntaAgora ? null : proximaTentativaEm };
}

type Desfecho =
  | { tipo: 'sucesso' }
  | {
      tipo: 'conflito' | 'falha' | 'conexao' | 'cancelada';
      mensagem: string;
      codigo?: string;
      // Falha inesperada (exceção que não é de rede): encerra a passada em vez de insistir.
      parar?: boolean;
    };

type ContextoDreno = {
  cliente: typeof supabase;
  database: ViagensDb;
  usuarioId: string;
  maxTentativas: number;
  agora: Date;
  geracaoLocal: number;
};

function desfechoDaRevisao(
  revisao: { tipo: 'revisao' | 'falha' | 'conexao' | 'cancelada'; mensagem: string },
  codigo: string | undefined,
): Desfecho {
  if (revisao.tipo === 'revisao') return { tipo: 'conflito', mensagem: revisao.mensagem, codigo };
  if (revisao.tipo === 'falha') return { tipo: 'falha', mensagem: revisao.mensagem, codigo };
  return { tipo: revisao.tipo, mensagem: revisao.mensagem };
}

async function revisar(
  ctx: ContextoDreno,
  item: schema.OutboxItem,
  payload: Record<string, unknown>,
  codigo: string,
  mensagem: string,
  buscarServidor = false,
): Promise<Desfecho> {
  const revisao = await enviarParaRevisao(
    ctx.cliente,
    ctx.database,
    item,
    ctx.usuarioId,
    payload,
    codigo,
    mensagem,
    { buscarServidor, agora: ctx.agora, geracaoLocal: ctx.geracaoLocal },
  );
  return desfechoDaRevisao(revisao, codigo);
}

// Envia UMA operação da outbox e diz o que aconteceu. Toda a escrita local do resultado (apagar da
// fila, backoff, revisão) acontece aqui dentro; o laço do dreno só contabiliza.
async function enviarItem(ctx: ContextoDreno, item: schema.OutboxItem): Promise<Desfecho> {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(item.payload) as Record<string, unknown>;
  } catch {
    return revisar(ctx, item, {}, 'PAYLOAD_INVALIDO', 'A operação local está corrompida e precisa de revisão.');
  }

  // REGRA CRÍTICA: km_rodado NUNCA é enviado ao Supabase (coluna gerada, erro 428C9).
  delete payload.km_rodado;

  if (typeof payload.id !== 'string' || payload.id.length === 0) {
    return revisar(
      ctx,
      item,
      payload,
      'PAYLOAD_SEM_ID',
      'A operação local não tem identificador e precisa de revisão.',
    );
  }

  if (item.tentativas >= ctx.maxTentativas) {
    return revisar(
      ctx,
      item,
      payload,
      'MAX_TENTATIVAS',
      `A operação não sincronizou após ${item.tentativas} tentativas e foi encaminhada para revisão.`,
    );
  }

  try {
    const idViagem = payload.id;
    const { id: _ignorado, ...dadosParaAtualizar } = payload;
    const { data, error } =
      item.operacao === 'insert'
        ? await ctx.cliente
            .from('viagem')
            .upsert(payload as never, { onConflict: 'id' })
            .select(COLUNAS_VIAGEM)
            .maybeSingle()
        : await ctx.cliente
            .from('viagem')
            .update(dadosParaAtualizar as never)
            .eq('id', idViagem)
            .select(COLUNAS_VIAGEM)
            .maybeSingle();

    if (!sessaoLocalAtual(ctx.geracaoLocal)) {
      return { tipo: 'cancelada', mensagem: MENSAGEM_SESSAO_ALTERADA };
    }

    if (error) {
      const tratado = await tratarErroDoServidor(ctx.cliente, ctx.database, item, ctx.usuarioId, payload, error, {
        maxTentativas: ctx.maxTentativas,
        agora: ctx.agora,
        geracaoLocal: ctx.geracaoLocal,
      });
      return desfechoDaRevisao(tratado, error.code);
    }

    if (!data) {
      // Zero linhas sem erro. No insert, o servidor não confirmou a gravação; no update, a viagem
      // não existe (ou o RLS a escondeu). Nunca apagar a outbox em silêncio: o dado local é
      // preservado e o conflito vai para revisão.
      return item.operacao === 'insert'
        ? revisar(ctx, item, payload, 'SEM_RESPOSTA', 'O servidor não confirmou a gravação da viagem.', true)
        : revisar(
            ctx,
            item,
            payload,
            'VIAGEM_AUSENTE',
            'A viagem não foi encontrada no servidor. A alteração local foi mantida para revisão.',
            true,
          );
    }

    const parsed = viagemApiSchema.safeParse(data);
    if (!parsed.success) {
      return revisar(ctx, item, payload, 'RESPOSTA_INVALIDA', 'O servidor devolveu uma viagem inválida.', true);
    }

    aplicarSucessoLocal(ctx.database, item, parsed.data);
    return { tipo: 'sucesso' };
  } catch (erro) {
    // A troca de conta durante a requisição não pode gravar erro nem aplicar nada na sessão nova.
    if (!sessaoLocalAtual(ctx.geracaoLocal)) {
      return { tipo: 'cancelada', mensagem: MENSAGEM_SESSAO_ALTERADA };
    }

    const mensagem = erro instanceof Error ? erro.message : 'Falha ao sincronizar com o servidor.';
    const erroNormalizado = {
      message: mensagem,
      code: erro instanceof Error ? (erro as Error & { code?: string }).code : undefined,
    };
    // Uma exceção de rede (fetch abortado, DNS, timeout) não pode queimar tentativa: o item
    // continua pendente e o backoff é aplicado quando a conexão voltar.
    if (ehErroConexao(erroNormalizado)) {
      atualizarErroTemporario(
        ctx.database,
        item,
        MENSAGEM_SEM_CONEXAO,
        'CONEXAO',
        item.tentativas,
        proximaTentativa(ctx.agora, item.tentativas),
      );
      return { tipo: 'conexao', mensagem: MENSAGEM_SEM_CONEXAO };
    }

    const tentativas = item.tentativas + 1;
    atualizarErroTemporario(
      ctx.database,
      item,
      mensagem,
      'EXCECAO',
      tentativas,
      proximaTentativa(ctx.agora, tentativas),
    );
    return { tipo: 'falha', mensagem, codigo: 'EXCECAO', parar: true };
  }
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

  const ctx: ContextoDreno = {
    cliente,
    database,
    usuarioId: opcoes.usuarioId,
    maxTentativas,
    agora,
    geracaoLocal,
  };
  const resultado = drenagemVazia();

  // Viagens cuja operação mais antiga ainda não subiu. As operações seguintes da mesma viagem
  // esperam: o fechamento (update) enviado antes da abertura (insert) afetaria zero linhas no
  // servidor e iria para revisão como VIAGEM_AUSENTE, mesmo com a abertura prestes a subir.
  const bloqueadas = new Set<string>();

  for (const item of lerFila(database, opcoes.usuarioId)) {
    // A conta pode ter mudado enquanto a requisição anterior estava em voo. A fila da conta
    // anterior fica preservada; nenhuma escrita local pode acontecer depois dessa troca.
    if (!sessaoLocalAtual(geracaoLocal)) {
      resultado.sessaoAlterada = true;
      break;
    }

    const viagemId = viagemIdDoPayload(item.payload);
    if (viagemId && bloqueadas.has(viagemId)) continue;

    // Em revisão ou em backoff: não sobe agora e segura o que vem depois da mesma viagem.
    const aguardando =
      item.status !== 'pendente' ||
      (item.proxima_tentativa_em !== null && item.proxima_tentativa_em > agoraIso);
    if (aguardando) {
      if (viagemId) bloqueadas.add(viagemId);
      continue;
    }

    if (resultado.total >= limite) break;
    resultado.total += 1;

    const desfecho = await enviarItem(ctx, item);

    if (desfecho.tipo === 'sucesso') {
      resultado.sincronizados += 1;
      resultado.itens.push({ id: item.id, status: 'sucesso', operacao: item.operacao });
      continue;
    }

    if (desfecho.tipo === 'cancelada') {
      resultado.sessaoAlterada = true;
      break;
    }

    if (desfecho.tipo === 'conexao') {
      // Sem conexão, o resto da fila também falharia: para a passada e espera a rede voltar.
      resultado.semConexao = true;
      resultado.falhas += 1;
      resultado.itens.push({
        id: item.id,
        status: 'falha',
        operacao: item.operacao,
        erro: desfecho.mensagem,
        codigo: 'CONEXAO',
      });
      break;
    }

    if (viagemId) bloqueadas.add(viagemId);
    if (desfecho.tipo === 'conflito') {
      resultado.conflitos += 1;
    } else {
      resultado.falhas += 1;
    }
    resultado.itens.push({
      id: item.id,
      status: desfecho.tipo,
      operacao: item.operacao,
      erro: desfecho.mensagem,
      codigo: desfecho.codigo,
    });
    if (desfecho.parar) break;
  }

  // A conta pode ter mudado durante a última operação. Nesse caso a outbox consultada pertence à
  // sessão nova e não deve alimentar o retry da sessão antiga.
  if (!resultado.sessaoAlterada && sessaoLocalAtual(geracaoLocal)) {
    const pendencias = resumirPendencias(database, opcoes.usuarioId);
    resultado.restantes = pendencias.restantes;
    resultado.proximaTentativaEm = pendencias.proximaTentativaEm;
  }

  return resultado;
}

/**
 * Ciclo completo de sincronização, nesta ordem:
 *
 * 1. Baixa as revisões que o gestor já decidiu, para liberar as viagens presas nelas.
 * 2. Sobe a outbox. Vem antes do download de propósito: o que o motorista gravou offline
 *    (RNF07) não pode esperar o download dar certo — uma linha inválida no catálogo não segura
 *    os hodômetros no aparelho.
 * 3. Baixa catálogos e viagens UMA vez, já depois do dreno, trazendo o status do veículo e o
 *    km_rodado que o servidor calculou durante o envio.
 */
export async function sincronizarViagens(
  usuarioId: string,
  deps: DepsSync = {},
): Promise<ResultadoSincronizacao> {
  const geracaoLocal = deps.geracaoLocal ?? obterGeracaoLocal();
  const depsSessao = { ...deps, geracaoLocal };

  if (!sessaoLocalAtual(geracaoLocal)) {
    return resultadoSessaoAlterada(drenagemVazia());
  }

  // Uma falha aqui não impede o dreno: no pior caso, a viagem continua presa na revisão até a
  // próxima sincronização.
  const revisoes = await baixarRevisoesResolvidas({ ...depsSessao, usuarioId });
  if (!sessaoLocalAtual(geracaoLocal) || (!revisoes.ok && revisoes.sessaoAlterada)) {
    return resultadoSessaoAlterada(drenagemVazia());
  }

  const drenagem = await drenarOutboxViagens({ usuarioId, geracaoLocal }, depsSessao);
  if (!sessaoLocalAtual(geracaoLocal) || drenagem.sessaoAlterada) {
    return resultadoSessaoAlterada(drenagem);
  }

  // Sem conexão no envio, o download também falharia: devolve já, com o retry agendado pelo store.
  if (drenagem.semConexao) {
    return {
      ok: false,
      semConexao: true,
      mensagem: MENSAGEM_SEM_CONEXAO,
      viagensBaixadas: 0,
      drenagem,
    };
  }

  const catalogos = await sincronizarCatalogos({ ...depsSessao, usuarioId });
  if (!sessaoLocalAtual(geracaoLocal) || (!catalogos.ok && catalogos.sessaoAlterada)) {
    return resultadoSessaoAlterada(drenagem);
  }
  if (!catalogos.ok) {
    return {
      ok: false,
      semConexao: catalogos.mensagem === MENSAGEM_SEM_CONEXAO,
      mensagem: catalogos.mensagem,
      viagensBaixadas: 0,
      drenagem,
    };
  }

  const viagens = await baixarViagens({ ...depsSessao, usuarioId });
  if (!sessaoLocalAtual(geracaoLocal) || (!viagens.ok && viagens.sessaoAlterada)) {
    return resultadoSessaoAlterada(drenagem, catalogos.data);
  }
  if (!viagens.ok) {
    return {
      ok: false,
      semConexao: viagens.mensagem === MENSAGEM_SEM_CONEXAO,
      mensagem: viagens.mensagem,
      catalogos: catalogos.data,
      viagensBaixadas: 0,
      drenagem,
    };
  }

  if (!revisoes.ok) {
    return {
      ok: false,
      semConexao: revisoes.mensagem === MENSAGEM_SEM_CONEXAO,
      mensagem: revisoes.mensagem,
      catalogos: catalogos.data,
      viagensBaixadas: viagens.data,
      drenagem,
    };
  }

  const falhaParcial = drenagem.falhas > 0;
  return {
    ok: !falhaParcial,
    semConexao: false,
    mensagem: falhaParcial ? 'Alguns registros não foram enviados. Nova tentativa em instantes.' : undefined,
    catalogos: catalogos.data,
    viagensBaixadas: viagens.data,
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
