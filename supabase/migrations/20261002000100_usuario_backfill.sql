-- EIX-30 (US16): contas criadas antes do trigger handle_new_user (login da US15, anterior
-- à EIX-27) não têm linha em usuario e por isso nem apareceriam na tela de aprovação.
-- Entram como Motorista e AguardandoAprovacao (default da coluna status, migration
-- 20260930000100): um Admin decide o acesso pela tela de Usuários.
insert into usuario (id, perfil_id, nome, email, google_subject_id)
select
  u.id,
  (select id from perfil where nome = 'Motorista'),
  coalesce(u.raw_user_meta_data ->> 'full_name', u.email),
  u.email,
  u.raw_user_meta_data ->> 'sub'
from auth.users u
where not exists (select 1 from usuario where usuario.id = u.id);
