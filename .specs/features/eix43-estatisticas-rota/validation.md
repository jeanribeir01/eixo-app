# EIX-43 · US10 — Motor de estatísticas de rota e custo por KM — Validação

**Verdict**: PASS
**Result**: PASS

**Data**: 2026-11-13 (rodada 3 de no máximo 3)
**Spec**: `.specs/features/eix43-estatisticas-rota/spec.md`
**Diff range**: `eb106b9..c6715df` (branch `feat/eix-43-us10-motor-estatisticas`). O código de produção está em `eb106b9..3ba960d`, em 6 commits. `2382b7f` só mexe em `.specs/STATE.md`. As correções `32dedef` (rodada 1) e `c6715df` (rodada 2) só mexem em `supabase/tests/bi.test.ts`.
**Verifier**: sub-agente independente (autor ≠ verificador)

## Histórico

| Rodada | Commit | Veredito | Sensor | Motivo |
| --- | --- | --- | --- | --- |
| 1 | `3ba960d` | FAIL | 24/29 não equivalentes mortos | Sobreviveram 5 mutantes. M2: sem `at time zone`, os testes passavam, porque o PGlite herdava `TZ=America/Sao_Paulo` do `jest.global-setup.js`. M6: desempate de `maior_custo` por KM. M10/M11: valores de datas e UFs no BI-01. M19: origem antes de destino |
| 2 | `32dedef` | FAIL | 12/13; os 5 da rodada 1 morrem | M25 (ordem sem a chave destino) morria em 4 de 7 execuções. O último desempate era `rota_id`, gerado por `gen_random_uuid()` |
| 3 | `c6715df` | **PASS** | 12/12 execuções mortas (M25 ×7 + 5 regressões de ordem) | As duas rotas de Maringa agora têm ids fixos (`…aa01` para Bauru, `…aa02` para Assis), na ordem contrária à dos destinos. Sem a chave destino, a ordem sai sempre invertida |

---

## Conclusão das tarefas

| Task | Status | Observação |
| --- | --- | --- |
| T1 View, índices, `estatisticas_viagens` | ✅ Done | - |
| T2 `estatisticas_rotas` | ✅ Done | Todas as chaves das duas ordenações (lista e `maior_custo`) discriminadas |
| T3 `estatisticas_veiculos` | ✅ Done | - |
| T4 Tipos | ✅ Done | Gerados, não avaliados |
| T5 `queries.ts` | ✅ Done | - |
| T6 `formatarIndicador` | ✅ Done | - |

---

## Critérios de aceite ancorados na spec

Arquivos de teste: `supabase/tests/bi.test.ts` (PGlite, sessão em UTC desde `:259`), `src/features/bi/__tests__/queries.test.ts`, `src/features/bi/__tests__/formatar.test.ts`.

### P1 — Estatística por viagem

| ID | Resultado definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| BI-01 | Uma linha por viagem EmAndamento/Finalizada do período, com placa, rota, status, datas, KM, receita, despesa, rentabilidade, litros, R$/KM, KM/L; da mais recente para a mais antiga | `bi.test.ts:302-319`: `rota_id`; `uf_origem` `'SP'` (`:304`); `uf_destino` `'PR'`; `data_inicio` `'2025-01-15T12:00:00.000Z'`; `data_fim` `'2025-01-16T12:00:00.000Z'`; cidades, `status` e todos os números. `:329` `toEqual(COLUNAS_VIAGEM)` + `placa` `'BIC0001'`. `:342` `toEqual([recente, meio, antiga])` | ✅ (M10, M11, M18) |
| BI-02 | Entradas − Saídas, pagas e pendentes, centavos exatos | `bi.test.ts:312-314`: 500000, 133457, 366543 (frete e pedágio pendentes, combustível pago) | ✅ (M12) |
| BI-03 | Saídas ÷ KM, arredondado ao centavo | `bi.test.ts:317` `toBe(133)`; `:375` `toBe(50)` | ✅ |
| BI-04 | KM ÷ litros, 2 casas | `bi.test.ts:319` `toBe(3.33)` | ✅ (M8) |
| BI-05 | Sem hodômetro final: KM, R$/KM e KM/L nulos | `bi.test.ts:353-355` `toBeNull()` ×3 | ✅ |
| BI-06 | Sem litros: `litros` e KM/L nulos | `bi.test.ts:373-374`; `:388-389` | ✅ (M9) |
| BI-07 | Sem lançamento: receita, despesa e rentabilidade valem 0 | `bi.test.ts:384-387` `toBe(0)` | ✅ |
| BI-08 | Ficam fora a Cancelada e a viagem iniciada fora do período (dia no fuso do Brasil) | `bi.test.ts:411` `toEqual([ultimaNoite, semInicio].sort())`, com a sessão em UTC | ✅ (M2, M27, M17) |

### P1 — Consolidação por rota

| ID | Resultado definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| BI-09 | Uma linha por rota com ≥1 Finalizada, somando só as finalizadas | `bi.test.ts:453` `toHaveLength(1)`; `:454` colunas; `:455-466` `toMatchObject({ quantidade_viagens: 2, km_total: 2000, receita_centavos: 500000, despesa_centavos: 150000, lucro_centavos: 350000, custo_por_km_centavos: 75 })` | ✅ (M3) |
| BI-10 | Ordem: lucro desc, `km_total` desc, origem, destino | `bi.test.ts:501` `[rotaA, rotaC, rotaB]` (chave KM); `:522` `[alfa, beta]` (origem); `:580-585` `[Abaete-Zelia, Barueri-Anapolis, Maringa-Assis, Maringa-Bauru]`. Nesse último, a ordem da origem discorda da do destino, e os ids fixos (`:564`, `:566`) discordam do destino | ✅ (M5, M19, M25 ×7) |
| BI-11 | `mais_lucrativa` em exatamente uma rota, a primeira da ordem | `bi.test.ts:504`, `:523`, `:555`, `:586` `[true, false, false, false]`, `:597` (lucro negativo), `:604` (lista vazia) | ✅ |
| BI-12 | `maior_custo` em exatamente uma rota; empate: maior `km_total`, depois origem e destino | `bi.test.ts:505`; `:556` `toEqual([false, true])` (R$/KM `[10, 10]`; Zeta tem mais KM e vem depois na ordem); `:587` | ✅ (M6, M26, M24, M23) |

### P1 — Consolidação por veículo

| ID | Resultado definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| BI-13 | R$/KM = Saídas somadas ÷ KM somados, só finalizadas | `bi.test.ts:658` `toHaveLength(1)`; `:660-670` `toEqual({ ..., km_total: 400, despesa_centavos: 80000, custo_por_km_centavos: 200 })` | ✅ (M4, M7) |
| BI-14 | Ordem: R$/KM desc, `km_total` desc, placa | `bi.test.ts:699` `['VEI0100', 'VEI0200', 'AAA0001', 'ZZZ0001']` | ✅ (M20) |

### P1 — Acesso, período e desempenho

| ID | Resultado definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| BI-15 | Quem não é Admin, Gestor ou Financeiro aprovado recebe `42501` nas três | `bi.test.ts:421-422`, `:613-614`, `:710-711` `toBe('42501')` para Motorista e não aprovado; perfis aceitos em `:418-420`, `:611-612`, `:707-709` | ✅ (M21) |
| BI-16 | Data nula, intervalo invertido ou >366 dias → `22023` | `bi.test.ts:426-431`, `:615-617`, `:712-714` | ✅ (M16) |
| BI-17 | `execute` só para `authenticated`; sem `select` na view | `bi.test.ts:725`, `:734`, `:743` `{ anon: false, publico: false, autenticado: true }`; `:751` `has_table_privilege` falso; `:754-755` `42501`. Privilégios padrão do Supabase imitados antes da migration (L-006) | ✅ (M1, M14) |
| BI-18 | Índices `viagem(rota_id)` e `viagem(veiculo_id)` | `bi.test.ts:769` `toEqual(['rota_id', 'veiculo_id'])` | ✅ (M15) |

### P1 — Consultas tipadas no app (sem mudança desde a rodada 1)

| ID | Resultado definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| BI-19 | Chama a RPC com o período e devolve `{ ok: true, data }` validado | `queries.test.ts:107` `toHaveBeenCalledWith(rpc, { data_inicial: '2026-11-01', data_final: '2026-11-30' })`; `:108`; `:157`; `:163` | ✅ (A5, A7) |
| BI-20 | `42501` → `MENSAGEM_ACESSO_NEGADO` | `queries.test.ts:120` | ✅ (A6) |
| BI-21 | `22023` → "Período inválido. Confira as datas do filtro." | `queries.test.ts:126` | ✅ (A1) |
| BI-22 | Outro erro ou dado fora do schema → mensagem genérica | `queries.test.ts:133-134`, `:140-141` | ✅ (A8) |
| BI-23 | Nulo → `—`; `R$`, `R$ 1,33/km`, `3,33 km/L` | `formatar.test.ts:7`, `:11-12`, `:21`, `:30` | ✅ (A2, A3) |

**Status**: 23/23 com evidência, e cada valor confere com a spec. Nenhum spec-precision gap.

---

## Casos de borda

- [x] Rota só com viagem EmAndamento fica fora: `bi.test.ts:453`.
- [x] Período sem viagem finalizada → lista vazia, sem destaque: `bi.test.ts:604`. Para veículos, a exclusão do veículo só com EmAndamento está em `:658` (M4).
- [x] R$ 1.234,57 sai exato (L-005): `bi.test.ts:313-314`. O M22 (`float8`) sobrevive, mas é equivalente: o cast do Postgres para `bigint` arredonda.
- [x] Moeda negativa `− R$ 100,00` e R$/KM zero `R$ 0,00/km`: `formatar.test.ts:16,26` (A4).
- [x] Viagem às 23h30 do último dia entra no período (L-001): `bi.test.ts:392-411` com a sessão em UTC (`:259`). M2 e M27 morrem.

---

## Sensor de discriminação

Worktree descartável em `%TEMP%\eix43-sensor`, criada em `c6715df` e ligada ao `node_modules` por junction. Rodei um mutante por vez e voltei o arquivo com `git checkout -- <arquivo>` depois de cada um. Baseline no scratch: 25/25.

### Rodada 3 (`c6715df`)

| # | Arquivo:linha | Mutação | Resultado |
| --- | --- | --- | --- |
| M25 ×7 | `20261113000100_bi.sql:227` | Ordem das rotas sem a chave `cidade_destino`, caindo em `rota_id` | ✅ Morto nas 7 execuções (na rodada 2, 4 de 7) |
| M19 | `…bi.sql:221,227` | Destino antes da origem (ordem e `mais_lucrativa`) | ✅ Morto |
| M24 | `…bi.sql:224` | Destino antes da origem na janela de `maior_custo` | ✅ Morto |
| M5 | `…bi.sql:227` | Rotas: `km_total asc` | ✅ Morto |
| M6 | `…bi.sql:224` | `maior_custo`: `km_total asc` | ✅ Morto |
| M18 | `…bi.sql:152` | Viagens da mais antiga para a mais recente | ✅ Morto |

### Rodadas anteriores (ainda válidas)

- Rodada 2 (`32dedef`): morreram M2, M6, M10, M11, M19, M24, M26, M27, M5, M17, M18 e M23. M25 morria só às vezes, e foi corrigido nesta rodada.
- Rodada 1 (`3ba960d`): morreram M1, M3, M4, M5, M7, M8, M9, M12, M14, M15, M16, M17, M18, M20, M21 e M23, e os do app A1 a A8. M22 é equivalente.
- As correções só acrescentaram asserções, a linha do fuso e os ids fixos de duas rotas. Nenhuma asserção que matava esses mutantes foi tirada ou enfraquecida.

**Profundidade**: expandida (dinheiro e autorização). No total, 36 mutações diferentes, 35 mortas de forma determinística e 1 equivalente.
**Resultado**: **PASS**.
**Isolamento**: o `git status --porcelain` antes do sensor era ` M .specs/LESSONS.md`, ` M .specs/lessons.json`, `?? .specs/features/eix43-estatisticas-rota/validation.md`, e ficou idêntico depois. Removi a junction com `rmdir`; o `node_modules` real continua com 691 entradas. A worktree foi removida com `git worktree remove --force`, seguido de `prune`. Depois disso, só o conteúdo deste `validation.md` mudou.

---

## Qualidade de código

| Item | Status |
| --- | --- |
| Correções só em teste, sem mexer em produção | ✅ `32dedef` e `c6715df` só tocam em `supabase/tests/bi.test.ts` |
| `criarRota` com id opcional | ✅ Mudança mínima, com o porquê comentado (`bi.test.ts:155-156`) e `gen_random_uuid()` como padrão |
| Código mínimo, mudanças cirúrgicas, padrões | ✅ Como na rodada 1: RPC `security definer` + `auth_perfil()` + revoke/grant; repositório no molde de `ponteRepository.ts`; agregação no banco (RNF06); `features/bi` não importa `financeiro` nem `frota` (RNF08) |
| Todo teste mapeia para um AC ou caso de borda | ✅ |
| Diretrizes | `AGENTS.md` §2.5, `.claude/CLAUDE.md` §3, L-001, L-005, L-006, L-008 e L-028 atendidas |

Fora do escopo, sem efeito no veredito: os outros testes do PGlite cujas migrations usam `at time zone 'America/Sao_Paulo'` (`kpis_dashboard`, `resumo_caixa`, `resumo_caixa_projecao_anual`, `veiculo_ano_inativo`, `manutencao_rpc`) não põem a sessão em UTC. É provável que tenham o mesmo ponto cego da rodada 1 (lição candidata L-029).

---

## Gate (`c6715df`, árvore real, somente leitura)

- `npm run typecheck`: exit 0
- `npm run lint`: exit 0
- `npm run test`: app com 117 suítes e **1448 passed**; supabase (PGlite) com 22 suítes e **412 passed**. 0 failed, 0 skipped
- Antes da feature eram 1420 no app e 387 no banco. A feature acrescentou 28 testes no app e 25 no banco, e nenhum teste foi removido

---

## Rastreabilidade

| Requisito | Status anterior | Novo status |
| --- | --- | --- |
| BI-01..BI-09 | ✅ Verified | ✅ Verified |
| BI-10 | ❌ Needs Fix | ✅ Verified |
| BI-11..BI-23 | ✅ Verified | ✅ Verified |

---

## Resumo

**Overall**: ✅ Ready. Os gaps das rodadas 1 e 2 foram fechados só com mudanças em teste. Nenhum mutante apontou erro no código de produção.

**Spec-anchored check**: 23/23 ✅, 0 spec-precision gaps.
**Sensor**: rodada 3 com 12/12 execuções mortas, sendo M25 ×7 e 5 regressões de ordem. No acumulado, 35 de 35 mutações não equivalentes mortas.
**Gate**: typecheck e lint ok; 1448 testes do app e 412 do banco verdes.

**O que conferir à mão antes do PR**: a migration já foi aplicada na nuvem (T4). Vale olhar, no painel do Supabase, se a view `estatistica_viagem` está sem `select` para `anon` e `authenticated`.
