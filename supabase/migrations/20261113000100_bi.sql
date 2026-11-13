-- EIX-43 (US10): motor de estatísticas de viagem, rota e veículo. O cálculo mora no banco (RNF06):
-- a tela só exibe o que estas funções devolvem, sem laço em JS. As US11, US12 e US13 leem daqui.
--
-- Endpoints (chamados com supabase.rpc; consumidos por src/features/bi/queries.ts):
--   estatisticas_viagens(data_inicial date, data_final date)   uma linha por viagem
--   estatisticas_rotas(data_inicial date, data_final date)     uma linha por rota
--   estatisticas_veiculos(data_inicial date, data_final date)  uma linha por veículo
--
-- Fórmulas (spec .specs/features/eix43-estatisticas-rota/spec.md):
--   km rodado        hodometro_final − hodometro_inicial (US08). Sem hodômetro final, nulo.
--   rentabilidade    soma das Entradas vinculadas − soma das Saídas vinculadas. Pagas e pendentes
--                    entram (regime de competência, decisão de 13/11/2026).
--   R$/KM            soma das Saídas ÷ KM rodado, em centavos inteiros arredondados.
--   KM/L             KM rodado ÷ soma dos litros vinculados (US09), com 2 casas.
-- Divisão por zero nunca acontece: sem KM ou sem litros, o resultado é nulo e o app mostra "—".
--
-- Unidades: dinheiro em centavos inteiros (bigint), KM com 1 casa, litros com 2, KM/L com 2.
--
-- Período: as datas são inclusivas e filtram pelo dia de início da viagem no fuso do Brasil
-- (data_inicio, ou data_inclusao se o celular não mandou). As regras e mensagens do período são as
-- mesmas das RPCs de KPI (20261109000100_kpis_dashboard.sql), para o FiltroPeriodo valer aqui.
--
-- Erros que o app traduz para português:
--   42501  perfil sem permissão (só Admin, Gestor de Frota e Financeiro aprovados)
--   22023  período inválido (data vazia, final antes da inicial, mais de 366 dias)
--
-- Acesso: o Gestor de Frota não lê movimentacao e o Financeiro não lê viagem (RLS). As funções são
-- security definer, checam o perfil no início e devolvem só agregados: nenhum lançamento, hodômetro
-- ou motorista sai daqui. As policies não mudam (mesmo molde da AD-013 e da AD-014).

-- As consolidações juntam viagem por rota e por veículo. O Postgres não indexa FK sozinho, e o único
-- índice de veiculo_id hoje é parcial (só EmAndamento, 20261015000100_viagem_regras.sql).
-- movimentacao(viagem_id) já tem índice desde a EIX-42.
create index viagem_rota_id_idx on viagem (rota_id);
create index viagem_veiculo_id_idx on viagem (veiculo_id);

-- Uma linha por viagem não cancelada, com os totais dos lançamentos vinculados. É a fórmula única
-- que as três funções reaproveitam: viagem, rota e veículo somam a mesma coisa.
-- security_invoker: se um grant vazar, o RLS de quem lê vale. As funções abaixo leem como dono.
create view estatistica_viagem
with (security_invoker = true)
as
select
  v.id as viagem_id,
  v.veiculo_id,
  v.rota_id,
  v.status,
  v.data_inicio,
  v.data_fim,
  coalesce(v.data_inicio, v.data_inclusao) as inicio,
  -- Dia do início no fuso do Brasil: uma viagem das 23h30 do dia 30 é do dia 30, não do 31 (UTC).
  (coalesce(v.data_inicio, v.data_inclusao) at time zone 'America/Sao_Paulo')::date as dia_inicio,
  v.hodometro_final - v.hodometro_inicial as km_rodado,
  -- A soma acontece em numeric (exato) e só depois vira centavos: 1234,57 não perde centavo.
  (coalesce(l.receita, 0) * 100)::bigint as receita_centavos,
  (coalesce(l.despesa, 0) * 100)::bigint as despesa_centavos,
  l.litros
from viagem v
left join lateral (
  select
    sum(m.valor) filter (where c.tipo = 'Entrada') as receita,
    sum(m.valor) filter (where c.tipo = 'Saida') as despesa,
    -- O trigger da EIX-42 só aceita litros em Combustível, então somar todos é somar o Combustível.
    sum(m.litros) as litros
  from movimentacao m
  join categoria c on c.id = m.categoria_id
  where m.viagem_id = v.id
) l on true
where v.status <> 'Cancelada';

-- A view é interna: sem estes revokes, o PostgREST a exporia sem a checagem de perfil.
revoke all on estatistica_viagem from public, anon, authenticated;

-- Mesmas regras do período das RPCs de KPI. Função interna: só as funções deste arquivo chamam.
create function bi_valida_periodo(data_inicial date, data_final date)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
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
end;
$$;

revoke execute on function bi_valida_periodo(date, date) from public, anon, authenticated;

-- estatisticas_viagens: uma linha por viagem EmAndamento ou Finalizada iniciada no período, da mais
-- recente para a mais antiga. Viagem em andamento aparece com os lançamentos, mas sem KM, R$/KM e
-- KM/L (ainda não tem hodômetro final).
create function estatisticas_viagens(data_inicial date, data_final date)
returns table (
  viagem_id uuid,
  veiculo_id uuid,
  placa text,
  rota_id uuid,
  cidade_origem text,
  uf_origem uf,
  cidade_destino text,
  uf_destino uf,
  status status_viagem,
  data_inicio timestamptz,
  data_fim timestamptz,
  km_rodado numeric,
  receita_centavos bigint,
  despesa_centavos bigint,
  rentabilidade_centavos bigint,
  litros numeric,
  custo_por_km_centavos bigint,
  consumo_km_por_litro numeric
)
language plpgsql
stable
-- Definer: lê viagem e movimentacao mesmo para quem o RLS esconde uma delas. A checagem de perfil
-- abaixo faz o papel da policy.
security definer
set search_path = public
as $$
-- Os nomes de retorno são iguais aos das colunas; aqui, nome solto é sempre a coluna.
#variable_conflict use_column
begin
  -- auth_perfil() é nulo para quem não está aprovado; o coalesce trata o nulo como "sem permissão".
  if not coalesce(auth_perfil() in ('Admin', 'Gestor de Frota', 'Financeiro'), false) then
    raise exception 'Sem permissão para ver as estatísticas.' using errcode = '42501';
  end if;
  perform bi_valida_periodo(data_inicial, data_final);

  return query
    select e.viagem_id, e.veiculo_id, ve.placa, e.rota_id,
           r.cidade_origem, r.uf_origem, r.cidade_destino, r.uf_destino,
           e.status, e.data_inicio, e.data_fim, e.km_rodado,
           e.receita_centavos, e.despesa_centavos,
           e.receita_centavos - e.despesa_centavos,
           e.litros,
           -- nullif: sem KM não há divisão (o banco garante final > inicial, mas a regra fica explícita).
           round(e.despesa_centavos / nullif(e.km_rodado, 0))::bigint,
           round(e.km_rodado / nullif(e.litros, 0), 2)
      from estatistica_viagem e
      join veiculo ve on ve.id = e.veiculo_id
      join rota r on r.id = e.rota_id
     where e.dia_inicio between estatisticas_viagens.data_inicial and estatisticas_viagens.data_final
     -- viagem_id desempata duas viagens no mesmo instante: a mesma chamada devolve a mesma ordem.
     order by e.inicio desc, e.viagem_id;
end;
$$;

-- Função nova nasce executável por PUBLIC, e o Supabase ainda concede a anon: fecha os dois.
revoke execute on function estatisticas_viagens(date, date) from public, anon;
grant execute on function estatisticas_viagens(date, date) to authenticated;
