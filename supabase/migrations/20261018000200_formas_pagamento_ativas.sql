-- EIX-39 (US06-b): o formulário de manutenção exige uma forma de pagamento ativa, e a RPC
-- `registrar_manutencao` (20261014000300_manutencao_rpc.sql) recusa forma inativa com 22023.
-- Quem mais registra manutenção é o Gestor de Frota, mas a policy `forma_pagamento_select`
-- (20260924000500_rls.sql) só libera a leitura para Admin e Financeiro.
--
-- Em vez de abrir a tabela para o Gestor, esta função devolve só o que o seletor precisa: id e
-- nome das formas ativas. A policy da tabela não muda (decisão da spec da EIX-39, opção b).
--
-- Erro que a função lança e o repositório traduz para português:
--   42501  perfil sem permissão (só Admin, Financeiro e Gestor de Frota aprovados)

create or replace function listar_formas_pagamento_ativas()
returns table (id uuid, nome text)
language plpgsql
stable
-- Definer: o Gestor de Frota não tem policy de select em forma_pagamento. A checagem de perfil
-- abaixo faz o papel da policy, e a função só expõe as duas colunas.
security definer
set search_path = public
as $$
begin
  -- Motorista não vê nada financeiro (CLAUDE.md §7). auth_perfil() é nulo para quem não está
  -- aprovado ou está bloqueado, e o coalesce trata o nulo como "sem permissão".
  if not coalesce(auth_perfil() in ('Admin', 'Financeiro', 'Gestor de Frota'), false) then
    raise exception 'Sem permissão para listar formas de pagamento.' using errcode = '42501';
  end if;

  -- `f.` em todas as colunas: id e nome também são os nomes das colunas de retorno, e sem o
  -- alias o plpgsql não saberia a qual dos dois a consulta se refere.
  return query
    select f.id, f.nome
    from forma_pagamento f
    where f.ativa
    order by f.nome;
end;
$$;

-- Função nova nasce executável por PUBLIC, e o Supabase ainda concede a anon: fecha os dois.
revoke execute on function listar_formas_pagamento_ativas() from public, anon;
grant execute on function listar_formas_pagamento_ativas() to authenticated;
