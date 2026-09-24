-- EIX-27: bucket privado `comprovantes` (US03) e policies em storage.objects.
-- Só Admin e Financeiro acessam — Motorista e Gestor de Frota não têm área
-- financeira.

insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

create policy comprovantes_select on storage.objects
  for select to authenticated
  using (bucket_id = 'comprovantes' and auth_perfil() in ('Admin', 'Financeiro'));

create policy comprovantes_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'comprovantes' and auth_perfil() in ('Admin', 'Financeiro'));

create policy comprovantes_update on storage.objects
  for update to authenticated
  using (bucket_id = 'comprovantes' and auth_perfil() in ('Admin', 'Financeiro'))
  with check (bucket_id = 'comprovantes' and auth_perfil() in ('Admin', 'Financeiro'));

create policy comprovantes_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'comprovantes' and auth_perfil() in ('Admin', 'Financeiro'));
