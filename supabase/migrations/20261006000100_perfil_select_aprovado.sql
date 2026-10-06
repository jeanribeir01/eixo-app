-- EIX-32 (US18): usuário pendente ou bloqueado não lê nada além do próprio registro. A
-- perfil_select da EIX-27 era `using (true)`, então ele ainda via os 4 perfis. Agora quem não
-- está Ativo (auth_perfil() nulo) lê só a linha do próprio perfil — o suficiente para o join
-- usuario → perfil do profileStore, que mostra a tela "aguardando liberação".
--
-- A subconsulta em `usuario` passa pela usuario_select, que libera a própria linha
-- (id = auth_usuario_id()) sem depender de auth_perfil(): não há recursão.

drop policy perfil_select on perfil;
create policy perfil_select on perfil
  for select to authenticated
  using (
    auth_perfil() is not null
    or id = (select u.perfil_id from usuario u where u.id = auth_usuario_id())
  );
