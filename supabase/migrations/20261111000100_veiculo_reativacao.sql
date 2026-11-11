-- EIX-81: reativar um veículo Inativo devolve o status real dele, não sempre Disponivel.
--
-- Um veículo pode ser inativado com viagem ou manutenção em aberto: a edição deixa trocar o
-- status livremente (menos para Inativo), e `concluir_manutencao` e `sincroniza_status_veiculo`
-- já preveem um veículo "inativado no meio do caminho". Se a reativação gravasse Disponivel
-- nesse caso, o trigger da viagem (VG002) e a `registrar_manutencao` (MN001) deixariam de
-- enxergar o que está aberto: abriria viagem com o caminhão na oficina, ou manutenção com ele
-- na estrada.
--
-- A regra mora num trigger, e não só no filtro do repositório, porque o app fala direto com o
-- PostgREST (CLAUDE.md §3): um PATCH em `veiculo` passa por aqui do mesmo jeito.
--
-- Por que corrigir o status em vez de recusar a reativação: o objetivo da EIX-81 é desfazer uma
-- inativação feita por engano. Recusar deixaria o veículo preso em Inativo até alguém encerrar a
-- viagem ou a manutenção — e as duas coisas exigem o veículo ativo. Voltando como EmViagem ou
-- EmManutencao, os triggers e RPCs existentes o devolvem a Disponivel quando a última pendência
-- fechar, como fariam se ele nunca tivesse sido inativado.
--
-- Não lança erro novo: o repositório não precisa traduzir código nenhum.

-- `security definer`: quem reativa (Admin ou Gestor de Frota) enxerga viagens e manutenções
-- pelo RLS, mas a regra não pode depender disso — se uma policy mudar, a reativação não pode
-- passar a "não ver" uma viagem aberta.
create function corrige_status_reativacao_veiculo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Viagem tem prioridade: o caminhão está na estrada agora. É também o caso que o
  -- `sincroniza_status_veiculo` sabe desfazer ao fim da viagem (só devolve se EmViagem).
  if exists (
    select 1 from viagem v where v.veiculo_id = new.id and v.status = 'EmAndamento'
  ) then
    new.status := 'EmViagem';
  elsif exists (
    select 1 from manutencao m where m.veiculo_id = new.id and m.data_conclusao is null
  ) then
    new.status := 'EmManutencao';
  else
    new.status := 'Disponivel';
  end if;

  return new;
end;
$$;

-- Só a saída de Inativo passa pelo trigger. As outras trocas de status (abrir e fechar viagem,
-- registrar e concluir manutenção, inativar) seguem como antes.
-- O UPDATE já trava a linha do veículo, o mesmo lock que `valida_viagem` e
-- `registrar_manutencao` pegam: uma viagem não abre no meio desta conta.
create trigger veiculo_corrige_status_reativacao
  before update of status on veiculo
  for each row
  when (old.status = 'Inativo' and new.status <> 'Inativo')
  execute function corrige_status_reativacao_veiculo();
