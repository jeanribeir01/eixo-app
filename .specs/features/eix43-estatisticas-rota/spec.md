# EIX-43 · US10 — Motor de estatísticas de rota e custo por KM

## Problem Statement

Desde a US09 (EIX-42) cada lançamento pode apontar para uma viagem, e o Combustível guarda os litros. Ainda falta transformar isso em número: o gestor não sabe quanto cada viagem deu de lucro, quanto custa rodar um KM em cada rota ou veículo, nem quanto cada caminhão faz por litro. O cálculo cruza Caixa e Frota, que o RLS separa (o Gestor de Frota não lê `movimentacao`, e o Financeiro não lê `viagem`). As US11, US12 e US13 vão ler destes números.

## Goals

- [ ] Admin, Gestor de Frota e Financeiro obtêm, em uma chamada, a rentabilidade, o R$/KM e o KM/L de cada viagem do período.
- [ ] As mesmas três funções entregam a consolidação por rota (com "Rota Mais Lucrativa" e "Rota com Maior Custo de Operação") e por veículo (R$/KM acumulado), já ordenadas para o ranking da US13.
- [ ] Nenhuma divisão por zero chega ao app como `Infinity`, `NaN` ou erro: o banco devolve nulo, e o app mostra `—`.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Tela de estatísticas, ranking ou gráfico | Os arquivos da task são a migration e `src/features/bi/queries.ts`. As telas são da US11, US12 e US13 |
| Despesas de manutenção no R$/KM do veículo | Decidido com o usuário em 13/11/2026: o veículo usa só as Saídas vinculadas às viagens dele |
| Offline das estatísticas | O offline obrigatório (RNF01) é viagem e hodômetro. Estatística é leitura online, como os KPIs |
| View materializada e agendamento de refresh | O volume do projeto cabe numa consulta comum com índice. Fica para quando o RNF06 (< 2s) falhar |
| Detalhe de uma rota ou de um veículo | Nenhum AC pede. A US13 decide o que o toque abre |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Quem chama as funções | Admin, Gestor de Frota e Financeiro. Motorista e usuário não aprovado recebem `42501` | Decidido com o usuário em 13/11/2026 | y |
| Como o Gestor e o Financeiro leem o que o RLS esconde | RPCs `security definer` com checagem de `auth_perfil()` no início, devolvendo só agregados (sem lançamento, hodômetro ou motorista). As policies não mudam | Mesmo molde da AD-013 e da AD-014 | y |
| Pago ou pendente | Entram todas as movimentações vinculadas, pagas e pendentes (regime de competência) | Decidido com o usuário em 13/11/2026: o frete a receber já pertence à viagem | y |
| "Rota Mais Lucrativa" | A rota com a maior soma de rentabilidade das viagens finalizadas do período | Decidido com o usuário em 13/11/2026 | y |
| "Rota com Maior Custo de Operação" | A rota com o maior R$/KM (Saídas somadas ÷ KM somados das viagens finalizadas) | Decidido com o usuário em 13/11/2026: compara rotas de tamanhos diferentes de forma justa | y |
| Quilometragem Rodada | `hodometro_final − hodometro_inicial` da viagem (US08). Sem `hodometro_final`, a viagem não tem KM | É a definição da US08. O banco já garante `hodometro_final > hodometro_inicial` | y |
| Viagens que entram | Por viagem: `EmAndamento` e `Finalizada`. Consolidação por rota e por veículo: só `Finalizada`. `Cancelada` nunca entra | A viagem em andamento tem lançamentos mas não tem KM; somá-la à rota misturaria lucro sem KM com KM sem lucro | n |
| Período | As três funções recebem `data_inicial` e `data_final` (ISO, inclusivas) e filtram pelo dia de início da viagem no fuso do Brasil (`data_inicio`, ou `data_inclusao` se o celular não mandou). Recusam com `22023` data vazia, intervalo invertido e mais de 366 dias | Mesmas regras e mensagens das RPCs de KPI (EIX-44), para a US13 reaproveitar o `FiltroPeriodo` e o `periodoCustomizadoSchema`. O início existe em toda viagem; o fim, não | n |
| Unidades devolvidas | Dinheiro em centavos inteiros (`bigint`): receita, despesa, rentabilidade e R$/KM (`custo_por_km_centavos`, arredondado ao centavo). KM com 1 casa e litros com 2, como as colunas. KM/L arredondado a 2 casas | CLAUDE.md §5: dinheiro no cliente é inteiro em centavos | y |
| Divisão por zero | R$/KM é nulo quando não há KM; KM/L é nulo quando não há KM ou a soma de litros é nula ou zero. O app formata nulo como `—` | AC da task. O banco nunca divide por zero, então não há `Infinity` nem erro | y |
| Viagem sem lançamento vinculado | Receita, despesa e rentabilidade valem 0. Com KM, o R$/KM vale 0; o KM/L é nulo (não há litros) | É o que a fórmula dá. Zero de despesa é um dado, falta de litros não é | n |
| Empate no destaque e na ordem | Rotas: maior lucro, depois maior KM total, depois origem e destino em ordem alfabética. Veículos: maior R$/KM (nulos no fim), depois maior KM total, depois placa | Ordem determinística: a mesma chamada sempre devolve a mesma lista (a US13 testa empate) | n |
| Lucro negativo | A rota com o maior lucro é a "Mais Lucrativa" mesmo se o lucro for negativo | O destaque compara rotas; dizer "nenhuma" esconderia a que perde menos | n |
| Onde mora o cálculo | Uma view interna `estatistica_viagem` (uma linha por viagem não cancelada, com KM, receita, despesa e litros), sem `select` para `anon` e `authenticated`. As três RPCs leem dela | Uma fórmula, um lugar: a viagem, a rota e o veículo usam o mesmo cálculo. Sem o revoke, o PostgREST exporia a view sem checagem de perfil | y |
| Índices | Novos `viagem (rota_id)` e `viagem (veiculo_id)`. `movimentacao (viagem_id)` já existe (EIX-42) | AC: índices nas FKs usadas nas junções. O único índice de `viagem.veiculo_id` hoje é parcial (só `EmAndamento`) | y |
| Pasta do app | `src/features/bi/queries.ts` com uma função tipada por RPC e `formatarIndicador` para o `—` | Arquivo pedido na task. `bi` lê as RPCs e não importa nem `financeiro` nem `frota` (RNF08) | y |
| Documentação dos endpoints | Comentário no topo da migration e JSDoc em `queries.ts` com parâmetros, campos, unidades e erros | AC "endpoints documentados" sem criar documento que ninguém pediu (AGENTS.md §4) | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Estatística por viagem ⭐ MVP

**User Story**: As a gestor (Admin, Gestor de Frota ou Financeiro), I want each trip's profit, cost per KM and KM per liter so that I know which freights pay off.

**Why P1**: É a fórmula base. Rota e veículo são somas dela.

**Acceptance Criteria**:

1. WHEN um perfil autorizado chama `estatisticas_viagens(data_inicial, data_final)` THEN the system SHALL devolver uma linha por viagem `EmAndamento` ou `Finalizada` iniciada no período, com placa, rota, status, datas, `km_rodado`, `receita_centavos`, `despesa_centavos`, `rentabilidade_centavos`, `litros`, `custo_por_km_centavos` e `consumo_km_por_litro`, da mais recente para a mais antiga.  <!-- BI-01 -->
2. The system SHALL calcular `rentabilidade_centavos` como a soma das Entradas vinculadas menos a soma das Saídas vinculadas, pagas e pendentes, em centavos exatos.  <!-- BI-02 -->
3. The system SHALL calcular `custo_por_km_centavos` como a soma das Saídas vinculadas, em centavos, dividida por `km_rodado` (`hodometro_final − hodometro_inicial`), arredondada ao centavo.  <!-- BI-03 -->
4. The system SHALL calcular `consumo_km_por_litro` como `km_rodado` dividido pela soma dos `litros` vinculados, arredondado a 2 casas.  <!-- BI-04 -->
5. IF a viagem não tem `hodometro_final` THEN the system SHALL devolver `km_rodado`, `custo_por_km_centavos` e `consumo_km_por_litro` nulos.  <!-- BI-05 -->
6. IF a viagem não tem litros vinculados THEN the system SHALL devolver `litros` e `consumo_km_por_litro` nulos.  <!-- BI-06 -->
7. IF a viagem não tem movimentação vinculada THEN the system SHALL devolver receita, despesa e rentabilidade iguais a 0.  <!-- BI-07 -->
8. The system SHALL deixar de fora as viagens `Cancelada` e as iniciadas fora do período.  <!-- BI-08 -->

**Independent Test**: No PGlite, uma viagem finalizada de 1.000 KM com frete de R$ 5.000,00, combustível de R$ 1.234,57 com 300 L e pedágio de R$ 100,00 devolve rentabilidade 366543, R$/KM 133 e KM/L 3,33.

---

### P1: Consolidação por rota ⭐ MVP

**User Story**: As a gestor, I want each route's total profit and cost per KM so that I know which routes to prioritize.

**Why P1**: AC da task e Top 3 da US13.

**Acceptance Criteria**:

1. WHEN um perfil autorizado chama `estatisticas_rotas(data_inicial, data_final)` THEN the system SHALL devolver uma linha por rota com ao menos uma viagem `Finalizada` iniciada no período, com origem, destino, `quantidade_viagens`, `km_total`, `receita_centavos`, `despesa_centavos`, `lucro_centavos` e `custo_por_km_centavos`, somando só as viagens finalizadas.  <!-- BI-09 -->
2. The system SHALL ordenar as rotas por `lucro_centavos` decrescente, depois `km_total` decrescente, depois origem e destino em ordem alfabética.  <!-- BI-10 -->
3. The system SHALL marcar `mais_lucrativa = true` em exatamente uma rota, a primeira dessa ordem, quando a lista não está vazia.  <!-- BI-11 -->
4. The system SHALL marcar `maior_custo = true` em exatamente uma rota, a de maior `custo_por_km_centavos` (empate: maior `km_total`, depois origem e destino), quando a lista não está vazia.  <!-- BI-12 -->

**Independent Test**: Duas rotas, a A com lucro maior e R$/KM menor que a B: A sai com `mais_lucrativa` e B com `maior_custo`.

---

### P1: Consolidação por veículo ⭐ MVP

**User Story**: As a gestor, I want each vehicle's accumulated cost per KM so that I know which trucks spend the most.

**Why P1**: AC da task e Top 3 da US13.

**Acceptance Criteria**:

1. WHEN um perfil autorizado chama `estatisticas_veiculos(data_inicial, data_final)` THEN the system SHALL devolver uma linha por veículo com ao menos uma viagem `Finalizada` iniciada no período, com placa, marca, modelo, `quantidade_viagens`, `km_total`, `despesa_centavos` e `custo_por_km_centavos` (Saídas somadas ÷ KM somados das viagens finalizadas, arredondado ao centavo).  <!-- BI-13 -->
2. The system SHALL ordenar os veículos por `custo_por_km_centavos` decrescente, depois `km_total` decrescente, depois placa.  <!-- BI-14 -->

**Independent Test**: Um veículo com duas viagens (100 KM / R$ 300,00 e 300 KM / R$ 500,00) devolve R$/KM 200, e não a média das duas razões (233).

---

### P1: Acesso, período e desempenho ⭐ MVP

**User Story**: As a responsável pela segurança (US18), I want the statistics to expose only aggregates to the allowed profiles so that crossing modules does not leak rows.

**Why P1**: As RPCs leem tabelas que o RLS esconde de quem chama.

**Acceptance Criteria**:

1. IF quem chama não é Admin, Gestor de Frota nem Financeiro aprovado THEN the system SHALL recusar as três funções com `42501`.  <!-- BI-15 -->
2. IF `data_inicial` ou `data_final` é nula, a final é anterior à inicial, ou o período passa de 366 dias THEN the system SHALL recusar com `22023`.  <!-- BI-16 -->
3. The system SHALL negar `execute` das três funções a `public` e `anon`, conceder a `authenticated`, e negar `select` da view `estatistica_viagem` a `anon` e `authenticated`.  <!-- BI-17 -->
4. The system SHALL criar os índices `viagem (rota_id)` e `viagem (veiculo_id)`.  <!-- BI-18 -->

**Independent Test**: Como Motorista, `estatisticas_viagens` falha com `42501`; `has_function_privilege('anon', ...)` é falso; `select` direto na view como `authenticated` falha.

---

### P1: Consultas tipadas no app ⭐ MVP

**User Story**: As a dev das US11–US13, I want typed, documented query functions so that the screens consume the numbers without redoing the math.

**Why P1**: AC "endpoints documentados" e arquivo `src/features/bi/queries.ts` da task.

**Acceptance Criteria**:

1. WHEN uma tela chama `listarEstatisticasViagens`, `listarEstatisticasRotas` ou `listarEstatisticasVeiculos` com um período ISO THEN the system SHALL chamar a RPC correspondente e devolver `{ ok: true, data }` com os campos validados por Zod, sem calcular nada no cliente.  <!-- BI-19 -->
2. IF a RPC devolve `42501` THEN the system SHALL devolver `{ ok: false, mensagem: MENSAGEM_ACESSO_NEGADO }`.  <!-- BI-20 -->
3. IF a RPC devolve `22023` THEN the system SHALL devolver "Período inválido. Confira as datas do filtro.", nunca o texto do banco.  <!-- BI-21 -->
4. IF a RPC devolve outro erro ou dados fora do schema THEN the system SHALL devolver uma mensagem genérica em português.  <!-- BI-22 -->
5. WHEN `formatarIndicador` recebe nulo THEN the system SHALL devolver `—`; com número, a moeda (`R$`), o R$/KM (`R$ 1,33/km`) ou o KM/L (`3,33 km/L`) no formato brasileiro.  <!-- BI-23 -->

**Independent Test**: Com o client do Supabase mockado, um `42501` vira a mensagem de acesso negado e um `custo_por_km_centavos` nulo vira `—`.

---

## Edge Cases

- IF a única viagem da rota está `EmAndamento` THEN a rota não aparece em `estatisticas_rotas` (BI-09).
- WHEN o período não tem viagem finalizada THEN `estatisticas_rotas` e `estatisticas_veiculos` devolvem lista vazia, sem destaque (BI-11, BI-12).
- WHEN o valor não é exato em ponto flutuante (R$ 1.234,57) THEN os centavos saem exatos, porque a soma acontece em `numeric` (lição L-005).
- WHEN `formatarIndicador` recebe moeda negativa (lucro de −R$ 100,00) THEN devolve `− R$ 100,00`, com o sinal tipográfico, como o Caixa (`formatarMoedaComSinal`). Zero é dado, não falta de dado: R$/KM 0 vira `R$ 0,00/km`, não `—` (BI-23).
- WHEN a viagem começou às 23h30 do último dia do período no fuso do Brasil (02h30 UTC do dia seguinte) THEN ela entra no período (BI-08, lição L-001).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| BI-01 | P1: Estatística por viagem | Execute | Implementing |
| BI-02 | P1: Estatística por viagem | Execute | Implementing |
| BI-03 | P1: Estatística por viagem | Execute | Implementing |
| BI-04 | P1: Estatística por viagem | Execute | Implementing |
| BI-05 | P1: Estatística por viagem | Execute | Implementing |
| BI-06 | P1: Estatística por viagem | Execute | Implementing |
| BI-07 | P1: Estatística por viagem | Execute | Implementing |
| BI-08 | P1: Estatística por viagem | Execute | Implementing |
| BI-09 | P1: Consolidação por rota | Execute | Implementing |
| BI-10 | P1: Consolidação por rota | Execute | Implementing |
| BI-11 | P1: Consolidação por rota | Execute | Implementing |
| BI-12 | P1: Consolidação por rota | Execute | Implementing |
| BI-13 | P1: Consolidação por veículo | Execute | Implementing |
| BI-14 | P1: Consolidação por veículo | Execute | Implementing |
| BI-15 | P1: Acesso, período e desempenho | Execute | Implementing |
| BI-16 | P1: Acesso, período e desempenho | Execute | Implementing |
| BI-17 | P1: Acesso, período e desempenho | Execute | Implementing |
| BI-18 | P1: Acesso, período e desempenho | Execute | Implementing |
| BI-19 | P1: Consultas tipadas no app | Execute | Implementing |
| BI-20 | P1: Consultas tipadas no app | Execute | Implementing |
| BI-21 | P1: Consultas tipadas no app | Execute | Implementing |
| BI-22 | P1: Consultas tipadas no app | Execute | Implementing |
| BI-23 | P1: Consultas tipadas no app | Execute | Implementing |

**Coverage:** 23 total, 23 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] As 9 verificações do AC da Linear têm teste verde no PGlite ou no Jest.
- [ ] Nenhuma tela precisa de laço em JS para obter lucro, R$/KM, KM/L ou destaque.
