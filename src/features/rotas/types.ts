import type { Enums, Tables } from '@/types/database';

// Derivados dos tipos gerados por `supabase gen types typescript` — nunca digite o tipo de
// tabela na mão (AGENTS.md §2.2, CLAUDE.md §12).
export type Uf = Enums<'uf'>;

// Só as colunas que a tela usa; data_inclusao/data_atualizacao ficam no banco.
export type Rota = Pick<
  Tables<'rota'>,
  'id' | 'cidade_origem' | 'uf_origem' | 'cidade_destino' | 'uf_destino' | 'distancia_estimada_km' | 'ativa'
>;

// O que o formulário grava. `ativa` fica de fora: rota nasce ativa (default do banco) e só muda
// pelo switch da lista ou pelo "Reativar rota existente".
export type RotaInput = Pick<Rota, 'cidade_origem' | 'uf_origem' | 'cidade_destino' | 'uf_destino' | 'distancia_estimada_km'>;

// Linha da lista: a contagem vem pronta do banco (embed `viagem(count)` só de finalizadas), nunca
// somada no cliente (RNF06).
export type RotaComViagens = Rota & { viagens_finalizadas: number };
