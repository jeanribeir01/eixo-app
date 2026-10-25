import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';

import * as local from '@/db/schema';
import { supabase } from '@/supabase/client';

import {
  payloadAberturaViagemSchema,
  payloadFechamentoViagemSchema,
  rotaCacheSchema,
  veiculoCacheSchema,
  viagemDetalhadaSchema,
  type PayloadAberturaViagem,
  type PayloadFechamentoViagem,
} from './schema';
import { COLUNAS_VIAGEM, getDb, traduzirErroBanco, type ViagensDb } from './viagensRepository';

// Sincronização das viagens com o Supabase (EIX-41, ADR 0004). Duas mãos:
//   1. `enviarPendencias`: drena a outbox, na ordem em que as coisas aconteceram no aparelho.
//   2. `baixarDadosDoServidor`: copia veículos, rotas e viagens do servidor para o SQLite, que é
//      de onde a tela lê. É assim que o gestor vê as viagens dos motoristas e que um aparelho novo
//      recebe o histórico.
// `sincronizarViagens` faz as duas, nessa ordem: primeiro sobe o que é do aparelho, depois o
// servidor (que vence) devolve o estado final.

// Erro temporário (servidor fora, timeout do banco) espera 30 s, 1 min, 2 min, 4 min... antes de
// tentar de novo. Depois de MAX_TENTATIVAS vira falha visível: não fica tentando para sempre.
export const MAX_TENTATIVAS = 5;
export const ESPERA_BASE_MS = 30_000;
const LIMITE_LOTE = 50;

// Cadastros pequenos: o limite só impede uma resposta sem teto (skill supabase-query).
const LIMITE_CADASTRO = 1000;
// O cache guarda as viagens mais recentes. Hodômetro só sobe, então o último final de cada
// veículo (regra VG004 no aparelho) está sempre entre elas.
const LIMITE_VIAGENS_BAIXADAS = 500;

// Códigos que o servidor devolve para dado que nunca vai passar: reenviar daria o mesmo erro.
// VG004/VG005/VG007 são disputa de hodômetro e vão para revisão do gestor (critério da EIX-41);
// os demais viram falha. Qualquer outro código é tratado como temporário.
const CODIGOS_CONFLITO = ['VG004', 'VG005', 'VG007'];
const CODIGOS_FALHA = ['VG001', 'VG002', 'VG003', 'VG006', '23502', '23503', '23505', '23514', '22P02', '42501', '428C9'];

export const MENSAGEM_VIAGEM_SUMIU_NO_SERVIDOR =
  'A viagem não foi encontrada no servidor, ou este usuário não tem acesso a ela.';
export const MENSAGEM_FECHADA_NO_SERVIDOR =
  'A viagem já tinha sido encerrada no servidor com outro hodômetro final. O registro do servidor foi mantido e este ficou para revisão do gestor.';
export const MENSAGEM_ABERTURA_RECUSADA =
  'A abertura desta viagem foi recusada pelo servidor, então este registro não foi enviado.';
const MENSAGEM_ITEM_CORROMPIDO = 'O registro guardado no aparelho está corrompido e não pode ser enviado.';

export type ResultadoEnvio = {
  enviados: number;
  falhas: number;
  conflitos: number;
  // true quando parou no meio porque a rede caiu. O que faltou continua pendente.
  semConexao: boolean;
};

export type StatusOutbox = { pendentes: number; falhas: number; conflitos: number };

type ClienteSupabase = typeof supabase;
export type DependenciasSync = { db?: ViagensDb; supabase?: ClienteSupabase };

type ErroServidor = { code?: string; message?: string; details?: string };

type Resposta =
  | { tipo: 'enviado' }
  | { tipo: 'sem_conexao' }
  | { tipo: 'temporario'; mensagem: string }
  | { tipo: 'recusado'; situacao: 'falha' | 'conflito'; mensagem: string };

// O supabase-js não lança exceção quando a rede cai: devolve um `error` com `code` vazio (e
// status HTTP 0). Todo erro que o servidor de fato respondeu traz código: SQLSTATE ou PGRST***.
export function ehErroConexao(error: ErroServidor): boolean {
  return !error.code;
}

function classificarErro(error: ErroServidor): Resposta {
  if (ehErroConexao(error)) {
    return { tipo: 'sem_conexao' };
  }

  const codigo = error.code ?? '';
  const mensagem = traduzirErroBanco(
    { code: codigo, message: error.message, details: error.details },
    'O servidor não aceitou o registro agora. Uma nova tentativa será feita.',
  ).mensagem;

  if (CODIGOS_CONFLITO.includes(codigo)) {
    return { tipo: 'recusado', situacao: 'conflito', mensagem };
  }
  if (CODIGOS_FALHA.includes(codigo)) {
    return { tipo: 'recusado', situacao: 'falha', mensagem };
  }
  return { tipo: 'temporario', mensagem };
}

// Upsert que ignora o id repetido (`on conflict (id) do nothing`): reenviar uma abertura que já
// subiu, porque a resposta se perdeu na estrada, não duplica a viagem nem mexe nela (idempotência).
async function enviarAbertura(cliente: ClienteSupabase, payload: PayloadAberturaViagem): Promise<Resposta> {
  const { error } = await cliente.from('viagem').upsert(payload, { onConflict: 'id', ignoreDuplicates: true });
  return error ? classificarErro(error) : { tipo: 'enviado' };
}

// O filtro de status é o mesmo do fechamento online (EIX-40): sem ele, um fechamento atrasado de
// uma viagem que o gestor já encerrou passaria como "correção de hodômetro" e trocaria o valor
// do servidor sem ninguém ver.
async function enviarFechamento(cliente: ClienteSupabase, payload: PayloadFechamentoViagem): Promise<Resposta> {
  const { id, ...campos } = payload;
  const { data, error } = await cliente
    .from('viagem')
    .update(campos)
    .eq('id', id)
    .eq('status', 'EmAndamento')
    .select('id')
    .maybeSingle();

  if (error) return classificarErro(error);
  if (data) return { tipo: 'enviado' };

  // Nenhuma linha mudou. Antes de chamar de erro, confere o que o servidor tem: pode ser o
  // reenvio de um fechamento que já tinha subido (a resposta da primeira vez se perdeu).
  const atual = await cliente.from('viagem').select('status, hodometro_final').eq('id', id).maybeSingle();
  if (atual.error) return classificarErro(atual.error);

  if (!atual.data) {
    return { tipo: 'recusado', situacao: 'falha', mensagem: MENSAGEM_VIAGEM_SUMIU_NO_SERVIDOR };
  }
  if (atual.data.status === payload.status && atual.data.hodometro_final === payload.hodometro_final) {
    return { tipo: 'enviado' };
  }
  return { tipo: 'recusado', situacao: 'conflito', mensagem: MENSAGEM_FECHADA_NO_SERVIDOR };
}

// Lê o payload de volta do texto. `null` = item corrompido.
function lerPayload(item: local.OutboxItem): PayloadAberturaViagem | PayloadFechamentoViagem | null {
  let bruto: unknown;
  try {
    bruto = JSON.parse(item.payload);
  } catch {
    return null;
  }
  const schema = item.operacao === 'insert' ? payloadAberturaViagemSchema : payloadFechamentoViagemSchema;
  const parsed = schema.safeParse(bruto);
  return parsed.success ? parsed.data : null;
}

function idDaViagem(item: local.OutboxItem): string | null {
  return lerPayload(item)?.id ?? null;
}

function marcarRecusado(
  database: ViagensDb,
  item: local.OutboxItem,
  situacao: 'falha' | 'conflito',
  mensagem: string,
): void {
  database
    .update(local.outbox)
    .set({ situacao, ultimo_erro: mensagem, tentativas: item.tentativas + 1, proxima_tentativa_em: null })
    .where(eq(local.outbox.id, item.id))
    .run();
}

// O servidor nunca aceitou esta viagem. No aparelho ela vira Cancelada: libera o veículo (o índice
// "um andamento por veículo" travaria a próxima abertura para sempre) e continua na lista, com a
// falha na fila, para o motorista ver o que aconteceu. Os itens seguintes da mesma viagem (o
// fechamento) não têm o que atualizar no servidor e ficam marcados junto.
function desfazerAberturaRecusada(database: ViagensDb, viagemId: string, itemRecusadoId: string): void {
  const agora = new Date().toISOString();
  database.transaction((tx) => {
    tx.update(local.viagem)
      .set({ status: 'Cancelada', data_atualizacao: agora })
      .where(eq(local.viagem.id, viagemId))
      .run();

    const seguintes = tx
      .select()
      .from(local.outbox)
      .where(and(eq(local.outbox.situacao, 'pendente'), ne(local.outbox.id, itemRecusadoId)))
      .all()
      .filter((item) => idDaViagem(item) === viagemId);

    for (const item of seguintes) {
      tx.update(local.outbox)
        .set({ situacao: 'falha', ultimo_erro: MENSAGEM_ABERTURA_RECUSADA, proxima_tentativa_em: null })
        .where(eq(local.outbox.id, item.id))
        .run();
    }
  });
}

export async function enviarPendencias(deps: DependenciasSync = {}): Promise<ResultadoEnvio> {
  const database = deps.db ?? getDb();
  const cliente = deps.supabase ?? supabase;
  const resultado: ResultadoEnvio = { enviados: 0, falhas: 0, conflitos: 0, semConexao: false };

  // Só o que ainda pode subir. Falha e conflito ficam fora: se entrassem no lote, 50 deles
  // parados ocupariam o lote inteiro e nada novo subiria mais. `rowid` desempata dois itens
  // gravados no mesmo milissegundo (abrir e fechar muito rápido).
  const itens = database
    .select()
    .from(local.outbox)
    .where(and(eq(local.outbox.entidade, 'viagem'), eq(local.outbox.situacao, 'pendente')))
    .orderBy(asc(local.outbox.criado_em), asc(sql`rowid`))
    .limit(LIMITE_LOTE)
    .all();

  // Viagem cujo item anterior ainda não subiu. O fechamento não pode passar na frente da abertura:
  // o servidor não teria a linha para atualizar.
  const viagensEsperando = new Set<string>();
  const agora = Date.now();

  for (const item of itens) {
    const payload = lerPayload(item);
    if (!payload) {
      marcarRecusado(database, item, 'falha', MENSAGEM_ITEM_CORROMPIDO);
      resultado.falhas++;
      continue;
    }

    if (viagensEsperando.has(payload.id)) continue;

    if (item.proxima_tentativa_em && Date.parse(item.proxima_tentativa_em) > agora) {
      viagensEsperando.add(payload.id);
      continue;
    }

    let resposta: Resposta;
    try {
      resposta =
        item.operacao === 'insert'
          ? await enviarAbertura(cliente, payload as PayloadAberturaViagem)
          : await enviarFechamento(cliente, payload as PayloadFechamentoViagem);
    } catch (erro) {
      // O supabase-js não costuma lançar; se lançar, é um problema que pode passar sozinho.
      const mensagem = erro instanceof Error ? erro.message : 'Falha inesperada ao enviar.';
      resposta = { tipo: 'temporario', mensagem };
    }

    if (resposta.tipo === 'enviado') {
      database.delete(local.outbox).where(eq(local.outbox.id, item.id)).run();
      resultado.enviados++;
      continue;
    }

    if (resposta.tipo === 'sem_conexao') {
      // Sem rede, nada mais vai passar agora. Não conta como tentativa: o motorista pode ficar
      // horas sem sinal, e isso não pode transformar o registro em falha.
      resultado.semConexao = true;
      break;
    }

    viagensEsperando.add(payload.id);

    if (resposta.tipo === 'temporario') {
      const tentativas = item.tentativas + 1;
      if (tentativas >= MAX_TENTATIVAS) {
        marcarRecusado(database, item, 'falha', resposta.mensagem);
        resultado.falhas++;
      } else {
        const espera = ESPERA_BASE_MS * 2 ** (tentativas - 1);
        database
          .update(local.outbox)
          .set({
            tentativas,
            ultimo_erro: resposta.mensagem,
            proxima_tentativa_em: new Date(agora + espera).toISOString(),
          })
          .where(eq(local.outbox.id, item.id))
          .run();
      }
      continue;
    }

    marcarRecusado(database, item, resposta.situacao, resposta.mensagem);
    if (resposta.situacao === 'conflito') {
      resultado.conflitos++;
    } else {
      resultado.falhas++;
    }
    if (item.operacao === 'insert') {
      desfazerAberturaRecusada(database, payload.id, item.id);
    }
  }

  return resultado;
}

// Viagens com algum item na outbox. Pendente: o aparelho tem uma mudança que o servidor ainda não
// viu, então a cópia do servidor não pode sobrescrevê-la. Falha ou conflito: o registro só existe
// aqui (ou diverge do servidor), e apagá-lo esconderia o problema que a fila está mostrando.
function viagensNaOutbox(database: ViagensDb): { pendentes: Set<string>; todas: Set<string> } {
  const pendentes = new Set<string>();
  const todas = new Set<string>();
  for (const item of database.select().from(local.outbox).all()) {
    const id = idDaViagem(item);
    if (!id) continue;
    todas.add(id);
    if (item.situacao === 'pendente') pendentes.add(id);
  }
  return { pendentes, todas };
}

export async function baixarDadosDoServidor(
  deps: DependenciasSync = {},
): Promise<{ ok: true } | { ok: false; mensagem: string; semConexao: boolean }> {
  const database = deps.db ?? getDb();
  const cliente = deps.supabase ?? supabase;

  // O RLS decide o que vem: o Motorista recebe só as próprias viagens, o Admin/Gestor recebe
  // todas. O nome do motorista vem embutido (só o nome, nunca o e-mail) para a tela mostrar quem
  // dirige sem consultar `usuario`.
  const [veiculos, rotas, viagens] = await Promise.all([
    cliente
      .from('veiculo')
      .select('id, placa, marca, modelo, capacidade_carga, status, ano_fabricacao, data_inclusao, data_atualizacao')
      .limit(LIMITE_CADASTRO),
    cliente
      .from('rota')
      .select('id, cidade_origem, cidade_destino, uf_origem, uf_destino, distancia_estimada_km, ativa, data_inclusao, data_atualizacao')
      .limit(LIMITE_CADASTRO),
    cliente
      .from('viagem')
      .select(`${COLUNAS_VIAGEM}, motorista:usuario!viagem_motorista_id_fkey (id, nome)`)
      .order('data_inclusao', { ascending: false })
      .limit(LIMITE_VIAGENS_BAIXADAS),
  ]);

  const erro = veiculos.error ?? rotas.error ?? viagens.error;
  if (erro) {
    return {
      ok: false,
      semConexao: ehErroConexao(erro),
      mensagem: traduzirErroBanco(
        { code: erro.code, message: erro.message },
        'Não foi possível atualizar os dados do servidor.',
      ).mensagem,
    };
  }

  const veiculosValidos = veiculoCacheSchema.array().safeParse(veiculos.data);
  const rotasValidas = rotaCacheSchema.array().safeParse(rotas.data);
  const viagensValidas = viagemDetalhadaSchema.array().safeParse(viagens.data);
  if (!veiculosValidos.success || !rotasValidas.success || !viagensValidas.success) {
    return { ok: false, semConexao: false, mensagem: 'Os dados recebidos do servidor são inválidos.' };
  }

  // Tudo numa transação: a tela nunca lê um cache pela metade.
  database.transaction((tx) => {
    for (const veiculo of veiculosValidos.data) {
      const { id, ...campos } = veiculo;
      tx.insert(local.veiculo).values(veiculo).onConflictDoUpdate({ target: local.veiculo.id, set: campos }).run();
    }

    for (const rota of rotasValidas.data) {
      const { id, ...campos } = rota;
      tx.insert(local.rota).values(rota).onConflictDoUpdate({ target: local.rota.id, set: campos }).run();
    }

    const naOutbox = viagensNaOutbox(tx);
    const idsDoServidor = new Set<string>();

    for (const { veiculo, rota, motorista, ...viagem } of viagensValidas.data) {
      idsDoServidor.add(viagem.id);

      if (motorista) {
        tx.insert(local.motorista)
          .values({ id: motorista.id, nome: motorista.nome })
          .onConflictDoUpdate({ target: local.motorista.id, set: { nome: motorista.nome } })
          .run();
      }

      if (naOutbox.pendentes.has(viagem.id)) continue;

      const { id, ...campos } = viagem;
      tx.insert(local.viagem).values(viagem).onConflictDoUpdate({ target: local.viagem.id, set: campos }).run();
    }

    // O aparelho espelha o que o servidor deixa esta pessoa ver. Uma viagem que sumiu de lá (fora
    // do limite, ou de outro usuário que usou este celular) sai daqui também, desde que não tenha
    // nada na outbox. É o que impede o próximo motorista de ver as viagens do anterior.
    const locais = tx.select({ id: local.viagem.id }).from(local.viagem).all();
    for (const { id } of locais) {
      if (!idsDoServidor.has(id) && !naOutbox.todas.has(id)) {
        tx.delete(local.viagem).where(eq(local.viagem.id, id)).run();
      }
    }

    // A viagem aberta no aparelho que ainda não subiu continua ocupando o veículo, mesmo que o
    // servidor ainda diga Disponível.
    const abertasAqui = tx
      .select({ veiculo_id: local.viagem.veiculo_id })
      .from(local.viagem)
      .where(eq(local.viagem.status, 'EmAndamento'))
      .all()
      .map((linha) => linha.veiculo_id);
    if (abertasAqui.length > 0) {
      tx.update(local.veiculo).set({ status: 'EmViagem' }).where(inArray(local.veiculo.id, abertasAqui)).run();
    }
  });

  return { ok: true };
}

// Sobe o que está pendente e, se `baixar` for true, traz o estado do servidor. Sem sessão não faz
// nada: o RLS recusaria tudo como 42501 e os itens virariam falha só porque ninguém logou ainda.
export async function sincronizarViagens(
  opcoes: { baixar?: boolean } = {},
  deps: DependenciasSync = {},
): Promise<ResultadoEnvio | null> {
  const cliente = deps.supabase ?? supabase;
  const { data } = await cliente.auth.getSession();
  if (!data.session) return null;

  const envio = await enviarPendencias(deps);
  if (opcoes.baixar !== false && !envio.semConexao) {
    await baixarDadosDoServidor(deps);
  }
  return envio;
}

export function obterStatusOutbox(database: ViagensDb = getDb()): StatusOutbox {
  const linhas = database
    .select({ situacao: local.outbox.situacao, total: sql<number>`count(*)` })
    .from(local.outbox)
    .where(eq(local.outbox.entidade, 'viagem'))
    .groupBy(local.outbox.situacao)
    .all();

  const status: StatusOutbox = { pendentes: 0, falhas: 0, conflitos: 0 };
  for (const { situacao, total } of linhas) {
    if (situacao === 'pendente') status.pendentes = total;
    if (situacao === 'falha') status.falhas = total;
    if (situacao === 'conflito') status.conflitos = total;
  }
  return status;
}
