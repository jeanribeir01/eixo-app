-- EIX-53: dados de exemplo para o vídeo de demonstração.
--
-- Como usar: Supabase → SQL Editor → cole este arquivo inteiro → Run. Para regravar o vídeo,
-- rode antes o reset-demo.sql e depois este de novo.
--
-- O que cria:
-- - garante ativas as categorias e formas de pagamento padrão (as migrations já as criam);
-- - 12 movimentações pagas nos últimos 2 meses, para o saldo não começar em zero (fica em
--   R$ 8.970,30);
-- - 4 movimentações pendentes nos próximos 35 dias, para a projeção de caixa ter o que mostrar.
--
-- Nenhuma dívida: criar a dívida parcelada ao vivo é um dos momentos do vídeo (US04).
--
-- As datas são relativas a hoje (fuso de São Paulo), então o script serve em qualquer dia.
-- Os IDs são fixos: rodar duas vezes não duplica nada.
--
-- Roda pelo SQL Editor, que entra como dono do banco e não passa pelo RLS. Pelo app, só Admin e
-- Financeiro conseguem lançar movimentações.

do $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;

  cat_frete uuid;
  cat_combustivel uuid;
  cat_pedagio uuid;
  cat_manutencao uuid;
  cat_salario uuid;

  forma_pix uuid;
  forma_ted uuid;
  forma_boleto uuid;
  forma_cartao uuid;

  inseridas integer;
begin
  -- Um item padrão desativado em algum teste sumiria dos seletores durante a gravação.
  update categoria set ativa = true
  where (titulo, tipo) in (
    ('Frete', 'Entrada'),
    ('Combustível', 'Saida'),
    ('Pedágio', 'Saida'),
    ('Manutenção', 'Saida'),
    ('Salário', 'Saida'),
    ('Financiamento', 'Saida')
  );
  update forma_pagamento set ativa = true
  where nome in ('Pix', 'TED', 'Boleto', 'Cartão Corporativo');

  -- "into strict" falha com mensagem clara se o item padrão não existir (migrations não aplicadas).
  select id into strict cat_frete from categoria where titulo = 'Frete' and tipo = 'Entrada';
  select id into strict cat_combustivel from categoria where titulo = 'Combustível' and tipo = 'Saida';
  select id into strict cat_pedagio from categoria where titulo = 'Pedágio' and tipo = 'Saida';
  select id into strict cat_manutencao from categoria where titulo = 'Manutenção' and tipo = 'Saida';
  select id into strict cat_salario from categoria where titulo = 'Salário' and tipo = 'Saida';

  select id into strict forma_pix from forma_pagamento where nome = 'Pix';
  select id into strict forma_ted from forma_pagamento where nome = 'TED';
  select id into strict forma_boleto from forma_pagamento where nome = 'Boleto';
  select id into strict forma_cartao from forma_pagamento where nome = 'Cartão Corporativo';

  insert into movimentacao (
    id, categoria_id, forma_pagamento_id, valor, descricao,
    data_vencimento, data_pagamento, status_pagamento
  )
  values
    -- Entradas pagas: R$ 33.300,00
    ('de000000-0000-4000-8000-000000000001', cat_frete, forma_pix, 8500.00, 'Frete São Paulo → Curitiba', hoje - 62, hoje - 62, 'Pago'),
    ('de000000-0000-4000-8000-000000000002', cat_frete, forma_ted, 6200.00, 'Frete Campinas → Belo Horizonte', hoje - 47, hoje - 47, 'Pago'),
    ('de000000-0000-4000-8000-000000000003', cat_frete, forma_pix, 4800.00, 'Frete Santos → Ribeirão Preto', hoje - 33, hoje - 33, 'Pago'),
    ('de000000-0000-4000-8000-000000000004', cat_frete, forma_pix, 8500.00, 'Frete São Paulo → Curitiba', hoje - 18, hoje - 18, 'Pago'),
    ('de000000-0000-4000-8000-000000000005', cat_frete, forma_boleto, 5300.00, 'Frete Sorocaba → Londrina', hoje - 4, hoje - 4, 'Pago'),

    -- Saídas pagas: R$ 24.329,70
    ('de000000-0000-4000-8000-000000000006', cat_combustivel, forma_cartao, 2350.00, 'Diesel S10 — abastecimento da frota', hoje - 60, hoje - 60, 'Pago'),
    ('de000000-0000-4000-8000-000000000007', cat_pedagio, forma_cartao, 412.80, 'Pedágios — Régis Bittencourt', hoje - 58, hoje - 58, 'Pago'),
    ('de000000-0000-4000-8000-000000000008', cat_salario, forma_ted, 7800.00, 'Salário dos motoristas', hoje - 40, hoje - 40, 'Pago'),
    ('de000000-0000-4000-8000-000000000009', cat_manutencao, forma_boleto, 3200.00, 'Troca de pneus — Volvo FH', hoje - 36, hoje - 36, 'Pago'),
    ('de000000-0000-4000-8000-000000000010', cat_combustivel, forma_cartao, 2480.50, 'Diesel S10 — abastecimento da frota', hoje - 25, hoje - 25, 'Pago'),
    ('de000000-0000-4000-8000-000000000011', cat_pedagio, forma_cartao, 286.40, 'Pedágios — Anhanguera e Bandeirantes', hoje - 20, hoje - 20, 'Pago'),
    ('de000000-0000-4000-8000-000000000012', cat_salario, forma_ted, 7800.00, 'Salário dos motoristas', hoje - 10, hoje - 10, 'Pago'),

    -- Pendentes: entram só na projeção de caixa
    ('de000000-0000-4000-8000-000000000013', cat_frete, forma_boleto, 6200.00, 'Frete Campinas → Belo Horizonte', hoje + 7, null, 'Pendente'),
    ('de000000-0000-4000-8000-000000000014', cat_combustivel, forma_cartao, 2500.00, 'Diesel S10 — abastecimento da frota', hoje + 12, null, 'Pendente'),
    ('de000000-0000-4000-8000-000000000015', cat_salario, forma_ted, 7800.00, 'Salário dos motoristas', hoje + 20, null, 'Pendente'),
    ('de000000-0000-4000-8000-000000000016', cat_frete, forma_pix, 8500.00, 'Frete São Paulo → Curitiba', hoje + 35, null, 'Pendente')
  on conflict (id) do nothing;

  get diagnostics inseridas = row_count;
  raise notice 'demo.sql: % movimentações criadas (as que já existiam foram mantidas).', inseridas;
end;
$$;
