-- EIX-27: categoria e forma_pagamento, com os registros padrão que US01/US02/US03
-- precisam para lançar movimentações sem configurar nada.

create table categoria (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo tipo_categoria not null,
  ativa boolean not null default true,
  data_inclusao timestamptz not null default now(),
  data_atualizacao timestamptz not null default now(),
  unique (titulo, tipo)
);

create trigger categoria_set_data_atualizacao
  before update on categoria
  for each row execute function set_data_atualizacao();

create table forma_pagamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativa boolean not null default true,
  data_inclusao timestamptz not null default now(),
  data_atualizacao timestamptz not null default now()
);

create trigger forma_pagamento_set_data_atualizacao
  before update on forma_pagamento
  for each row execute function set_data_atualizacao();

-- Idempotente: reaplicar a migration não duplica os registros.
insert into categoria (titulo, tipo) values
  ('Combustível', 'Saida'),
  ('Pedágio', 'Saida'),
  ('Manutenção', 'Saida'),
  ('Salário', 'Saida'),
  ('Financiamento', 'Saida'),
  ('Frete', 'Entrada')
on conflict (titulo, tipo) do nothing;

insert into forma_pagamento (nome) values
  ('Boleto'),
  ('Pix'),
  ('TED'),
  ('Cartão Corporativo')
on conflict (nome) do nothing;
