import type { Enums, Tables } from '@/types/database';
import type { BadgeTone } from '@/ui';

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
// Só a primeira palavra com maiúscula, como todo rótulo do app ("Em viagem", não "Em Viagem").
export const rotuloStatusVeiculo: Record<StatusVeiculo, string> = {
  Disponivel: 'Disponível',
  EmViagem: 'Em viagem',
  EmManutencao: 'Em manutenção',
  // Na tela é 'Desativado', a mesma palavra de Categorias, Formas de pagamento e Rotas; no banco segue Inativo.
  Inativo: 'Desativado',
};

// Tom do selo de cada status, num lugar só (DESIGN-CYAN §1): parado na oficina pede atenção (warning),
// na estrada é informação (neutral), disponível é o estado bom (success) e desativado não tem ênfase.
export const tomStatusVeiculo: Record<StatusVeiculo, BadgeTone> = {
  Disponivel: 'success',
  EmViagem: 'neutral',
  EmManutencao: 'warning',
  Inativo: 'muted',
};

// O formulário tem opções próprias: desativar é o botão do fim do Editar, não uma opção do seletor.
export const STATUS_VEICULO: StatusVeiculo[] = ['Disponivel', 'EmViagem', 'EmManutencao', 'Inativo'];
