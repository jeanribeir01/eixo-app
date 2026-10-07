import { z } from 'zod';

import { supabase } from '@/supabase/client';
import { Constants } from '@/types/database';

import { normalizarPlaca } from './placa';
import type { FiltroVeiculos, Veiculo, VeiculoInput } from './types';

// Camada de acesso a dados isolada da tela (AGENTS.md §2.3, skill supabase-query): as telas só
// conhecem estas funções e o formato de resultado abaixo, nunca o Supabase. A autorização
// (escrita só para Admin e Gestor de Frota) é decidida pelas policies de RLS da tabela `veiculo`.
//
// TODO(EIX-37): falta "inativar" (soft delete — veículo com viagens no histórico nunca é apagado).
// Depende de uma migration que ainda não existe: o enum `status_veiculo` não tem o valor "Inativo".
// Quando existir, entra aqui um `inativarVeiculo(id)` fazendo `update({ status: 'Inativo' })` —
// nunca `.delete()`.

// `campo` diz à tela em qual input mostrar a mensagem (ex.: placa duplicada aparece na Placa).
export type Resultado<T> = { ok: true; data: T } | { ok: false; mensagem: string; campo?: 'placa' };

const COLUNAS = 'id, placa, marca, modelo, capacidade_carga, status';

// O limite só impede uma resposta sem teto (skill supabase-query); a frota de uma transportadora
// cabe com folga nele.
const LIMITE_LISTA = 500;

const MENSAGEM_PLACA_DUPLICADA = 'Já existe um veículo cadastrado com essa placa.';
const MENSAGEM_PLACA_INVALIDA = 'Placa inválida. Use o formato AAA-1234 ou o padrão Mercosul AAA1A23.';
const MENSAGEM_NAO_ENCONTRADO = 'Veículo não encontrado.';
const MENSAGEM_DADOS_INVALIDOS = 'Os dados recebidos são inválidos. Tente novamente.';

// Dado externo não é confiável só porque o TypeScript compilou: a resposta passa pelo Zod.
// O enum vem de `Constants` (gerado), então acompanha o banco sem lista escrita à mão.
const veiculoSchema = z.object({
  id: z.string(),
  placa: z.string(),
  marca: z.string(),
  modelo: z.string(),
  capacidade_carga: z.number(),
  status: z.enum(Constants.public.Enums.status_veiculo),
});

type ErroSupabase = { code: string; message?: string };
type Falha = Extract<Resultado<never>, { ok: false }>;

// Nunca mostra `error.message` do Postgres ao usuário: traduz os códigos que a tela sabe explicar.
function traduzirErro(error: ErroSupabase, mensagemPadrao: string): Falha {
  // 23505 = unique_violation. A única unique da tabela é `veiculo_placa_unique`; como a placa
  // chega normalizada, "ABC-1234" e "abc1234" batem na mesma linha e caem aqui.
  if (error.code === '23505') return { ok: false, mensagem: MENSAGEM_PLACA_DUPLICADA, campo: 'placa' };
  // 23514 = check_violation em `veiculo_placa_normalizada`. Não deveria acontecer (o schema
  // normaliza antes), mas se acontecer o usuário vê a mensagem certa no campo certo.
  if (error.code === '23514') return { ok: false, mensagem: MENSAGEM_PLACA_INVALIDA, campo: 'placa' };
  // 42501 = insufficient_privilege: a policy de RLS recusou a escrita para este perfil.
  if (error.code === '42501') return { ok: false, mensagem: 'Você não tem permissão para alterar veículos.' };
  return { ok: false, mensagem: mensagemPadrao };
}

function validarVeiculo(data: unknown): Resultado<Veiculo> {
  const parsed = veiculoSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  }
  return { ok: true, data: parsed.data };
}

// Garante o formato que a constraint do banco exige, mesmo que quem chame não tenha passado
// pelo schema do formulário.
function paraBanco(input: VeiculoInput): VeiculoInput {
  return {
    placa: normalizarPlaca(input.placa),
    marca: input.marca.trim(),
    modelo: input.modelo.trim(),
    capacidade_carga: input.capacidade_carga,
    status: input.status,
  };
}

// O filtro `.or()` do PostgREST é uma string com sintaxe própria: vírgula separa condições,
// parênteses agrupam e `%`/`*` são curingas. Remover esses caracteres do texto digitado impede
// que a busca quebre a query ou vire um filtro diferente do que o usuário pediu.
function limparTermoBusca(termo: string): string {
  return termo.replace(/[,()%*\\":.]/g, ' ').trim();
}

// Monta "placa OU modelo contém o termo". A placa é comparada já normalizada ("abc-12" → "ABC12"),
// porque é assim que ela está gravada.
function filtroBusca(busca: string): string | null {
  const termoModelo = limparTermoBusca(busca);
  const termoPlaca = normalizarPlaca(busca);

  const condicoes: string[] = [];
  if (termoPlaca) condicoes.push(`placa.ilike.%${termoPlaca}%`);
  if (termoModelo) condicoes.push(`modelo.ilike.%${termoModelo}%`);

  return condicoes.length > 0 ? condicoes.join(',') : null;
}

export async function listarVeiculos(filtro: FiltroVeiculos = {}): Promise<Resultado<Veiculo[]>> {
  let query = supabase.from('veiculo').select(COLUNAS);

  if (filtro.status) {
    query = query.eq('status', filtro.status);
  }

  const busca = filtro.busca ? filtroBusca(filtro.busca) : null;
  if (busca) {
    query = query.or(busca);
  }

  const { data, error } = await query.order('placa').limit(LIMITE_LISTA);

  if (error) {
    return traduzirErro(error, 'Não foi possível carregar os veículos. Tente novamente.');
  }

  const parsed = z.array(veiculoSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  }

  return { ok: true, data: parsed.data };
}

export async function buscarVeiculoPorId(id: string): Promise<Resultado<Veiculo>> {
  const { data, error } = await supabase.from('veiculo').select(COLUNAS).eq('id', id).maybeSingle();

  if (error) {
    return traduzirErro(error, 'Não foi possível carregar o veículo. Tente novamente.');
  }
  if (!data) {
    return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADO };
  }

  return validarVeiculo(data);
}

export async function criarVeiculo(input: VeiculoInput): Promise<Resultado<Veiculo>> {
  // Sem checagem prévia de duplicada (diferente de categorias): a placa já chega normalizada,
  // então a constraint unique do banco é exata e o 23505 dela vira a mensagem no campo.
  // id gerado pelo banco (gen_random_uuid): o cadastro de frota é online-only; o offline
  // obrigatório (RNF01) é viagem e hodômetro.
  const { data, error } = await supabase.from('veiculo').insert(paraBanco(input)).select(COLUNAS).single();

  if (error) {
    return traduzirErro(error, 'Não foi possível cadastrar o veículo. Tente novamente.');
  }

  return validarVeiculo(data);
}

export async function atualizarVeiculo(id: string, input: VeiculoInput): Promise<Resultado<Veiculo>> {
  const { data, error } = await supabase
    .from('veiculo')
    .update(paraBanco(input))
    .eq('id', id)
    .select(COLUNAS)
    .maybeSingle();

  if (error) {
    return traduzirErro(error, 'Não foi possível atualizar o veículo. Tente novamente.');
  }
  // Sem linha: o id não existe ou o RLS não deixou este perfil alterar. Para a tela, "não encontrado".
  if (!data) {
    return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADO };
  }

  return validarVeiculo(data);
}
