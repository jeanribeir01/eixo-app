-- EIX-56: o que a US06 (EIX-37) pede de `veiculo` e o schema da EIX-27 não cobria —
-- status Inativo, ano de fabricação e o fim do delete físico.

-- Inativar é o soft delete do veículo: ele some dos seletores, mas as viagens e
-- manutenções antigas continuam apontando para ele.
-- O Postgres não deixa usar um valor novo de enum na mesma transação em que foi criado.
-- Nada abaixo usa 'Inativo', por isso cabe tudo num arquivo só; se um dia esta migration
-- precisar gravar ou comparar com 'Inativo', o `add value` vai para um arquivo próprio.
alter type status_veiculo add value if not exists 'Inativo';

-- Nullable de propósito: veículos cadastrados antes desta migration não têm o ano, e o
-- formulário (schema Zod da EIX-37) é quem torna o campo obrigatório daqui para frente.
alter table veiculo add column ano_fabricacao smallint null;

-- Limite inferior é fixo, então fica numa check comum.
alter table veiculo
  add constraint veiculo_ano_fabricacao_minimo check (ano_fabricacao >= 1950);

-- O limite superior (ano atual + 1) muda com o tempo. Uma check com `now()` só é avaliada
-- na escrita e o Postgres a trata como se fosse imutável, então ele fica num trigger, que
-- é o lugar honesto para regra que depende da data. O ano é o de São Paulo, como em
-- `resumo_caixa()` (AD-007): no réveillon, 21h em Brasília já é o ano seguinte em UTC.
create function valida_ano_fabricacao_veiculo()
returns trigger
language plpgsql
as $$
declare
  ano_maximo int := extract(year from (now() at time zone 'America/Sao_Paulo'))::int + 1;
begin
  if new.ano_fabricacao > ano_maximo then
    raise exception 'ano_fabricacao % maior que o permitido (%)', new.ano_fabricacao, ano_maximo
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- `of ano_fabricacao`: mudar só o status (inativar) não precisa revalidar o ano.
create trigger veiculo_valida_ano_fabricacao
  before insert or update of ano_fabricacao on veiculo
  for each row execute function valida_ano_fabricacao_veiculo();

-- Veículo com viagem no histórico nunca é apagado; sai de circulação com status Inativo,
-- como categoria, forma_pagamento e usuario, que também não têm policy de delete. Sem
-- policy, o RLS rejeita o delete de qualquer perfil (0 linhas afetadas), inclusive Admin.
drop policy veiculo_delete on veiculo;
