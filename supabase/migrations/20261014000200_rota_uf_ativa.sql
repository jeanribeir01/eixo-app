-- EIX-75: o que a US07 (EIX-38) pede de `rota` e o schema da EIX-27 não cobria — UF de
-- origem e destino, soft delete, bloqueio de rota duplicada e o fim do delete físico.
--
-- Antes do `db push`, confira na nuvem que não há rota cadastrada:
--   select count(*) from rota; (deve ser 0)
-- As colunas de UF nascem `not null` sem default: não dá para adivinhar o estado de uma
-- rota antiga pelo nome da cidade, e um default (ex.: 'SP') gravaria dado falso. Em
-- 14/10/2026 a nuvem tinha 0 rotas e 0 viagens, então não há backfill a fazer. Se houver
-- linha, o `add column` falha e nada é aplicado — preencha as UFs à mão antes.

-- UF como enum, e não `char(2)` + check: o `supabase gen types` exporta o enum como union
-- TypeScript e como lista em `Constants`, então o seletor das 27 UFs da tela (EIX-38) usa
-- exatamente a lista do banco, sem uma segunda cópia digitada no app. A lista de UFs não
-- muda; o custo de alterar um enum não pesa aqui.
create type uf as enum (
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
);

alter table rota add column uf_origem uf not null;
alter table rota add column uf_destino uf not null;

-- Soft delete, mesmo padrão de categoria: a rota inativa some do seletor da viagem, mas
-- as viagens antigas continuam apontando para ela.
alter table rota add column ativa boolean not null default true;

-- Cidade gravada sem espaço sobrando, como a placa em `veiculo_placa_normalizada`: o banco
-- rejeita " Curitiba" ou "São  Paulo" e o cliente normaliza antes de enviar (trim e espaços
-- repetidos viram um). Vazio também é rejeitado.
alter table rota add constraint rota_cidade_origem_normalizada check (
  cidade_origem = btrim(regexp_replace(cidade_origem, '\s+', ' ', 'g')) and cidade_origem <> ''
);
alter table rota add constraint rota_cidade_destino_normalizada check (
  cidade_destino = btrim(regexp_replace(cidade_destino, '\s+', ' ', 'g')) and cidade_destino <> ''
);

-- Mesma origem + destino é a mesma rota, sem diferenciar maiúscula de minúscula
-- ("Curitiba" e "curitiba"). O sentido importa: São Paulo → Curitiba e Curitiba → São Paulo
-- são rotas diferentes. Vale também para rota inativa: em vez de cadastrar de novo, o
-- usuário reativa a antiga (o histórico de viagens fica numa rota só).
-- Limite conhecido: acento não é normalizado ("Sao Paulo" e "São Paulo" viram duas rotas).
create unique index rota_trecho_unico
  on rota (lower(cidade_origem), uf_origem, lower(cidade_destino), uf_destino);

-- Rota com viagem no histórico nunca é apagada; sai de circulação com `ativa = false`,
-- como veiculo (EIX-56) e categoria. Sem policy, o RLS rejeita o delete de qualquer perfil
-- (0 linhas afetadas), inclusive Admin.
drop policy rota_delete on rota;
