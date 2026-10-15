# EIX-76 · DB de viagem: validação (re-verificação 1)

## Validation: eix76-db-viagem - PASS ✅

**Data**: 2026-10-15
**Spec**: `.specs/features/eix76-db-viagem/spec.md`
**Diff range**: `be9b7f1..6e1e0e1` (`36838bf`, `c16f370`, `56ee96f`, `2d4297a`, `4d81e4c`, `1937b31`, `0814205`, `491226f`, `892b397`, `6e1e0e1`)
**Verifier**: sub-agente independente (autor ≠ verificador)
**Iteração**: 2 de 3 (fix → re-verificação)

Os 27 ACs e os 3 casos de borda têm evidência `file:line`, e o valor asserido bate com o da spec. O sensor matou 21 dos 22 mutantes. O único sobrevivente (M18, o lock `for update`) não é observável no PGlite e fica como verificação manual, não como gap.

O fix `6e1e0e1` só mexeu em teste e na spec. `git diff 892b397..6e1e0e1 -- supabase/migrations` está vazio. Os dois gaps e os dois pontos de precisão da rodada 1 foram fechados:

| Gap da rodada 1 | Fix | Prova |
| --- | --- | --- |
| M20: VG004 não testado no insert que já chega encerrado | `it.each(['Finalizada','Cancelada'])`: anterior fecha em 1500, insert encerrado 1400 → 1450 | M20 morre (2 testes) |
| M02: "outras viagens" não discriminado | viagem `EmAndamento` 1000 com final 1500; inicial vai para 1100 e é aceito | M02 morre |
| Precisão VIAG-26 sem SQLSTATE | spec agora diz `428C9` | resolvido |
| Precisão do caso de borda do RLS em veículo ocupado | spec diz `42501` em veículo disponível e `VG001`/`VG002`/`VG003` em veículo ocupado ou indisponível | resolvido |

---

## Conclusão das tasks

| Task | Commit | Status |
| --- | --- | --- |
| T1 fixtures de RLS | `c16f370` | ✅ Só fixture: um veículo por viagem aberta. Nenhum `expect` removido (`git diff be9b7f1..HEAD -- supabase/tests/rls*.test.ts`) |
| T2 uma viagem em andamento | `56ee96f` | ✅ |
| T3 veículo indisponível | `2d4297a` | ✅ |
| T4 hodômetro não regride | `4d81e4c` + `6e1e0e1` | ✅ Os dois testes da rodada 1 entraram no fix |
| T5 encerrada é terminal / veículo não troca | `1937b31` | ✅ |
| T6 status automático + upsert | `0814205` | ✅ |
| T7 km rodado | `491226f` | ✅ |
| T8 sem delete | `892b397` | ✅ |

Todos os "Done when" do `tasks.md` estão marcados.

---

## Critérios de aceite contra a spec

Testes em `supabase/tests/viagem.test.ts` (PGlite). Os helpers gravam como superuser, salvo quando o teste usa `comoUsuario`. Cada teste cria um veículo próprio. `viagensDoVeiculo` conta as linhas do veículo.

| Critério | Resultado definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| VIAG-01: 2ª viagem `EmAndamento` no mesmo veículo | `VG001` e nada gravado | `supabase/tests/viagem.test.ts:101-102` - `expect(codigo).toBe('VG001')`; `viagensDoVeiculo` `toBe(1)` | ✅ PASS |
| VIAG-02: índice único parcial barra escrita sem trigger | `23505` | `supabase/tests/viagem.test.ts:121-122` - `expect(codigo).toBe('23505')` com `session_replication_role = replica`; 1 linha | ✅ PASS |
| VIAG-03: depois de `Finalizada`/`Cancelada`, abre de novo | aceito; 1 aberta, 2 no total | `supabase/tests/viagem.test.ts:141-142` - `abertas toBe(1)`, `viagensDoVeiculo toBe(2)` (`it.each` nos dois status) | ✅ PASS |
| VIAG-04: veículo `EmManutencao` | `VG002` | `supabase/tests/viagem.test.ts:153-154` - `toBe('VG002')`; 0 linhas | ✅ PASS |
| VIAG-05: veículo `Inativo` | `VG003` | `supabase/tests/viagem.test.ts:162-163` - `toBe('VG003')`; 0 linhas | ✅ PASS |
| VIAG-06: insert já `Finalizada`/`Cancelada` em veículo indisponível | aceito | `supabase/tests/viagem.test.ts:176` - `viagensDoVeiculo toBe(1)` (4 combinações) | ✅ PASS |
| VIAG-07: inicial < maior final das outras viagens, em qualquer insert | `VG004` e nada gravado | `supabase/tests/viagem.test.ts:187-188` (aberta, 1499 < 1500); `:201-202` (já `Finalizada`/`Cancelada`, 1400 < 1500); `:213-214` (maior final, inclusive `Cancelada`) - `toBe('VG004')` | ✅ PASS |
| VIAG-08: inicial = maior final | aceito | `supabase/tests/viagem.test.ts:223` - `viagensDoVeiculo toBe(2)` | ✅ PASS |
| VIAG-09: update do inicial de viagem aberta para baixo | `VG004`; a comparação ignora a própria viagem | `supabase/tests/viagem.test.ts:243` e `:248` - `toBe('VG004')`, inicial continua `'1600.0'`; `:263` - inicial 1000 → 1100 abaixo do próprio final 1500 é aceito, `toBe('1100.0')` | ✅ PASS |
| VIAG-10: Motorista comparado com viagens de todos os motoristas | `VG004` para o Motorista B pelo final do A | `supabase/tests/viagem.test.ts:286-287` - `toBe('VG004')` via `comoUsuario(MOTORISTA_B)` | ✅ PASS |
| VIAG-11: checks antigas mantidas | `23514` (final ≤ inicial; `Finalizada` sem final) | `supabase/tests/viagem.test.ts:296-298` - `finalIgual toBe('23514')`, `finalizadaSemFinal toBe('23514')`, 0 linhas | ✅ PASS |
| VIAG-12: insert `EmAndamento` → veículo `EmViagem` | `EmViagem` | `supabase/tests/viagem.test.ts:369` - `toBe('EmViagem')` | ✅ PASS |
| VIAG-13: `EmAndamento` → `Finalizada`/`Cancelada` → `Disponivel` | `Disponivel` | `supabase/tests/viagem.test.ts:381` - `toBe('Disponivel')` (`it.each` nos dois) | ✅ PASS |
| VIAG-14: veículo fora de `EmViagem` ao encerrar | status inalterado | `supabase/tests/viagem.test.ts:392` - `toBe('Inativo')` | ✅ PASS |
| VIAG-15: insert já encerrado não mexe no veículo | status inalterado | `supabase/tests/viagem.test.ts:403` - `toBe(statusVeiculo)` (`Disponivel`/`Finalizada`, `EmManutencao`/`Cancelada`) | ✅ PASS |
| VIAG-16: Motorista abre e fecha → status muda sem policy de update em `veiculo` | `EmViagem`, depois `Disponivel` | `supabase/tests/viagem.test.ts:417` e `:422` | ✅ PASS |
| VIAG-17: encerrada com status/hodômetro diferente | `VG005`, linha intacta | `supabase/tests/viagem.test.ts:324-325` - `toBe('VG005')`; `toMatchObject({ status, hodometro_inicial: '1000.0', hodometro_final: '1500.0' })` (4 casos) | ✅ PASS |
| VIAG-18: encerrada regravada com os mesmos valores | aceito | `supabase/tests/viagem.test.ts:338` - `resultado.rows toHaveLength(1)` | ✅ PASS (só `Finalizada`; `Cancelada` usa o mesmo ramo `old.status <> 'EmAndamento'`) |
| VIAG-19: trocar `veiculo_id` | `VG006`, veículo original mantido | `supabase/tests/viagem.test.ts:353-354` - `toBe('VG006')`; `veiculo_id toBe(veiculoId)` (aberta e encerrada) | ✅ PASS |
| VIAG-20: upsert repetido da viagem aberta | aceito, 1 linha, veículo `EmViagem` | `supabase/tests/viagem.test.ts:461-462` - `toBe(1)`, `toBe('EmViagem')` | ✅ PASS |
| VIAG-21: reenvio do fechamento depois de viagem nova | aceito, veículo continua `EmViagem` | `supabase/tests/viagem.test.ts:490-491` - o upsert não lança; `toBe(2)`, `toBe('EmViagem')` | ✅ PASS |
| VIAG-22: upsert `EmAndamento` sobre `Finalizada` | `VG005` | `supabase/tests/viagem.test.ts:502-503` - `toBe('VG005')`; veículo segue `Disponivel` | ✅ PASS |
| VIAG-23: fechamento por upsert | linha atualizada, veículo `Disponivel` | `supabase/tests/viagem.test.ts:477-478` - `toEqual({ status: 'Finalizada', hodometro_final: '1500.0' })`, `toBe('Disponivel')` | ✅ PASS |
| VIAG-24: `km_rodado = final - inicial` | `234.5` (1000 → 1234,5) | `supabase/tests/viagem.test.ts:519` - `toBe('234.5')` | ✅ PASS |
| VIAG-25: `km_rodado` nulo com final nulo | `null` | `supabase/tests/viagem.test.ts:526` - `toBeNull()` | ✅ PASS |
| VIAG-26: `km_rodado` explícito é rejeitado | `428C9` | `supabase/tests/viagem.test.ts:540-541` - `toBe('428C9')`; 0 linhas | ✅ PASS |
| VIAG-27: delete por Admin, Gestor e Motorista | 0 linhas, viagem continua | `supabase/tests/viagem.test.ts:558-559` - `rows toHaveLength(0)`; `viagensDoVeiculo toBe(1)` (3 perfis) | ✅ PASS |

**Status**: ✅ Todos os ACs cobertos. Os gaps de precisão da rodada 1 foram resolvidos na spec.

---

## Casos de borda

- [x] Motorista cria viagem para outro motorista em veículo disponível → RLS rejeita com `42501`: `supabase/tests/rls_perfis.test.ts:155` - `expect(codigo).toBe('42501')`, com `veiculoLivreId` (`:150`). A spec agora registra que, em veículo ocupado ou indisponível, a rejeição chega como `VG001`/`VG002`/`VG003`, porque o trigger roda antes do RLS. Esse texto descreve a ordem de execução e não é um resultado novo a testar. A escrita é barrada nos dois casos, e os `VG00x` têm testes próprios (VIAG-01, 04 e 05).
- [x] Motorista abre a própria viagem em veículo disponível (RLS + triggers): `supabase/tests/viagem.test.ts:409-417` - insert via `comoUsuario(MOTORISTA_A)` devolve o `id`; veículo `toBe('EmViagem')`.
- [x] Veículo sem viagem anterior aceita qualquer inicial ≥ 0: `supabase/tests/viagem.test.ts:229-231` - inicial `0` aceito, `viagensDoVeiculo toBe(1)`.

---

## Sensor de discriminação

O sensor rodou num `git worktree` temporário no scratchpad, com symlink para o `node_modules` da árvore real: na rodada 1 em `892b397`, na rodada 2 em `6e1e0e1`. Cada mutante foi aplicado por substituição exata e única (o script aborta se o trecho não aparece exatamente uma vez). Depois rodei `supabase/tests/viagem.test.ts` (41 testes na R1, 44 na R2) e reverti o arquivo com `git checkout` no worktree. Na rodada 2 rodei de novo os 22 mutantes, não só M02 e M20. Não usei `git stash`. Nas duas rodadas, o worktree foi removido com `git worktree remove --force`, e o `git status --porcelain` da árvore real ficou idêntico ao baseline (na R2, só o `?? validation.md` deste relatório).

| # | `file:line` | Mutação | R1 | R2 |
| --- | --- | --- | --- | --- |
| M01 | `supabase/migrations/20261015000100_viagem_regras.sql:114` | `<` → `<=` no VG004 | ✅ | ✅ |
| M02 | `supabase/migrations/20261015000100_viagem_regras.sql:112` | sem `and v.id <> new.id` | ❌ | ✅ (VIAG-09, `:263`) |
| M03 | `supabase/migrations/20261015000100_viagem_regras.sql:53` | sem a saída antecipada do upsert no ramo INSERT | ✅ | ✅ |
| M04 | `supabase/migrations/20261015000100_viagem_regras.sql:149` | sem a guarda `v.status = 'EmViagem'` ao devolver `Disponivel` | ✅ | ✅ |
| M05 | `supabase/migrations/20261015000100_viagem_regras.sql:42` | `valida_viagem()` sem `security definer` | ✅ | ✅ |
| M06 | `supabase/migrations/20261015000100_viagem_regras.sql:136` | `sincroniza_status_veiculo()` sem `security definer` | ✅ | ✅ |
| M07 | `supabase/migrations/20261015000100_viagem_regras.sql:91` | checagem de encerrada invertida (`<>` → `=`) | ✅ | ✅ |
| M08 | `supabase/migrations/20261015000100_viagem_regras.sql:163` | sem `drop policy viagem_delete` | ✅ | ✅ |
| M09 | `supabase/migrations/20261015000100_viagem_regras.sql:67` | checagem VG001 desligada (sobra só o índice) | ✅ | ✅ |
| M10 | `supabase/migrations/20261015000100_viagem_regras.sql:64` | disponibilidade checada em todo insert, não só `EmAndamento` | ✅ | ✅ |
| M11 | `supabase/migrations/20261015000100_viagem_regras.sql:142` | insert encerrado também põe `EmViagem` | ✅ | ✅ |
| M12 | `supabase/migrations/20261015000100_viagem_regras.sql:99` | update nunca checa hodômetro | ✅ | ✅ |
| M13 | `supabase/migrations/20261015000100_viagem_regras.sql:94` | VG005 sem a cláusula do `hodometro_final` | ✅ | ✅ |
| M14 | `supabase/migrations/20261015000100_viagem_regras.sql:83` | VG006 desligado | ✅ | ✅ |
| M15 | `supabase/migrations/20261015000100_viagem_regras.sql:73` | `VG002` → `VG003` | ✅ | ✅ |
| M16 | `supabase/migrations/20261015000100_viagem_regras.sql:35` | `km_rodado` com `coalesce(final, inicial)` (aberta dá 0) | ✅ | ✅ |
| M17 | `supabase/migrations/20261015000100_viagem_regras.sql:145` | `after update` sem `old.status = 'EmAndamento'` | ✅ | ✅ |
| M18 | `supabase/migrations/20261015000100_viagem_regras.sql:59` | sem `for update` no veículo | ➖ | ➖ |
| M19 | `supabase/migrations/20261015000100_viagem_regras.sql:93` | VG005 sem a cláusula do `hodometro_inicial` | ✅ | ✅ |
| M20 | `supabase/migrations/20261015000100_viagem_regras.sql:79` | insert já encerrado sai antes da regra de hodômetro | ❌ | ✅ (VIAG-07, `:201`, 2 testes) |
| M21 | `supabase/migrations/20261015000100_viagem_regras.sql:145` | só `Finalizada` devolve o veículo | ✅ | ✅ |
| M22 | `supabase/migrations/20261015000100_viagem_regras.sql:143` | `EmViagem` só se já estava `EmViagem` (abrir nunca muda o status) | ✅ | ✅ |

**M18 (não observável no harness, verificação manual)**: o PGlite é uma conexão só, então duas gravações concorrentes não acontecem no teste. O lock não é AC, é Assumption ("Concorrência"). Para VG001, a barreira testada sob concorrência é o índice (VIAG-02). Para o hodômetro, o lock é a única barreira, e só dá para prová-lo com duas sessões num Postgres real.

**Profundidade**: P0 (integridade de hodômetro e de viagem, RNF07), com 22 mutantes.
**Resultado**: 21/21 observáveis mortos na rodada 2; M18 não é observável no harness. ✅ PASS.

---

## Qualidade do código

| Princípio | Status |
| --- | --- |
| Código mínimo, sem escopo extra | ✅ Uma migration (índice, coluna gerada, 2 triggers, `drop policy`). Nada em `src/`. |
| Mudanças cirúrgicas | ✅ Os fixtures de `rls*.test.ts` só ganharam veículos. O fix `6e1e0e1` só toca `viagem.test.ts` e a spec |
| Segue os padrões | ✅ Mesmo molde de `20261014000300_manutencao_rpc.sql`: cabeçalho com pré-checagem do `db push`, tabela de SQLSTATEs, `security definer` + `set search_path = public`, lock `for update`, guarda "só se ainda está no status esperado" |
| Valores asseridos batem com a spec | ✅ |
| Cobertura por camada (1:1 com AC, cada VG*** com caso que dispara e caso-limite) | ✅ |
| Todo teste mapeia a AC ou caso de borda | ✅ Todos os 44 citam o VIAG-XX ou o caso de borda no nome |
| Guias seguidos | `AGENTS.md` §2.4 (RLS, regra no banco), `.claude/CLAUDE.md` §3 (invariante em trigger/constraint, sem delete físico) e §7 (validação de hodômetro no Postgres) |

Observação, sem gap: a mensagem do `VG004` (`supabase/migrations/20261015000100_viagem_regras.sql:115`) traz o número do hodômetro final de viagens que o Motorista não enxerga pelo RLS. O app traduz por código e não mostra esse texto, mas a mensagem crua chega ao cliente pelo PostgREST. É um dado de veículo, não financeiro.

---

## Gate

Todos rodados na árvore real, sem modificação, em `6e1e0e1`:

- Full: `node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects supabase`: 16 suítes, 284 testes, 0 falhas
- Build: `npm run typecheck` exit 0; `npm run lint` exit 0; `npm run test` exit 0. App: 79 suítes e 794 testes. Supabase: 16 suítes e 284 testes
- **Antes da feature** (`be9b7f1`, medido no worktree): supabase 15 suítes, 240 testes
- **Depois**: 16 suítes, 284 testes. **Delta**: +44, todos de `viagem.test.ts` (41 na R1, mais 3 do fix). Os testes de `rls`/`rls_perfis` têm a mesma contagem
- Pulados: nenhum. Falhas: nenhuma

---

## Rastreabilidade (recomendação para o `spec.md`)

O verificador não edita a spec. Recomendação:

| Requisito | Antes | Recomendado |
| --- | --- | --- |
| VIAG-01 a VIAG-27 | Implementing | Verified |

Critérios de sucesso: testes e build verdes ✅. `db push` e `gen types` estão fora do alcance do verificador, que não acessa a nuvem.

---

## Resumo

**Geral**: ✅ Pronto.
**Spec**: 27 ACs e 3 casos de borda, todos com evidência e valor correto. Sem gap de precisão em aberto.
**Sensor**: 21/21 observáveis mortos. M02 e M20, sobreviventes da rodada 1, morrem. M18 (lock) não é observável no PGlite.
**Gate**: verde (794 app + 284 supabase; +44 da feature).
**Revisão manual antes do PR**:
- Antes do `db push`, rodar na nuvem a query do cabeçalho da migration (`supabase/migrations/20261015000100_viagem_regras.sql:10-11`): nenhum veículo com duas viagens `EmAndamento`.
- O lock `for update` do hodômetro sob concorrência real (M18) só pode ser conferido com duas sessões num Postgres de verdade.
- Depois do push, regerar `src/types/database.ts` com `km_rodado`.
