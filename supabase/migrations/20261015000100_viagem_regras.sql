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
-- Os códigos VG*** são nossos, no mesmo esquema dos MN*** da manutenção: classe "VG"
-- (viagem) fica na faixa que o padrão SQL deixa livre para a aplicação.

-- Última barreira da regra "um veículo, uma viagem em andamento": vale mesmo se duas
-- gravações chegarem juntas ou se alguém desligar os triggers.
create unique index viagem_um_andamento_por_veiculo on viagem (veiculo_id)
  where status = 'EmAndamento';

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
  end if;

  return new;
end;
$$;

create trigger viagem_valida
  before insert or update on viagem
  for each row execute function valida_viagem();
