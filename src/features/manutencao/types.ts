import type { Enums, Tables } from '@/types/database';

// Derivados dos tipos gerados por `supabase gen types typescript` — nunca digite o tipo de
// tabela na mão (AGENTS.md §2.2, CLAUDE.md §12).
export type StatusPagamento = Enums<'status_pagamento'>;

// Só as colunas que as telas usam. `data_conclusao` nula = manutenção em aberto (veículo parado);
// é preenchida pela RPC `concluir_manutencao` (migration 20261014000300).
export type Manutencao = Pick<
  Tables<'manutencao'>,
  'id' | 'veiculo_id' | 'descricao' | 'data_manutencao' | 'valor' | 'data_conclusao'
>;
