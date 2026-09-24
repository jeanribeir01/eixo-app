-- EIX-27: enums do domínio, função de timestamp, perfil, usuario e as funções que
-- ligam auth.users ao perfil do domínio (auth_perfil, auth_usuario_id, handle_new_user).

create type perfil_nome as enum ('Admin', 'Gestor de Frota', 'Financeiro', 'Motorista');
create type tipo_categoria as enum ('Entrada', 'Saida');
create type status_veiculo as enum ('Disponivel', 'EmViagem', 'EmManutencao');
create type status_viagem as enum ('EmAndamento', 'Finalizada', 'Cancelada');
create type status_pagamento as enum ('Pendente', 'Pago');

-- Uma trigger por tabela usa esta função para gravar `now()` em data_atualizacao a
-- cada update, sem repetir a lógica em cada migration.
create function set_data_atualizacao()
returns trigger
language plpgsql
as $$
begin
  new.data_atualizacao = now();
  return new;
end;
$$;

create table perfil (
  id uuid primary key default gen_random_uuid(),
  nome perfil_nome not null unique,
  data_inclusao timestamptz not null default now(),
  data_atualizacao timestamptz not null default now()
);

create trigger perfil_set_data_atualizacao
  before update on perfil
  for each row execute function set_data_atualizacao();

-- Idempotente: reaplicar a migration não duplica os 4 perfis.
insert into perfil (nome) values
  ('Admin'),
  ('Gestor de Frota'),
  ('Financeiro'),
  ('Motorista')
on conflict (nome) do nothing;

-- usuario.id é a própria auth.users.id (não gen_random_uuid()): o vínculo é 1:1 com a
-- conta do Supabase Auth, criado pelo handle_new_user abaixo.
create table usuario (
  id uuid primary key references auth.users (id) on delete restrict,
  perfil_id uuid not null references perfil (id),
  nome text not null,
  email text not null unique,
  google_subject_id text,
  ativo boolean not null default true,
  data_inclusao timestamptz not null default now(),
  data_atualizacao timestamptz not null default now()
);

create trigger usuario_set_data_atualizacao
  before update on usuario
  for each row execute function set_data_atualizacao();

-- Existe para as policies lerem o id do usuário logado com um nome que segue o
-- vocabulário do domínio (CLAUDE.md), em vez de auth.uid() espalhado pelas policies.
create function auth_usuario_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

-- security definer + search_path vazio: evita que a consulta caia na RLS de
-- `usuario` (recursão) e que alguém troque o search_path para ler outra tabela.
create function auth_perfil()
returns perfil_nome
language sql
stable
security definer
set search_path = ''
as $$
  select p.nome
  from public.usuario u
  join public.perfil p on p.id = u.perfil_id
  where u.id = auth.uid() and u.ativo;
$$;

-- Primeiro login cria a linha em usuario com o perfil de menor privilégio
-- (Motorista); promoção só por Admin (US16). nome vem do full_name do Google, com
-- e-mail como fallback quando o provider não manda nome.
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuario (id, perfil_id, nome, email, google_subject_id)
  values (
    new.id,
    (select id from public.perfil where nome = 'Motorista'),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    new.raw_user_meta_data ->> 'sub'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
