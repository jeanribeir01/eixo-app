-- EIX-30 (US16): status de aprovação do usuário. Conta nova nasce sem acesso a módulo
-- algum até um Admin aprovar, e o Admin não consegue rebaixar nem bloquear a si mesmo.
-- Migrations já aplicadas (EIX-27) não são editadas: as funções e a policy que mudam
-- são recriadas aqui.

-- Sem acento/espaço, no mesmo padrão dos outros enums (EmViagem, Saida); o rótulo com
-- acento existe só na UI.
create type status_usuario as enum ('AguardandoAprovacao', 'Aprovado', 'Bloqueado');

-- O default vale para as linhas que já existem: ninguém ganha acesso sem um Admin
-- aprovar. O primeiro Admin é promovido por SQL no painel (ver README/PR).
alter table usuario
  add column status status_usuario not null default 'AguardandoAprovacao';

-- Contas criadas antes do trigger handle_new_user (login da US15, anterior à EIX-27)
-- não têm linha em usuario e por isso nem apareceriam na tela de aprovação.
insert into usuario (id, perfil_id, nome, email, google_subject_id)
select
  u.id,
  (select id from perfil where nome = 'Motorista'),
  coalesce(u.raw_user_meta_data ->> 'full_name', u.email),
  u.email,
  u.raw_user_meta_data ->> 'sub'
from auth.users u
where not exists (select 1 from usuario where usuario.id = u.id);

-- Todas as policies decidem pelo perfil devolvido aqui. Exigir status 'Aprovado'
-- faz qualquer conta pendente ou bloqueada valer como "sem perfil" em todo o banco,
-- sem precisar mexer em cada policy.
create or replace function auth_perfil()
returns perfil_nome
language sql
stable
security definer
set search_path = ''
as $$
  select p.nome
  from public.usuario u
  join public.perfil p on p.id = u.perfil_id
  where u.id = auth.uid() and u.ativo and u.status = 'Aprovado';
$$;

-- Igual à versão da EIX-27, agora gravando o status de forma explícita (não depende
-- do default da coluna para a regra mais importante da US16).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuario (id, perfil_id, nome, email, google_subject_id, status)
  values (
    new.id,
    (select id from public.perfil where nome = 'Motorista'),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    new.raw_user_meta_data ->> 'sub',
    'AguardandoAprovacao'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- A policy da EIX-27 deixava o motorista ler as próprias viagens só pelo
-- motorista_id, sem olhar o perfil — um usuário bloqueado continuaria lendo. Agora
-- exige perfil Motorista (portanto aprovado), como já faziam insert e update.
drop policy viagem_select on viagem;

create policy viagem_select on viagem
  for select to authenticated
  using (
    auth_perfil() in ('Admin', 'Gestor de Frota')
    or (auth_perfil() = 'Motorista' and motorista_id = auth_usuario_id())
  );

-- Regra crítica validada no banco, não só na tela (AGENTS.md §2.4): ninguém altera o
-- próprio perfil, status ou soft delete. Isso impede o único Admin de se rebaixar ou
-- se bloquear e ficar sem ninguém para desfazer. Sem auth.uid() (SQL Editor do
-- painel, service_role) a alteração passa — é por lá que o primeiro Admin é criado.
create function impedir_auto_alteracao_usuario()
returns trigger
language plpgsql
as $$
begin
  if new.id = auth.uid()
     and (
       new.perfil_id is distinct from old.perfil_id
       or new.status is distinct from old.status
       or new.ativo is distinct from old.ativo
     ) then
    -- 42501 (insufficient_privilege): o app já traduz esse código como falta de permissão.
    raise exception 'Você não pode alterar o próprio perfil ou status.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger usuario_impedir_auto_alteracao
  before update on usuario
  for each row execute function impedir_auto_alteracao_usuario();
