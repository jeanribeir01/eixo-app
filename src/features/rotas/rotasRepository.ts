import { z } from 'zod';

import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { supabase } from '@/supabase/client';
import { Constants } from '@/types/database';

import { chaveCidade, limparCidade } from './cidade';
import type { Rota, RotaComViagens, RotaInput } from './types';

// Camada de acesso a dados isolada da tela (AGENTS.md §2.3, skill supabase-query): as telas só
// conhecem estas funções e o formato de resultado abaixo, nunca o Supabase. A autorização
// (escrita só para Admin e Gestor de Frota) é decidida pelas policies de RLS da tabela `rota`.

// `campo: 'trecho'` diz à tela que a falha é de rota duplicada: a mensagem aparece no formulário,
// não num Snackbar. `rotaInativaId` só vem quando a rota igual está inativa, para o botão
// "Reativar rota existente" saber qual rota reativar.
export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; mensagem: string; campo?: 'trecho'; rotaInativaId?: string };

type Falha = Extract<Resultado<never>, { ok: false }>;

const COLUNAS = 'id, cidade_origem, uf_origem, cidade_destino, uf_destino, distancia_estimada_km, ativa';

// Catálogo pequeno por natureza; o limite só impede uma resposta sem teto (skill supabase-query).
const LIMITE_LISTA = 500;

const MENSAGEM_DUPLICADA = 'Já existe uma rota com esse trecho.';
const MENSAGEM_DUPLICADA_INATIVA = 'Já existe uma rota inativa com esse trecho. Reative-a para usar de novo.';
const MENSAGEM_CIDADE_INVALIDA = 'Cidade inválida. Revise os nomes de origem e destino.';
const MENSAGEM_NAO_ENCONTRADA = 'Rota não encontrada.';
const MENSAGEM_DADOS_INVALIDOS = 'Os dados recebidos são inválidos. Tente novamente.';

// Dado externo não é confiável só porque o TypeScript compilou: a resposta passa pelo Zod.
// O enum vem de `Constants` (gerado), então acompanha o banco sem lista escrita à mão.
const rotaSchema = z.object({
  id: z.string(),
  cidade_origem: z.string(),
  uf_origem: z.enum(Constants.public.Enums.uf),
  cidade_destino: z.string(),
  uf_destino: z.enum(Constants.public.Enums.uf),
  distancia_estimada_km: z.number(),
  ativa: z.boolean(),
});

// O embed `viagem(count)` do PostgREST devolve a contagem como lista de um item: [{ count: 3 }].
const rotaComViagensSchema = rotaSchema.extend({
  viagem: z.array(z.object({ count: z.number() })),
});

type ErroSupabase = { code: string };

// Nunca mostra `error.message` do Postgres ao usuário: traduz os códigos que a tela sabe explicar.
function traduzirErro(error: ErroSupabase, mensagemPadrao: string): Falha {
  // 23505 = unique_violation no índice `rota_trecho_unico`. Cobre a corrida entre a checagem de
  // duplicada abaixo e o insert/update; sem saber se a outra rota está ativa, usa a mensagem geral.
  if (error.code === '23505') return { ok: false, mensagem: MENSAGEM_DUPLICADA, campo: 'trecho' };
  // 23514 = check_violation em `rota_cidade_*_normalizada`. Não deveria acontecer (a cidade sai
  // limpa do app), mas se acontecer o usuário sabe o que revisar.
  if (error.code === '23514') return { ok: false, mensagem: MENSAGEM_CIDADE_INVALIDA };
  if (ehAcessoNegado(error)) return { ok: false, mensagem: MENSAGEM_ACESSO_NEGADO };
  return { ok: false, mensagem: mensagemPadrao };
}

function validarRota(data: unknown): Resultado<Rota> {
  const parsed = rotaSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  }
  return { ok: true, data: parsed.data };
}

// Garante o formato que as checks do banco exigem, mesmo que quem chame não tenha passado
// pelo schema do formulário.
function paraBanco(input: RotaInput): RotaInput {
  return {
    cidade_origem: limparCidade(input.cidade_origem),
    uf_origem: input.uf_origem,
    cidade_destino: limparCidade(input.cidade_destino),
    uf_destino: input.uf_destino,
    distancia_estimada_km: input.distancia_estimada_km,
  };
}

// Mesma regra do índice `rota_trecho_unico` (migration 20261014000400): cidade sem diferença de
// maiúscula, espaço ou acento + UF, nos dois lados. O sentido importa: Curitiba → São Paulo e
// São Paulo → Curitiba são rotas diferentes. Rota inativa também conta (decisão da spec): o
// histórico de viagens de um trecho fica numa rota só, então o caminho é reativar a antiga.
// Roda antes de gravar porque só aqui dá para saber se a rota igual está inativa e qual é o id dela.
async function verificarDuplicada(input: RotaInput, ignorarId?: string): Promise<Falha | null> {
  // As UFs filtram no banco; a cidade é comparada aqui, com a mesma normalização do índice.
  const { data, error } = await supabase
    .from('rota')
    .select('id, cidade_origem, cidade_destino, ativa')
    .eq('uf_origem', input.uf_origem)
    .eq('uf_destino', input.uf_destino);

  if (error) {
    return traduzirErro(error, 'Não foi possível salvar a rota. Tente novamente.');
  }

  const origem = chaveCidade(input.cidade_origem);
  const destino = chaveCidade(input.cidade_destino);
  // Ignora o próprio id: salvar a edição sem mudar o trecho não pode contar como duplicada.
  const existente = data.find(
    (rota) =>
      rota.id !== ignorarId && chaveCidade(rota.cidade_origem) === origem && chaveCidade(rota.cidade_destino) === destino,
  );

  if (!existente) return null;
  if (!existente.ativa) {
    return { ok: false, mensagem: MENSAGEM_DUPLICADA_INATIVA, campo: 'trecho', rotaInativaId: existente.id };
  }
  return { ok: false, mensagem: MENSAGEM_DUPLICADA, campo: 'trecho' };
}

// Traz ativas e inativas: a tela filtra localmente com o switch "Mostrar inativas".
// A contagem de viagens é feita no Postgres (RNF06): o filtro `viagem.status` vale só para as
// linhas do embed, então rota sem viagem finalizada continua na lista, com contagem 0.
export async function listarRotas(): Promise<Resultado<RotaComViagens[]>> {
  const { data, error } = await supabase
    .from('rota')
    .select(`${COLUNAS}, viagem(count)`)
    .eq('viagem.status', 'Finalizada')
    .order('cidade_origem')
    .order('cidade_destino')
    .limit(LIMITE_LISTA);

  if (error) {
    return traduzirErro(error, 'Não foi possível carregar as rotas. Tente novamente.');
  }

  const parsed = z.array(rotaComViagensSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  }

  return {
    ok: true,
    data: parsed.data.map(({ viagem, ...rota }) => ({ ...rota, viagens_finalizadas: viagem[0]?.count ?? 0 })),
  };
}

export async function buscarRotaPorId(id: string): Promise<Resultado<Rota>> {
  const { data, error } = await supabase.from('rota').select(COLUNAS).eq('id', id).maybeSingle();

  if (error) {
    return traduzirErro(error, 'Não foi possível carregar a rota. Tente novamente.');
  }
  // Sem linha também é o que o RLS devolve quando o perfil não pode ler: para a tela, "não encontrada".
  if (!data) {
    return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADA };
  }

  return validarRota(data);
}

export async function criarRota(input: RotaInput): Promise<Resultado<Rota>> {
  const rota = paraBanco(input);

  const duplicada = await verificarDuplicada(rota);
  if (duplicada) return duplicada;

  // id gerado pelo banco (gen_random_uuid): o cadastro de rota é online-only; o offline
  // obrigatório (RNF01) é viagem e hodômetro.
  const { data, error } = await supabase.from('rota').insert(rota).select(COLUNAS).single();

  if (error) {
    return traduzirErro(error, 'Não foi possível cadastrar a rota. Tente novamente.');
  }

  return validarRota(data);
}

export async function atualizarRota(id: string, input: RotaInput): Promise<Resultado<Rota>> {
  const rota = paraBanco(input);

  const duplicada = await verificarDuplicada(rota, id);
  if (duplicada) return duplicada;

  const { data, error } = await supabase.from('rota').update(rota).eq('id', id).select(COLUNAS).maybeSingle();

  if (error) {
    return traduzirErro(error, 'Não foi possível atualizar a rota. Tente novamente.');
  }
  // Sem linha: o id não existe ou o RLS não deixou este perfil alterar. Para a tela, "não encontrada".
  if (!data) {
    return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADA };
  }

  return validarRota(data);
}

// Soft delete: alterna só a coluna `ativa` — nunca DELETE físico (AGENTS.md §2.4). A tabela nem
// tem policy de delete (migration 20261014000200); rota inativa continua nas viagens antigas.
// Também é o que o botão "Reativar rota existente" do formulário chama.
export async function definirAtivaRota(id: string, ativa: boolean): Promise<Resultado<Rota>> {
  const { data, error } = await supabase.from('rota').update({ ativa }).eq('id', id).select(COLUNAS).maybeSingle();

  if (error) {
    const acao = ativa ? 'reativar' : 'inativar';
    return traduzirErro(error, `Não foi possível ${acao} a rota. Tente novamente.`);
  }
  if (!data) {
    return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADA };
  }

  return validarRota(data);
}
