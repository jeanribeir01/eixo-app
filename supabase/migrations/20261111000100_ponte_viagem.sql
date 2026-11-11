-- EIX-42 (US09): ponte entre o Caixa e as Viagens. O vínculo em si já existe desde a EIX-27
-- (`movimentacao.viagem_id`, anulável). Esta migration acrescenta o que falta para usá-lo:
--
-- 1. `movimentacao.litros`: quantidade abastecida, que a US10 (EIX-43) soma por viagem para o
--    KM/L. Só faz sentido em Combustível, e é obrigatória quando o Combustível está vinculado a
--    uma viagem (decisão de 11/11/2026, spec da EIX-42).
-- 2. Duas RPCs para o Financeiro enxergar as viagens que pode vincular. O RLS de `viagem` só
--    libera Admin, Gestor de Frota e o próprio Motorista; em vez de abrir a tabela, as funções
--    devolvem só placa, rota, status e datas (mesmo molde da AD-013). A policy não muda.
--
-- Erros que o repositório traduz para português:
--   23514  litros fora de Combustível, Combustível vinculado sem litros, litros <= 0
--   42501  perfil sem permissão nas RPCs (só Admin e Financeiro aprovados)
--
-- Antes do `db push`, confira na nuvem que nenhum Combustível vinculado ficaria inválido:
--   select count(*) from movimentacao m join categoria c on c.id = m.categoria_id
--   where c.titulo = 'Combustível' and c.tipo = 'Saida' and m.viagem_id is not null; (deve ser 0)
-- Em 11/11/2026 nenhuma tela gravava viagem_id, então o resultado esperado é 0.

-- numeric(8,2): até 999.999,99 litros, com duas casas. O schema Zod do app usa o mesmo limite
-- (src/features/movimentacoes/schema.ts). Nulo = não informado.
alter table movimentacao add column litros numeric(8, 2);
alter table movimentacao add constraint movimentacao_litros_positivo check (litros is null or litros > 0);

-- As duas regras abaixo dependem da categoria, que está em outra tabela: check não alcança,
-- por isso é trigger. Combustível é achado pelo título, como a `registrar_manutencao` acha
-- "Manutenção" (20261014000300_manutencao_rpc.sql).
create function valida_litros_movimentacao()
returns trigger
language plpgsql
-- Definer: lê `categoria` mesmo quando quem grava não tem policy de leitura nela.
security definer
set search_path = public
as $$
declare
  eh_combustivel boolean;
begin
  select c.titulo = 'Combustível' and c.tipo = 'Saida'
    into eh_combustivel
    from categoria c
   where c.id = new.categoria_id;

  -- Categoria inexistente: deixa a FK da coluna recusar com 23503.
  if eh_combustivel is null then
    return new;
  end if;

  if new.litros is not null and not eh_combustivel then
    raise exception 'Litros só podem ser informados em lançamento de Combustível.' using errcode = '23514';
  end if;

  -- Sem litros, a viagem fica sem KM/L na US10. Combustível sem viagem (abastecimento avulso)
  -- e lançamentos antigos continuam válidos.
  if eh_combustivel and new.viagem_id is not null and new.litros is null then
    raise exception 'Combustível vinculado a uma viagem precisa da quantidade em litros.' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- `of ...`: só revalida quando muda o que a regra olha. Pagar uma parcela antiga (que mexe só em
-- status e data) não passa pelo trigger.
create trigger movimentacao_valida_litros
  before insert or update of categoria_id, viagem_id, litros on movimentacao
  for each row execute function valida_litros_movimentacao();

-- O detalhe da viagem lista os lançamentos por `viagem_id`, e a US10 vai somar por ele. O
-- Postgres não indexa FK sozinho.
create index movimentacao_viagem_id_idx on movimentacao (viagem_id);

-- Viagens que o seletor do formulário e a lista "Lançamentos por viagem" mostram: todas as em
-- andamento e as concluídas nos últimos 30 dias. `data_fim` é opcional no banco; sem ela, vale a
-- última atualização da viagem, que é quando ela foi encerrada.
create or replace function listar_viagens_vinculaveis()
returns table (
  id uuid,
  placa text,
  cidade_origem text,
  uf_origem uf,
  cidade_destino text,
  uf_destino uf,
  status status_viagem,
  data_inicio timestamptz,
  data_fim timestamptz
)
language plpgsql
stable
-- Definer: o Financeiro não tem policy de select em `viagem`. A checagem de perfil abaixo faz o
-- papel da policy, e a função só expõe estas colunas (sem hodômetro nem motorista).
security definer
set search_path = public
as $$
begin
  -- auth_perfil() é nulo para quem não está aprovado; o coalesce trata o nulo como "sem permissão".
  if not coalesce(auth_perfil() in ('Admin', 'Financeiro'), false) then
    raise exception 'Sem permissão para listar viagens.' using errcode = '42501';
  end if;

  -- Aliases em todas as colunas: os nomes de retorno são iguais aos das tabelas.
  return query
    select v.id, ve.placa, r.cidade_origem, r.uf_origem, r.cidade_destino, r.uf_destino,
           v.status, v.data_inicio, v.data_fim
      from viagem v
      join veiculo ve on ve.id = v.veiculo_id
      join rota r on r.id = v.rota_id
     where v.status = 'EmAndamento'
        or (v.status = 'Finalizada' and coalesce(v.data_fim, v.data_atualizacao) >= now() - interval '30 days')
     -- Em andamento primeiro (false < true); depois, da mais recente para a mais antiga.
     order by v.status <> 'EmAndamento', coalesce(v.data_inicio, v.data_inclusao) desc;
end;
$$;

-- Uma viagem só, qualquer que seja o status ou a data: o formulário precisa do rótulo de um
-- vínculo antigo, e o detalhe abre qualquer viagem que tenha lançamento.
create or replace function buscar_viagem_vinculavel(p_viagem_id uuid)
returns table (
  id uuid,
  placa text,
  cidade_origem text,
  uf_origem uf,
  cidade_destino text,
  uf_destino uf,
  status status_viagem,
  data_inicio timestamptz,
  data_fim timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not coalesce(auth_perfil() in ('Admin', 'Financeiro'), false) then
    raise exception 'Sem permissão para ver a viagem.' using errcode = '42501';
  end if;

  -- Viagem inexistente devolve zero linhas; o repositório mostra "Viagem não encontrada.".
  return query
    select v.id, ve.placa, r.cidade_origem, r.uf_origem, r.cidade_destino, r.uf_destino,
           v.status, v.data_inicio, v.data_fim
      from viagem v
      join veiculo ve on ve.id = v.veiculo_id
      join rota r on r.id = v.rota_id
     where v.id = p_viagem_id;
end;
$$;

-- Função nova nasce executável por PUBLIC, e o Supabase ainda concede a anon: fecha os dois.
revoke execute on function listar_viagens_vinculaveis() from public, anon;
grant execute on function listar_viagens_vinculaveis() to authenticated;
revoke execute on function buscar_viagem_vinculavel(uuid) from public, anon;
grant execute on function buscar_viagem_vinculavel(uuid) to authenticated;
-- A função do trigger roda como definer só dentro do trigger; ninguém a chama pela API.
revoke execute on function valida_litros_movimentacao() from public, anon, authenticated;
