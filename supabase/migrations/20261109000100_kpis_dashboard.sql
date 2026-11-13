-- EIX-44 (US11): indicadores dos cards da Home, com o período do FiltroPeriodo. O cálculo mora no
-- banco (RNF06): a tela só exibe o JSON devolvido aqui.
--
-- As duas funções recebem o período como o filtro manda (datas ISO, inclusive nas duas pontas) e
-- recusam com 22023 o mesmo que o schema Zod recusa (src/features/dashboard/schema.ts):
--   - data vazia;
--   - data final anterior à inicial;
--   - período com mais de 366 dias (MAX_DIAS_PERIODO). Sem teto, 1900 a 9999 agregaria o
--     histórico inteiro e poria em risco o RNF06 (< 2s).
-- Perfil sem acesso recebe 42501, como na resumo_caixa: um resultado zerado faria a tela dizer
-- "sem dados no período" em vez de "sem permissão".
--
-- Separadas por módulo (RNF08): Financeiro não lê viagem e Gestor de Frota não lê movimentação.
-- Admin chama as duas.

-- kpis_financeiros (Admin e Financeiro). Dinheiro sai em centavos inteiros (CLAUDE.md §5); a
-- tela põe o sinal e a cor.
--   saldoAtualCentavos              Entradas − Saídas pagas até a data final (data_pagamento).
--   totalReceberCentavos            Entradas pendentes com vencimento dentro do período.
--   totalPagarCentavos              Saídas pendentes com vencimento dentro do período.
--                                   As duas somas não incluem atrasadas (vencidas antes do início)
--                                   nem pendência sem vencimento: o card é "do período".
--   quantidadeMovimentacoesPeriodo  Movimentações do período pela mesma regra da lista de
--                                   Movimentações: vencimento no período ou, sem vencimento, data
--                                   de inclusão no período (no fuso do Brasil). Zero = estado vazio.
create function kpis_financeiros(data_inicial date, data_final date)
returns jsonb
language plpgsql
stable
-- Invoker: o RLS de movimentacao e categoria vale nas linhas lidas (US18).
security invoker
set search_path = public
as $$
declare
  resultado jsonb;
begin
  if not coalesce(auth_perfil() in ('Admin', 'Financeiro'), false) then
    raise exception 'Sem permissão para ver os indicadores financeiros.' using errcode = '42501';
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

  with base as (
    select m.valor, m.status_pagamento, m.data_vencimento, m.data_pagamento, m.data_inclusao, c.tipo
    from movimentacao m
    join categoria c on c.id = m.categoria_id
  )
  select jsonb_build_object(
    'saldoAtualCentavos', (coalesce(sum(case when tipo = 'Entrada' then valor else -valor end)
      filter (where status_pagamento = 'Pago' and data_pagamento <= data_final), 0) * 100)::bigint,
    'totalReceberCentavos', (coalesce(sum(valor)
      filter (where status_pagamento = 'Pendente' and tipo = 'Entrada'
                and data_vencimento between data_inicial and data_final), 0) * 100)::bigint,
    'totalPagarCentavos', (coalesce(sum(valor)
      filter (where status_pagamento = 'Pendente' and tipo = 'Saida'
                and data_vencimento between data_inicial and data_final), 0) * 100)::bigint,
    'quantidadeMovimentacoesPeriodo', count(*)
      filter (where data_vencimento between data_inicial and data_final
                or (data_vencimento is null
                    and (data_inclusao at time zone 'America/Sao_Paulo')::date between data_inicial and data_final))
  )
  into resultado
  from base;

  return resultado;
end;
$$;

-- Função nova nasce executável por PUBLIC, e o Supabase ainda concede a anon: fecha os dois.
revoke execute on function kpis_financeiros(date, date) from public, anon;
grant execute on function kpis_financeiros(date, date) to authenticated;

-- kpis_frota (Admin e Gestor de Frota).
--   veiculosEmViagem  Veículos com viagem aberta no fim do dia de referência.
--   dataReferencia    A data final do período ou hoje (fuso do Brasil), a que vier antes: um
--                     período que ainda não terminou mostra quem está na estrada agora. A tela
--                     pode exibir a data para o card não parecer "do mês inteiro".
--
-- Uma viagem está aberta num instante quando:
--   - começou antes dele: data_inicio, ou data_inclusao se o celular não mandou data_inicio;
--   - e não tinha terminado: EmAndamento ainda não terminou; Finalizada terminou em data_fim, ou
--     na última atualização (data_atualizacao) se o celular não mandou data_fim.
-- Cancelada não conta: o card mostra veículo rodando, e uma viagem cancelada não chegou ao fim.
-- data_inicio e data_fim vêm do relógio do celular (EIX-76), então o número de um dia passado é
-- uma boa aproximação, não um registro exato. Para "agora", a regra se reduz ao status EmAndamento.
-- count(distinct): relógios errados podem sobrepor duas viagens do mesmo veículo no passado.
create function kpis_frota(data_inicial date, data_final date)
returns jsonb
language plpgsql
stable
-- Invoker: o RLS de viagem vale nas linhas lidas (US18).
security invoker
set search_path = public
as $$
declare
  data_referencia date;
  -- Fim do dia de referência no fuso do Brasil: viagem aberta até a meia-noite conta.
  fim_do_dia timestamptz;
  quantidade bigint;
begin
  if not coalesce(auth_perfil() in ('Admin', 'Gestor de Frota'), false) then
    raise exception 'Sem permissão para ver os indicadores da frota.' using errcode = '42501';
  end if;

  if data_inicial is null or data_final is null then
    raise exception 'Informe a data inicial e a data final.' using errcode = '22023';
  end if;
  if data_final < data_inicial then
    raise exception 'A data final não pode ser anterior à data inicial.' using errcode = '22023';
  end if;
  if (data_final - data_inicial) + 1 > 366 then
    raise exception 'O período pode ter no máximo 366 dias.' using errcode = '22023';
  end if;

  data_referencia := least(data_final, (now() at time zone 'America/Sao_Paulo')::date);
  fim_do_dia := (data_referencia + 1)::timestamp at time zone 'America/Sao_Paulo';

  select count(distinct v.veiculo_id)
  into quantidade
  from viagem v
  where v.status <> 'Cancelada'
    and coalesce(v.data_inicio, v.data_inclusao) < fim_do_dia
    and (v.status = 'EmAndamento' or coalesce(v.data_fim, v.data_atualizacao) >= fim_do_dia);

  return jsonb_build_object(
    'veiculosEmViagem', quantidade,
    'dataReferencia', to_char(data_referencia, 'YYYY-MM-DD')
  );
end;
$$;

revoke execute on function kpis_frota(date, date) from public, anon;
grant execute on function kpis_frota(date, date) to authenticated;
