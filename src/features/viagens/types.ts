import type { Veiculo as VeiculoSelecionavel } from '@/features/veiculos/types';
import type { Enums, Tables } from '@/types/database';

export type StatusViagem = Enums<'status_viagem'>;
export type StatusVeiculo = Enums<'status_veiculo'>;
export type Uf = Enums<'uf'>;

// Linha exata da tabela `viagem` no banco (snake_case, paridade 1:1 com schema e tipos gerados)
export type Viagem = Tables<'viagem'>;

// O banco guarda "Finalizada", mas o critério de aceite da US08 exibe "Concluída"
// (mesmo padrão de `rotuloStatusVeiculo`). Um mapa só, para lista e fechamento não divergirem.
export const rotuloStatusViagem: Record<StatusViagem, string> = {
  EmAndamento: 'Em andamento',
  Finalizada: 'Concluída',
  Cancelada: 'Cancelada',
};

// Resumo do veículo acoplado à viagem
export type VeiculoResumo = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  status: StatusVeiculo;
};

// Resumo da rota acoplada à viagem
export type RotaResumo = {
  id: string;
  cidade_origem: string;
  uf_origem: Uf;
  cidade_destino: string;
  uf_destino: Uf;
  distancia_estimada_km: number;
};

// Resumo do motorista acoplado à viagem
export type MotoristaResumo = {
  id: string;
  nome: string;
  email?: string | null;
};

// Viagem com relações para exibição em listas e detalhes
export type ViagemDetalhada = Viagem & {
  veiculo?: VeiculoResumo | null;
  rota?: RotaResumo | null;
  motorista?: MotoristaResumo | null;
};

// Dados para abertura de viagem (novos registros)
export type NovaViagemInput = {
  id?: string; // Opcional, para idempotência offline / geração pelo cliente (AD-010)
  veiculo_id: string;
  rota_id: string;
  motorista_id: string;
  hodometro_inicial: number;
  data_inicio?: string | null;
};

// Dados para encerramento de viagem
export type FecharViagemInput = {
  hodometro_final: number;
  data_fim?: string | null;
};

// Filtro de listagem
export type FiltroViagens = {
  status?: StatusViagem | 'Todos';
  veiculo_id?: string;
  motorista_id?: string;
  limite?: number;
};

// Identificação do campo com erro para feedback no formulário
export type CampoErroViagem =
  | 'veiculo_id'
  | 'rota_id'
  | 'motorista_id'
  | 'hodometro_inicial'
  | 'hodometro_final'
  | 'status';

export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; mensagem: string; campo?: CampoErroViagem; codigo?: string };

// Interface que define o contrato do repositório de viagens.
// Mantém paridade com as colunas do banco. Desde a EIX-41 a implementação lê e grava no SQLite
// do aparelho; a tela não muda, só a fonte.
export interface ViagensRepository {
  listarViagens(filtro?: FiltroViagens): Promise<Resultado<ViagemDetalhada[]>>;
  buscarViagemPorId(id: string): Promise<Resultado<ViagemDetalhada>>;
  buscarUltimoHodometro(veiculo_id: string): Promise<Resultado<number | null>>;
  listarVeiculosDisponiveis(): Promise<Resultado<VeiculoSelecionavel[]>>;
  buscarVeiculo(id: string): Promise<Resultado<VeiculoSelecionavel>>;
  listarRotasAtivas(): Promise<Resultado<RotaResumo[]>>;
  listarMotoristasAtivos(): Promise<Resultado<MotoristaResumo[]>>;
  abrirViagem(dados: NovaViagemInput): Promise<Resultado<Viagem>>;
  fecharViagem(id: string, dados: FecharViagemInput): Promise<Resultado<Viagem>>;
}
