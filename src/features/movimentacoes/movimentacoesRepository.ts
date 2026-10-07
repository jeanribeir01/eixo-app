import { z } from 'zod';

import { listarCategorias } from '@/features/categorias/categoriasRepository';
import type { Categoria } from '@/features/categorias/types';
import { listarFormasPagamento } from '@/features/formas-pagamento/formasPagamentoRepository';
import type { FormaPagamento } from '@/features/formas-pagamento/types';
import { dataLocalISO, intervaloDoMes } from '@/lib/datas';
import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { centavosParaReais, reaisParaCentavos } from '@/lib/money';
import { supabase } from '@/supabase/client';

import type { MovimentacaoInput } from './schema';
import type { Movimentacao } from './types';

export type Resultado<T> = { ok: true; data: T } | { ok: false; mensagem: string };

// Joins pelo nome da tabela: o PostgREST resolve pela FK e devolve um objeto em cada linha.
const COLUNAS =
  'id, valor, descricao, categoria_id, forma_pagamento_id, divida_id, data_vencimento, data_pagamento, ' +
  'data_inclusao, status_pagamento, caminho_comprovante, categoria(titulo, tipo, ativa), forma_pagamento(nome, ativa)';
// Um mês de lançamentos de uma transportadora pequena fica bem abaixo disso.
const LIMITE_LISTA = 500;

const MENSAGEM_NAO_ENCONTRADA = 'Movimentação não encontrada.';
const MENSAGEM_DADOS_INVALIDOS = 'Os dados recebidos são inválidos. Tente novamente.';

const linhaSchema = z.object({
  id: z.string(),
  valor: z.number(),
  descricao: z.string(),
  categoria_id: z.string(),
  forma_pagamento_id: z.string(),
  divida_id: z.string().nullable(),
  data_vencimento: z.string().nullable(),
  data_pagamento: z.string().nullable(),
  data_inclusao: z.string(),
  status_pagamento: z.enum(['Pendente', 'Pago']),
  caminho_comprovante: z.string().nullable(),
  categoria: z.object({ titulo: z.string(), tipo: z.enum(['Entrada', 'Saida']), ativa: z.boolean() }),
  forma_pagamento: z.object({ nome: z.string(), ativa: z.boolean() }),
});

type ErroSupabase = { code: string };

function traduzirErro(error: ErroSupabase, mensagemPadrao: string): string {
  if (ehAcessoNegado(error)) return MENSAGEM_ACESSO_NEGADO;
  // 23514 = check do banco (valor > 0, Pago com data). O form já barra; chegar aqui
  // significa que a regra do banco segurou algo que passou pelo app.
  if (error.code === '23514') return 'Valor ou data de pagamento inválidos.';
  // 23503 = FK: a categoria ou forma escolhida não existe mais.
  if (error.code === '23503') return 'Categoria ou forma de pagamento não encontrada.';
  return mensagemPadrao;
}

function paraMovimentacao({ valor, forma_pagamento, ...resto }: z.infer<typeof linhaSchema>): Movimentacao {
  return { ...resto, valorCentavos: reaisParaCentavos(valor), formaPagamento: forma_pagamento };
}

function validar(data: unknown): Resultado<Movimentacao> {
  const parsed = linhaSchema.safeParse(data);
  if (!parsed.success) return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  return { ok: true, data: paraMovimentacao(parsed.data) };
}

// Data que posiciona o lançamento no mês: vencimento, ou o dia (local) em que foi criado.
export function dataDeReferencia(movimentacao: Pick<Movimentacao, 'data_vencimento' | 'data_inclusao'>): string {
  if (movimentacao.data_vencimento) return movimentacao.data_vencimento;
  return dataLocalISO(new Date(movimentacao.data_inclusao));
}

function paraLinhaDoBanco(input: MovimentacaoInput) {
  // data_inclusao e data_atualizacao ficam com o banco (default e trigger).
  return {
    categoria_id: input.categoriaId,
    forma_pagamento_id: input.formaPagamentoId,
    valor: centavosParaReais(input.valorCentavos),
    descricao: input.descricao,
    data_vencimento: input.dataVencimento,
    data_pagamento: input.dataPagamento,
    status_pagamento: input.status,
    caminho_comprovante: input.caminhoComprovante,
  };
}

export async function listarMovimentacoesDoMes(ano: number, mes: number): Promise<Resultado<Movimentacao[]>> {
  const intervalo = intervaloDoMes(ano, mes);
  // Instantes entre aspas: têm ":" e ".", que o filtro .or() do PostgREST trataria como sintaxe.
  const filtro =
    `and(data_vencimento.gte.${intervalo.inicioData},data_vencimento.lte.${intervalo.fimData}),` +
    `and(data_vencimento.is.null,data_inclusao.gte."${intervalo.inicioInstante}",data_inclusao.lt."${intervalo.fimInstante}")`;

  const { data, error } = await supabase.from('movimentacao').select(COLUNAS).or(filtro).limit(LIMITE_LISTA);

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível carregar as movimentações. Tente novamente.') };
  }

  const parsed = z.array(linhaSchema).safeParse(data);
  if (!parsed.success) return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };

  const movimentacoes = parsed.data.map(paraMovimentacao);
  movimentacoes.sort((a, b) => dataDeReferencia(a).localeCompare(dataDeReferencia(b)));
  return { ok: true, data: movimentacoes };
}

export async function buscarMovimentacaoPorId(id: string): Promise<Resultado<Movimentacao>> {
  const { data, error } = await supabase.from('movimentacao').select(COLUNAS).eq('id', id).maybeSingle();

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível carregar a movimentação. Tente novamente.') };
  }
  if (!data) return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADA };

  return validar(data);
}

export async function criarMovimentacao(input: MovimentacaoInput): Promise<Resultado<Movimentacao>> {
  const { data, error } = await supabase.from('movimentacao').insert(paraLinhaDoBanco(input)).select(COLUNAS).single();

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível registrar a movimentação. Tente novamente.') };
  }

  return validar(data);
}

export async function atualizarMovimentacao(id: string, input: MovimentacaoInput): Promise<Resultado<Movimentacao>> {
  const { data, error } = await supabase
    .from('movimentacao')
    .update(paraLinhaDoBanco(input))
    .eq('id', id)
    .select(COLUNAS)
    .maybeSingle();

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível atualizar a movimentação. Tente novamente.') };
  }
  if (!data) return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADA };

  return validar(data);
}

// Delete físico (movimentação não está na lista de soft delete). Parcela de dívida é
// bloqueada pelo RLS: o delete "funciona" mas afeta 0 linhas — por isso pedimos o id de volta.
export async function excluirMovimentacao(id: string): Promise<Resultado<string>> {
  const { data, error } = await supabase.from('movimentacao').delete().eq('id', id).select('id');

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível excluir a movimentação. Tente novamente.') };
  }
  if (!data || data.length === 0) {
    return { ok: false, mensagem: 'Movimentação não encontrada ou não pode ser excluída.' };
  }

  return { ok: true, data: id };
}

export type OpcoesMovimentacao = { categorias: Categoria[]; formasPagamento: FormaPagamento[] };

// Itens desativados (soft delete) somem dos seletores, mas continuam nos lançamentos antigos.
export async function listarOpcoesMovimentacao(): Promise<Resultado<OpcoesMovimentacao>> {
  const [categorias, formasPagamento] = await Promise.all([listarCategorias(), listarFormasPagamento()]);

  if (!categorias.ok) return categorias;
  if (!formasPagamento.ok) return formasPagamento;

  return {
    ok: true,
    data: {
      categorias: categorias.data.filter((categoria) => categoria.ativa),
      formasPagamento: formasPagamento.data.filter((forma) => forma.ativa),
    },
  };
}
