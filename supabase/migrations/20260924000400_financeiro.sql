-- EIX-27: divida e movimentacao — o núcleo financeiro do sistema. As FKs anuláveis
-- viagem_id e divida_id são a ponte entre os módulos (US09) e o vínculo com
-- parcelamentos (US04). Fecha o schema ligando manutencao.movimentacao_id.

create table divida (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references categoria (id),
  descricao text not null,
  quantidade_parcelas integer not null,
  valor_parcela numeric(12, 2) not null,
  data_vencimento_primeira date not null,
  data_inclusao timestamptz not null default now(),
  data_atualizacao timestamptz not null default now(),
  constraint divida_quantidade_parcelas_positiva check (quantidade_parcelas > 0),
  constraint divida_valor_parcela_nao_negativo check (valor_parcela >= 0)
);

create trigger divida_set_data_atualizacao
  before update on divida
  for each row execute function set_data_atualizacao();

create table movimentacao (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references categoria (id),
  forma_pagamento_id uuid not null references forma_pagamento (id),
  -- Nulo = despesa de escritório (viagem_id) ou lançamento avulso (divida_id).
  viagem_id uuid references viagem (id),
  divida_id uuid references divida (id),
  valor numeric(12, 2) not null,
  descricao text not null,
  data_vencimento date,
  data_pagamento date,
  status_pagamento status_pagamento not null default 'Pendente',
  data_inclusao timestamptz not null default now(),
  data_atualizacao timestamptz not null default now(),
  constraint movimentacao_valor_nao_negativo check (valor >= 0),
  -- Pago sem data_pagamento é rejeitado; Pendente com data_pagamento preenchida
  -- (pagamento agendado) é aceito.
  constraint movimentacao_pago_tem_data_pagamento check (status_pagamento <> 'Pago' or data_pagamento is not null)
);

create trigger movimentacao_set_data_atualizacao
  before update on movimentacao
  for each row execute function set_data_atualizacao();

alter table manutencao
  add constraint manutencao_movimentacao_id_fkey foreign key (movimentacao_id) references movimentacao (id);
