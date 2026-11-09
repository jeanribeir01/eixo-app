import { and, desc, eq, gt, isNotNull, lt, notInArray } from 'drizzle-orm';
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
import { idsDeViagensDeOutrasContas, idsDeViagensNaOutbox } from './outboxLocal';
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
    // Viagem ainda na fila de outra conta do aparelho fica guardada até o dono voltar, mas não
    // aparece para quem está logado agora.
    const deOutrasContas = idsDeViagensDeOutrasContas(database, obterUsuarioLocal());
    if (deOutrasContas.size > 0) {
      condicoes.push(notInArray(schema.viagem.id, [...deOutrasContas]));
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

    if (!row || idsDeViagensDeOutrasContas(database, obterUsuarioLocal()).has(id)) {
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

// Usado só por Admin/Gestor: o Motorista é sempre o próprio responsável. A lista traz apenas
// usuários ativos com perfil Motorista — o gestor logado não entra, senão a viagem poderia ficar
// no nome dele sem ninguém perceber.
export async function listarMotoristasParaViagem(): Promise<Resultado<MotoristaSelecionavel[]>> {
  try {
    const database = getDb();
    const rows = database
      .select()
      .from(schema.usuarioCache)
      .where(and(eq(schema.usuarioCache.status, 'Ativo'), eq(schema.usuarioCache.perfil, 'Motorista')))
      .orderBy(schema.usuarioCache.nome)
      .all();

    return { ok: true, data: rows.map((row) => ({ id: row.id, nome: row.nome, email: row.email })) };
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível carregar os motoristas. Tente novamente.');
  }
}

// Espelho local do trigger `sincroniza_status_veiculo` (20261015000100_viagem_regras.sql). Sem
// ele, um veículo que veio do servidor como EmViagem continuaria assim depois de um fechamento
// offline, e a próxima viagem não poderia ser aberta até a internet voltar. O próximo pull de
// veículos traz o valor do servidor por cima.
function ocuparVeiculoLocal(database: ViagensDb, veiculoId: string): void {
  database
    .update(schema.veiculo)
    .set({ status: 'EmViagem' })
    .where(eq(schema.veiculo.id, veiculoId))
    .run();
}

function liberarVeiculoLocal(database: ViagensDb, veiculoId: string): void {
  // Só devolve se ainda está EmViagem: veículo inativado durante a viagem continua Inativo.
  database
    .update(schema.veiculo)
    .set({ status: 'Disponivel' })
    .where(and(eq(schema.veiculo.id, veiculoId), eq(schema.veiculo.status, 'EmViagem')))
    .run();
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
      ocuparVeiculoLocal(tx as ViagensDb, parsed.data.veiculo_id);
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

      if (!viagemAtual || idsDeViagensDeOutrasContas(tx as ViagensDb, usuarioId).has(id)) {
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

      liberarVeiculoLocal(tx as ViagensDb, viagemAtual.veiculo_id);

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

      liberarVeiculoLocal(tx as ViagensDb, viagemAtual.veiculo_id);

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

/**
 * Remove o cache de leitura (viagens, veículos, rotas e usuários) e mantém só o que ainda tem
 * operação na outbox de QUALQUER conta do aparelho, com o veículo e a rota que essas viagens
 * referenciam (FK local). Assim nem logout nem troca de conta apagam uma viagem offline ainda
 * não sincronizada: ela fica guardada até o dono voltar. As consultas da tela escondem as viagens
 * que pertencem à fila de outra conta (`idsDeViagensDeOutrasContas`).
 */
function limparCachePreservandoPendencias(tx: ViagensDb): void {
  const pendentes = [...idsDeViagensNaOutbox(tx)];

  if (pendentes.length === 0) {
    tx.delete(schema.viagem).run();
    tx.delete(schema.veiculo).run();
    tx.delete(schema.rota).run();
    tx.delete(schema.usuarioCache).run();
    return;
  }

  tx.delete(schema.viagem).where(notInArray(schema.viagem.id, pendentes)).run();
  const mantidas = tx
    .select({ veiculo_id: schema.viagem.veiculo_id, rota_id: schema.viagem.rota_id })
    .from(schema.viagem)
    .all();
  const veiculosMantidos = [...new Set(mantidas.map((item) => item.veiculo_id))];
  const rotasMantidas = [...new Set(mantidas.map((item) => item.rota_id))];

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
}

function definirDonoDoCache(tx: ViagensDb, usuarioId: string): void {
  tx.insert(schema.syncMeta)
    .values({ chave: 'cache_owner', valor: usuarioId })
    .onConflictDoUpdate({ target: schema.syncMeta.chave, set: { valor: usuarioId } })
    .run();
}

/**
 * Prepara o banco local para a conta que acabou de entrar. Se o cache é de outra conta (ou ficou
 * sem dono depois de um logout), ele é limpo antes de qualquer tela ler, preservando as pendências
 * de todas as contas. As outboxes só são drenadas quando o respectivo dono entrar de novo.
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

      limparCachePreservandoPendencias(tx as ViagensDb);
      definirDonoDoCache(tx as ViagensDb, usuarioId);
    });

    return { ok: true, data: true };
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível preparar os dados locais. Tente novamente.');
  }
}

/**
 * Logout: remove o cache da conta, mas mantém a outbox e as viagens pendentes de todas as contas.
 * Se a limpeza falhar, o próximo login detecta o dono antigo e limpa antes de mostrar qualquer tela.
 */
export async function limparCacheLocalNoLogout(_usuarioId: string): Promise<Resultado<true>> {
  try {
    const database = getDb();
    database.transaction((tx) => {
      limparCachePreservandoPendencias(tx as ViagensDb);
      definirDonoDoCache(tx as ViagensDb, '');
    });

    return { ok: true, data: true };
  } catch (error) {
    return traduzirErroSqlite(error, 'Não foi possível limpar os dados locais da conta.');
  }
}

/**
 * Perfil da conta salvo no último sync, para o app abrir sem internet (RNF01). Só vale se o cache
 * ainda é desta conta: depois de um logout ou de uma troca de conta ele não é usado. É uma decisão
 * de navegação, não de segurança — o RLS continua decidindo o que o servidor aceita.
 */
export function lerPerfilDoCacheLocal(usuarioId: string): schema.UsuarioCache | null {
  try {
    const database = getDb();
    const dono = database
      .select()
      .from(schema.syncMeta)
      .where(eq(schema.syncMeta.chave, 'cache_owner'))
      .get()?.valor;
    if (dono !== usuarioId) return null;

    return (
      database.select().from(schema.usuarioCache).where(eq(schema.usuarioCache.id, usuarioId)).get() ??
      null
    );
  } catch {
    // Banco ainda migrando ou indisponível: sem cache, o app segue o caminho online.
    return null;
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
