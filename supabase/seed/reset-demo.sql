-- EIX-53: limpa o caixa para regravar o vídeo de demonstração.
--
-- ATENÇÃO: apaga TODAS as movimentações e TODAS as dívidas do projeto, inclusive as que o time
-- lançou para testar. O projeto de nuvem é um só para todos (AD-003): avise o grupo antes de rodar.
--
-- Como usar: Supabase → SQL Editor → cole este arquivo inteiro → Run. Depois, rode o demo.sql.
--
-- Fica como está: usuários, perfis, categorias, formas de pagamento, veículos, rotas e viagens.
--
-- É um delete físico de propósito, e só aqui: no app, dívida e catálogos usam soft delete. Uma
-- dívida apenas desativada continuaria no banco e o vídeo não começaria do zero.
--
-- Os arquivos de comprovante continuam no Storage (bucket "comprovantes"): arquivo só é removido
-- de verdade pela API do Storage, não por SQL. Se quiser limpá-los, apague pelo painel em
-- Storage → comprovantes.
--
-- Tudo roda num bloco só: se algo falhar, nada é apagado.

do $$
declare
  movimentacoes_apagadas integer;
  dividas_apagadas integer;
  comprovantes integer;
begin
  -- Manutenção aponta para a despesa que gerou (US06-b). Apagar a despesa quebraria esse vínculo:
  -- melhor parar e avisar do que mexer em dado da frota.
  if exists (select 1 from manutencao where movimentacao_id is not null) then
    raise exception 'Há manutenções ligadas a movimentações. Remova essas manutenções antes de rodar o reset.';
  end if;

  select count(*) into comprovantes from movimentacao where caminho_comprovante is not null;

  -- Parcelas antes das dívidas: movimentacao.divida_id aponta para divida.
  delete from movimentacao;
  get diagnostics movimentacoes_apagadas = row_count;

  delete from divida;
  get diagnostics dividas_apagadas = row_count;

  raise notice 'reset-demo.sql: % movimentações e % dívidas apagadas; % comprovantes ficaram no Storage.',
    movimentacoes_apagadas, dividas_apagadas, comprovantes;
end;
$$;
