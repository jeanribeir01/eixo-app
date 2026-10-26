import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import * as schema from '@/db/schema';
import { supabase } from '@/supabase/client';
import { Constants } from '@/types/database';

import { getDb, type ViagensDb } from './viagensRepository';
import { obterGeracaoLocal } from './sessaoLocal';
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

// A sessão pode mudar enquanto uma página está em voo. A geração é lida de novo imediatamente
// antes de cada transação de escrita; o resultado atrasado é descartado em vez de contaminar o
// cache da conta que acabou de entrar.
function sessaoLocalAtual(geracaoLocal?: number): boolean {
  return geracaoLocal === undefined || obterGeracaoLocal() === geracaoLocal;
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

function idsDeViagensNaOutbox(database: ViagensDb, usuarioId?: string | null): Set<string> {
  const consulta = database
    .select({ payload: schema.outbox.payload })
    .from(schema.outbox);
  const itens =
    usuarioId && usuarioId.length > 0
      ? consulta.where(eq(schema.outbox.usuario_id, usuarioId)).all()
      : consulta.all();

  const ids = new Set<string>();
  for (const item of itens) {
    try {
      const payload = JSON.parse(item.payload) as { id?: unknown };
      if (typeof payload.id === 'string') ids.add(payload.id);
    } catch {
      // Payload quebrado já vira revisão no dreno; aqui só não protege a linha local.
    }
  }
  return ids;
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
  const usuarioId = deps.usuarioId;

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

  const pendentes = idsDeViagensNaOutbox(database, usuarioId);
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
  });

  return { ok: true, data: aplicadas };
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
