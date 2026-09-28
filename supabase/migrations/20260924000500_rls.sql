-- EIX-27: ativa RLS nas 10 tabelas do domínio e cria as policies por perfil da
-- tabela de acesso do design.md. Nenhuma policy para `anon` → não autenticado vê
-- zero linhas. Sem policy de delete = delete rejeitado (soft delete obrigatório em
-- categoria, forma_pagamento, usuario e perfil).

alter table perfil enable row level security;
alter table usuario enable row level security;
alter table categoria enable row level security;
alter table forma_pagamento enable row level security;
alter table divida enable row level security;
alter table movimentacao enable row level security;
alter table veiculo enable row level security;
alter table rota enable row level security;
alter table viagem enable row level security;
alter table manutencao enable row level security;

-- perfil: leitura para qualquer autenticado; escrita só Admin (US16); sem delete.
create policy perfil_select on perfil
  for select to authenticated
  using (true);

create policy perfil_insert on perfil
  for insert to authenticated
  with check (auth_perfil() = 'Admin');

create policy perfil_update on perfil
  for update to authenticated
  using (auth_perfil() = 'Admin')
  with check (auth_perfil() = 'Admin');

-- usuario: cada um lê a própria linha; Admin e Gestor de Frota leem todas (o
-- gestor precisa escolher motorista na viagem). Escrita só Admin. Sem delete.
create policy usuario_select on usuario
  for select to authenticated
  using (id = auth_usuario_id() or auth_perfil() in ('Admin', 'Gestor de Frota'));

create policy usuario_insert on usuario
  for insert to authenticated
  with check (auth_perfil() = 'Admin');

create policy usuario_update on usuario
  for update to authenticated
  using (auth_perfil() = 'Admin')
  with check (auth_perfil() = 'Admin');

-- categoria, forma_pagamento: leitura e escrita para Admin e Financeiro. Sem
-- delete (soft delete via `ativa`).
create policy categoria_select on categoria
  for select to authenticated
  using (auth_perfil() in ('Admin', 'Financeiro'));

create policy categoria_insert on categoria
  for insert to authenticated
  with check (auth_perfil() in ('Admin', 'Financeiro'));

create policy categoria_update on categoria
  for update to authenticated
  using (auth_perfil() in ('Admin', 'Financeiro'))
  with check (auth_perfil() in ('Admin', 'Financeiro'));

create policy forma_pagamento_select on forma_pagamento
  for select to authenticated
  using (auth_perfil() in ('Admin', 'Financeiro'));

create policy forma_pagamento_insert on forma_pagamento
  for insert to authenticated
  with check (auth_perfil() in ('Admin', 'Financeiro'));

create policy forma_pagamento_update on forma_pagamento
  for update to authenticated
  using (auth_perfil() in ('Admin', 'Financeiro'))
  with check (auth_perfil() in ('Admin', 'Financeiro'));

-- divida, movimentacao: leitura e escrita (inclusive delete) para Admin e
-- Financeiro. Motorista não enxerga nada financeiro.
create policy divida_select on divida
  for select to authenticated
  using (auth_perfil() in ('Admin', 'Financeiro'));

create policy divida_insert on divida
  for insert to authenticated
  with check (auth_perfil() in ('Admin', 'Financeiro'));

create policy divida_update on divida
  for update to authenticated
  using (auth_perfil() in ('Admin', 'Financeiro'))
  with check (auth_perfil() in ('Admin', 'Financeiro'));

create policy divida_delete on divida
  for delete to authenticated
  using (auth_perfil() in ('Admin', 'Financeiro'));

create policy movimentacao_select on movimentacao
  for select to authenticated
  using (auth_perfil() in ('Admin', 'Financeiro'));

create policy movimentacao_insert on movimentacao
  for insert to authenticated
  with check (auth_perfil() in ('Admin', 'Financeiro'));

create policy movimentacao_update on movimentacao
  for update to authenticated
  using (auth_perfil() in ('Admin', 'Financeiro'))
  with check (auth_perfil() in ('Admin', 'Financeiro'));

create policy movimentacao_delete on movimentacao
  for delete to authenticated
  using (auth_perfil() in ('Admin', 'Financeiro'));

-- veiculo, rota: leitura para qualquer autenticado; escrita (inclusive delete)
-- para Admin e Gestor de Frota.
create policy veiculo_select on veiculo
  for select to authenticated
  using (true);

create policy veiculo_insert on veiculo
  for insert to authenticated
  with check (auth_perfil() in ('Admin', 'Gestor de Frota'));

create policy veiculo_update on veiculo
  for update to authenticated
  using (auth_perfil() in ('Admin', 'Gestor de Frota'))
  with check (auth_perfil() in ('Admin', 'Gestor de Frota'));

create policy veiculo_delete on veiculo
  for delete to authenticated
  using (auth_perfil() in ('Admin', 'Gestor de Frota'));

create policy rota_select on rota
  for select to authenticated
  using (true);

create policy rota_insert on rota
  for insert to authenticated
  with check (auth_perfil() in ('Admin', 'Gestor de Frota'));

create policy rota_update on rota
  for update to authenticated
  using (auth_perfil() in ('Admin', 'Gestor de Frota'))
  with check (auth_perfil() in ('Admin', 'Gestor de Frota'));

create policy rota_delete on rota
  for delete to authenticated
  using (auth_perfil() in ('Admin', 'Gestor de Frota'));

-- manutencao: leitura e escrita (inclusive delete) para Admin e Gestor de Frota.
create policy manutencao_select on manutencao
  for select to authenticated
  using (auth_perfil() in ('Admin', 'Gestor de Frota'));

create policy manutencao_insert on manutencao
  for insert to authenticated
  with check (auth_perfil() in ('Admin', 'Gestor de Frota'));

create policy manutencao_update on manutencao
  for update to authenticated
  using (auth_perfil() in ('Admin', 'Gestor de Frota'))
  with check (auth_perfil() in ('Admin', 'Gestor de Frota'));

create policy manutencao_delete on manutencao
  for delete to authenticated
  using (auth_perfil() in ('Admin', 'Gestor de Frota'));

-- viagem: Admin e Gestor de Frota enxergam e gravam tudo; Motorista só as
-- próprias viagens (leitura e escrita, sem delete).
create policy viagem_select on viagem
  for select to authenticated
  using (auth_perfil() in ('Admin', 'Gestor de Frota') or motorista_id = auth_usuario_id());

create policy viagem_insert on viagem
  for insert to authenticated
  with check (
    auth_perfil() in ('Admin', 'Gestor de Frota')
    or (auth_perfil() = 'Motorista' and motorista_id = auth_usuario_id())
  );

create policy viagem_update on viagem
  for update to authenticated
  using (
    auth_perfil() in ('Admin', 'Gestor de Frota')
    or (auth_perfil() = 'Motorista' and motorista_id = auth_usuario_id())
  )
  with check (
    auth_perfil() in ('Admin', 'Gestor de Frota')
    or (auth_perfil() = 'Motorista' and motorista_id = auth_usuario_id())
  );

create policy viagem_delete on viagem
  for delete to authenticated
  using (auth_perfil() in ('Admin', 'Gestor de Frota'));
