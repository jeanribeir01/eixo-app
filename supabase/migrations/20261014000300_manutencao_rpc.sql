-- EIX-75: o que a US06-b (EIX-39) pede de `manutencao`. Registrar uma manutenção grava três
-- coisas — a manutenção, a despesa em `movimentacao` e o status do veículo — e as três
-- acontecem numa única chamada de RPC, no molde de `criar_divida` (20261005000200_divida.sql,
-- AD-008): o PostgREST roda cada RPC numa transação, então se qualquer passo falha nada fica
-- gravado (rollback).
--
-- Antes do `db push`, confira na nuvem que as manutenções existentes cabem nas regras novas:
--   select count(*) from manutencao where valor <= 0 or data_manutencao > current_date; (deve ser 0)
-- Em 14/10/2026 a nuvem tinha 0 manutenções.
--
-- Erros que a RPC lança e o repositório traduz para português (o texto do banco nunca chega
-- ao usuário):
--   42501  perfil sem permissão (só Admin e Gestor de Frota)
--   P0002  veículo não encontrado; manutenção não encontrada ou já concluída
--   22023  forma de pagamento inativa ou inexistente
--   23514  valor zero ou negativo; data da manutenção no futuro
--   MN001  veículo em viagem
--   MN002  veículo inativo
--   MN003  categoria "Manutenção" (Saída) inexistente ou inativa
-- Os códigos MN*** são nossos: classe "MN" (manutenção) fica na faixa que o padrão SQL deixa
-- livre para a aplicação, e o PostgREST os repassa em `error.code` como qualquer outro.

-- Valor zero não é manutenção (mesma regra da movimentacao na EIX-33).
alter table manutencao drop constraint manutencao_valor_nao_negativo;
alter table manutencao add constraint manutencao_valor_positivo check (valor > 0);

-- Nulo = manutenção em aberto (veículo parado). Preenchida pela `concluir_manutencao`.
alter table manutencao add column data_conclusao timestamptz;

-- "Data não futura" depende do dia de hoje, então fica num trigger, como o ano máximo do
-- veículo (20261014000100_veiculo_ano_inativo.sql): uma check com `now()` só seria avaliada
-- na escrita e o Postgres a trata como imutável. O "hoje" é o de São Paulo (AD-007): às 22h
-- de Brasília já é o dia seguinte em UTC, e a manutenção de hoje não pode ser recusada.
create function valida_data_manutencao()
returns trigger
language plpgsql
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if new.data_manutencao > hoje then
    raise exception 'data_manutencao % no futuro (hoje é %)', new.data_manutencao, hoje
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- `of data_manutencao`: concluir a manutenção (que mexe só em data_conclusao) não revalida
-- a data.
create trigger manutencao_valida_data
  before insert or update of data_manutencao on manutencao
  for each row execute function valida_data_manutencao();

-- Manutenção só é escrita pelas RPCs abaixo: insert direto criaria manutenção sem a despesa
-- e sem parar o veículo; update direto descasaria o valor da despesa já gerada; delete físico
-- apagaria o histórico mecânico. A leitura (manutencao_select) continua para Admin e Gestor
-- de Frota.
drop policy manutencao_insert on manutencao;
drop policy manutencao_update on manutencao;
drop policy manutencao_delete on manutencao;

create or replace function registrar_manutencao(
  veiculo_id uuid,
  descricao text,
  data_manutencao date,
  valor numeric,
  forma_pagamento_id uuid,
  status_pagamento status_pagamento
)
returns uuid
language plpgsql
-- Definer: sem policy de insert em manutencao, e o Gestor de Frota não grava (nem lê)
-- movimentacao. Só esta função grava as duas; a checagem de perfil abaixo faz o papel da
-- policy.
security definer
set search_path = public
as $$
declare
  placa_veiculo text;
  status_atual status_veiculo;
  categoria_manutencao_id uuid;
  nova_movimentacao_id uuid;
  nova_manutencao_id uuid;
begin
  if not coalesce(auth_perfil() in ('Admin', 'Gestor de Frota'), false) then
    raise exception 'Sem permissão para registrar manutenções.' using errcode = '42501';
  end if;

  -- `for update` trava o veículo: uma viagem não abre nele enquanto a manutenção é gravada,
  -- e a `concluir_manutencao` do mesmo veículo espera esta terminar.
  -- Os parâmetros têm o mesmo nome das colunas; `registrar_manutencao.x` deixa claro que é o
  -- parâmetro.
  select v.placa, v.status into placa_veiculo, status_atual
  from veiculo v
  where v.id = registrar_manutencao.veiculo_id
  for update;

  if not found then
    raise exception 'Veículo não encontrado.' using errcode = 'P0002';
  end if;

  if status_atual = 'EmViagem' then
    raise exception 'Veículo em viagem não pode entrar em manutenção.' using errcode = 'MN001';
  end if;

  if status_atual = 'Inativo' then
    raise exception 'Veículo inativo não pode receber manutenção.' using errcode = 'MN002';
  end if;
  -- Veículo já EmManutencao é aceito: duas ordens de serviço podem estar abertas ao mesmo
  -- tempo (ex.: pneus e freio). Ele só volta a Disponível quando a última for concluída.

  if not exists (
    select 1 from forma_pagamento f
    where f.id = registrar_manutencao.forma_pagamento_id and f.ativa
  ) then
    raise exception 'Forma de pagamento inválida.' using errcode = '22023';
  end if;

  -- A categoria é achada pelo título que a migration de catálogos (20260924000200) semeia.
  -- Inativa conta como inexistente: categoria desativada não recebe lançamento novo.
  select c.id into categoria_manutencao_id
  from categoria c
  where c.titulo = 'Manutenção' and c.tipo = 'Saida' and c.ativa;

  if not found then
    raise exception 'Categoria Manutenção inexistente ou inativa.' using errcode = 'MN003';
  end if;

  -- A despesa nasce primeiro porque a manutenção guarda o id dela. Pago exige data de
  -- pagamento (check da movimentacao): usa a data do serviço. O vencimento também é a data
  -- do serviço — o formulário da US06-b não pede vencimento.
  insert into movimentacao (
    categoria_id, forma_pagamento_id, valor, descricao,
    data_vencimento, data_pagamento, status_pagamento
  ) values (
    categoria_manutencao_id,
    registrar_manutencao.forma_pagamento_id,
    registrar_manutencao.valor,
    -- A placa entra na descrição porque o Financeiro lê a despesa sem ver a manutenção.
    format('Manutenção %s: %s', placa_veiculo, registrar_manutencao.descricao),
    registrar_manutencao.data_manutencao,
    case when registrar_manutencao.status_pagamento = 'Pago' then registrar_manutencao.data_manutencao end,
    registrar_manutencao.status_pagamento
  )
  returning id into nova_movimentacao_id;

  -- As checks e o trigger da tabela (valor > 0, data não futura) barram aqui; a despesa
  -- inserida acima é desfeita junto.
  insert into manutencao (veiculo_id, descricao, data_manutencao, valor, movimentacao_id)
  values (
    registrar_manutencao.veiculo_id,
    registrar_manutencao.descricao,
    registrar_manutencao.data_manutencao,
    registrar_manutencao.valor,
    nova_movimentacao_id
  )
  returning id into nova_manutencao_id;

  update veiculo v set status = 'EmManutencao' where v.id = registrar_manutencao.veiculo_id;

  return nova_manutencao_id;
end;
$$;

create or replace function concluir_manutencao(id uuid)
returns status_veiculo
language plpgsql
security definer
set search_path = public
as $$
declare
  id_veiculo uuid;
  status_final status_veiculo;
begin
  if not coalesce(auth_perfil() in ('Admin', 'Gestor de Frota'), false) then
    raise exception 'Sem permissão para concluir manutenções.' using errcode = '42501';
  end if;

  select m.veiculo_id into id_veiculo from manutencao m where m.id = concluir_manutencao.id;
  if not found then
    raise exception 'Manutenção não encontrada.' using errcode = 'P0002';
  end if;

  -- Trava o veículo antes de olhar as manutenções abertas. Sem isso, duas conclusões ao
  -- mesmo tempo no mesmo veículo veriam, cada uma, a outra ainda aberta, e ele ficaria
  -- EmManutencao para sempre.
  perform 1 from veiculo v where v.id = id_veiculo for update;

  update manutencao m set data_conclusao = now()
  where m.id = concluir_manutencao.id and m.data_conclusao is null;
  if not found then
    raise exception 'Manutenção já concluída.' using errcode = 'P0002';
  end if;

  -- Volta para Disponível só se esta era a última manutenção aberta, e só se o veículo
  -- ainda está EmManutencao: um veículo inativado no meio do caminho continua Inativo.
  update veiculo v set status = 'Disponivel'
  where v.id = id_veiculo
    and v.status = 'EmManutencao'
    and not exists (
      select 1 from manutencao m where m.veiculo_id = id_veiculo and m.data_conclusao is null
    );

  -- Devolve o status final para a tela avisar se o veículo continua parado.
  select v.status into status_final from veiculo v where v.id = id_veiculo;
  return status_final;
end;
$$;

-- Função nova nasce executável por PUBLIC, e o Supabase ainda concede a anon: fecha os dois.
revoke execute on function registrar_manutencao(uuid, text, date, numeric, uuid, status_pagamento) from public, anon;
grant execute on function registrar_manutencao(uuid, text, date, numeric, uuid, status_pagamento) to authenticated;
revoke execute on function concluir_manutencao(uuid) from public, anon;
grant execute on function concluir_manutencao(uuid) to authenticated;
