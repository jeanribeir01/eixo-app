-- EIX-41: fila de revisão de viagens que o servidor recusou. O motorista pode criar a revisão
-- (o conflito nasceu de uma operação dele), mas só Admin e Gestor de Frota leem a fila inteira e
-- decidem. A linha guarda o payload local para que o dado não se perca enquanto o gestor decide.

create type status_revisao as enum ('Pendente', 'Resolvida', 'Descartada');

create table viagem_revisao (
  -- Mesmo id da outbox do cliente: reenviar a revisão após uma queda faz upsert, não duplica.
  id uuid primary key,
  viagem_id uuid not null,
  solicitante_id uuid not null references usuario (id) on delete restrict,
  -- Sem FK: o id vem do payload local e a revisão existe justamente quando o servidor recusou a
  -- viagem. Uma FK aqui poderia impedir o registro do conflito.
  motorista_id uuid,
  motorista_nome text,
  veiculo_id uuid,
  veiculo_placa text,
  rota_id uuid,
  rota_trecho text,
  codigo text not null,
  mensagem text not null,
  payload jsonb not null default '{}'::jsonb,
  status status_revisao not null default 'Pendente',
  observacao text,
  resolvido_por uuid references usuario (id) on delete set null,
  resolvido_em timestamptz,
  data_inclusao timestamptz not null default now(),
  data_atualizacao timestamptz not null default now(),
  constraint viagem_revisao_payload_objeto check (jsonb_typeof(payload) = 'object')
);

create index viagem_revisao_status_idx on viagem_revisao (status, data_inclusao desc);

create trigger viagem_revisao_set_data_atualizacao
  before update on viagem_revisao
  for each row execute function set_data_atualizacao();

-- Quem resolveu e quando são preenchidos pelo banco, não pelo cliente: o app não pode forjar a
-- autoria da decisão.
create function viagem_revisao_marca_resolucao()
returns trigger
language plpgsql
as $$
begin
  -- A revisão nasce sempre pendente: quem abre o conflito não decide o conflito.
  if tg_op = 'INSERT' and new.status <> 'Pendente' then
    raise exception 'Revisão de viagem deve ser criada como Pendente.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and (
    new.viagem_id <> old.viagem_id
    or new.solicitante_id <> old.solicitante_id
    or new.codigo <> old.codigo
    or new.payload <> old.payload
  ) then
    raise exception 'Os dados de origem da revisão não podem ser alterados.'
      using errcode = '23514';
  end if;

  if new.status <> 'Pendente' then
    -- Autoria e data vêm da sessão, nunca do payload do cliente.
    new.resolvido_por = auth_usuario_id();
    new.resolvido_em = now();
  else
    new.resolvido_por = null;
    new.resolvido_em = null;
  end if;
  return new;
end;
$$;

create trigger viagem_revisao_marca_resolucao
  before insert or update on viagem_revisao
  for each row execute function viagem_revisao_marca_resolucao();

alter table viagem_revisao enable row level security;

-- O solicitante acompanha a própria revisão; Admin e Gestor veem a fila inteira.
create policy viagem_revisao_select on viagem_revisao
  for select to authenticated
  using (
    solicitante_id = auth_usuario_id()
    or auth_perfil() in ('Admin', 'Gestor de Frota')
  );

-- Só quem tem rotina de viagem cria a revisão, e sempre em nome próprio.
create policy viagem_revisao_insert on viagem_revisao
  for insert to authenticated
  with check (
    solicitante_id = auth_usuario_id()
    and auth_perfil() in ('Admin', 'Gestor de Frota', 'Motorista')
  );

-- Decisão é exclusiva de Admin/Gestor. Sem policy de delete: a trilha não é apagada.
create policy viagem_revisao_update on viagem_revisao
  for update to authenticated
  using (auth_perfil() in ('Admin', 'Gestor de Frota'))
  with check (auth_perfil() in ('Admin', 'Gestor de Frota'));
