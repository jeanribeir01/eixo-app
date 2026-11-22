-- Simulação de 3 meses de uso do app: zera os dados operacionais e grava uma operação inteira de
-- transportadora, com datas relativas a hoje (fuso de São Paulo). Serve para testar as telas com
-- volume real: caixa, projeção, dívidas, frota, manutenção, viagens, KPIs, custo por KM e ranking.
--
-- ATENÇÃO: APAGA TODOS os veículos, rotas, viagens, manutenções, revisões de viagem,
-- movimentações e dívidas do projeto, inclusive o que o time lançou à mão. O projeto de nuvem é um
-- só para todos (AD-003): avise o grupo antes de rodar.
--
-- Como usar: Supabase → SQL Editor → cole este arquivo inteiro → Run. Rodar de novo zera e grava
-- tudo outra vez, com as datas andando junto com o dia de hoje.
--
-- Fica como está:
-- - usuários reais, perfis e as categorias e formas de pagamento que já existem (as padrão são
--   reativadas; quatro categorias novas entram se ainda não existirem);
-- - arquivos de comprovante no Storage (bucket "comprovantes"): SQL não apaga arquivo. Apague pelo
--   painel em Storage → comprovantes, se quiser.
--
-- O que cria:
-- - 7 motoristas fictícios (e-mail @simulacao.local, sem senha: não entram no app). 5 ativos,
--   1 bloqueado (saiu da empresa) e 1 aguardando aprovação, para a tela de Perfis ter o que mostrar;
-- - 6 veículos: um em viagem agora, um em manutenção, um inativo (devolvido), três disponíveis;
-- - 9 rotas, uma delas desativada, e uma com frete abaixo do custo (dá prejuízo no ranking);
-- - viagens de 3 meses, algumas canceladas, cada viagem finalizada com frete, diesel (com litros)
--   e pedágio vinculados (US09), para o custo por KM e o ranking (US10, US13);
-- - manutenções concluídas ao longo do período e uma aberta, cada uma com a despesa vinculada
--   (US06-b);
-- - despesas fixas mensais (salário por motorista, aluguel, seguro, impostos) pagas no passado e
--   pendentes nos próximos 2 meses, para a projeção de caixa;
-- - 4 dívidas: um financiamento longo, um capital de giro com quitação antecipada, uma excluída
--   (só as parcelas pagas ficam) e uma compra parcelada que começa a vencer agora;
-- - 1 frete a receber atrasado e uma categoria desativada com lançamentos antigos (soft delete).
--
-- Celular de motorista com viagem na fila offline: depois deste script, a viagem que subir aponta
-- para um veículo que não existe mais e cai em erro de sincronização. Limpe os dados do app nesses
-- aparelhos (ou faça logout) antes de usar.
--
-- Roda pelo SQL Editor, que entra como dono do banco e não passa pelo RLS. Tudo roda num bloco só:
-- se algo falhar, nada é apagado nem gravado.

do $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  -- 91 dias atrás: o "primeiro dia" do app na empresa.
  inicio date := (now() at time zone 'America/Sao_Paulo')::date - 91;
  fuso constant text := 'America/Sao_Paulo';

  perfil_motorista uuid;

  cat_frete uuid;
  cat_combustivel uuid;
  cat_pedagio uuid;
  cat_manutencao uuid;
  cat_salario uuid;
  cat_financiamento uuid;
  cat_seguro uuid;
  cat_aluguel uuid;
  cat_impostos uuid;
  cat_aporte uuid;
  cat_lavagem uuid;

  forma_pix uuid;
  forma_ted uuid;
  forma_boleto uuid;
  forma_cartao uuid;

  -- Motoristas fictícios. O 6º saiu da empresa (Bloqueado) e o 7º acabou de pedir acesso.
  motorista_nome text[] := array[
    'Carlos Almeida', 'Rafael Souza', 'Marcos Oliveira', 'Anderson Lima', 'Paulo Henrique Santos',
    'Edson Ferreira', 'Lucas Martins'
  ];
  motorista_email text[] := array[
    'carlos.almeida@simulacao.local', 'rafael.souza@simulacao.local', 'marcos.oliveira@simulacao.local',
    'anderson.lima@simulacao.local', 'paulo.santos@simulacao.local', 'edson.ferreira@simulacao.local',
    'lucas.martins@simulacao.local'
  ];
  motorista_salario numeric[] := array[4150.00, 3980.00, 4220.00, 3890.00, 3760.00, 3920.00];
  id_motorista uuid[];

  -- Veículos. O motorista i dirige o veículo i. Hodômetro de partida de cada um.
  veiculo_placa text[] := array['RTA4B21', 'QKP7E58', 'SFD2H94', 'PWX9J13', 'TBC6K47', 'NHM3L82'];
  veiculo_marca text[] := array['Volvo', 'Scania', 'Mercedes-Benz', 'DAF', 'Volkswagen', 'Iveco'];
  veiculo_modelo text[] := array['FH 540', 'R 450', 'Actros 2651', 'XF 530', 'Constellation 24.280', 'Stralis 480'];
  veiculo_ano smallint[] := array[2021, 2020, 2022, 2019, 2023, 2016];
  veiculo_capacidade numeric[] := array[37, 33, 40, 36, 14, 30];
  veiculo_hodometro numeric[] := array[182340.0, 241870.0, 98760.0, 312450.0, 45120.0, 498300.0];
  -- Rendimento em km/l: caminhão pesado faz perto de 2,5.
  veiculo_km_por_litro numeric[] := array[2.55, 2.45, 2.60, 2.40, 3.40, 2.30];
  id_veiculo uuid[];

  -- Rotas. A 7ª é um contrato antigo com frete abaixo do custo; a 9ª foi desativada no meio do
  -- período (só tem viagens antigas).
  rota_origem text[] := array[
    'São Paulo', 'Campinas', 'Santos', 'Curitiba', 'São Paulo', 'Sorocaba', 'Goiânia', 'Joinville', 'Belo Horizonte'
  ];
  rota_uf_origem uf[] := array['SP', 'SP', 'SP', 'PR', 'SP', 'SP', 'GO', 'SC', 'MG']::uf[];
  rota_destino text[] := array[
    'Curitiba', 'Belo Horizonte', 'Ribeirão Preto', 'Porto Alegre', 'Rio de Janeiro', 'Londrina', 'Uberlândia',
    'São Paulo', 'Vitória'
  ];
  rota_uf_destino uf[] := array['PR', 'MG', 'SP', 'RS', 'RJ', 'PR', 'MG', 'SP', 'ES']::uf[];
  rota_distancia numeric[] := array[408, 590, 410, 711, 435, 440, 340, 530, 524];
  rota_frete_por_km numeric[] := array[9.20, 8.70, 8.40, 8.90, 9.60, 8.10, 2.20, 8.80, 8.30];
  rota_pedagio numeric[] := array[248.60, 182.40, 211.30, 96.80, 268.20, 152.70, 0, 189.50, 64.20];
  id_rota uuid[];

  manutencao_descricao text[] := array[
    'Troca de óleo e filtros', 'Revisão do sistema de freios', 'Troca de 2 pneus dianteiros',
    'Alinhamento e balanceamento', 'Troca do kit de embreagem', 'Revisão preventiva'
  ];
  manutencao_valor numeric[] := array[1380.00, 2640.00, 4180.00, 590.00, 7950.00, 3420.00];

  v integer;
  k integer;
  r integer;
  n integer;
  i integer;
  viagens_do_veiculo integer;
  dia date;
  ultimo_dia date;
  duracao integer;
  variacao integer;
  km numeric;
  hodometro numeric;
  hodometro_inicial numeric;
  litros numeric;
  preco_diesel numeric;
  vencimento date;
  pago boolean;
  mes date;
  dia_pagamento date;
  nova_viagem uuid;
  nova_movimentacao uuid;
  divida_atual uuid;
  cancelada boolean;
  inicio_viagem timestamptz;
  fim_viagem timestamptz;
  trecho text;

  total_viagens integer;
  total_movimentacoes integer;
begin
  -- 1. Reset. A ordem segue as FKs: quem aponta é apagado antes de quem é apontado.
  delete from viagem_revisao;
  delete from manutencao;
  delete from movimentacao;
  delete from divida;
  delete from viagem;
  delete from veiculo;
  delete from rota;

  -- 2. Catálogos. Um item padrão desativado em algum teste sumiria dos seletores.
  update categoria set ativa = true
  where (titulo, tipo) in (
    ('Frete', 'Entrada'), ('Combustível', 'Saida'), ('Pedágio', 'Saida'), ('Manutenção', 'Saida'),
    ('Salário', 'Saida'), ('Financiamento', 'Saida')
  );
  update forma_pagamento set ativa = true where nome in ('Pix', 'TED', 'Boleto', 'Cartão Corporativo');

  insert into categoria (titulo, tipo) values
    ('Seguro', 'Saida'), ('Aluguel', 'Saida'), ('Impostos', 'Saida'), ('Aporte de capital', 'Entrada'),
    ('Lavagem', 'Saida')
  on conflict (titulo, tipo) do nothing;
  -- Lavagem é desativada no fim, depois dos lançamentos antigos: mostra o soft delete (US01).
  update categoria set ativa = true
  where (titulo, tipo) in (
    ('Seguro', 'Saida'), ('Aluguel', 'Saida'), ('Impostos', 'Saida'), ('Aporte de capital', 'Entrada'),
    ('Lavagem', 'Saida')
  );

  -- "into strict" falha com mensagem clara se o item padrão não existir (migrations não aplicadas).
  select id into strict cat_frete from categoria where titulo = 'Frete' and tipo = 'Entrada';
  select id into strict cat_combustivel from categoria where titulo = 'Combustível' and tipo = 'Saida';
  select id into strict cat_pedagio from categoria where titulo = 'Pedágio' and tipo = 'Saida';
  select id into strict cat_manutencao from categoria where titulo = 'Manutenção' and tipo = 'Saida';
  select id into strict cat_salario from categoria where titulo = 'Salário' and tipo = 'Saida';
  select id into strict cat_financiamento from categoria where titulo = 'Financiamento' and tipo = 'Saida';
  select id into strict cat_seguro from categoria where titulo = 'Seguro' and tipo = 'Saida';
  select id into strict cat_aluguel from categoria where titulo = 'Aluguel' and tipo = 'Saida';
  select id into strict cat_impostos from categoria where titulo = 'Impostos' and tipo = 'Saida';
  select id into strict cat_aporte from categoria where titulo = 'Aporte de capital' and tipo = 'Entrada';
  select id into strict cat_lavagem from categoria where titulo = 'Lavagem' and tipo = 'Saida';

  select id into strict forma_pix from forma_pagamento where nome = 'Pix';
  select id into strict forma_ted from forma_pagamento where nome = 'TED';
  select id into strict forma_boleto from forma_pagamento where nome = 'Boleto';
  select id into strict forma_cartao from forma_pagamento where nome = 'Cartão Corporativo';

  select id into strict perfil_motorista from perfil where nome = 'Motorista';

  -- 3. Motoristas fictícios. A linha em auth.users dispara o handle_new_user, que cria o usuário
  -- como Motorista aguardando aprovação; aqui eles são aprovados (ou bloqueados). IDs fixos: rodar
  -- de novo reaproveita as mesmas contas.
  for i in 1..7 loop
    id_motorista[i] := ('5e000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;

    insert into auth.users (id, email, raw_user_meta_data)
    values (id_motorista[i], motorista_email[i], jsonb_build_object('full_name', motorista_nome[i]))
    on conflict (id) do nothing;

    insert into usuario (id, perfil_id, nome, email)
    values (id_motorista[i], perfil_motorista, motorista_nome[i], motorista_email[i])
    on conflict (id) do nothing;

    update usuario
    set perfil_id = perfil_motorista,
        nome = motorista_nome[i],
        status = case i when 6 then 'Bloqueado' when 7 then 'AguardandoAprovacao' else 'Ativo' end::status_usuario
    where id = id_motorista[i];
  end loop;

  -- 4. Frota e rotas, cadastradas no primeiro dia.
  for v in 1..6 loop
    id_veiculo[v] := ('5e100000-0000-4000-8000-' || lpad(v::text, 12, '0'))::uuid;
    insert into veiculo (
      id, placa, marca, modelo, capacidade_carga, ano_fabricacao, data_inclusao, data_atualizacao
    ) values (
      id_veiculo[v], veiculo_placa[v], veiculo_marca[v], veiculo_modelo[v], veiculo_capacidade[v],
      veiculo_ano[v], (inicio + time '08:00') at time zone fuso, (inicio + time '08:00') at time zone fuso
    );
  end loop;

  for r in 1..9 loop
    id_rota[r] := ('5e200000-0000-4000-8000-' || lpad(r::text, 12, '0'))::uuid;
    insert into rota (
      id, cidade_origem, uf_origem, cidade_destino, uf_destino, distancia_estimada_km, data_inclusao, data_atualizacao
    ) values (
      id_rota[r], rota_origem[r], rota_uf_origem[r], rota_destino[r], rota_uf_destino[r], rota_distancia[r],
      (inicio + time '08:30') at time zone fuso, (inicio + time '08:30') at time zone fuso
    );
  end loop;

  -- 5. Saldo de abertura: o caixa não começa em zero no dia em que a empresa adota o app.
  insert into movimentacao (
    categoria_id, forma_pagamento_id, valor, descricao, data_vencimento, data_pagamento, status_pagamento,
    data_inclusao
  ) values (
    cat_aporte, forma_ted, 85000.00, 'Saldo de abertura (migração da planilha)', inicio, inicio, 'Pago',
    (inicio + time '09:00') at time zone fuso
  );

  -- 6. Viagens. Cada veículo roda em sequência, sem sobrepor viagens, com o hodômetro sempre
  -- subindo (VG004). Os "sorteios" são contas com o número da viagem: o resultado é sempre o mesmo.
  for v in 1..6 loop
    dia := inicio + v;
    hodometro := veiculo_hodometro[v];
    viagens_do_veiculo := 0;
    -- Veículo 1: abre uma viagem agora (fica EmViagem). Veículo 4: entra em manutenção.
    -- Veículo 6: devolvido no meio do período (fica Inativo).
    ultimo_dia := case v when 1 then hoje - 3 when 4 then hoje - 5 when 6 then hoje - 37 else hoje - 1 end;
    k := 0;

    loop
      k := k + 1;
      r := 1 + ((v * 5 + k * 3) % 8);
      -- A rota desativada só aparece nas viagens antigas.
      if dia < hoje - 50 and v in (2, 5) and k % 4 = 0 then
        r := 9;
      end if;
      duracao := case when rota_distancia[r] > 500 then 2 else 1 end;
      exit when dia + duracao > ultimo_dia;

      variacao := ((v * 7 + k * 13) % 9) - 4;
      km := round(rota_distancia[r] * (1 + variacao / 100.0), 1);
      -- Deslocamento até o ponto de carga antes de começar a viagem.
      hodometro_inicial := hodometro + ((v + k) % 4) * 6;
      cancelada := (v * k) % 17 = 5;
      inicio_viagem := (dia + time '06:00' + make_interval(hours => v % 3)) at time zone fuso;
      fim_viagem := (dia + duracao + time '17:30') at time zone fuso;
      nova_viagem := ('5e300000-0000-4000-8000-' || lpad((v * 1000 + k)::text, 12, '0'))::uuid;
      trecho := rota_origem[r] || '/' || rota_uf_origem[r] || ' → ' || rota_destino[r] || '/' || rota_uf_destino[r];

      if cancelada then
        -- Cancelada antes de sair: não rodou, não tem hodômetro final nem lançamento.
        insert into viagem (
          id, veiculo_id, rota_id, motorista_id, hodometro_inicial, hodometro_final, data_inicio, data_fim, status,
          data_inclusao, data_atualizacao
        ) values (
          nova_viagem, id_veiculo[v], id_rota[r], id_motorista[v], hodometro_inicial, null, inicio_viagem,
          inicio_viagem + interval '2 hours', 'Cancelada', inicio_viagem, inicio_viagem + interval '2 hours'
        );
        hodometro := hodometro_inicial;
        dia := dia + 1;
        continue;
      end if;

      insert into viagem (
        id, veiculo_id, rota_id, motorista_id, hodometro_inicial, hodometro_final, data_inicio, data_fim, status,
        data_inclusao, data_atualizacao
      ) values (
        nova_viagem, id_veiculo[v], id_rota[r], id_motorista[v], hodometro_inicial, hodometro_inicial + km,
        inicio_viagem, fim_viagem, 'Finalizada', inicio_viagem, fim_viagem
      );
      hodometro := hodometro_inicial + km;
      viagens_do_veiculo := viagens_do_veiculo + 1;

      -- Diesel do trecho, com litros (obrigatório no combustível vinculado à viagem).
      litros := round(km / veiculo_km_por_litro[v], 2);
      preco_diesel := 6.09 + ((k * 7 + v) % 6) * 0.04;
      insert into movimentacao (
        categoria_id, forma_pagamento_id, viagem_id, valor, descricao, data_vencimento, data_pagamento,
        status_pagamento, litros, data_inclusao
      ) values (
        cat_combustivel, forma_cartao, nova_viagem, round(litros * preco_diesel, 2),
        'Diesel S10 — ' || veiculo_placa[v], dia, dia, 'Pago', litros, inicio_viagem
      );

      if rota_pedagio[r] > 0 then
        insert into movimentacao (
          categoria_id, forma_pagamento_id, viagem_id, valor, descricao, data_vencimento, data_pagamento,
          status_pagamento, data_inclusao
        ) values (
          cat_pedagio, forma_cartao, nova_viagem, rota_pedagio[r], 'Pedágios — ' || trecho, dia, dia, 'Pago',
          inicio_viagem
        );
      end if;

      -- Frete: o cliente paga 15 dias depois da entrega. Uma fatura do veículo 3 está atrasada.
      vencimento := dia + duracao + 15;
      pago := vencimento <= hoje and not (v = 3 and vencimento > hoje - 9);
      insert into movimentacao (
        categoria_id, forma_pagamento_id, viagem_id, valor, descricao, data_vencimento, data_pagamento,
        status_pagamento, data_inclusao
      ) values (
        cat_frete, case when k % 3 = 0 then forma_pix else forma_boleto end, nova_viagem,
        round(rota_distancia[r] * rota_frete_por_km[r] * (1 + (((k * 11 + v * 3) % 7) - 3) / 100.0), 2),
        'Frete ' || trecho, vencimento, case when pago then vencimento end,
        case when pago then 'Pago' else 'Pendente' end::status_pagamento, fim_viagem
      );

      dia := dia + duracao + 2 + ((v + k) % 3);

      -- A cada 6 viagens, uma manutenção preventiva no dia seguinte, com a despesa vinculada (US06-b).
      if viagens_do_veiculo % 6 = 0 and dia <= ultimo_dia then
        n := 1 + ((v + viagens_do_veiculo / 6) % 6);
        insert into movimentacao (
          categoria_id, forma_pagamento_id, valor, descricao, data_vencimento, data_pagamento, status_pagamento,
          data_inclusao
        ) values (
          cat_manutencao, forma_boleto, manutencao_valor[n],
          'Manutenção ' || veiculo_placa[v] || ': ' || manutencao_descricao[n], dia, dia, 'Pago',
          (dia + time '08:00') at time zone fuso
        )
        returning id into nova_movimentacao;

        insert into manutencao (
          veiculo_id, descricao, data_manutencao, valor, hodometro, movimentacao_id, data_conclusao, data_inclusao,
          data_atualizacao
        ) values (
          id_veiculo[v], manutencao_descricao[n], dia, manutencao_valor[n], hodometro, nova_movimentacao,
          (dia + time '18:00') at time zone fuso, (dia + time '08:00') at time zone fuso,
          (dia + time '18:00') at time zone fuso
        );
        dia := dia + 1;
      end if;
    end loop;
  end loop;

  -- Viagem em andamento agora: Campinas → Belo Horizonte, saiu ontem. O trigger põe o veículo
  -- EmViagem. Já tem o diesel lançado; o frete entra quando ela fechar.
  select max(hodometro_final) into hodometro from viagem where veiculo_id = id_veiculo[1];
  inicio_viagem := (hoje - 1 + time '07:00') at time zone fuso;
  nova_viagem := '5e300000-0000-4000-8000-000000999999';
  insert into viagem (
    id, veiculo_id, rota_id, motorista_id, hodometro_inicial, data_inicio, status, data_inclusao, data_atualizacao
  ) values (
    nova_viagem, id_veiculo[1], id_rota[2], id_motorista[1], hodometro + 12, inicio_viagem, 'EmAndamento',
    inicio_viagem, inicio_viagem
  );
  insert into movimentacao (
    categoria_id, forma_pagamento_id, viagem_id, valor, descricao, data_vencimento, data_pagamento,
    status_pagamento, litros, data_inclusao
  ) values (
    cat_combustivel, forma_cartao, nova_viagem, 1474.20, 'Diesel S10 — ' || veiculo_placa[1], hoje - 1, hoje - 1,
    'Pago', 240.00, inicio_viagem
  );

  -- Manutenção aberta no veículo 4: retífica do motor, boleto para daqui a 12 dias.
  select max(hodometro_final) into hodometro from viagem where veiculo_id = id_veiculo[4];
  insert into movimentacao (
    categoria_id, forma_pagamento_id, valor, descricao, data_vencimento, status_pagamento, data_inclusao
  ) values (
    cat_manutencao, forma_boleto, 18450.00, 'Manutenção ' || veiculo_placa[4] || ': Retífica do motor',
    hoje + 12, 'Pendente', (hoje - 3 + time '08:00') at time zone fuso
  )
  returning id into nova_movimentacao;
  insert into manutencao (
    veiculo_id, descricao, data_manutencao, valor, hodometro, movimentacao_id, data_inclusao, data_atualizacao
  ) values (
    id_veiculo[4], 'Retífica do motor', hoje - 3, 18450.00, hodometro, nova_movimentacao,
    (hoje - 3 + time '08:00') at time zone fuso, (hoje - 3 + time '08:00') at time zone fuso
  );
  update veiculo set status = 'EmManutencao' where id = id_veiculo[4];

  -- Veículo 6 devolvido ao fim do leasing; o motorista dele saiu da empresa.
  update veiculo set status = 'Inativo' where id = id_veiculo[6];
  insert into movimentacao (
    categoria_id, forma_pagamento_id, valor, descricao, data_vencimento, data_pagamento, status_pagamento,
    data_inclusao
  ) values (
    cat_salario, forma_ted, 9870.40, 'Rescisão — ' || motorista_nome[6], hoje - 35, hoje - 35, 'Pago',
    (hoje - 35 + time '10:00') at time zone fuso
  );

  -- Rota desativada depois das viagens antigas (soft delete da US07).
  update rota set ativa = false where id = id_rota[9];

  -- 7. Despesas fixas mensais: do primeiro mês até 2 meses à frente. Vencidas ficam pagas no dia;
  -- as futuras ficam pendentes e alimentam a projeção de caixa.
  mes := date_trunc('month', inicio)::date;
  while mes <= (date_trunc('month', hoje) + interval '2 months')::date loop
    -- Salário no 5º dia, um lançamento por motorista.
    dia_pagamento := mes + 4;
    if dia_pagamento >= inicio then
      for i in 1..6 loop
        continue when i = 6 and dia_pagamento > hoje - 37;
        insert into movimentacao (
          categoria_id, forma_pagamento_id, valor, descricao, data_vencimento, data_pagamento, status_pagamento,
          data_inclusao
        ) values (
          cat_salario, forma_ted, motorista_salario[i], 'Salário — ' || motorista_nome[i], dia_pagamento,
          case when dia_pagamento <= hoje then dia_pagamento end,
          case when dia_pagamento <= hoje then 'Pago' else 'Pendente' end::status_pagamento,
          (least(dia_pagamento, hoje) + time '09:00') at time zone fuso
        );
      end loop;
    end if;

    dia_pagamento := mes + 9;
    if dia_pagamento >= inicio then
      insert into movimentacao (
        categoria_id, forma_pagamento_id, valor, descricao, data_vencimento, data_pagamento, status_pagamento,
        data_inclusao
      ) values (
        cat_aluguel, forma_boleto, 6800.00, 'Aluguel do pátio — Guarulhos', dia_pagamento,
        case when dia_pagamento <= hoje then dia_pagamento end,
        case when dia_pagamento <= hoje then 'Pago' else 'Pendente' end::status_pagamento,
        (least(dia_pagamento, hoje) + time '09:00') at time zone fuso
      );
    end if;

    dia_pagamento := mes + 14;
    if dia_pagamento >= inicio then
      insert into movimentacao (
        categoria_id, forma_pagamento_id, valor, descricao, data_vencimento, data_pagamento, status_pagamento,
        data_inclusao
      ) values (
        cat_seguro, forma_boleto, 5240.00, 'Seguro da frota — parcela mensal', dia_pagamento,
        case when dia_pagamento <= hoje then dia_pagamento end,
        case when dia_pagamento <= hoje then 'Pago' else 'Pendente' end::status_pagamento,
        (least(dia_pagamento, hoje) + time '09:00') at time zone fuso
      );
    end if;

    dia_pagamento := mes + 19;
    if dia_pagamento >= inicio then
      insert into movimentacao (
        categoria_id, forma_pagamento_id, valor, descricao, data_vencimento, data_pagamento, status_pagamento,
        data_inclusao
      ) values (
        cat_impostos, forma_boleto, 9800.00 + (extract(month from mes)::int % 3) * 730.00,
        'Simples Nacional (DAS)', dia_pagamento,
        case when dia_pagamento <= hoje then dia_pagamento end,
        case when dia_pagamento <= hoje then 'Pago' else 'Pendente' end::status_pagamento,
        (least(dia_pagamento, hoje) + time '09:00') at time zone fuso
      );
    end if;

    mes := (mes + interval '1 month')::date;
  end loop;

  -- Lavagem da frota nos primeiros meses; depois a categoria foi desativada (os lançamentos ficam).
  for i in 0..2 loop
    dia_pagamento := inicio + 6 + i * 14;
    insert into movimentacao (
      categoria_id, forma_pagamento_id, valor, descricao, data_vencimento, data_pagamento, status_pagamento,
      data_inclusao
    ) values (
      cat_lavagem, forma_pix, 680.00, 'Lavagem da frota', dia_pagamento, dia_pagamento, 'Pago',
      (dia_pagamento + time '11:00') at time zone fuso
    );
  end loop;
  update categoria set ativa = false where id = cat_lavagem;

  -- 8. Dívidas, no formato que a RPC criar_divida grava: a dívida e uma parcela por mês, com a
  -- mesma descrição. As parcelas vencidas foram pagas no dia.

  -- Financiamento do Scania: 48 parcelas, a primeira no dia 25 do primeiro mês.
  divida_atual := '5e400000-0000-4000-8000-000000000001';
  insert into divida (
    id, categoria_id, descricao, quantidade_parcelas, valor_parcela, data_vencimento_primeira, data_inclusao,
    data_atualizacao
  ) values (
    divida_atual, cat_financiamento, 'Financiamento Scania R 450 (QKP7E58)', 48, 6890.00,
    date_trunc('month', inicio)::date + 24, (inicio + time '10:00') at time zone fuso,
    (inicio + time '10:00') at time zone fuso
  );

  -- Capital de giro: 12 parcelas a partir do dia 8 do segundo mês, com quitação antecipada.
  insert into divida (
    id, categoria_id, descricao, quantidade_parcelas, valor_parcela, data_vencimento_primeira,
    valor_quitacao_antecipada, data_inclusao, data_atualizacao
  ) values (
    '5e400000-0000-4000-8000-000000000002', cat_financiamento, 'Capital de giro — Banco do Brasil', 12, 2450.00,
    (date_trunc('month', inicio) + interval '1 month')::date + 7, 26800.00,
    (inicio + time '10:30') at time zone fuso, (inicio + time '10:30') at time zone fuso
  );

  -- Consórcio de pneus: excluído depois de 2 parcelas pagas. A exclusão apaga as pendentes e
  -- desativa a dívida (excluir_divida); as pagas ficam no histórico.
  insert into divida (
    id, categoria_id, descricao, quantidade_parcelas, valor_parcela, data_vencimento_primeira, ativa,
    data_inclusao, data_atualizacao
  ) values (
    '5e400000-0000-4000-8000-000000000003', cat_financiamento, 'Consórcio de pneus', 10, 980.00,
    inicio + 5, false, (inicio + time '11:00') at time zone fuso, (inicio + time '11:00') at time zone fuso
  );

  -- Compra de 8 pneus em 6 vezes, fechada esta semana: só parcelas futuras.
  insert into divida (
    id, categoria_id, descricao, quantidade_parcelas, valor_parcela, data_vencimento_primeira, data_inclusao,
    data_atualizacao
  ) values (
    '5e400000-0000-4000-8000-000000000004', cat_financiamento, 'Compra de 8 pneus — Pneus Rodovia', 6, 1520.00,
    hoje + 8, (hoje - 2 + time '15:00') at time zone fuso, (hoje - 2 + time '15:00') at time zone fuso
  );

  insert into movimentacao (
    categoria_id, forma_pagamento_id, divida_id, valor, descricao, data_vencimento, data_pagamento,
    status_pagamento, data_inclusao
  )
  select
    d.categoria_id,
    case when d.descricao like 'Capital%' then forma_ted else forma_boleto end,
    d.id,
    d.valor_parcela,
    d.descricao,
    p.vencimento,
    case when p.vencimento <= hoje then p.vencimento end,
    case when p.vencimento <= hoje then 'Pago' else 'Pendente' end::status_pagamento,
    d.data_inclusao
  from divida d
  cross join lateral (
    select (d.data_vencimento_primeira + make_interval(months => s))::date as vencimento
    from generate_series(0, d.quantidade_parcelas - 1) as s
  ) p
  -- Da dívida excluída sobram só as 2 primeiras parcelas, pagas.
  where d.ativa or p.vencimento <= d.data_vencimento_primeira + interval '1 month';

  select count(*) into total_viagens from viagem;
  select count(*) into total_movimentacoes from movimentacao;
  raise notice 'simulacao-3-meses.sql: % viagens e % movimentações gravadas, de % até hoje (%).',
    total_viagens, total_movimentacoes, inicio, hoje;
end;
$$;
