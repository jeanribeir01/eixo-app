import type { Enums, Tables } from '@/types/database';

// Derivados dos tipos gerados por `supabase gen types typescript` — nunca digite o tipo de
// tabela na mão (AGENTS.md §2.2, CLAUDE.md §12).
//
// "Inativo" (soft delete do veículo) entrou no enum pela migration da EIX-56.
// TODO(EIX-37): incluir "Inativo" em STATUS_VEICULO quando o botão Inativar existir.
export type StatusVeiculo = Enums<'status_veiculo'>;

// TODO(EIX-37): a coluna `ano_fabricacao` já existe (EIX-56); falta incluí-la aqui, no schema Zod
// e no formulário.
// Só as colunas que a tela usa; data_inclusao/data_atualizacao ficam no banco.
export type Veiculo = Pick<Tables<'veiculo'>, 'id' | 'placa' | 'marca' | 'modelo' | 'capacidade_carga' | 'status'>;

export type VeiculoInput = Pick<Veiculo, 'placa' | 'marca' | 'modelo' | 'capacidade_carga' | 'status'>;

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

// Ordem fixa usada nos filtros e no formulário.
export const STATUS_VEICULO: StatusVeiculo[] = ['Disponivel', 'EmViagem', 'EmManutencao'];
