import { and, asc, desc, eq, isNotNull, type SQL } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

import { db } from '@/db/client';
import * as local from '@/db/schema';
import type { Veiculo as VeiculoSelecionavel } from '@/features/veiculos/types';
import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { gerarUuidV7 } from '@/lib/uuid';
import { supabase } from '@/supabase/client';

import {
  abrirViagemSchema,
  fecharViagemSchema,
  motoristaResumoSchema,
  viagemDetalhadaSchema,
  type PayloadAberturaViagem,
  type PayloadFechamentoViagem,
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
//
// Offline-first (EIX-41, ADR 0004): a tela lê e escreve no SQLite do aparelho, nunca direto no
// Supabase. Abrir e fechar viagem gravam a linha local e o item da outbox na mesma transação; o
// envio ao servidor e a cópia do que está lá ficam em `sync.ts`. Só a lista de motoristas
// (Admin/Gestor) continua online: `usuario` não é espelhado no aparelho.

// Tipo comum ao banco do app (expo-sqlite) e ao do Jest (better-sqlite3): os dois são SQLite
// síncrono, só o tipo do resultado de `run()` muda, e o repositório não o usa.
export type ViagensDb = BaseSQLiteDatabase<'sync', unknown, typeof local>;

let dbAtual: ViagensDb = db as unknown as ViagensDb;

// Os testes trocam o banco pelo SQLite em memória de `src/db/testing.ts`.
export function setDb(instancia: ViagensDb): void {
  dbAtual = instancia;
}

export function getDb(): ViagensDb {
  return dbAtual;
}

export const COLUNAS_VIAGEM =
  'id, veiculo_id, rota_id, motorista_id, hodometro_inicial, hodometro_final, data_inicio, data_fim, status, km_rodado, data_inclusao, data_atualizacao';

// Seletores do formulário de abertura: cadastro pequeno por natureza; o limite só impede uma
// resposta sem teto (skill supabase-query). Os filtros vão para o banco para o limite valer
// sobre o que a tela mostra, e não sobre a tabela inteira.
const LIMITE_SELETOR = 500;

// Mensagens amigáveis para cada erro do banco (EIX-76 / migrations 20260924000300_frota.sql e
// 20261015000100_viagem_regras.sql). O texto técnico do banco ou SQLSTATE nunca é exposto
// diretamente ao usuário. As mesmas mensagens servem para a regra checada no aparelho.
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

// O cache local de veículos e rotas só existe depois da primeira sincronização com internet.
export const MENSAGEM_VEICULO_FORA_DO_APARELHO =
  'Veículo não encontrado neste aparelho. Conecte-se à internet para atualizar a lista.';
export const MENSAGEM_ROTA_FORA_DO_APARELHO =
  'Rota não encontrada neste aparelho. Conecte-se à internet para atualizar a lista.';

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

// Traduz o erro do Supabase. Desde a EIX-41 quem chama é o sync (`sync.ts`) e a lista de
// motoristas: a mensagem traduzida é o que fica gravado no item da outbox que o servidor recusou.
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

// Erro do SQLite local. As regras de negócio já foram checadas antes de gravar, com a mensagem
// certa; o que chega aqui é a última barreira (índice único ou FK) ou um erro inesperado.
function traduzirErroLocal(error: unknown, mensagemPadrao: string): Falha {
  const texto = error instanceof Error ? error.message : String(error);

  if (texto.includes('UNIQUE constraint failed: viagem.veiculo_id')) {
    return { ok: false, mensagem: MENSAGENS_ERRO_VIAGEM.VG001, campo: 'veiculo_id', codigo: 'VG001' };
  }

  return { ok: false, mensagem: mensagemPadrao };
}

// Viagem com veículo, rota e nome do motorista, montada pelos joins locais. O `motorista` vem do
// cache de nomes que o sync preenche (`local.motorista`); sem ele, a tela só omite o nome.
function selecionarViagensDetalhadas(onde?: SQL) {
  const consulta = getDb()
    .select({
      viagem: local.viagem,
      veiculo: {
        id: local.veiculo.id,
        placa: local.veiculo.placa,
        marca: local.veiculo.marca,
        modelo: local.veiculo.modelo,
        status: local.veiculo.status,
      },
      rota: {
        id: local.rota.id,
        cidade_origem: local.rota.cidade_origem,
        uf_origem: local.rota.uf_origem,
        cidade_destino: local.rota.cidade_destino,
        uf_destino: local.rota.uf_destino,
        distancia_estimada_km: local.rota.distancia_estimada_km,
      },
      motorista: local.motorista,
    })
    .from(local.viagem)
    .leftJoin(local.veiculo, eq(local.viagem.veiculo_id, local.veiculo.id))
    .leftJoin(local.rota, eq(local.viagem.rota_id, local.rota.id))
    .leftJoin(local.motorista, eq(local.viagem.motorista_id, local.motorista.id));

  return onde ? consulta.where(onde) : consulta;
}

type LinhaDetalhada = ReturnType<ReturnType<typeof selecionarViagensDetalhadas>['all']>[number];

function validarViagemDetalhada({ viagem, veiculo, rota, motorista }: LinhaDetalhada): Resultado<ViagemDetalhada> {
  const parsed = viagemDetalhadaSchema.safeParse({ ...viagem, veiculo, rota, motorista });
  if (!parsed.success) {
    return { ok: false, mensagem: 'Os dados detalhados da viagem são inválidos.' };
  }
  return { ok: true, data: parsed.data };
}

export async function listarViagens(filtro: FiltroViagens = {}): Promise<Resultado<ViagemDetalhada[]>> {
  try {
    const condicoes: SQL[] = [];

    if (filtro.status && filtro.status !== 'Todos') {
      condicoes.push(eq(local.viagem.status, filtro.status));
    }
    if (filtro.veiculo_id) {
      condicoes.push(eq(local.viagem.veiculo_id, filtro.veiculo_id));
    }
    if (filtro.motorista_id) {
      condicoes.push(eq(local.viagem.motorista_id, filtro.motorista_id));
    }

    const linhas = selecionarViagensDetalhadas(and(...condicoes))
      .orderBy(desc(local.viagem.data_inclusao))
      .limit(filtro.limite ?? 100)
      .all();

    const viagens: ViagemDetalhada[] = [];
    for (const linha of linhas) {
      const validado = validarViagemDetalhada(linha);
      if (!validado.ok) {
        return validado;
      }
      viagens.push(validado.data);
    }

    return { ok: true, data: viagens };
  } catch (error) {
    return traduzirErroLocal(error, 'Não foi possível carregar as viagens. Tente novamente.');
  }
}

export async function buscarViagemPorId(id: string): Promise<Resultado<ViagemDetalhada>> {
  try {
    const linha = selecionarViagensDetalhadas(eq(local.viagem.id, id)).get();

    if (!linha) {
      return { ok: false, mensagem: 'Viagem não encontrada.' };
    }

    return validarViagemDetalhada(linha);
  } catch (error) {
    return traduzirErroLocal(error, 'Não foi possível carregar a viagem. Tente novamente.');
  }
}

// O aparelho só tem as viagens que o RLS deixou o sync baixar: para o Motorista, o máximo
// considera só as viagens dele. A tela só usa esse valor para Admin/Gestor; para o Motorista, o
// servidor devolve VG004 na sincronização sem expor o hodômetro de uma viagem que ele não enxerga.
export async function buscarUltimoHodometro(veiculo_id: string): Promise<Resultado<number | null>> {
  try {
    const linha = getDb()
      .select({ hodometro_final: local.viagem.hodometro_final })
      .from(local.viagem)
      .where(and(eq(local.viagem.veiculo_id, veiculo_id), isNotNull(local.viagem.hodometro_final)))
      .orderBy(desc(local.viagem.hodometro_final))
      .limit(1)
      .get();

    return { ok: true, data: linha?.hodometro_final ?? null };
  } catch (error) {
    return traduzirErroLocal(error, 'Não foi possível consultar o último hodômetro do veículo.');
  }
}

const COLUNAS_VEICULO_SELECIONAVEL = {
  id: local.veiculo.id,
  placa: local.veiculo.placa,
  marca: local.veiculo.marca,
  modelo: local.veiculo.modelo,
  ano_fabricacao: local.veiculo.ano_fabricacao,
  capacidade_carga: local.veiculo.capacidade_carga,
  status: local.veiculo.status,
};

// Só Disponível, como `listarVeiculosSelecionaveis('viagem')`: inativo, em manutenção e em
// viagem nem aparecem. Lê do cache local para o motorista abrir viagem sem internet.
export async function listarVeiculosDisponiveis(): Promise<Resultado<VeiculoSelecionavel[]>> {
  try {
    const veiculos = getDb()
      .select(COLUNAS_VEICULO_SELECIONAVEL)
      .from(local.veiculo)
      .where(eq(local.veiculo.status, 'Disponivel'))
      .orderBy(asc(local.veiculo.placa))
      .limit(LIMITE_SELETOR)
      .all();

    return { ok: true, data: veiculos };
  } catch (error) {
    return traduzirErroLocal(error, 'Não foi possível carregar os veículos. Tente novamente.');
  }
}

// O status vem do cache de `veiculo`, que o sync copia do servidor (lá o trigger
// `sincroniza_status_veiculo` o mantém) e que abrir/fechar viagem atualiza no próprio aparelho.
export async function buscarVeiculo(id: string): Promise<Resultado<VeiculoSelecionavel>> {
  try {
    const veiculo = getDb()
      .select(COLUNAS_VEICULO_SELECIONAVEL)
      .from(local.veiculo)
      .where(eq(local.veiculo.id, id))
      .get();

    if (!veiculo) {
      return { ok: false, mensagem: MENSAGEM_VEICULO_FORA_DO_APARELHO, campo: 'veiculo_id' };
    }

    return { ok: true, data: veiculo };
  } catch (error) {
    return traduzirErroLocal(error, 'Não foi possível carregar o veículo. Tente novamente.');
  }
}

// Só rotas ativas: uma rota desativada some do seletor, mas continua nas viagens antigas.
export async function listarRotasAtivas(): Promise<Resultado<RotaResumo[]>> {
  try {
    const rotas = getDb()
      .select({
        id: local.rota.id,
        cidade_origem: local.rota.cidade_origem,
        uf_origem: local.rota.uf_origem,
        cidade_destino: local.rota.cidade_destino,
        uf_destino: local.rota.uf_destino,
        distancia_estimada_km: local.rota.distancia_estimada_km,
      })
      .from(local.rota)
      .where(eq(local.rota.ativa, true))
      .orderBy(asc(local.rota.cidade_origem), asc(local.rota.cidade_destino))
      .limit(LIMITE_SELETOR)
      .all();

    return { ok: true, data: rotas };
  } catch (error) {
    return traduzirErroLocal(error, 'Não foi possível carregar as rotas. Tente novamente.');
  }
}

// Motoristas ativos para o Admin/Gestor escolher o responsável. Continua online: `usuario` não é
// espelhado no aparelho (ADR 0004, decisão 5) e quem escolhe motorista trabalha no escritório.
// O `!inner` faz o filtro de perfil valer sobre a linha de `usuario` (sem ele, o PostgREST só
// esvaziaria a relação). O RLS de `usuario` deixa Admin e Gestor de Frota lerem todos
// (20260924000500_rls.sql).
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

function primeiraFalhaDoSchema(error: z.ZodError, mensagemPadrao: string): Falha {
  const issue = error.issues[0];
  return {
    ok: false,
    mensagem: issue?.message ?? mensagemPadrao,
    campo: issue?.path[0] as CampoErroViagem,
  };
}

function falhaDeRegra(codigo: 'VG001' | 'VG002' | 'VG003' | 'VG004'): Falha {
  return { ok: false, mensagem: MENSAGENS_ERRO_VIAGEM[codigo], campo: CAMPOS_ERRO_VIAGEM[codigo], codigo };
}

// Grava a viagem no aparelho e enfileira o envio. As regras VG001–VG004 são checadas aqui com o
// que o aparelho sabe, para o motorista ter resposta na hora mesmo sem sinal. O servidor checa de
// novo quando a viagem sobe, e o que ele recusar aparece como falha ou conflito na sincronização.
export async function abrirViagem(input: NovaViagemInput): Promise<Resultado<Viagem>> {
  const parsed = abrirViagemSchema.safeParse(input);
  if (!parsed.success) {
    return primeiraFalhaDoSchema(parsed.error, 'Dados inválidos para abertura de viagem.');
  }
  const dados = parsed.data;

  try {
    return getDb().transaction((tx): Resultado<Viagem> => {
      const veiculo = tx
        .select({ status: local.veiculo.status })
        .from(local.veiculo)
        .where(eq(local.veiculo.id, dados.veiculo_id))
        .get();

      if (!veiculo) {
        return { ok: false, mensagem: MENSAGEM_VEICULO_FORA_DO_APARELHO, campo: 'veiculo_id' };
      }
      if (veiculo.status === 'EmViagem') return falhaDeRegra('VG001');
      if (veiculo.status === 'EmManutencao') return falhaDeRegra('VG002');
      if (veiculo.status === 'Inativo') return falhaDeRegra('VG003');

      const rota = tx.select({ id: local.rota.id }).from(local.rota).where(eq(local.rota.id, dados.rota_id)).get();
      if (!rota) {
        return { ok: false, mensagem: MENSAGEM_ROTA_FORA_DO_APARELHO, campo: 'rota_id' };
      }

      // O status do veículo pode estar velho no cache; a viagem aberta neste aparelho, não.
      const emAndamento = tx
        .select({ id: local.viagem.id })
        .from(local.viagem)
        .where(and(eq(local.viagem.veiculo_id, dados.veiculo_id), eq(local.viagem.status, 'EmAndamento')))
        .get();
      if (emAndamento) return falhaDeRegra('VG001');

      const ultimo = tx
        .select({ hodometro_final: local.viagem.hodometro_final })
        .from(local.viagem)
        .where(and(eq(local.viagem.veiculo_id, dados.veiculo_id), isNotNull(local.viagem.hodometro_final)))
        .orderBy(desc(local.viagem.hodometro_final))
        .limit(1)
        .get();
      if (ultimo && ultimo.hodometro_final !== null && dados.hodometro_inicial < ultimo.hodometro_final) {
        return falhaDeRegra('VG004');
      }

      const agora = new Date().toISOString();
      const viagem: Viagem = {
        id: dados.id ?? gerarUuidV7(),
        veiculo_id: dados.veiculo_id,
        rota_id: dados.rota_id,
        motorista_id: dados.motorista_id,
        hodometro_inicial: dados.hodometro_inicial,
        hodometro_final: null,
        data_inicio: dados.data_inicio ?? agora,
        data_fim: null,
        status: 'EmAndamento',
        km_rodado: null,
        data_inclusao: agora,
        data_atualizacao: agora,
      };

      tx.insert(local.viagem).values(viagem).run();
      // Espelha o trigger `sincroniza_status_veiculo`: o veículo sai do seletor na hora.
      tx.update(local.veiculo).set({ status: 'EmViagem' }).where(eq(local.veiculo.id, dados.veiculo_id)).run();

      // Mesmas colunas do insert online da EIX-40. Datas de inclusão e atualização ficam com o
      // servidor, e km_rodado NUNCA vai: é coluna gerada no Postgres (428C9).
      const payload: PayloadAberturaViagem = {
        id: viagem.id,
        veiculo_id: viagem.veiculo_id,
        rota_id: viagem.rota_id,
        motorista_id: viagem.motorista_id,
        hodometro_inicial: viagem.hodometro_inicial,
        data_inicio: viagem.data_inicio,
        status: 'EmAndamento',
      };
      tx.insert(local.outbox)
        .values({ id: gerarUuidV7(), entidade: 'viagem', operacao: 'insert', payload: JSON.stringify(payload), criado_em: agora })
        .run();

      return { ok: true, data: viagem };
    });
  } catch (error) {
    return traduzirErroLocal(error, 'Não foi possível abrir a viagem. Tente novamente.');
  }
}

export async function fecharViagem(id: string, input: FecharViagemInput): Promise<Resultado<Viagem>> {
  const parsed = fecharViagemSchema.safeParse(input);
  if (!parsed.success) {
    return primeiraFalhaDoSchema(parsed.error, 'Dados inválidos para fechamento de viagem.');
  }
  const dados = parsed.data;

  try {
    return getDb().transaction((tx): Resultado<Viagem> => {
      const atual = tx.select().from(local.viagem).where(eq(local.viagem.id, id)).get();

      // Só fecha o que ainda está em andamento: a tela aberta há tempo não "fecha de novo" uma
      // viagem já encerrada (aqui ou por outro aparelho, depois de sincronizar).
      if (!atual || atual.status !== 'EmAndamento') {
        return { ok: false, mensagem: MENSAGEM_VIAGEM_NAO_ABERTA, campo: 'status' };
      }

      if (dados.hodometro_final <= atual.hodometro_inicial) {
        return falhaDaConstraint('viagem_hodometro_final_maior', '23514');
      }

      const agora = new Date().toISOString();
      const data_fim = dados.data_fim ?? agora;
      const viagem: Viagem = {
        ...atual,
        status: 'Finalizada',
        hodometro_final: dados.hodometro_final,
        data_fim,
        // No servidor é coluna gerada; aqui é calculada só para a tela mostrar até sincronizar.
        km_rodado: dados.hodometro_final - atual.hodometro_inicial,
        data_atualizacao: agora,
      };

      tx.update(local.viagem)
        .set({
          status: viagem.status,
          hodometro_final: viagem.hodometro_final,
          data_fim,
          km_rodado: viagem.km_rodado,
          data_atualizacao: agora,
        })
        .where(eq(local.viagem.id, id))
        .run();
      // Como o trigger do servidor: só devolve o veículo que ainda está EmViagem (um veículo
      // inativado durante a viagem continua Inativo).
      tx.update(local.veiculo)
        .set({ status: 'Disponivel' })
        .where(and(eq(local.veiculo.id, atual.veiculo_id), eq(local.veiculo.status, 'EmViagem')))
        .run();

      const payload: PayloadFechamentoViagem = {
        id,
        status: 'Finalizada',
        hodometro_final: dados.hodometro_final,
        data_fim,
      };
      tx.insert(local.outbox)
        .values({ id: gerarUuidV7(), entidade: 'viagem', operacao: 'update', payload: JSON.stringify(payload), criado_em: agora })
        .run();

      return { ok: true, data: viagem };
    });
  } catch (error) {
    return traduzirErroLocal(error, 'Não foi possível fechar a viagem. Tente novamente.');
  }
}

export const viagensRepository: ViagensRepository = {
  listarViagens,
  buscarViagemPorId,
  buscarUltimoHodometro,
  listarVeiculosDisponiveis,
  buscarVeiculo,
  listarRotasAtivas,
  listarMotoristasAtivos,
  abrirViagem,
  fecharViagem,
};
