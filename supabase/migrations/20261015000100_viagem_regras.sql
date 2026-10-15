-- EIX-76: as regras de `viagem` que a US08 (EIX-40) e o sync offline (EIX-41) pedem.
--
-- As regras moram em trigger e índice, não em RPC: o sync sobe a viagem como `upsert`
-- (`insert ... on conflict (id) do update`) direto na tabela, e um trigger vale igual para a
-- escrita online e para a que chega da outbox. Uma RPC obrigaria o sync a conhecer duas
-- formas de escrever.
--
-- Antes do `db push`, confira na nuvem que nenhum veículo tem duas viagens abertas (senão a
-- criação do índice falha e nada é aplicado):
--   select veiculo_id, count(*) from viagem where status = 'EmAndamento'
--   group by veiculo_id having count(*) > 1; (deve voltar vazio)
-- Em 14/10/2026 a nuvem tinha 0 viagens.
--
-- Erros que os triggers lançam e o repositório da EIX-40 traduz para português (o texto do
-- banco nunca chega ao usuário):
--   VG001  veículo já está em outra viagem em andamento
--   23505  mesma regra, pelo índice único (só aparece se o trigger for contornado)
--   VG002  veículo em manutenção
--   VG003  veículo inativo
--   VG004  hodômetro inicial menor que o último hodômetro final do veículo
--   VG005  viagem encerrada (Finalizada ou Cancelada) não pode ser alterada
--   VG006  veículo da viagem não pode ser trocado
-- Os códigos VG*** são nossos, no mesmo esquema dos MN*** da manutenção: classe "VG"
-- (viagem) fica na faixa que o padrão SQL deixa livre para a aplicação.

-- Última barreira da regra "um veículo, uma viagem em andamento": vale mesmo se duas
-- gravações chegarem juntas ou se alguém desligar os triggers.
create unique index viagem_um_andamento_por_veiculo on viagem (veiculo_id)
  where status = 'EmAndamento';

-- Km rodado calculado pelo banco, para a tela da viagem e as views de custo por km (US10)
-- lerem pronto. Nulo enquanto a viagem está aberta (final nulo). O app não envia esta coluna
-- no insert nem no upsert: o Postgres rejeita valor escrito à mão em coluna gerada (428C9).
alter table viagem
  add column km_rodado numeric(12, 1) generated always as (hodometro_final - hodometro_inicial) stored;

-- `security definer`: o Motorista só enxerga as próprias viagens pelo RLS, mas a regra
-- precisa olhar as viagens de todos os motoristas daquele veículo.
create or replace function valida_viagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status_veiculo_atual status_veiculo;
  ultimo_hodometro_final numeric(12, 1);
begin
  if tg_op = 'INSERT' then
    -- No upsert, o Postgres roda este trigger de insert mesmo quando o `id` já existe, e em
    -- seguida transforma a gravação num update. Quem julga esse caso é o ramo de update;
    -- validar aqui rejeitaria o reenvio de uma viagem aberta por causa dela mesma.
    if exists (select 1 from viagem v where v.id = new.id) then
      return new;
    end if;

    -- Trava o veículo: duas aberturas ao mesmo tempo no mesmo veículo ficam em fila, e a
    -- segunda já enxerga a primeira. É o mesmo lock que `registrar_manutencao` usa.
    select v.status into status_veiculo_atual from veiculo v where v.id = new.veiculo_id for update;

    -- Disponibilidade só vale para quem abre viagem agora. Viagem que já chega encerrada
    -- (registro retroativo, ou o sync subindo abrir + fechar numa operação só) aconteceu no
    -- passado, e o status de hoje do veículo não diz nada sobre ela.
    if new.status = 'EmAndamento' then
      if exists (
        select 1 from viagem v
        where v.veiculo_id = new.veiculo_id and v.status = 'EmAndamento'
      ) then
        raise exception 'Veículo já está em uma viagem em andamento.' using errcode = 'VG001';
      end if;

      if status_veiculo_atual = 'EmManutencao' then
        raise exception 'Veículo em manutenção não pode sair em viagem.' using errcode = 'VG002';
      end if;

      if status_veiculo_atual = 'Inativo' then
        raise exception 'Veículo inativo não pode sair em viagem.' using errcode = 'VG003';
      end if;
    end if;
  else
    -- Trocar o veículo exigiria liberar um e prender outro no mesmo passo. Para corrigir,
    -- cancela a viagem e abre outra no veículo certo.
    if new.veiculo_id is distinct from old.veiculo_id then
      raise exception 'O veículo de uma viagem não pode ser trocado.' using errcode = 'VG006';
    end if;

    -- Viagem encerrada é histórico: reabrir ou mexer no hodômetro furaria a regra de
    -- hodômetro das viagens seguintes. Também é o que impede um reenvio atrasado do sync
    -- ("abrir") de reabrir uma viagem já fechada. Regravar os mesmos valores passa, porque
    -- o sync pode reenviar o fechamento.
    if old.status <> 'EmAndamento' and (
      new.status is distinct from old.status
      or new.hodometro_inicial is distinct from old.hodometro_inicial
      or new.hodometro_final is distinct from old.hodometro_final
    ) then
      raise exception 'Viagem encerrada não pode ser alterada.' using errcode = 'VG005';
    end if;

    if new.hodometro_inicial is not distinct from old.hodometro_inicial then
      return new;
    end if;

    -- Mesmo lock do insert: uma viagem que fecha no meio desta conta não escapa da comparação.
    perform 1 from veiculo v where v.id = new.veiculo_id for update;
  end if;

  -- O "último" hodômetro final é o maior: hodômetro só sobe, e `data_fim` é opcional e vem do
  -- relógio do celular. Entra viagem de qualquer status, inclusive Cancelada que chegou a
  -- rodar (final preenchido). Igual é aceito: o caminhão sai de onde parou.
  select max(v.hodometro_final) into ultimo_hodometro_final
  from viagem v
  where v.veiculo_id = new.veiculo_id and v.id <> new.id;

  if new.hodometro_inicial < ultimo_hodometro_final then
    raise exception 'Hodômetro inicial % menor que o último hodômetro final do veículo (%).',
      new.hodometro_inicial, ultimo_hodometro_final
      using errcode = 'VG004';
  end if;

  return new;
end;
$$;

create trigger viagem_valida
  before insert or update on viagem
  for each row execute function valida_viagem();

-- O status do veículo acompanha a viagem. `security definer` porque o Motorista abre e fecha
-- a própria viagem, mas não tem policy de update em `veiculo`.
-- É trigger `after`: só roda quando a linha foi gravada de fato. No upsert de uma viagem que
-- já existe, o `after insert` não dispara (a gravação virou update), e o `after update` só
-- age na transição EmAndamento → encerrada; reenviar o mesmo estado não mexe no veículo.
create or replace function sincroniza_status_veiculo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Viagem que já chega encerrada não ocupa o veículo.
    if new.status = 'EmAndamento' then
      update veiculo v set status = 'EmViagem' where v.id = new.veiculo_id;
    end if;
  elsif old.status = 'EmAndamento' and new.status <> 'EmAndamento' then
    -- Só devolve se ele ainda está EmViagem: um veículo inativado durante a viagem continua
    -- Inativo (mesmo cuidado da `concluir_manutencao`).
    update veiculo v set status = 'Disponivel'
    where v.id = new.veiculo_id and v.status = 'EmViagem';
  end if;

  return null;
end;
$$;

create trigger viagem_sincroniza_status_veiculo
  after insert or update of status on viagem
  for each row execute function sincroniza_status_veiculo();

-- Viagem com hodômetro é histórico: o custo por km (US10) e a regra "hodômetro não regride"
-- dependem dela. O caminho de desfazer é Cancelada. Sem policy, o RLS rejeita o delete de
-- qualquer perfil (0 linhas afetadas), inclusive Admin — mesmo padrão de `veiculo` (EIX-56).
drop policy viagem_delete on viagem;
