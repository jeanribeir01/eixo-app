import type { Enums, Tables } from '@/types/database';

// Derivados dos tipos gerados por `supabase gen types typescript` — nunca digite o tipo de
// tabela na mão (AGENTS.md §2.2, CLAUDE.md §12).
//
// "Inativo" (soft delete do veículo) entrou no enum pela migration da EIX-56.
export type StatusVeiculo = Enums<'status_veiculo'>;

// Só as colunas que a tela usa; data_inclusao/data_atualizacao ficam no banco.
export type Veiculo = Pick<Tables<'veiculo'>, 'id' | 'placa' | 'marca' | 'modelo' | 'ano_fabricacao' | 'capacidade_carga' | 'status'>;

export type VeiculoInput = Pick<Veiculo, 'placa' | 'marca' | 'modelo' | 'capacidade_carga' | 'status'> & {
  ano_fabricacao: NonNullable<Veiculo['ano_fabricacao']>;
};

export type FiltroVeiculos = {
  busca?: string; // compara com placa (normalizada) e modelo, sem diferenciar maiúsculas/minúsculas
  status?: StatusVeiculo;
};

// O enum do banco não tem acento nem espaço ('EmManutencao'); isso existe só no que o usuário lê.
export const rotuloStatusVeiculo: Record<StatusVeiculo, string> = {
  Disponivel: 'Disponível',
  EmViagem: 'Em Viagem',
  EmManutencao: 'Em Manutenção',
  Inativo: 'Inativo',
};

// O formulário tem opções próprias: inativação exige botão e confirmação.
export const STATUS_VEICULO: StatusVeiculo[] = ['Disponivel', 'EmViagem', 'EmManutencao', 'Inativo'];
