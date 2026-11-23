-- EIX-45 (US12): dados dos gráficos de fluxo de caixa da aba Dashboards. A soma e o percentual moram
-- no banco (RNF06): a tela só desenha o que estas funções devolvem.
--
-- Endpoints (chamados com supabase.rpc; consumidos por src/features/dashboard/graficos/queries.ts):
--   fluxo_caixa_mensal(mes_final date, meses int)                 barras Entradas vs Saídas
--   despesas_por_categoria(data_inicial date, data_final date)    rosca das despesas
--
-- Regime de caixa (decisão de 22/11/2026): só entra movimentação com status 'Pago', no mês ou no dia
-- da data_pagamento. Pendente com data_pagamento preenchida (pagamento agendado) não entra.
--
-- Dinheiro sai em centavos inteiros (CLAUDE.md §5). A soma acontece em numeric (exato) e só depois
-- vira centavos: 1,13 vira 113, nunca 112.
--
-- Erros que o app traduz para português:
--   42501  perfil sem permissão (só Admin e Financeiro, como no kpis_financeiros)
--   22023  parâmetro inválido
--
-- Security invoker: o RLS de movimentacao e categoria vale nas linhas lidas (US18). O Gestor de
-- Frota não lê movimentacao, por isso recebe 42501 em vez de um gráfico vazio.

-- fluxo_caixa_mensal: uma linha por mês, do mais antigo ao mais recente, terminando no mês de
-- mes_final (qualquer dia do mês serve).
--   meses = 3, 6, 12 ou 24  exatamente esse número de linhas.
--   meses = null ("Máximo") do mês do primeiro pagamento até o mês final. Sem pagamento até lá,
--                           nenhuma linha. Agrupado por mês, o histórico inteiro tem poucas linhas.
-- Mês sem movimento aparece com zero: pular o mês esconderia um mês parado no gráfico.
create function fluxo_caixa_mensal(mes_final date, meses int)
returns table (mes text, entradas_centavos bigint, saidas_centavos bigint)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  ultimo_mes date;
  primeiro_mes date;
begin
  if not coalesce(auth_perfil() in ('Admin', 'Financeiro'), false) then
    raise exception 'Sem permissão para ver o fluxo de caixa.' using errcode = '42501';
  end if;

  if mes_final is null then
    raise exception 'Informe o mês final.' using errcode = '22023';
  end if;
  -- As mesmas opções das abas do gráfico: 3 meses, 6 meses, 1 ano, 2 anos.
  if meses is not null and meses not in (3, 6, 12, 24) then
    raise exception 'Horizonte inválido. Use 3, 6, 12 ou 24 meses.' using errcode = '22023';
  end if;

  ultimo_mes := date_trunc('month', mes_final)::date;

  if meses is null then
    select date_trunc('month', min(m.data_pagamento))::date
      into primeiro_mes
      from movimentacao m
     where m.status_pagamento = 'Pago'
       and m.data_pagamento < (ultimo_mes + interval '1 month');

    if primeiro_mes is null then
      return;
    end if;
  else
    primeiro_mes := (ultimo_mes - make_interval(months => meses - 1))::date;
  end if;

  return query
    with pagos as (
      select date_trunc('month', m.data_pagamento)::date as inicio_do_mes, c.tipo, m.valor
        from movimentacao m
        join categoria c on c.id = m.categoria_id
       where m.status_pagamento = 'Pago'
         and m.data_pagamento >= primeiro_mes
         and m.data_pagamento < (ultimo_mes + interval '1 month')
    )
    select to_char(s.inicio_do_mes, 'YYYY-MM'),
           (coalesce(sum(p.valor) filter (where p.tipo = 'Entrada'), 0) * 100)::bigint,
           (coalesce(sum(p.valor) filter (where p.tipo = 'Saida'), 0) * 100)::bigint
      from generate_series(primeiro_mes, ultimo_mes, interval '1 month') as s(inicio_do_mes)
      left join pagos p on p.inicio_do_mes = s.inicio_do_mes::date
     group by s.inicio_do_mes
     order by s.inicio_do_mes;
end;
$$;

-- Função nova nasce executável por PUBLIC, e o Supabase ainda concede a anon: fecha os dois.
revoke execute on function fluxo_caixa_mensal(date, int) from public, anon;
grant execute on function fluxo_caixa_mensal(date, int) to authenticated;

-- despesas_por_categoria: as Saídas pagas no período, por categoria, para a rosca.
--   - As 5 categorias de maior total, do maior para o menor (empate: título em ordem alfabética).
--   - As demais somadas numa linha "Outras", com categoria_id nulo, sempre no fim. Mais de 6 fatias
--     não se distinguem com a paleta stone + cyan, e somar no app seria agregação no cliente.
--   - percentual: parte da linha no total de Saídas pagas do período, com 1 casa.
--   - Categoria inativa entra com o próprio título: o lançamento histórico continua valendo.
--   - O banco só aceita valor positivo (movimentacao_valor_positivo): o total nunca é zero, então o
--     percentual nunca divide por zero.
-- Período: mesmas regras e mensagens do kpis_financeiros, para o FiltroPeriodo valer aqui.
create function despesas_por_categoria(data_inicial date, data_final date)
returns table (categoria_id uuid, titulo text, total_centavos bigint, percentual numeric)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if not coalesce(auth_perfil() in ('Admin', 'Financeiro'), false) then
    raise exception 'Sem permissão para ver as despesas por categoria.' using errcode = '42501';
  end if;

  if data_inicial is null or data_final is null then
    raise exception 'Informe a data inicial e a data final.' using errcode = '22023';
  end if;
  if data_final < data_inicial then
    raise exception 'A data final não pode ser anterior à data inicial.' using errcode = '22023';
  end if;
  -- +1 porque as duas pontas contam: de 01/10 a 01/10 é um período de 1 dia.
  if (data_final - data_inicial) + 1 > 366 then
    raise exception 'O período pode ter no máximo 366 dias.' using errcode = '22023';
  end if;

  return query
    with por_categoria as (
      select c.id, c.titulo, sum(m.valor) as total
        from movimentacao m
        join categoria c on c.id = m.categoria_id
       where c.tipo = 'Saida'
         and m.status_pagamento = 'Pago'
         and m.data_pagamento between despesas_por_categoria.data_inicial and despesas_por_categoria.data_final
       group by c.id, c.titulo
    ),
    ranqueadas as (
      select pc.id, pc.titulo, pc.total, row_number() over (order by pc.total desc, pc.titulo) as posicao
        from por_categoria pc
    ),
    fatias as (
      -- Da 6ª em diante, tudo cai no mesmo grupo (id nulo, "Outras"), que fica em 6º lugar.
      select case when r.posicao <= 5 then r.id end as id,
             case when r.posicao <= 5 then r.titulo else 'Outras' end as titulo,
             sum(r.total) as total,
             min(r.posicao) as ordem
        from ranqueadas r
       group by 1, 2
    )
    select f.id, f.titulo, (f.total * 100)::bigint, round(f.total * 100 / sum(f.total) over (), 1)
      from fatias f
     order by f.ordem;
end;
$$;

revoke execute on function despesas_por_categoria(date, date) from public, anon;
grant execute on function despesas_por_categoria(date, date) to authenticated;
