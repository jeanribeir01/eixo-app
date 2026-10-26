import { and, desc, eq, gt, inArray, isNotNull, lt, notInArray } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { db } from '@/db/client';
import * as schema from '@/db/schema';
import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { gerarUUIDv7 } from '@/lib/uuid';

import {
  abrirViagemSchema,
  corrigirHodometroFinalSchema,
  fecharViagemSchema,
  viagemDetalhadaSchema,
  viagemSchema,
} from './schema';
import { obterUsuarioLocal } from './sessaoLocal';
import { notificarEscritaLocal } from './syncBus';
import type {
  CampoErroViagem,
  CorrigirHodometroFinalInput,
  FecharViagemInput,
  FiltroViagens,
  MotoristaSelecionavel,
  NovaViagemInput,
  Resultado,
  RotaSelecionavel,
  VeiculoSelecionavel,
  ViagemDetalhada,
  ViagemLocal,
  ViagensRepository,
} from './types';

export {
  abrirViagemSchema,
  corrigirHodometroFinalSchema,
  fecharViagemSchema,
  viagemDetalhadaSchema,
  viagemSchema,
} from './schema';

export type ViagensDb = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

let dbAtual: ViagensDb = db as unknown as ViagensDb;

export function setDb(instancia: ViagensDb): void {
  dbAtual = instancia;
}

export function getDb(): ViagensDb {
  return dbAtual;
}

// Mantido como nome público para os testes antigos; a implementação agora é UUID v7 com CSPRNG.
export const gerarUUID = gerarUUIDv7;

// Colunas usadas pelo sync no PostgREST. O `km_rodado` é gerado no servidor e nunca sobe.
export const COLUNAS_VIAGEM =
  'id, veiculo_id, rota_id, motorista_id, hodometro_inicial, hodometro_final, data_inicio, data_fim, status, km_rodado, data_inclusao, data_atualizacao';

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

  if (error.code === '23505') {
    const constraint = nomeDaConstraint(error, '23505');
    if (constraint) {
      return falhaDaConstraint(constraint, error.code);
    }
    return { ok: false, mensagem: MENSAGENS_ERRO_VIAGEM['23505'], codigo: error.code };
  }

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

  if (msg.includes('UNIQUE constraint failed: viagem.id')) {
    return {
      ok: false,
      mensagem: 'Já existe uma viagem com este identificador.',
      codigo: '23505',
    };
  }

  if (msg.includes('FOREIGN KEY constraint failed')) {
    return {
      ok: false,
      mensagem: 'Veículo ou rota não encontrado no dispositivo. Conecte-se para atualizar os dados.',
      codigo: '23503',
    };
  }

  return { ok: false, mensagem: mensagemPadrao };
}

function validarViagem(data: unknown): Resultado<ViagemLocal> {
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

function montarDetalhada(row: {
  viagem: schema.Viagem;
  veiculo: schema.Veiculo | null;
  rota: schema.Rota | null;
  motorista: schema.UsuarioCache | null;
}): ViagemDetalhada {
  return {
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
    motorista: row.motorista
      ? {
          id: row.motorista.id,
          nome: row.motorista.nome,
          email: row.motorista.email,
        }
      : null,
  };
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
        motorista: schema.usuarioCache,
      })
      .from(schema.viagem)
      .leftJoin(schema.veiculo, eq(schema.viagem.veiculo_id, schema.veiculo.id))
      .leftJoin(schema.rota, eq(schema.viagem.rota_id, schema.rota.id))
      .leftJoin(schema.usuarioCache, eq(schema.viagem.motorista_id, schema.usuarioCache.id))
      .orderBy(desc(schema.viagem.data_inclusao))
      .limit(filtro.limite ?? 100);

    const rows = condicoes.length > 0 ? query.where(and(...condicoes)).all() : query.all();

    const viagens: ViagemDetalhada[] = [];
    for (const item of rows) {
      const validado = validarViagemDetalhada(montarDetalhada(item));
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
        motorista: schema.usuarioCache,
      })
      .from(schema.viagem)
      .leftJoin(schema.veiculo, eq(schema.viagem.veiculo_id, schema.veiculo.id))
      .leftJoin(schema.rota, eq(schema.viagem.rota_id, schema.rota.id))
      .leftJoin(schema.usuarioCache, eq(schema.viagem.motorista_id, schema.usuarioCache.id))
      .where(eq(schema.viagem.id, id))
      .get();

    if (!row) {
      return { ok: false, mensagem: 'Viagem não encontrada.' };
    }

    return validarViagemDetalhada(montarDetalhada(row));
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível carregar a viagem. Tente novamente.');
  }
}

// Consulta usada só por Admin/Gestor para sugerir o hodômetro inicial. O cache local contém as
// viagens que o RLS deixou baixar; para Motorista, o servidor valida o VG004 no sync.
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

export async function buscarViagemEmAndamento(veiculo_id: string): Promise<Resultado<ViagemLocal | null>> {
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

export async function listarVeiculosParaViagem(): Promise<Resultado<VeiculoSelecionavel[]>> {
  try {
    const database = getDb();
    const abertas = database
      .select({ veiculo_id: schema.viagem.veiculo_id })
      .from(schema.viagem)
      .where(eq(schema.viagem.status, 'EmAndamento'))
      .all()
      .map((item) => item.veiculo_id);

    const condicoes = [eq(schema.veiculo.status, 'Disponivel')];
    if (abertas.length > 0) {
      condicoes.push(notInArray(schema.veiculo.id, abertas));
    }

    const rows = database
      .select()
      .from(schema.veiculo)
      .where(and(...condicoes))
      .orderBy(schema.veiculo.placa)
      .all();

    return { ok: true, data: rows };
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível carregar os veículos. Tente novamente.');
  }
}

export async function buscarVeiculoParaViagem(id: string): Promise<Resultado<schema.Veiculo>> {
  try {
    const database = getDb();
    const row = database.select().from(schema.veiculo).where(eq(schema.veiculo.id, id)).get();
    if (!row) {
      return {
        ok: false,
        mensagem: 'Veículo não encontrado no dispositivo. Conecte-se para atualizar os dados.',
      };
    }
    return { ok: true, data: row };
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível consultar o veículo. Tente novamente.');
  }
}

export async function listarRotasParaViagem(): Promise<Resultado<RotaSelecionavel[]>> {
  try {
    const database = getDb();
    const rows = database
      .select()
      .from(schema.rota)
      .where(eq(schema.rota.ativa, true))
      .orderBy(schema.rota.cidade_origem, schema.rota.cidade_destino)
      .all();

    return { ok: true, data: rows };
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível carregar as rotas. Tente novamente.');
  }
}

export async function listarMotoristasParaViagem(usuario: {
  id: string;
  nome: string;
  email: string;
}): Promise<Resultado<MotoristaSelecionavel[]>> {
  try {
    const database = getDb();
    const rows = database
      .select()
      .from(schema.usuarioCache)
      .where(and(eq(schema.usuarioCache.status, 'Ativo'), eq(schema.usuarioCache.perfil, 'Motorista')))
      .orderBy(schema.usuarioCache.nome)
      .all();

    const opcoes = rows.map((row) => ({ id: row.id, nome: row.nome, email: row.email }));
    // O próprio usuário logado pode abrir para si mesmo (Admin/Gestor) ou é o único motorista
    // disponível no cache (Motorista). Se o cache ainda não tem a linha, ela entra da sessão.
    if (!opcoes.some((opcao) => opcao.id === usuario.id)) {
      opcoes.unshift({ id: usuario.id, nome: usuario.nome, email: usuario.email });
    } else {
      const propria = opcoes.findIndex((opcao) => opcao.id === usuario.id);
      if (propria > 0) {
        const [item] = opcoes.splice(propria, 1);
        opcoes.unshift(item);
      }
    }

    return { ok: true, data: opcoes };
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível carregar os motoristas. Tente novamente.');
  }
}

function usuarioDaOutbox(): string | Falha {
  const usuarioId = obterUsuarioLocal();
  if (!usuarioId) {
    return { ok: false, mensagem: 'Sessão não identificada. Entre novamente para salvar a viagem.' };
  }
  return usuarioId;
}

function criarItemOutbox(
  operacao: 'insert' | 'update',
  payload: Record<string, unknown>,
  usuarioId: string,
  agora: string,
): schema.NovoOutboxItem {
  return {
    id: gerarUUIDv7(),
    usuario_id: usuarioId,
    entidade: 'viagem',
    operacao,
    payload: JSON.stringify(payload),
    status: 'pendente',
    tentativas: 0,
    proxima_tentativa_em: null,
    codigo_erro: null,
    criado_em: agora,
    ultimo_erro: null,
  };
}

export async function abrirViagem(input: NovaViagemInput): Promise<Resultado<ViagemLocal>> {
  const parsed = abrirViagemSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      mensagem: issue?.message ?? 'Dados inválidos para abertura de viagem.',
      campo: issue?.path[0] as CampoErroViagem,
    };
  }

  const usuarioId = usuarioDaOutbox();
  if (typeof usuarioId !== 'string') return usuarioId;

  const database = getDb();

  try {
    const resultado = database.transaction((tx) => {
      const veiculo = tx
        .select()
        .from(schema.veiculo)
        .where(eq(schema.veiculo.id, parsed.data.veiculo_id))
        .get();

      if (!veiculo) {
        return {
          ok: false as const,
          mensagem: 'Veículo não encontrado no dispositivo. Conecte-se para atualizar os dados.',
          campo: 'veiculo_id' as CampoErroViagem,
          codigo: '23503',
        };
      }

      const rota = tx
        .select({ id: schema.rota.id, ativa: schema.rota.ativa })
        .from(schema.rota)
        .where(eq(schema.rota.id, parsed.data.rota_id))
        .get();

      if (!rota) {
        return {
          ok: false as const,
          mensagem: 'Rota não encontrada no dispositivo. Conecte-se para atualizar os dados.',
          campo: 'rota_id' as CampoErroViagem,
          codigo: '23503',
        };
      }

      if (!rota.ativa) {
        return {
          ok: false as const,
          mensagem: 'Rota inativa não pode ser usada em uma viagem.',
          campo: 'rota_id' as CampoErroViagem,
          codigo: 'VG008',
        };
      }

      if (veiculo.status === 'EmViagem') {
        return {
          ok: false as const,
          mensagem: MENSAGENS_ERRO_VIAGEM.VG001,
          campo: 'veiculo_id' as CampoErroViagem,
          codigo: 'VG001',
        };
      }
      if (veiculo.status === 'EmManutencao') {
        return {
          ok: false as const,
          mensagem: MENSAGENS_ERRO_VIAGEM.VG002,
          campo: 'veiculo_id' as CampoErroViagem,
          codigo: 'VG002',
        };
      }
      if (veiculo.status === 'Inativo') {
        return {
          ok: false as const,
          mensagem: MENSAGENS_ERRO_VIAGEM.VG003,
          campo: 'veiculo_id' as CampoErroViagem,
          codigo: 'VG003',
        };
      }

      const emAndamento = tx
        .select({ id: schema.viagem.id })
        .from(schema.viagem)
        .where(
          and(
            eq(schema.viagem.veiculo_id, parsed.data.veiculo_id),
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

      const ultimoHodometro = tx
        .select({ hodometro_final: schema.viagem.hodometro_final })
        .from(schema.viagem)
        .where(
          and(
            eq(schema.viagem.veiculo_id, parsed.data.veiculo_id),
            isNotNull(schema.viagem.hodometro_final),
          ),
        )
        .orderBy(desc(schema.viagem.hodometro_final))
        .limit(1)
        .get();

      if (
        ultimoHodometro?.hodometro_final !== null &&
        ultimoHodometro?.hodometro_final !== undefined &&
        parsed.data.hodometro_inicial < Number(ultimoHodometro.hodometro_final)
      ) {
        return {
          ok: false as const,
          mensagem: MENSAGENS_ERRO_VIAGEM.VG004,
          campo: 'hodometro_inicial' as CampoErroViagem,
          codigo: 'VG004',
        };
      }

      const id = parsed.data.id ?? gerarUUIDv7();
      const agora = new Date().toISOString();
      const data_inicio = parsed.data.data_inicio ?? agora;

      const novaViagemLocal: schema.NovaViagem = {
        id,
        veiculo_id: parsed.data.veiculo_id,
        rota_id: parsed.data.rota_id,
        motorista_id: parsed.data.motorista_id,
        hodometro_inicial: parsed.data.hodometro_inicial,
        hodometro_final: null,
        data_inicio,
        data_fim: null,
        status: 'EmAndamento',
        km_rodado: null,
        em_revisao: false,
        data_inclusao: agora,
        data_atualizacao: agora,
      };

      // REGRA CRÍTICA: km_rodado NUNCA entra no payload do outbox (erro 428C9 no Postgres).
      const outboxPayload = {
        id,
        veiculo_id: parsed.data.veiculo_id,
        rota_id: parsed.data.rota_id,
        motorista_id: parsed.data.motorista_id,
        hodometro_inicial: parsed.data.hodometro_inicial,
        data_inicio,
        status: 'EmAndamento',
        data_inclusao: agora,
        data_atualizacao: agora,
      };

      tx.insert(schema.viagem).values(novaViagemLocal).run();
      tx.insert(schema.outbox)
        .values(criarItemOutbox('insert', outboxPayload, usuarioId, agora))
        .run();

      return { ok: true as const, data: novaViagemLocal as ViagemLocal };
    });

    if (!resultado.ok) {
      return resultado;
    }

    const validado = validarViagem(resultado.data);
    if (validado.ok) notificarEscritaLocal();
    return validado;
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível abrir a viagem. Tente novamente.');
  }
}

export async function fecharViagem(id: string, input: FecharViagemInput): Promise<Resultado<ViagemLocal>> {
  const parsed = fecharViagemSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      mensagem: issue?.message ?? 'Dados inválidos para fechamento de viagem.',
      campo: issue?.path[0] as CampoErroViagem,
    };
  }

  const usuarioId = usuarioDaOutbox();
  if (typeof usuarioId !== 'string') return usuarioId;

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

      if (parsed.data.hodometro_final <= viagemAtual.hodometro_inicial) {
        return {
          ok: false as const,
          mensagem: MENSAGENS_ERRO_VIAGEM['23514'],
          campo: 'hodometro_final' as CampoErroViagem,
          codigo: '23514',
        };
      }

      const agora = new Date().toISOString();
      const data_fim = parsed.data.data_fim ?? agora;
      const km_rodado = parsed.data.hodometro_final - viagemAtual.hodometro_inicial;

      tx.update(schema.viagem)
        .set({
          status: 'Finalizada',
          hodometro_final: parsed.data.hodometro_final,
          data_fim,
          km_rodado,
          data_atualizacao: agora,
        })
        .where(eq(schema.viagem.id, id))
        .run();

      const outboxPayload = {
        id,
        status: 'Finalizada',
        hodometro_final: parsed.data.hodometro_final,
        data_fim,
        data_atualizacao: agora,
      };

      tx.insert(schema.outbox)
        .values(criarItemOutbox('update', outboxPayload, usuarioId, agora))
        .run();

      const viagemAtualizada: ViagemLocal = {
        ...viagemAtual,
        status: 'Finalizada',
        hodometro_final: parsed.data.hodometro_final,
        data_fim,
        km_rodado,
        data_atualizacao: agora,
      };

      return { ok: true as const, data: viagemAtualizada };
    });

    if (!resultado.ok) {
      return resultado;
    }

    const validado = validarViagem(resultado.data);
    if (validado.ok) notificarEscritaLocal();
    return validado;
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível fechar a viagem. Tente novamente.');
  }
}

export async function cancelarViagem(
  id: string,
  options?: { hodometro_final?: number | null },
): Promise<Resultado<ViagemLocal>> {
  const usuarioId = usuarioDaOutbox();
  if (typeof usuarioId !== 'string') return usuarioId;

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
        hodometro_final !== null &&
        hodometro_final !== undefined &&
        hodometro_final > viagemAtual.hodometro_inicial
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

      const outboxPayload: Record<string, unknown> = {
        id,
        status: 'Cancelada',
        data_fim,
        data_atualizacao: agora,
      };

      if (options?.hodometro_final !== undefined) {
        outboxPayload.hodometro_final = options.hodometro_final;
      }

      tx.insert(schema.outbox)
        .values(criarItemOutbox('update', outboxPayload, usuarioId, agora))
        .run();

      const viagemAtualizada: ViagemLocal = {
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

    const validado = validarViagem(resultado.data);
    if (validado.ok) notificarEscritaLocal();
    return validado;
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível cancelar a viagem. Tente novamente.');
  }
}

export async function corrigirHodometroFinal(
  id: string,
  dados: CorrigirHodometroFinalInput,
): Promise<Resultado<ViagemLocal>> {
  const parsed = corrigirHodometroFinalSchema.safeParse(dados);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      mensagem: issue?.message ?? 'Hodômetro final inválido.',
      campo: 'hodometro_final',
    };
  }

  const usuarioId = usuarioDaOutbox();
  if (typeof usuarioId !== 'string') return usuarioId;

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

      if (parsed.data.hodometro_final <= viagemAtual.hodometro_inicial) {
        return {
          ok: false as const,
          mensagem: MENSAGENS_ERRO_VIAGEM['23514'],
          campo: 'hodometro_final' as CampoErroViagem,
          codigo: '23514',
        };
      }

      const viagemPosterior = tx
        .select()
        .from(schema.viagem)
        .where(
          and(
            eq(schema.viagem.veiculo_id, viagemAtual.veiculo_id),
            gt(schema.viagem.hodometro_inicial, viagemAtual.hodometro_inicial),
            lt(schema.viagem.hodometro_inicial, parsed.data.hodometro_final),
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
      const km_rodado = parsed.data.hodometro_final - viagemAtual.hodometro_inicial;

      tx.update(schema.viagem)
        .set({
          hodometro_final: parsed.data.hodometro_final,
          km_rodado,
          data_atualizacao: agora,
        })
        .where(eq(schema.viagem.id, id))
        .run();

      const outboxPayload = {
        id,
        hodometro_final: parsed.data.hodometro_final,
        data_atualizacao: agora,
      };

      tx.insert(schema.outbox)
        .values(criarItemOutbox('update', outboxPayload, usuarioId, agora))
        .run();

      const viagemAtualizada: ViagemLocal = {
        ...viagemAtual,
        hodometro_final: parsed.data.hodometro_final,
        km_rodado,
        data_atualizacao: agora,
      };

      return { ok: true as const, data: viagemAtualizada };
    });

    if (!resultado.ok) {
      return resultado;
    }

    const validado = validarViagem(resultado.data);
    if (validado.ok) notificarEscritaLocal();
    return validado;
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível corrigir o hodômetro final. Tente novamente.');
  }
}

// ---------------------------------------------------------------------------
// Ciclo de vida do cache local
// ---------------------------------------------------------------------------

function idsDeViagensNaOutbox(database: ViagensDb, usuarioId: string): string[] {
  const itens = database
    .select({ payload: schema.outbox.payload })
    .from(schema.outbox)
    .where(eq(schema.outbox.usuario_id, usuarioId))
    .all();

  const ids = new Set<string>();
  for (const item of itens) {
    try {
      const payload = JSON.parse(item.payload) as { id?: unknown };
      if (typeof payload.id === 'string' && payload.id.length > 0) {
        ids.add(payload.id);
      }
    } catch {
      // Payload inválido já será tratado pelo dreno; não impede a limpeza do cache.
    }
  }
  return [...ids];
}

/**
 * Prepara o banco local para a conta que acabou de entrar. Uma troca de conta limpa o cache da
 * conta anterior, mas preserva as outboxes de todas as contas: elas só serão drenadas quando o
 * respectivo dono entrar novamente. Assim um logout (ou uma falha dele) nunca apaga operação
 * ainda não sincronizada.
 */
export async function prepararSessaoLocal(usuarioId: string): Promise<Resultado<true>> {
  if (!usuarioId) {
    return { ok: false, mensagem: 'Sessão não identificada.' };
  }

  try {
    const database = getDb();
    database.transaction((tx) => {
      // Outbox criada antes da coluna `usuario_id` não tem dono. A primeira conta que entrar
      // depois da migration adota essas operações; o servidor ainda aplica o RLS por cima.
      tx.update(schema.outbox)
        .set({ usuario_id: usuarioId })
        .where(eq(schema.outbox.usuario_id, ''))
        .run();

      const dono = tx
        .select()
        .from(schema.syncMeta)
        .where(eq(schema.syncMeta.chave, 'cache_owner'))
        .get()?.valor;

      if (dono === usuarioId) return;

      // Sem dono (primeiro login desta versão) ou depois de um logout limpo, preserva apenas as
      // viagens que ainda têm operação na outbox. A outbox sem dono já foi adotada acima.
      if (!dono || dono === '') {
        // Logout limpo: as viagens pendentes do usuário foram preservadas junto da outbox.
        // Mantém somente elas (e os veículos/rotas que elas referenciam) ao entrar de novo.
        const pendentes = idsDeViagensNaOutbox(database, usuarioId);
        if (pendentes.length > 0) {
          tx.delete(schema.viagem).where(notInArray(schema.viagem.id, pendentes)).run();
          const veiculosMantidos = tx
            .selectDistinct({ id: schema.viagem.veiculo_id })
            .from(schema.viagem)
            .where(inArray(schema.viagem.id, pendentes))
            .all()
            .map((item) => item.id);
          const rotasMantidas = tx
            .selectDistinct({ id: schema.viagem.rota_id })
            .from(schema.viagem)
            .where(inArray(schema.viagem.id, pendentes))
            .all()
            .map((item) => item.id);

          if (veiculosMantidos.length > 0) {
            tx.delete(schema.veiculo).where(notInArray(schema.veiculo.id, veiculosMantidos)).run();
          } else {
            tx.delete(schema.veiculo).run();
          }
          if (rotasMantidas.length > 0) {
            tx.delete(schema.rota).where(notInArray(schema.rota.id, rotasMantidas)).run();
          } else {
            tx.delete(schema.rota).run();
          }
          tx.delete(schema.usuarioCache).run();
        } else {
          tx.delete(schema.viagem).run();
          tx.delete(schema.veiculo).run();
          tx.delete(schema.rota).run();
          tx.delete(schema.usuarioCache).run();
        }
      } else {
        // Troca direta de conta (o logout anterior falhou ou outra conta entrou sem sair):
        // nada do cache da conta anterior pode aparecer. A outbox de cada dono permanece.
        tx.delete(schema.viagem).run();
        tx.delete(schema.veiculo).run();
        tx.delete(schema.rota).run();
        tx.delete(schema.usuarioCache).run();
      }

      tx.insert(schema.syncMeta)
        .values({ chave: 'cache_owner', valor: usuarioId })
        .onConflictDoUpdate({ target: schema.syncMeta.chave, set: { valor: usuarioId } })
        .run();
    });

    return { ok: true, data: true };
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível preparar os dados locais. Tente novamente.');
  }
}

/**
 * Logout: remove o cache da conta, mas mantém a outbox e as viagens pendentes dela. As demais
 * contas que usaram o aparelho continuam com suas outboxes intactas. Se a limpeza falhar, o
 * próximo login detecta o dono antigo e limpa antes de mostrar qualquer tela.
 */
export async function limparCacheLocalNoLogout(usuarioId: string): Promise<Resultado<true>> {
  try {
    const database = getDb();
    database.transaction((tx) => {
      const pendentes = idsDeViagensNaOutbox(database, usuarioId);
      if (pendentes.length > 0) {
        tx.delete(schema.viagem).where(notInArray(schema.viagem.id, pendentes)).run();
        const veiculosMantidos = tx
          .selectDistinct({ id: schema.viagem.veiculo_id })
          .from(schema.viagem)
          .where(inArray(schema.viagem.id, pendentes))
          .all()
          .map((item) => item.id);
        const rotasMantidas = tx
          .selectDistinct({ id: schema.viagem.rota_id })
          .from(schema.viagem)
          .where(inArray(schema.viagem.id, pendentes))
          .all()
          .map((item) => item.id);

        if (veiculosMantidos.length > 0) {
          tx.delete(schema.veiculo).where(notInArray(schema.veiculo.id, veiculosMantidos)).run();
        } else {
          tx.delete(schema.veiculo).run();
        }
        if (rotasMantidas.length > 0) {
          tx.delete(schema.rota).where(notInArray(schema.rota.id, rotasMantidas)).run();
        } else {
          tx.delete(schema.rota).run();
        }
      } else {
        tx.delete(schema.viagem).run();
        tx.delete(schema.veiculo).run();
        tx.delete(schema.rota).run();
      }

      tx.delete(schema.usuarioCache).run();
      tx.insert(schema.syncMeta)
        .values({ chave: 'cache_owner', valor: '' })
        .onConflictDoUpdate({ target: schema.syncMeta.chave, set: { valor: '' } })
        .run();
    });

    return { ok: true, data: true };
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível limpar os dados locais da conta.');
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
