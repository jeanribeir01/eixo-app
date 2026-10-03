-- EIX-30 (US16): ninguém altera o próprio perfil ou status. Como só Admin grava em
-- `usuario` (RLS), isso significa que o Admin que está agindo nunca se rebaixa nem se
-- bloqueia — e portanto sempre sobra pelo menos um Admin ativo.
--
-- A regra mora no banco, não só na tela (AGENTS.md §2.4): a UI esconde os botões na linha
-- do próprio Admin, mas uma chamada direta à API também precisa falhar.

create function impede_autoalteracao_usuario()
returns trigger
language plpgsql
as $$
begin
  -- auth.uid() nulo = SQL Editor / service_role. Fica liberado para o bootstrap do
  -- primeiro Admin (ver design.md da US16).
  if auth.uid() is not null
     and old.id = auth.uid()
     and (new.perfil_id is distinct from old.perfil_id or new.status is distinct from old.status)
  then
    -- P0001 é o código que o app traduz para "Você não pode alterar o próprio perfil ou status."
    raise exception 'Você não pode alterar o próprio perfil ou status.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;
create trigger usuario_impede_autoalteracao
  before update on usuario
  for each row execute function impede_autoalteracao_usuario();
