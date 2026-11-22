-- EIX-71: 200 movimentações no mês atual, para medir a rolagem da lista de Movimentações.
--
-- Como usar: Supabase → SQL Editor → cole este arquivo inteiro → Run.
-- Terminou de medir? Troque `modo` para 'remover' e rode de novo.
--
-- O projeto de nuvem é um só para todos (AD-003): enquanto as 200 linhas existirem, o saldo, a
-- projeção e os KPIs do time mudam. Avise o grupo antes e remova logo depois da medição.
--
-- Os IDs são fixos (prefixo f0000000-…): rodar duas vezes não duplica, e o modo 'remover' apaga só
-- essas linhas, nunca um lançamento do time. Toda descrição começa com "Perf", para achar no app.
--
-- Roda pelo SQL Editor, que entra como dono do banco e não passa pelo RLS.

do $$
declare
  -- 'criar' ou 'remover'
  modo text := 'criar';

  quantidade constant integer := 200;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  inicio_mes date := date_trunc('month', hoje)::date;
  dias_no_mes integer := extract(day from (date_trunc('month', hoje) + interval '1 month - 1 day'))::integer;

  -- Entradas e saídas alternadas: a lista fica com os dois sinais (+ / −), como no uso real.
  categorias uuid[];
  formas uuid[];

  n integer;
  vencimento date;
  linhas integer;
  inserida integer;
begin
  if modo = 'remover' then
    -- Se alguma manutenção apontar para uma linha "Perf" (US06-b), a FK barra o delete e nada é
    -- apagado. O seed não cria esse vínculo.
    delete from movimentacao
    where id between 'f0000000-0000-4000-8000-000000000001' and 'f0000000-0000-4000-8000-000000000200';
    get diagnostics linhas = row_count;
    raise notice 'perf-200.sql: % movimentações de teste removidas.', linhas;
    return;
  end if;

  if modo <> 'criar' then
    raise exception 'modo deve ser ''criar'' ou ''remover'', veio %', modo;
  end if;

  -- Ordem fixa: Frete (entrada) e depois as saídas. "into strict" falha se a migration não rodou.
  select array_agg(id order by tipo, titulo) into strict categorias
  from categoria
  where (titulo, tipo) in (('Frete', 'Entrada'), ('Combustível', 'Saida'), ('Pedágio', 'Saida'), ('Manutenção', 'Saida'));
  if array_length(categorias, 1) <> 4 then
    raise exception 'Categorias padrão não encontradas (Frete, Combustível, Pedágio, Manutenção).';
  end if;

  select array_agg(id order by nome) into strict formas
  from forma_pagamento
  where nome in ('Pix', 'TED', 'Boleto', 'Cartão Corporativo');
  if array_length(formas, 1) <> 4 then
    raise exception 'Formas de pagamento padrão não encontradas (Pix, TED, Boleto, Cartão Corporativo).';
  end if;

  linhas := 0;
  for n in 1..quantidade loop
    -- Espalha as 200 linhas pelos dias do mês atual: todas caem no mesmo filtro de mês da lista.
    vencimento := inicio_mes + ((n - 1) % dias_no_mes);

    insert into movimentacao (
      id, categoria_id, forma_pagamento_id, valor, descricao,
      data_vencimento, data_pagamento, status_pagamento
    )
    values (
      ('f0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
      categorias[1 + (n % 4)],
      formas[1 + (n % 4)],
      -- Valores variados e sempre positivos (movimentacao_valor_positivo).
      round((50 + (n * 37) % 4000)::numeric + (n % 100) / 100.0, 2),
      'Perf ' || lpad(n::text, 3, '0') || ' — lançamento de teste de rolagem',
      vencimento,
      -- Pago só no que já venceu (movimentacao_pago_tem_data_pagamento); o resto fica pendente.
      case when vencimento <= hoje then vencimento end,
      -- O CASE devolve text; a coluna é do enum status_pagamento, por isso o cast explícito.
      (case when vencimento <= hoje then 'Pago' else 'Pendente' end)::status_pagamento
    )
    on conflict (id) do nothing;

    get diagnostics inserida = row_count;
    linhas := linhas + inserida;
  end loop;

  raise notice 'perf-200.sql: % movimentações criadas em % (as que já existiam foram mantidas).',
    linhas, to_char(inicio_mes, 'MM/YYYY');
end;
$$;
