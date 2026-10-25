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

// O que as telas recebem: valor em centavos inteiros (CLAUDE.md §5), nunca o `numeric` em reais.
export type ManutencaoItem = Omit<Manutencao, 'valor'> & { valorCentavos: number };

// Linha da lista de manutenções: a placa vem junto para o título "PLACA · descrição".
export type ManutencaoComPlaca = ManutencaoItem & { placa: string };

export type VeiculoResumo = Pick<Tables<'veiculo'>, 'id' | 'placa' | 'marca' | 'modelo' | 'status'>;

// Detalhe do veículo (`/frota/<id>`): os dados dele e o histórico de manutenções.
export type VeiculoComHistorico = VeiculoResumo & { manutencoes: ManutencaoItem[] };

// Opção do seletor: só id e nome, que é o que a RPC `listar_formas_pagamento_ativas` devolve.
export type FormaPagamentoOpcao = Pick<Tables<'forma_pagamento'>, 'id' | 'nome'>;
