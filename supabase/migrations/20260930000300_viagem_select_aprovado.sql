-- EIX-30 (US16): o ramo "motorista lê as próprias viagens" da viagem_select (EIX-27) não
-- passava por auth_perfil(), então um Motorista pendente ou bloqueado ainda lia as viagens
-- dele. Recria a policy com o mesmo corte que viagem_insert/viagem_update já usam: só
-- Motorista aprovado (auth_perfil() só é não nulo para status Ativo).

drop policy viagem_select on viagem;
create policy viagem_select on viagem
  for select to authenticated
  using (
    auth_perfil() in ('Admin', 'Gestor de Frota')
    or (auth_perfil() = 'Motorista' and motorista_id = auth_usuario_id())
  );
