-- EIX-75: rota duplicada passa a ignorar acento, além de maiúscula/minúscula. Antes,
-- "São Paulo" e "Sao Paulo" viravam duas rotas (limite registrado em 20261014000200, que já
-- estava aplicada na nuvem — por isso a troca do índice vem numa migration nova).
--
-- Antes do `db push`, confira na nuvem que não há rota que só difere por acento (senão a
-- criação do índice falha e nada é aplicado):
--   select normaliza_cidade(cidade_origem), uf_origem, normaliza_cidade(cidade_destino), uf_destino, count(*)
--   from rota group by 1, 2, 3, 4 having count(*) > 1; (deve voltar vazio — rode depois de criar a função)
-- Em 14/10/2026 a nuvem tinha 0 rotas.

-- `translate` em vez da extensão `unaccent`: é nativo do Postgres, então roda igual na nuvem
-- e no PGlite dos testes, sem habilitar extensão. Também é `immutable`, que é o que o índice
-- exige (a `unaccent()` da extensão não é, e precisaria de uma função embrulhando). A mesma
-- troca de letras é fácil de repetir em TypeScript se o app quiser avisar antes de enviar.
-- As maiúsculas acentuadas estão na lista de propósito: o `lower()` só converte letra
-- acentuada quando o banco usa um locale UTF-8, e assim a regra não depende disso.
-- As duas listas têm o mesmo tamanho: cada letra da primeira vira a da mesma posição na segunda.
create function normaliza_cidade(cidade text)
returns text
language sql
immutable
parallel safe
as $$
  select translate(
    lower(cidade),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
$$;

-- Mesma regra de antes (sentido importa, rota inativa também bloqueia), agora sem acento.
drop index rota_trecho_unico;
create unique index rota_trecho_unico
  on rota (normaliza_cidade(cidade_origem), uf_origem, normaliza_cidade(cidade_destino), uf_destino);
