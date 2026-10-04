-- EIX-30 (US16): usuário novo nasce aguardando aprovação e não acessa nenhum módulo até
-- um Admin aprovar. `status` substitui a coluna booleana `ativo` (Bloqueado = soft delete).

create type status_usuario as enum ('AguardandoAprovacao', 'Ativo', 'Bloqueado');
-- O default cobre o handle_new_user da EIX-27 sem precisar reescrevê-lo: todo login novo
-- entra como AguardandoAprovacao.
alter table usuario
  add column status status_usuario not null default 'AguardandoAprovacao';
-- Quem já usava o app continua com acesso; quem estava desativado vira Bloqueado.
update usuario
set status = case when ativo then 'Ativo'::status_usuario else 'Bloqueado'::status_usuario end;
-- Todas as policies passam por auth_perfil(). Devolver nulo para quem não está Ativo
-- bloqueia pendente e bloqueado em todas as tabelas sem mexer em nenhuma policy.
-- A policy usuario_select não depende dela para a própria linha (id = auth_usuario_id()),
-- então o app ainda consegue ler o status e mostrar "aguardando liberação".
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
  where u.id = auth.uid() and u.status = 'Ativo';
$$;
-- Removida só depois de auth_perfil() deixar de usá-la.
alter table usuario drop column ativo;
-- veiculo e rota eram legíveis por qualquer autenticado (`using (true)`), o que deixaria o
-- usuário pendente ver a frota. "Qualquer autenticado" passa a ser "qualquer aprovado":
-- auth_perfil() só é não nulo para status Ativo. `perfil` continua aberto (só os 4 nomes),
-- porque o app lê o próprio perfil junto com a linha de usuario.
drop policy veiculo_select on veiculo;
create policy veiculo_select on veiculo
  for select to authenticated
  using (auth_perfil() is not null);
drop policy rota_select on rota;
create policy rota_select on rota
  for select to authenticated
  using (auth_perfil() is not null);
