-- EIX-74: projeção de caixa por ano. Uma dívida de 80 parcelas gerava 80 meses na tela; agora a
-- tela mostra os próximos 12 meses e o resto resumido por ano. A soma por ano também mora no banco
-- (RNF06). O resto da função é o da 20261005000100_resumo_caixa.sql, sem mudança.
--
-- Campos novos no JSON:
-- - mesReferencia: 'AAAA-MM' do mês atual usado no cálculo. A tela conta os 12 meses a partir dele.
-- - projecaoAnual: um item por ano com pendência. O saldo do fim do ano é o do último mês com
--   pendência daquele ano (depois dele, até a virada, nada entra nem sai). O menor saldo do ano
--   avisa quando o caixa fica negativo no meio do ano, mesmo que termine positivo.

create or replace function resumo_caixa(referencia date default null)
returns jsonb
language plpgsql
stable
-- Invoker: o RLS de movimentacao e categoria vale nas linhas lidas (US18).
security invoker
set search_path = public
as $$
declare
  -- Sem referência, "hoje" é no fuso do Brasil: 22h de 31/10 ainda é outubro.
  inicio_do_mes date := date_trunc('month', coalesce(referencia, (now() at time zone 'America/Sao_Paulo')::date))::date;
  resultado jsonb;
begin
  -- Sem esta checagem, um Motorista receberia um resumo vazio (o RLS esconde as linhas),
  -- e a tela diria "sem movimentações" em vez de "sem permissão".
  if not coalesce(auth_perfil() in ('Admin', 'Financeiro'), false) then
    raise exception 'Sem permissão para ver o saldo.' using errcode = '42501';
  end if;

  with base as (
    select m.valor, m.status_pagamento, m.data_vencimento, c.tipo
    from movimentacao m
    join categoria c on c.id = m.categoria_id
  ),
  saldo as (
    select coalesce(sum(case when tipo = 'Entrada' then valor else -valor end), 0) as valor
    from base
    where status_pagamento = 'Pago'
  ),
  meses as (
    -- greatest(): o que venceu antes do mês de referência cai no mês de referência.
    select
      to_char(greatest(date_trunc('month', data_vencimento)::date, inicio_do_mes), 'YYYY-MM') as mes,
      coalesce(sum(valor) filter (where tipo = 'Entrada'), 0) as entradas,
      coalesce(sum(valor) filter (where tipo = 'Saida'), 0) as saidas
    from base
    where status_pagamento = 'Pendente' and data_vencimento is not null
    group by 1
  ),
  projecao as (
    select
      mes,
      entradas,
      saidas,
      (select valor from saldo) + sum(entradas - saidas) over (order by mes) as saldo_projetado
    from meses
  ),
  anos as (
    select
      left(mes, 4)::int as ano,
      sum(entradas) as entradas,
      sum(saidas) as saidas,
      (array_agg(saldo_projetado order by mes desc))[1] as saldo_fim_do_ano,
      min(saldo_projetado) as menor_saldo
    from projecao
    group by 1
  )
  select jsonb_build_object(
    'quantidadeMovimentacoes', (select count(*) from base),
    'saldoAtualCentavos', (select (valor * 100)::bigint from saldo),
    'mesReferencia', to_char(inicio_do_mes, 'YYYY-MM'),
    'projecao', coalesce(
      (select jsonb_agg(
         jsonb_build_object(
           'mes', mes,
           'entradasPendentesCentavos', (entradas * 100)::bigint,
           'saidasPendentesCentavos', (saidas * 100)::bigint,
           'saldoProjetadoCentavos', (saldo_projetado * 100)::bigint
         ) order by mes)
       from projecao),
      '[]'::jsonb),
    'projecaoAnual', coalesce(
      (select jsonb_agg(
         jsonb_build_object(
           'ano', ano,
           'entradasPendentesCentavos', (entradas * 100)::bigint,
           'saidasPendentesCentavos', (saidas * 100)::bigint,
           'saldoFimDoAnoCentavos', (saldo_fim_do_ano * 100)::bigint,
           'menorSaldoCentavos', (menor_saldo * 100)::bigint
         ) order by ano)
       from anos),
      '[]'::jsonb),
    'semVencimento', (
      select jsonb_build_object(
        'quantidade', count(*),
        'entradasCentavos', (coalesce(sum(valor) filter (where tipo = 'Entrada'), 0) * 100)::bigint,
        'saidasCentavos', (coalesce(sum(valor) filter (where tipo = 'Saida'), 0) * 100)::bigint
      )
      from base
      where status_pagamento = 'Pendente' and data_vencimento is null
    )
  ) into resultado;

  return resultado;
end;
$$;

-- O create or replace mantém as permissões, mas repetir deixa a regra explícita: só authenticated
-- executa (o perfil é checado dentro da função).
revoke execute on function resumo_caixa(date) from public, anon;
grant execute on function resumo_caixa(date) to authenticated;
