-- Stub mínimo do ambiente Supabase, só para os testes com PGlite.
-- Nunca é aplicado na nuvem: recria roles, auth.users, auth.uid() e storage.* o
-- suficiente para exercitar as migrations reais de supabase/migrations/.

create role anon nologin;
create role authenticated nologin;

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Supabase real lê o `sub` do JWT decodificado; aqui simulamos com uma GUC de
-- sessão/transação que os testes trocam via `set local`.
create function auth.uid() returns uuid
  language sql stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

create schema if not exists storage;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid
);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;

-- O Supabase real concede acesso amplo às roles anon/authenticated nas tabelas de
-- public e deixa o RLS decidir o que cada uma enxerga; replicamos isso aqui.
grant usage on schema public to anon, authenticated;
grant usage on schema storage to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant all on storage.buckets, storage.objects to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema storage grant all on tables to anon, authenticated;
