import { z } from 'zod';

import { rotuloStatusViagem } from '@/features/viagens/types';
import { dataLocalISO, isoParaDataBR } from '@/lib/datas';
import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { reaisParaCentavos } from '@/lib/money';
import { supabase } from '@/supabase/client';

// Ponte entre o Caixa e as Viagens (US09, RNF08). É o único lugar que conhece os dois módulos:
// `movimentacoes` importa daqui para o seletor de viagem, e `viagens` não importa nada do
// Financeiro. O Financeiro não lê a tabela `viagem` (RLS), por isso as viagens vêm das RPCs da
// migration 20261111000100_ponte_viagem.sql, que devolvem só placa, rota, status e datas.

export type Resultado<T> = { ok: true; data: T } | { ok: false; mensagem: string };

const MENSAGEM_DADOS_INVALIDOS = 'Os dados recebidos são inválidos. Tente novamente.';
export const MENSAGEM_DESVINCULO_FALHOU = 'Não foi possível desvincular. Tente novamente.';

// O tipo gerado diz `data_inicio: string`, mas a coluna aceita nulo (o gerador não sabe a
// nulidade do retorno de uma função). O Zod confere o que de fato chega.
const viagemSchema = z.object({
  id: z.string(),
  placa: z.string(),
  cidade_origem: z.string(),
  uf_origem: z.string(),
  cidade_destino: z.string(),
  uf_destino: z.string(),
  status: z.enum(['EmAndamento', 'Finalizada', 'Cancelada']),
  data_inicio: z.string().nullable(),
  data_fim: z.string().nullable(),
});

export type ViagemVinculavel = z.infer<typeof viagemSchema>;

const lancamentoSchema = z.object({
  id: z.string(),
  valor: z.number(),
  descricao: z.string(),
  litros: z.number().nullable(),
  categoria: z.object({ titulo: z.string(), tipo: z.enum(['Entrada', 'Saida']) }),
});

// Lançamento como o detalhe da viagem mostra. `valor` vira centavos aqui e nunca mais é float.
export type LancamentoDaViagem = Omit<z.infer<typeof lancamentoSchema>, 'valor'> & { valorCentavos: number };

// "ABC1D23 · São Paulo/SP → Curitiba/PR": placa e rota no rótulo, porque a busca do seletor filtra
// por elas (PONTE-03).
export function rotuloViagem(viagem: ViagemVinculavel): string {
  return `${viagem.placa} · ${viagem.cidade_origem}/${viagem.uf_origem} → ${viagem.cidade_destino}/${viagem.uf_destino}`;
}

// "Em andamento · início 09/11/2026". O dia é o do fuso do aparelho, não o de UTC.
export function descricaoViagem(viagem: ViagemVinculavel): string {
  const status = rotuloStatusViagem[viagem.status];
  if (!viagem.data_inicio) return status;
  return `${status} · início ${isoParaDataBR(dataLocalISO(new Date(viagem.data_inicio)))}`;
}

function mensagemDeErro(error: { code: string }, mensagemPadrao: string): string {
  return ehAcessoNegado(error) ? MENSAGEM_ACESSO_NEGADO : mensagemPadrao;
}

export async function listarViagensVinculaveis(): Promise<Resultado<ViagemVinculavel[]>> {
  const { data, error } = await supabase.rpc('listar_viagens_vinculaveis');

  if (error) {
    return { ok: false, mensagem: mensagemDeErro(error, 'Não foi possível carregar as viagens. Tente novamente.') };
  }

  const parsed = z.array(viagemSchema).safeParse(data);
  if (!parsed.success) return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  // A ordem (em andamento primeiro, depois as mais recentes) vem da RPC.
  return { ok: true, data: parsed.data };
}

// Uma viagem qualquer, mesmo fora da lista do seletor: rótulo de um vínculo antigo e cabeçalho
// do detalhe.
export async function buscarViagemVinculavel(id: string): Promise<Resultado<ViagemVinculavel>> {
  const { data, error } = await supabase.rpc('buscar_viagem_vinculavel', { p_viagem_id: id });

  if (error) {
    return { ok: false, mensagem: mensagemDeErro(error, 'Não foi possível carregar a viagem. Tente novamente.') };
  }

  const parsed = z.array(viagemSchema).safeParse(data);
  if (!parsed.success) return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  const viagem = parsed.data[0];
  if (!viagem) return { ok: false, mensagem: 'Viagem não encontrada.' };
  return { ok: true, data: viagem };
}

export async function listarLancamentosDaViagem(viagemId: string): Promise<Resultado<LancamentoDaViagem[]>> {
  const { data, error } = await supabase
    .from('movimentacao')
    .select('id, valor, descricao, litros, categoria(titulo, tipo)')
    .eq('viagem_id', viagemId)
    .order('data_inclusao', { ascending: true });

  if (error) {
    return { ok: false, mensagem: mensagemDeErro(error, 'Não foi possível carregar os lançamentos. Tente novamente.') };
  }

  const parsed = z.array(lancamentoSchema).safeParse(data);
  if (!parsed.success) return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  return {
    ok: true,
    data: parsed.data.map(({ valor, ...resto }) => ({ ...resto, valorCentavos: reaisParaCentavos(valor) })),
  };
}

// Desvincular não apaga: só tira o `viagem_id`. O lançamento continua no Caixa como despesa de
// escritório. Os litros ficam (o banco só proíbe litros fora de Combustível).
export async function desvincularLancamento(id: string): Promise<Resultado<string>> {
  const { data, error } = await supabase.from('movimentacao').update({ viagem_id: null }).eq('id', id).select('id');

  if (error) return { ok: false, mensagem: mensagemDeErro(error, MENSAGEM_DESVINCULO_FALHOU) };
  // Update barrado pelo RLS volta com 0 linhas e sem erro.
  if (!data || data.length === 0) return { ok: false, mensagem: MENSAGEM_DESVINCULO_FALHOU };
  return { ok: true, data: id };
}
