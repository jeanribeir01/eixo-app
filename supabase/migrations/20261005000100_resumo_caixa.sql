-- EIX-35 (US05): motor de saldo e previsão de caixa. O cálculo mora no banco (RNF06):
-- a tela da EIX-51 só exibe o JSON devolvido aqui, no formato do contrato Zod dela.
--
-- Regras (spec EIX-35):
-- - Saldo atual: Entradas − Saídas, só status 'Pago'. Tipo vem de categoria.tipo.
-- - Projeção: pendências com vencimento, agrupadas por mês; a atrasada soma no mês de
--   referência; saldo projetado é acumulado a partir do saldo atual.
-- - Pendência sem vencimento fica fora da projeção, em `semVencimento`.
-- - Dinheiro sai em centavos inteiros (CLAUDE.md §5); saídas saem positivas, a tela põe o sinal.

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
  )
  select jsonb_build_object(
    'quantidadeMovimentacoes', (select count(*) from base),
    'saldoAtualCentavos', (select (valor * 100)::bigint from saldo),
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

-- Função nova nasce executável por PUBLIC, e o Supabase ainda concede a anon: fecha os dois.
revoke execute on function resumo_caixa(date) from public, anon;
grant execute on function resumo_caixa(date) to authenticated;
