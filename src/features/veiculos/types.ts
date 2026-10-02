import type { Enums, Tables } from '@/types/database';

// Derivados dos tipos gerados por `supabase gen types typescript` — nunca digite o tipo de
// tabela na mão (AGENTS.md §2.2, CLAUDE.md §12).
//
// TODO(EIX-37): o critério de aceite pede o status "Inativo" (soft delete do veículo), mas o enum
// `status_veiculo` só tem Disponivel, EmViagem e EmManutencao. Depende de uma migration que ainda
// não existe — quando ela entrar e os tipos forem regerados, o novo valor aparece aqui sozinho e o
// `Record` abaixo passa a exigir o rótulo dele (o typecheck acusa).
export type StatusVeiculo = Enums<'status_veiculo'>;

// TODO(EIX-37): falta `ano_fabricacao` — a coluna não existe na tabela `veiculo` e depende de uma
// migration que ainda não existe. Não adicionar o campo aqui antes de os tipos serem regerados.
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
};

// Ordem fixa usada nos filtros e no formulário.
export const STATUS_VEICULO: StatusVeiculo[] = ['Disponivel', 'EmViagem', 'EmManutencao'];
