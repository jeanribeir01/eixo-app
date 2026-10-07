-- EIX-36 (US04): dívidas e parcelamentos. Uma dívida nasce sempre junto com as N parcelas
-- (movimentações Pendente), e as duas coisas acontecem numa única chamada de RPC: o PostgREST
-- roda cada RPC numa transação, então um erro em qualquer parcela desfaz tudo (rollback).
--
-- Por que RPC em plpgsql e não Edge Function (CLAUDE.md §3): ver AD-008 em .specs/STATE.md.
--
-- Antes do `db push`, confira na nuvem que as dívidas existentes cabem nas regras novas:
--   select count(*) from divida where valor_parcela <= 0 or quantidade_parcelas > 120; (deve ser 0)

-- Soft delete (US04: excluir preserva as parcelas pagas, que continuam apontando para a dívida
-- pela FK divida_id — por isso a linha não pode sumir).
alter table divida add column ativa boolean not null default true;
-- Só guardado e exibido; nenhuma regra usa esse valor ainda.
alter table divida add column valor_quitacao_antecipada numeric(12, 2);

-- 120 parcelas = 10 anos. O teto impede uma chamada de pedir milhões de linhas.
alter table divida drop constraint divida_quantidade_parcelas_positiva;
alter table divida add constraint divida_quantidade_parcelas_faixa check (quantidade_parcelas between 1 and 120);

-- Parcela de valor zero não é dívida (mesma regra da movimentacao na EIX-33).
alter table divida drop constraint divida_valor_parcela_nao_negativo;
alter table divida add constraint divida_valor_parcela_positivo check (valor_parcela > 0);

alter table divida add constraint divida_quitacao_ate_soma_total check (
  valor_quitacao_antecipada is null
  or (valor_quitacao_antecipada > 0 and valor_quitacao_antecipada <= quantidade_parcelas * valor_parcela)
);

-- Dívida só é escrita pelas RPCs abaixo: insert direto criaria dívida sem parcelas; update
-- direto descasaria quantidade/valor das parcelas já geradas; delete físico apagaria o vínculo
-- das parcelas pagas. A leitura (divida_select) continua para Admin e Financeiro.
drop policy divida_insert on divida;
drop policy divida_update on divida;
drop policy divida_delete on divida;

create or replace function criar_divida(
  descricao text,
  categoria_id uuid,
  forma_pagamento_id uuid,
  quantidade_parcelas integer,
  valor_parcela numeric,
  data_vencimento_primeira date,
  valor_quitacao_antecipada numeric default null
)
returns uuid
language plpgsql
-- Definer: sem policy de insert em divida, só esta função grava. A checagem de perfil abaixo
-- faz o papel da policy.
security definer
set search_path = public
as $$
declare
  nova_divida_id uuid;
begin
  if not coalesce(auth_perfil() in ('Admin', 'Financeiro'), false) then
    raise exception 'Sem permissão para registrar dívidas.' using errcode = '42501';
  end if;

  -- Os parâmetros têm o mesmo nome das colunas; `criar_divida.x` deixa claro que é o parâmetro.
  if not exists (
    select 1 from categoria c
    where c.id = criar_divida.categoria_id and c.ativa and c.tipo = 'Saida'
  ) then
    raise exception 'Categoria inválida para dívida.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from forma_pagamento f
    where f.id = criar_divida.forma_pagamento_id and f.ativa
  ) then
    raise exception 'Forma de pagamento inválida.' using errcode = '22023';
  end if;

  -- As checks da tabela (parcelas 1–120, valor > 0, quitação ≤ soma) barram aqui, antes de
  -- qualquer parcela existir.
  insert into divida (
    categoria_id, descricao, quantidade_parcelas, valor_parcela,
    data_vencimento_primeira, valor_quitacao_antecipada
  ) values (
    criar_divida.categoria_id, criar_divida.descricao, criar_divida.quantidade_parcelas, criar_divida.valor_parcela,
    criar_divida.data_vencimento_primeira, criar_divida.valor_quitacao_antecipada
  )
  returning id into nova_divida_id;

  -- Parcela n vence na 1ª + n meses, sempre a partir da 1ª: o Postgres ajusta o dia
  -- inexistente para o último do mês (31/01 + 1 mês = 28/02) e a seguinte volta a 31/03.
  insert into movimentacao (
    categoria_id, forma_pagamento_id, divida_id, valor, descricao, data_vencimento, status_pagamento
  )
  select
    criar_divida.categoria_id,
    criar_divida.forma_pagamento_id,
    nova_divida_id,
    criar_divida.valor_parcela,
    criar_divida.descricao,
    (criar_divida.data_vencimento_primeira + make_interval(months => n))::date,
    'Pendente'
  from generate_series(0, criar_divida.quantidade_parcelas - 1) as n;

  return nova_divida_id;
end;
$$;

create or replace function excluir_divida(id uuid)
returns jsonb
language plpgsql
-- Definer: o RLS de movimentacao proíbe apagar parcela de dívida pela API (EIX-33); só esta
-- função pode, e só as pendentes.
security definer
set search_path = public
as $$
declare
  removidas integer;
  preservadas integer;
begin
  if not coalesce(auth_perfil() in ('Admin', 'Financeiro'), false) then
    raise exception 'Sem permissão para excluir dívidas.' using errcode = '42501';
  end if;

  -- `for update` trava a dívida: duas exclusões ao mesmo tempo não contam as mesmas parcelas.
  perform 1 from divida d where d.id = excluir_divida.id and d.ativa for update;
  if not found then
    raise exception 'Dívida não encontrada.' using errcode = 'P0002';
  end if;

  delete from movimentacao m
  where m.divida_id = excluir_divida.id and m.status_pagamento = 'Pendente';
  get diagnostics removidas = row_count;

  select count(*) into preservadas from movimentacao m where m.divida_id = excluir_divida.id;

  update divida d set ativa = false where d.id = excluir_divida.id;

  return jsonb_build_object('parcelasRemovidas', removidas, 'parcelasPreservadas', preservadas);
end;
$$;

-- Função nova nasce executável por PUBLIC, e o Supabase ainda concede a anon: fecha os dois.
revoke execute on function criar_divida(text, uuid, uuid, integer, numeric, date, numeric) from public, anon;
grant execute on function criar_divida(text, uuid, uuid, integer, numeric, date, numeric) to authenticated;
revoke execute on function excluir_divida(uuid) from public, anon;
grant execute on function excluir_divida(uuid) to authenticated;
