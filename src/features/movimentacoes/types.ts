import type { Categoria, TipoCategoria } from '@/features/categorias/types';
import type { FormaPagamento } from '@/features/formas-pagamento/types';
import type { Enums, Tables } from '@/types/database';

// Derivados dos tipos gerados por `supabase gen types` — nunca digite o tipo de tabela na mão.
export type StatusPagamento = Enums<'status_pagamento'>;

// `valor` vem do banco em reais (numeric); no app ele vira `valorCentavos` (inteiro) no
// repositório e nunca mais é tratado como float (CLAUDE.md §5).
export type Movimentacao = Pick<
  Tables<'movimentacao'>,
  | 'id'
  | 'descricao'
  | 'categoria_id'
  | 'forma_pagamento_id'
  | 'divida_id'
  | 'data_vencimento'
  | 'data_pagamento'
  | 'data_inclusao'
  | 'status_pagamento'
  | 'comprovante_url'
> & {
  valorCentavos: number;
  categoria: Pick<Categoria, 'titulo' | 'tipo' | 'ativa'>;
  formaPagamento: Pick<FormaPagamento, 'nome' | 'ativa'>;
};

// O enum tem um valor só para "pago"; quem lê vê "Recebido" numa entrada (AC da EIX-33).
export function rotuloStatus(status: StatusPagamento, tipo: TipoCategoria): string {
  if (status === 'Pendente') return 'Pendente';
  return tipo === 'Entrada' ? 'Recebido' : 'Pago';
}
