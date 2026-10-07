-- EIX-33 (US03): regras de movimentacao que o formulário valida e o banco precisa garantir
-- também (AGENTS.md §2.4), porque o app fala direto com o PostgREST.

-- Valor zero não é lançamento: a constraint da EIX-27 aceitava `valor >= 0`.
-- Antes do `db push`, confira na nuvem: select count(*) from movimentacao where valor <= 0; (deve ser 0)
alter table movimentacao drop constraint movimentacao_valor_nao_negativo;
alter table movimentacao add constraint movimentacao_valor_positivo check (valor > 0);

-- Parcela de dívida pertence à dívida (US04): só some quando a dívida é excluída, pela
-- function da EIX-36, que roda fora do RLS. Pela API, delete de parcela afeta 0 linhas.
drop policy movimentacao_delete on movimentacao;
create policy movimentacao_delete on movimentacao
  for delete to authenticated
  using (auth_perfil() in ('Admin', 'Financeiro') and divida_id is null);
