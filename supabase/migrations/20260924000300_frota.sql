-- EIX-27: veiculo, rota, viagem e manutencao, com a validação de hodômetro e a
-- normalização de placa que a spec exige (US06, US07, US08, US06-b).

create table veiculo (
  id uuid primary key default gen_random_uuid(),
  placa text not null,
  marca text not null,
  modelo text not null,
  capacidade_carga numeric(10, 2) not null,
  status status_veiculo not null default 'Disponivel',
  data_inclusao timestamptz not null default now(),
  data_atualizacao timestamptz not null default now(),
  -- O banco rejeita placa em formato errado (minúscula ou com espaço); o cliente
  -- normaliza antes de enviar. "placa repetida" e "placa mal formatada" viram
  -- erros diferentes, e ninguém grava duas versões da mesma placa.
  constraint veiculo_placa_normalizada check (placa = upper(replace(placa, ' ', ''))),
  constraint veiculo_placa_unique unique (placa)
);

create trigger veiculo_set_data_atualizacao
  before update on veiculo
  for each row execute function set_data_atualizacao();

create table rota (
  id uuid primary key default gen_random_uuid(),
  cidade_origem text not null,
  cidade_destino text not null,
  distancia_estimada_km numeric(10, 2) not null,
  data_inclusao timestamptz not null default now(),
  data_atualizacao timestamptz not null default now(),
  constraint rota_distancia_positiva check (distancia_estimada_km > 0)
);

create trigger rota_set_data_atualizacao
  before update on rota
  for each row execute function set_data_atualizacao();

create table viagem (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references veiculo (id),
  rota_id uuid not null references rota (id),
  motorista_id uuid not null references usuario (id),
  hodometro_inicial numeric(12, 1) not null,
  hodometro_final numeric(12, 1),
  data_inicio timestamptz,
  data_fim timestamptz,
  status status_viagem not null default 'EmAndamento',
  data_inclusao timestamptz not null default now(),
  data_atualizacao timestamptz not null default now(),
  constraint viagem_hodometro_inicial_nao_negativo check (hodometro_inicial >= 0),
  -- Viagem aberta (hodômetro final nulo) é aceita; se preenchido, tem que ser maior
  -- que o inicial.
  constraint viagem_hodometro_final_maior check (hodometro_final is null or hodometro_final > hodometro_inicial),
  -- Nenhuma viagem fecha (status Finalizada) sem hodômetro final.
  constraint viagem_finalizada_tem_hodometro_final check (status <> 'Finalizada' or hodometro_final is not null)
);

create trigger viagem_set_data_atualizacao
  before update on viagem
  for each row execute function set_data_atualizacao();

create table manutencao (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references veiculo (id),
  descricao text not null,
  data_manutencao date not null,
  valor numeric(12, 2) not null,
  hodometro numeric(12, 1),
  -- FK para movimentacao entra na migration financeira (movimentacao ainda não
  -- existe aqui); a US06-b liga a despesa gerada automaticamente depois.
  movimentacao_id uuid,
  data_inclusao timestamptz not null default now(),
  data_atualizacao timestamptz not null default now(),
  constraint manutencao_valor_nao_negativo check (valor >= 0)
);

create trigger manutencao_set_data_atualizacao
  before update on manutencao
  for each row execute function set_data_atualizacao();
