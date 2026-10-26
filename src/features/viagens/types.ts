import type { PerfilNome, StatusUsuario } from '@/features/auth/permissions';
import type { Enums, Tables } from '@/types/database';

export type StatusViagem = Enums<'status_viagem'>;
export type StatusVeiculo = Enums<'status_veiculo'>;
export type Uf = Enums<'uf'>;

// Linha exata da tabela `viagem` no banco (snake_case, paridade 1:1 com schema e tipos gerados).
export type Viagem = Tables<'viagem'>;

// Linha local: além das colunas do Postgres, o SQLite guarda `em_revisao` (estado só do aparelho).
export type ViagemLocal = Viagem & { em_revisao: boolean };

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
export type ViagemDetalhada = ViagemLocal & {
  veiculo?: VeiculoResumo | null;
  rota?: RotaResumo | null;
  motorista?: MotoristaResumo | null;
};

// Opções lidas do cache local para abrir uma viagem offline.
export type VeiculoSelecionavel = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  capacidade_carga: number;
  status: StatusVeiculo;
  ano_fabricacao: number | null;
};

export type RotaSelecionavel = {
  id: string;
  cidade_origem: string;
  uf_origem: Uf;
  cidade_destino: string;
  uf_destino: Uf;
  distancia_estimada_km: number;
};

export type MotoristaSelecionavel = {
  id: string;
  nome: string;
  email: string | null;
};

export type MotoristaCache = MotoristaSelecionavel & {
  perfil: PerfilNome;
  status: StatusUsuario;
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

// Dados para correção do hodômetro final (Admin / Gestor)
export type CorrigirHodometroFinalInput = {
  hodometro_final: number;
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
  | {
      ok: false;
      mensagem: string;
      campo?: CampoErroViagem;
      codigo?: string;
      // A troca de conta no meio do sync não é erro para o usuário: o resultado atrasado deve ser
      // descartado sem aparecer como falha na conta nova.
      sessaoAlterada?: boolean;
    };

// Item da fila de revisão do gestor. O payload é o mesmo JSON da outbox: é ele que preserva a
// operação local recusada pelo servidor, para o gestor decidir o que fazer.
export type RevisaoViagem = {
  id: string;
  viagem_id: string;
  solicitante_id: string;
  motorista_id: string | null;
  motorista_nome: string | null;
  veiculo_id: string | null;
  veiculo_placa: string | null;
  rota_id: string | null;
  rota_trecho: string | null;
  codigo: string;
  mensagem: string;
  payload: Record<string, unknown>;
  status: Enums<'status_revisao'>;
  observacao: string | null;
  resolvido_por: string | null;
  resolvido_em: string | null;
  data_inclusao: string;
  data_atualizacao: string;
};

// Interface que define o contrato do repositório de viagens.
// Mantém paridade com as colunas do banco e prepara a migração offline (EIX-41).
export interface ViagensRepository {
  listarViagens(filtro?: FiltroViagens): Promise<Resultado<ViagemDetalhada[]>>;
  buscarViagemPorId(id: string): Promise<Resultado<ViagemDetalhada>>;
  buscarUltimoHodometro(veiculo_id: string): Promise<Resultado<number | null>>;
  buscarViagemEmAndamento(veiculo_id: string): Promise<Resultado<ViagemLocal | null>>;
  abrirViagem(dados: NovaViagemInput): Promise<Resultado<ViagemLocal>>;
  fecharViagem(id: string, dados: FecharViagemInput): Promise<Resultado<ViagemLocal>>;
  cancelarViagem(id: string, options?: { hodometro_final?: number | null }): Promise<Resultado<ViagemLocal>>;
  corrigirHodometroFinal(id: string, dados: CorrigirHodometroFinalInput): Promise<Resultado<ViagemLocal>>;
}
