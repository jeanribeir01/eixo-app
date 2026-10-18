-- EIX-39 (US06-b): o formulário de manutenção tem um seletor de Forma de Pagamento, e quem
-- registra manutenção é o Gestor de Frota (`registrar_manutencao` aceita Admin e Gestor). A
-- `forma_pagamento_select` da EIX-27 (20260924000500_rls.sql) só libera Admin e Financeiro,
-- então o seletor do Gestor vinha vazio e a manutenção não tinha como ser salva.
--
-- Exceção estreita à regra "Gestor não tem área financeira" (AD-011): só leitura e só das
-- formas ativas, que é o que o seletor mostra. Forma inativa a RPC já recusa (22023). O
-- Gestor continua sem gravar `forma_pagamento` e sem ler `movimentacao`, `divida` e
-- `categoria`: a categoria "Manutenção" a RPC acha sozinha, como `security definer`.
--
-- Policy nova em vez de trocar a `forma_pagamento_select`: policies permissivas somam com
-- OR, então Admin e Financeiro continuam lendo todas, inclusive as inativas. Usuário pendente
-- ou bloqueado continua sem ver nada, porque `auth_perfil()` devolve nulo para ele.
create policy forma_pagamento_select_gestor on forma_pagamento
  for select to authenticated
  using (auth_perfil() = 'Gestor de Frota' and ativa);
