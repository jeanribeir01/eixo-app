import { z } from 'zod';

import { centavosParaReais, reaisParaCentavos } from '@/lib/money';
import { supabase } from '@/supabase/client';

import { somaTotalCentavos, type DividaInput } from './schema';
import type { Divida, DividaCriada, DividaDetalhe, Parcela, ResultadoExclusao } from './types';

export type Resultado<T> = { ok: true; data: T } | { ok: false; mensagem: string };

// Escrita só pelas RPCs (criar_divida, excluir_divida): o banco não aceita insert, update
// nem delete direto em divida. A leitura continua direta via PostgREST.
// `movimentacao(...)` traz as parcelas pela FK divida_id.
const COLUNAS =
  'id, descricao, quantidade_parcelas, valor_parcela, valor_quitacao_antecipada, data_vencimento_primeira, ativa, ' +
  'categoria(titulo), movimentacao(id, valor, data_vencimento, data_pagamento, status_pagamento)';

const MENSAGEM_NAO_ENCONTRADA = 'Dívida não encontrada ou já excluída.';
const MENSAGEM_DADOS_INVALIDOS = 'Os dados recebidos são inválidos. Tente novamente.';

const parcelaSchema = z.object({
  id: z.string(),
  valor: z.number(),
  data_vencimento: z.string(),
  data_pagamento: z.string().nullable(),
  status_pagamento: z.enum(['Pendente', 'Pago']),
});

const linhaSchema = z.object({
  id: z.string(),
  descricao: z.string(),
  quantidade_parcelas: z.number(),
  valor_parcela: z.number(),
  valor_quitacao_antecipada: z.number().nullable(),
  data_vencimento_primeira: z.string(),
  ativa: z.boolean(),
  categoria: z.object({ titulo: z.string() }),
  movimentacao: z.array(parcelaSchema),
});

const exclusaoSchema = z.object({ parcelasRemovidas: z.number().int(), parcelasPreservadas: z.number().int() });

type ErroSupabase = { code: string };

// Os códigos vêm das RPCs e checks da migration 20261005000200_divida.sql. O texto do
// banco nunca chega ao usuário.
function traduzirErro(error: ErroSupabase, mensagemPadrao: string): string {
  if (error.code === '42501') return 'Você não tem permissão para gerenciar dívidas.';
  if (error.code === '22023') return 'Categoria ou forma de pagamento inválida. Escolha outra.';
  // 23514 = check do banco. O form já barra; chegar aqui é algo que passou pelo app.
  if (error.code === '23514') return 'Confira a quantidade de parcelas, o valor e a quitação.';
  if (error.code === 'P0002') return MENSAGEM_NAO_ENCONTRADA;
  return mensagemPadrao;
}

function paraDividaDetalhe(linha: z.infer<typeof linhaSchema>): DividaDetalhe {
  const valorParcelaCentavos = reaisParaCentavos(linha.valor_parcela);
  // Ordem de vencimento define o número da parcela (a descrição é a mesma em todas).
  const parcelas: Parcela[] = [...linha.movimentacao]
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
    .map((parcela, indice) => ({
      id: parcela.id,
      numero: indice + 1,
      dataVencimento: parcela.data_vencimento,
      valorCentavos: reaisParaCentavos(parcela.valor),
      status: parcela.status_pagamento,
      dataPagamento: parcela.data_pagamento,
    }));

  return {
    id: linha.id,
    descricao: linha.descricao,
    categoria: linha.categoria,
    quantidadeParcelas: linha.quantidade_parcelas,
    valorParcelaCentavos,
    somaTotalCentavos: somaTotalCentavos(linha.quantidade_parcelas, valorParcelaCentavos),
    valorQuitacaoCentavos:
      linha.valor_quitacao_antecipada === null ? null : reaisParaCentavos(linha.valor_quitacao_antecipada),
    dataVencimentoPrimeira: linha.data_vencimento_primeira,
    parcelasPagas: parcelas.filter((parcela) => parcela.status === 'Pago').length,
    ativa: linha.ativa,
    parcelas,
  };
}

// A lista não precisa das parcelas, só da contagem de pagas.
function paraDivida(linha: z.infer<typeof linhaSchema>): Divida {
  const { parcelas: _parcelas, ...divida } = paraDividaDetalhe(linha);
  return divida;
}

export async function criarDivida(input: DividaInput): Promise<Resultado<DividaCriada>> {
  const { data, error } = await supabase.rpc('criar_divida', {
    descricao: input.descricao,
    categoria_id: input.categoriaId,
    forma_pagamento_id: input.formaPagamentoId,
    quantidade_parcelas: input.quantidadeParcelas,
    valor_parcela: centavosParaReais(input.valorParcelaCentavos),
    data_vencimento_primeira: input.dataVencimentoPrimeira,
    // Parâmetro opcional da RPC: omitido = null no banco.
    ...(input.valorQuitacaoCentavos !== null && {
      valor_quitacao_antecipada: centavosParaReais(input.valorQuitacaoCentavos),
    }),
  });

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível registrar a dívida. Tente novamente.') };
  }

  const id = z.string().safeParse(data);
  if (!id.success) return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };

  // A quantidade alimenta o Snackbar "X parcelas geradas" da EIX-50.
  return { ok: true, data: { id: id.data, quantidadeParcelas: input.quantidadeParcelas } };
}

// Só as ativas: dívida excluída (soft delete) sai da lista, mas as parcelas pagas dela
// continuam no caixa.
export async function listarDividas(): Promise<Resultado<Divida[]>> {
  const { data, error } = await supabase
    .from('divida')
    .select(COLUNAS)
    .eq('ativa', true)
    .order('data_vencimento_primeira', { ascending: false });

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível carregar as dívidas. Tente novamente.') };
  }

  const parsed = z.array(linhaSchema).safeParse(data);
  if (!parsed.success) return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };

  return { ok: true, data: parsed.data.map(paraDivida) };
}

export async function buscarDivida(id: string): Promise<Resultado<DividaDetalhe>> {
  const { data, error } = await supabase.from('divida').select(COLUNAS).eq('id', id).maybeSingle();

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível carregar a dívida. Tente novamente.') };
  }
  if (!data) return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADA };

  const parsed = linhaSchema.safeParse(data);
  if (!parsed.success) return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };

  return { ok: true, data: paraDividaDetalhe(parsed.data) };
}

// Apaga as parcelas pendentes, preserva as pagas e desativa a dívida — tudo na RPC.
export async function excluirDivida(id: string): Promise<Resultado<ResultadoExclusao>> {
  const { data, error } = await supabase.rpc('excluir_divida', { id });

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível excluir a dívida. Tente novamente.') };
  }

  const parsed = exclusaoSchema.safeParse(data);
  if (!parsed.success) return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };

  return { ok: true, data: parsed.data };
}
