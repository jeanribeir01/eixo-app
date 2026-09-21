// A tabela `veiculo` ainda não existe no Postgres (chega pela EIX-27). Enquanto isso, este é o
// tipo de domínio usado pelo repositório mock; quando os tipos gerados existirem, este arquivo
// deve ser substituído pelo tipo de `src/supabase/types.ts`.
export type StatusVeiculo = 'Disponivel' | 'EmViagem' | 'EmManutencao' | 'Inativo';

export type Veiculo = {
  id: string;
  placa: string; // sempre normalizada: maiúscula, sem hífen
  marca: string;
  modelo: string;
  anoFabricacao: number;
  capacidadeCarga: number; // toneladas
  status: StatusVeiculo;
  createdAt: string;
  updatedAt: string;
};

// Campos que vêm do formulário/schema. O id não está aqui: por convenção do projeto (UUID v7
// gerado no cliente), quem cria o veículo (a tela, numa etapa futura) fornece o id ao repositório.
export type NovoVeiculoInput = {
  placa: string;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  capacidadeCarga: number;
};

export type AtualizarVeiculoInput = NovoVeiculoInput;

export type FiltroVeiculos = {
  busca?: string; // compara com placa (normalizada) e modelo, sem diferenciar maiúsculas/minúsculas
  status?: StatusVeiculo;
};
