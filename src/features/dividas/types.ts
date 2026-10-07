import type { StatusPagamento } from '@/features/movimentacoes/types';
import type { Tables } from '@/types/database';

type LinhaDivida = Tables<'divida'>;

// Dinheiro sai do repositório sempre em centavos inteiros (CLAUDE.md §5); os campos
// derivados do banco vêm dos tipos gerados, nunca digitados à mão.
export type Divida = {
  id: LinhaDivida['id'];
  descricao: LinhaDivida['descricao'];
  categoria: Pick<Tables<'categoria'>, 'titulo'>;
  quantidadeParcelas: LinhaDivida['quantidade_parcelas'];
  valorParcelaCentavos: number;
  // Quantidade × valor da parcela — o "Soma Total" da tela.
  somaTotalCentavos: number;
  valorQuitacaoCentavos: number | null;
  dataVencimentoPrimeira: LinhaDivida['data_vencimento_primeira'];
  parcelasPagas: number;
  ativa: LinhaDivida['ativa'];
};

// Parcela é uma movimentacao com divida_id; `numero` é a posição na ordem de vencimento.
export type Parcela = {
  id: Tables<'movimentacao'>['id'];
  numero: number;
  dataVencimento: string;
  valorCentavos: number;
  status: StatusPagamento;
  dataPagamento: Tables<'movimentacao'>['data_pagamento'];
};

export type DividaDetalhe = Divida & { parcelas: Parcela[] };

export type DividaCriada = { id: string; quantidadeParcelas: number };

export type ResultadoExclusao = { parcelasRemovidas: number; parcelasPreservadas: number };
