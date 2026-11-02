import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import * as schema from '@/db/schema';
import { supabase } from '@/supabase/client';
import { Constants } from '@/types/database';

import { getDb, type ViagensDb } from './viagensRepository';
import { idsDeViagensNaOutbox, viagemIdDoPayload } from './outboxLocal';
import { sessaoLocalAtual } from './sessaoLocal';
import { ehErroConexao, MENSAGEM_SEM_CONEXAO, MENSAGEM_SESSAO_ALTERADA } from './syncErros';
import type { Resultado } from './types';

// ---------------------------------------------------------------------------
// Schemas do que chega do PostgREST. O banco é a fonte de verdade, mas a resposta continua sendo
// validada: uma coluna nova/renomeada não pode entrar no SQLite sem contrato.
// ---------------------------------------------------------------------------
const perfilRelacaoSchema = z.preprocess(
  (valor) => (Array.isArray(valor) ? valor[0] : valor),
  z.object({ nome: z.enum(Constants.public.Enums.perfil_nome) }),
);

const usuarioApiSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string(),
  status: z.enum(Constants.public.Enums.status_usuario),
  data_atualizacao: z.string(),
  perfil: perfilRelacaoSchema,
});

const veiculoApiSchema = z.object({
  id: z.string(),
  placa: z.string(),
  marca: z.string(),
  modelo: z.string(),
  capacidade_carga: z.coerce.number(),
  status: z.enum(Constants.public.Enums.status_veiculo),
  ano_fabricacao: z.coerce.number().nullable(),
  data_inclusao: z.string(),
  data_atualizacao: z.string(),
});

const rotaApiSchema = z.object({
  id: z.string(),
  cidade_origem: z.string(),
  cidade_destino: z.string(),
  uf_origem: z.enum(Constants.public.Enums.uf),
  uf_destino: z.enum(Constants.public.Enums.uf),
  distancia_estimada_km: z.coerce.number(),
  ativa: z.boolean(),
  data_inclusao: z.string(),
  data_atualizacao: z.string(),
});

export const viagemApiSchema = z.object({
  id: z.string(),
  veiculo_id: z.string(),
  rota_id: z.string(),
  motorista_id: z.string(),
  hodometro_inicial: z.coerce.number(),
  hodometro_final: z.coerce.number().nullable(),
  data_inicio: z.string().nullable(),
  data_fim: z.string().nullable(),
  status: z.enum(Constants.public.Enums.status_viagem),
  km_rodado: z.coerce.number().nullable(),
  data_inclusao: z.string(),
  data_atualizacao: z.string(),
});

export type ViagemApi = z.infer<typeof viagemApiSchema>;
type UsuarioApi = z.infer<typeof usuarioApiSchema>;
type VeiculoApi = z.infer<typeof veiculoApiSchema>;
type RotaApi = z.infer<typeof rotaApiSchema>;

type ErroSupabase = { code?: string; message?: string } | null;
type PaginaSupabase = { data: unknown[] | null; error: ErroSupabase };
type DepsPull = {
  db?: ViagensDb;
  supabase?: typeof supabase;
  usuarioId?: string | null;
  geracaoLocal?: number;
};

const TAMANHO_PAGINA = 500;
const MENSAGEM_DADOS_INVALIDOS = 'Os dados recebidos do servidor são inválidos. Tente novamente.';
const MENSAGEM_FALHA_PULL = 'Não foi possível atualizar os dados. Tente novamente.';

// Lotes do filtro `in` na consulta de revisões: mantém a URL do PostgREST curta.
const TAMANHO_LOTE_IDS = 100;
// Lotes de delete no SQLite: fica abaixo do limite de variáveis por comando.
const TAMANHO_LOTE_DELETE = 500;

function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}

function sessaoAlterada<T>(): Resultado<T> {
  return { ok: false, mensagem: MENSAGEM_SESSAO_ALTERADA, sessaoAlterada: true };
}

async function buscarPaginado<T>(
  buscarPagina: (de: number, ate: number) => PromiseLike<PaginaSupabase>,
  validar: (item: unknown) => T | null,
): Promise<Resultado<T[]>> {
  const itens: T[] = [];
  let de = 0;

  for (;;) {
    let paginaResposta: PaginaSupabase;
    try {
      paginaResposta = await buscarPagina(de, de + TAMANHO_PAGINA - 1);
    } catch (erro) {
      return {
        ok: false,
        mensagem: ehErroConexao({
          message: erro instanceof Error ? erro.message : String(erro),
        })
          ? MENSAGEM_SEM_CONEXAO
          : MENSAGEM_FALHA_PULL,
      };
    }

    const { data, error } = paginaResposta;
    if (error) {
      return {
        ok: false,
        mensagem: ehErroConexao(error) ? MENSAGEM_SEM_CONEXAO : MENSAGEM_FALHA_PULL,
      };
    }

    const pagina = data ?? [];
    for (const linha of pagina) {
      const validado = validar(linha);
      if (validado === null) {
        return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
      }
      itens.push(validado);
    }

    if (pagina.length < TAMANHO_PAGINA) break;
    de += TAMANHO_PAGINA;
  }

  return { ok: true, data: itens };
}

function validarLinha<T>(schemaLinha: z.ZodType<T>) {
  return (item: unknown): T | null => {
    const parsed = schemaLinha.safeParse(item);
    return parsed.success ? parsed.data : null;
  };
}

function upsertUsuario(database: ViagensDb, usuario: UsuarioApi): void {
  const valores = {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    status: usuario.status,
    perfil: usuario.perfil.nome,
    data_atualizacao: usuario.data_atualizacao,
  };
  database
    .insert(schema.usuarioCache)
    .values(valores)
    .onConflictDoUpdate({ target: schema.usuarioCache.id, set: valores })
    .run();
}

function upsertVeiculo(database: ViagensDb, veiculo: VeiculoApi): void {
  const { id, ...valores } = veiculo;
  database
    .insert(schema.veiculo)
    .values({ id, ...valores })
    .onConflictDoUpdate({ target: schema.veiculo.id, set: valores })
    .run();
}

function upsertRota(database: ViagensDb, rota: RotaApi): void {
  const { id, ...valores } = rota;
  database
    .insert(schema.rota)
    .values({ id, ...valores })
    .onConflictDoUpdate({ target: schema.rota.id, set: valores })
    .run();
}

export function aplicarViagemServidor(
  database: ViagensDb,
  viagem: ViagemApi,
  opcoes: { emRevisao?: boolean } = {},
): void {
  const campos = {
    veiculo_id: viagem.veiculo_id,
    rota_id: viagem.rota_id,
    motorista_id: viagem.motorista_id,
    hodometro_inicial: viagem.hodometro_inicial,
    hodometro_final: viagem.hodometro_final,
    data_inicio: viagem.data_inicio,
    data_fim: viagem.data_fim,
    status: viagem.status,
    km_rodado: viagem.km_rodado,
    data_inclusao: viagem.data_inclusao,
    data_atualizacao: viagem.data_atualizacao,
    em_revisao: opcoes.emRevisao ?? false,
  };

  const existente = database
    .select({ id: schema.viagem.id })
    .from(schema.viagem)
    .where(eq(schema.viagem.id, viagem.id))
    .get();

  if (existente) {
    database.update(schema.viagem).set(campos).where(eq(schema.viagem.id, viagem.id)).run();
  } else {
    // `onConflictDoNothing` também absorve o índice parcial de "uma viagem aberta por veículo":
    // se a linha do servidor colidir com uma viagem local ainda em revisão, o sync não derruba
    // o lote inteiro. O conflito já está (ou será) levado ao gestor pela outbox.
    database
      .insert(schema.viagem)
      .values({ id: viagem.id, ...campos })
      .onConflictDoNothing()
      .run();
  }
}

export async function baixarUsuarios(
  deps: DepsPull = {},
): Promise<Resultado<number>> {
  const cliente = deps.supabase ?? supabase;
  const database = deps.db ?? getDb();

  const resultado = await buscarPaginado<UsuarioApi>(
    (de, ate) =>
      cliente
        .from('usuario')
        .select('id, nome, email, status, data_atualizacao, perfil:perfil_id(nome)')
        .order('nome')
        .order('id')
        .range(de, ate) as unknown as PromiseLike<PaginaSupabase>,
    validarLinha(usuarioApiSchema),
  );

  if (!resultado.ok) return resultado;
  if (!sessaoLocalAtual(deps.geracaoLocal)) return sessaoAlterada();

  database.transaction((tx) => {
    for (const usuario of resultado.data) upsertUsuario(tx as ViagensDb, usuario);
  });

  return { ok: true, data: resultado.data.length };
}

export async function baixarVeiculos(
  deps: DepsPull = {},
): Promise<Resultado<number>> {
  const cliente = deps.supabase ?? supabase;
  const database = deps.db ?? getDb();

  const resultado = await buscarPaginado<VeiculoApi>(
    (de, ate) =>
      cliente
        .from('veiculo')
        .select(
          'id, placa, marca, modelo, capacidade_carga, status, ano_fabricacao, data_inclusao, data_atualizacao',
        )
        .order('placa')
        .order('id')
        .range(de, ate) as unknown as PromiseLike<PaginaSupabase>,
    validarLinha(veiculoApiSchema),
  );

  if (!resultado.ok) return resultado;
  if (!sessaoLocalAtual(deps.geracaoLocal)) return sessaoAlterada();

  database.transaction((tx) => {
    for (const veiculo of resultado.data) upsertVeiculo(tx as ViagensDb, veiculo);
  });

  return { ok: true, data: resultado.data.length };
}

export async function baixarRotas(
  deps: DepsPull = {},
): Promise<Resultado<number>> {
  const cliente = deps.supabase ?? supabase;
  const database = deps.db ?? getDb();

  const resultado = await buscarPaginado<RotaApi>(
    (de, ate) =>
      cliente
        .from('rota')
        .select(
          'id, cidade_origem, cidade_destino, uf_origem, uf_destino, distancia_estimada_km, ativa, data_inclusao, data_atualizacao',
        )
        .order('cidade_origem')
        .order('id')
        .range(de, ate) as unknown as PromiseLike<PaginaSupabase>,
    validarLinha(rotaApiSchema),
  );

  if (!resultado.ok) return resultado;
  if (!sessaoLocalAtual(deps.geracaoLocal)) return sessaoAlterada();

  database.transaction((tx) => {
    for (const rota of resultado.data) upsertRota(tx as ViagensDb, rota);
  });

  return { ok: true, data: resultado.data.length };
}

export async function baixarViagens(
  deps: DepsPull = {},
): Promise<Resultado<number>> {
  const cliente = deps.supabase ?? supabase;
  const database = deps.db ?? getDb();

  const resultado = await buscarPaginado<ViagemApi>(
    (de, ate) =>
      cliente
        .from('viagem')
        .select(
          'id, veiculo_id, rota_id, motorista_id, hodometro_inicial, hodometro_final, data_inicio, data_fim, status, km_rodado, data_inclusao, data_atualizacao',
        )
        .order('data_inclusao')
        .order('id')
        .range(de, ate) as unknown as PromiseLike<PaginaSupabase>,
    validarLinha(viagemApiSchema),
  );

  if (!resultado.ok) return resultado;
  if (!sessaoLocalAtual(deps.geracaoLocal)) return sessaoAlterada();

  // A outbox de TODAS as contas protege a linha local: a viagem offline de uma conta que saiu
  // não pode ser sobrescrita (nem apagada) pelo download da conta que entrou.
  const pendentes = idsDeViagensNaOutbox(database);
  const idsServidor = new Set(resultado.data.map((viagem) => viagem.id));
  const veiculosComPendencia = new Set(
    pendentes.size === 0
      ? []
      : database
          .select({ veiculo_id: schema.viagem.veiculo_id })
          .from(schema.viagem)
          .where(
            inArray(schema.viagem.id, [...pendentes]),
          )
          .all()
          .map((item) => item.veiculo_id),
  );

  const veiculosLocais = new Set(
    database.select({ id: schema.veiculo.id }).from(schema.veiculo).all().map((item) => item.id),
  );
  const rotasLocais = new Set(
    database.select({ id: schema.rota.id }).from(schema.rota).all().map((item) => item.id),
  );

  let aplicadas = 0;
  database.transaction((tx) => {
    for (const viagem of resultado.data) {
      // Uma operação local ainda não confirmada é a fonte de verdade até o dreno terminar.
      if (pendentes.has(viagem.id)) continue;
      // Se o servidor tem outra viagem aberta para um veículo cuja viagem local está pendente,
      // deixar as duas entrarem quebraria o índice único local. O conflito fica para a revisão.
      if (viagem.status === 'EmAndamento' && veiculosComPendencia.has(viagem.veiculo_id)) continue;
      if (!veiculosLocais.has(viagem.veiculo_id) || !rotasLocais.has(viagem.rota_id)) continue;

      aplicarViagemServidor(tx as ViagensDb, viagem);
      aplicadas += 1;
    }

    // O download traz tudo o que o RLS deixa a conta ver. Uma linha local que não veio e não tem
    // operação na fila não existe mais para esta conta — por exemplo, a abertura offline que o
    // gestor descartou na revisão. Mantê-la deixaria o veículo preso "em andamento" no aparelho.
    const orfas = tx
      .select({ id: schema.viagem.id })
      .from(schema.viagem)
      .all()
      .map((linha) => linha.id)
      .filter((id) => !idsServidor.has(id) && !pendentes.has(id));
    for (const lote of emLotes(orfas, TAMANHO_LOTE_DELETE)) {
      tx.delete(schema.viagem).where(inArray(schema.viagem.id, lote)).run();
    }
  });

  return { ok: true, data: aplicadas };
}

const revisaoDecididaSchema = z.object({
  id: z.string(),
  status: z.enum(Constants.public.Enums.status_revisao),
});

/**
 * Tira da fila local as operações cujas revisões o gestor já decidiu (Resolvida ou Descartada).
 * Sem isso, a linha 'revisao' ficaria na outbox para sempre: a viagem nunca mais seria baixada,
 * o selo "Em revisão" não sairia e o veículo continuaria bloqueado no aparelho. Depois daqui o
 * download de viagens reconcilia a linha local com o que o servidor tem (ou a apaga).
 */
export async function baixarRevisoesResolvidas(
  deps: DepsPull = {},
): Promise<Resultado<number>> {
  const cliente = deps.supabase ?? supabase;
  const database = deps.db ?? getDb();
  const usuarioId = deps.usuarioId;
  if (!usuarioId) return { ok: true, data: 0 };

  const locais = database
    .select({ id: schema.outbox.id })
    .from(schema.outbox)
    .where(and(eq(schema.outbox.usuario_id, usuarioId), eq(schema.outbox.status, 'revisao')))
    .all()
    .map((linha) => linha.id);
  if (locais.length === 0) return { ok: true, data: 0 };

  const decididas: string[] = [];
  for (const lote of emLotes(locais, TAMANHO_LOTE_IDS)) {
    let resposta: PaginaSupabase;
    try {
      resposta = (await cliente
        .from('viagem_revisao')
        .select('id, status')
        .in('id', lote)
        .neq('status', 'Pendente')) as unknown as PaginaSupabase;
    } catch (erro) {
      return {
        ok: false,
        mensagem: ehErroConexao({ message: erro instanceof Error ? erro.message : String(erro) })
          ? MENSAGEM_SEM_CONEXAO
          : MENSAGEM_FALHA_PULL,
      };
    }

    if (resposta.error) {
      return {
        ok: false,
        mensagem: ehErroConexao(resposta.error) ? MENSAGEM_SEM_CONEXAO : MENSAGEM_FALHA_PULL,
      };
    }

    for (const linha of resposta.data ?? []) {
      const parsed = revisaoDecididaSchema.safeParse(linha);
      if (!parsed.success) return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
      if (parsed.data.status !== 'Pendente') decididas.push(parsed.data.id);
    }
  }

  if (decididas.length === 0) return { ok: true, data: 0 };
  if (!sessaoLocalAtual(deps.geracaoLocal)) return sessaoAlterada();

  database.transaction((tx) => {
    const viagensAfetadas = new Set(
      tx
        .select({ payload: schema.outbox.payload })
        .from(schema.outbox)
        .where(inArray(schema.outbox.id, decididas))
        .all()
        .map((linha) => viagemIdDoPayload(linha.payload))
        .filter((id): id is string => id !== null),
    );

    tx.delete(schema.outbox).where(inArray(schema.outbox.id, decididas)).run();

    // O selo só sai quando a viagem não tem mais nenhuma operação em revisão.
    const aindaEmRevisao = new Set(
      tx
        .select({ payload: schema.outbox.payload })
        .from(schema.outbox)
        .where(eq(schema.outbox.status, 'revisao'))
        .all()
        .map((linha) => viagemIdDoPayload(linha.payload)),
    );
    const liberadas = [...viagensAfetadas].filter((id) => !aindaEmRevisao.has(id));
    if (liberadas.length > 0) {
      tx.update(schema.viagem)
        .set({ em_revisao: false })
        .where(inArray(schema.viagem.id, liberadas))
        .run();
    }
  });

  return { ok: true, data: decididas.length };
}

export type ResultadoCatalogos = {
  usuarios: number;
  veiculos: number;
  rotas: number;
};

/**
 * Baixa o que a tela precisa para funcionar offline, na ordem em que as FKs locais exigem:
 * usuários (nomes/motoristas) e veículos/rotas antes das viagens. A paginação evita o corte
 * silencioso de 1000 linhas do PostgREST.
 */
export async function sincronizarCatalogos(
  deps: DepsPull = {},
): Promise<Resultado<ResultadoCatalogos>> {
  const usuarios = await baixarUsuarios(deps);
  if (!usuarios.ok) return usuarios;

  const veiculos = await baixarVeiculos(deps);
  if (!veiculos.ok) return veiculos;

  const rotas = await baixarRotas(deps);
  if (!rotas.ok) return rotas;

  return {
    ok: true,
    data: { usuarios: usuarios.data, veiculos: veiculos.data, rotas: rotas.data },
  };
}
