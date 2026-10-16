# EIX-76 · DB de viagem: validação (iteração 4)

## Validation: eix76-db-viagem - PASS ✅

**Data**: 2026-10-15
**Spec**: `.specs/features/eix76-db-viagem/spec.md` (32 critérios, VIAG-01..32)
**Diff range**: `be9b7f1..40cc577` (`36838bf`, `c16f370`, `56ee96f`, `2d4297a`, `4d81e4c`, `1937b31`, `0814205`, `491226f`, `892b397`, `6e1e0e1`, `d6ddee7`, `32db183`, `0c5ce2b`, `40cc577`)
**Verifier**: sub-agente independente (autor ≠ verificador)
**Iteração**: 4. A 4ª iteração foi autorizada pelo usuário depois do FAIL da 3ª.

Os 32 critérios e os 4 casos de borda têm evidência `file:line`, e o valor asserido bate com o da spec. O sensor matou todos os 31 mutantes observáveis e não equivalentes. N04 virou equivalente com o `>` (explicado abaixo). M18 e N12 são locks que o PGlite não observa e ficam como verificação manual. Os gates estão verdes.

### Histórico das iterações

| Iteração | HEAD | Veredito | O que decidiu |
| --- | --- | --- | --- |
| 1 | `892b397` | ❌ FAIL | M02 (`v.id <> new.id` do último final) e M20 (VG004 no insert já encerrado) sobreviviam; VIAG-26 sem SQLSTATE na spec |
| 2 | `6e1e0e1` | ✅ PASS | Testes novos mataram M02 e M20; spec ganhou `428C9` e o caso de borda do RLS |
| 3 | `0c5ce2b` | ❌ FAIL | Escopo ampliado (VG004 sem números; T9, a correção do final por Admin/Gestor). N08 sobrevivia, e o `>=` do VG007 travava a correção quando havia uma cancelada sem rodar no mesmo inicial |
| 4 | `40cc577` | ✅ PASS | Opção (a) aplicada: VG007 com `>`, spec de VIAG-28/29/30 reescrita, teste do fluxo "cancelar e reabrir". N08 morre |

---

## Conclusão das tasks

| Task | Commit | Status |
| --- | --- | --- |
| T1 fixtures de RLS | `c16f370` | ✅ Só fixture; nenhum `expect` removido |
| T2 uma viagem em andamento | `56ee96f` | ✅ |
| T3 veículo indisponível | `2d4297a` | ✅ |
| T4 hodômetro não regride | `4d81e4c` + `6e1e0e1` + `32db183` | ✅ |
| T5 encerrada é terminal / veículo não troca | `1937b31` | ✅ |
| T6 status automático + upsert | `0814205` | ✅ |
| T7 km rodado | `491226f` | ✅ |
| T8 sem delete | `892b397` | ✅ |
| T9 correção do hodômetro final | `0c5ce2b` + `40cc577` | ✅ |

Todos os "Done when" do `tasks.md` estão marcados.

---

## Critérios de aceite contra a spec

Testes em `supabase/tests/viagem.test.ts` (PGlite). Os helpers gravam como superuser, onde `auth_perfil()` é nulo, salvo quando o teste usa `comoUsuario`. Cada teste cria um veículo próprio. `viagensDoVeiculo` conta as linhas do veículo. `corrigirFinal` faz o update do `hodometro_final` como o usuário dado.

| Critério | Resultado definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| VIAG-01: 2ª viagem `EmAndamento` no mesmo veículo | `VG001` e nada gravado | `supabase/tests/viagem.test.ts:101-102` - `toBe('VG001')`; `viagensDoVeiculo toBe(1)` | ✅ PASS |
| VIAG-02: índice único parcial barra escrita sem trigger | `23505` | `supabase/tests/viagem.test.ts:121-122` - `toBe('23505')` com `session_replication_role = replica` | ✅ PASS |
| VIAG-03: depois de `Finalizada`/`Cancelada`, abre de novo | 1 aberta, 2 no total | `supabase/tests/viagem.test.ts:141-142` | ✅ PASS |
| VIAG-04: veículo `EmManutencao` | `VG002` | `supabase/tests/viagem.test.ts:153-154` | ✅ PASS |
| VIAG-05: veículo `Inativo` | `VG003` | `supabase/tests/viagem.test.ts:162-163` | ✅ PASS |
| VIAG-06: insert já encerrado em veículo indisponível | aceito | `supabase/tests/viagem.test.ts:176` (4 combinações) | ✅ PASS |
| VIAG-07: inicial < maior final das outras viagens, em qualquer insert | `VG004` e nada gravado | `supabase/tests/viagem.test.ts:187-188` (aberta), `:201-202` (já `Finalizada`/`Cancelada`), `:213-214` (maior final, inclusive `Cancelada`) | ✅ PASS |
| VIAG-08: inicial = maior final | aceito | `supabase/tests/viagem.test.ts:223` - `toBe(2)` | ✅ PASS |
| VIAG-09: update do inicial de viagem aberta para baixo; ignora a própria viagem | `VG004`; próprio final não conta | `supabase/tests/viagem.test.ts:243` e `:248` (`'1600.0'`); `:263` (`'1100.0'`) | ✅ PASS |
| VIAG-10: Motorista comparado com viagens de todos os motoristas | `VG004` | `supabase/tests/viagem.test.ts:286-287` via `comoUsuario(MOTORISTA_B)` | ✅ PASS |
| VIAG-11: checks antigas mantidas | `23514` (2 casos) | `supabase/tests/viagem.test.ts:323-325` | ✅ PASS |
| VIAG-12: insert `EmAndamento` → `EmViagem` | `EmViagem` | `supabase/tests/viagem.test.ts:396` | ✅ PASS |
| VIAG-13: encerrar → `Disponivel` | `Disponivel` | `supabase/tests/viagem.test.ts:408` (`Finalizada` e `Cancelada`) | ✅ PASS |
| VIAG-14: veículo fora de `EmViagem` ao encerrar | inalterado | `supabase/tests/viagem.test.ts:419` - `toBe('Inativo')` | ✅ PASS |
| VIAG-15: insert já encerrado não mexe no veículo | inalterado | `supabase/tests/viagem.test.ts:430` | ✅ PASS |
| VIAG-16: Motorista abre e fecha → status muda | `EmViagem`, depois `Disponivel` | `supabase/tests/viagem.test.ts:444` e `:449` | ✅ PASS |
| VIAG-17: encerrada com status ou inicial diferente, ou final diferente por quem não é Admin/Gestor | `VG005`, linha intacta | `supabase/tests/viagem.test.ts:351-352` - superuser em 4 casos, `toMatchObject` intacto; `:718` - Gestor mudando o inicial → `VG005`; `:706-707` - Motorista mudando o final → `VG005`, final `'1500.0'` | ✅ PASS |
| VIAG-18: encerrada regravada com os mesmos valores | aceito | `supabase/tests/viagem.test.ts:365` - `toHaveLength(1)` | ✅ PASS |
| VIAG-19: trocar `veiculo_id` | `VG006` | `supabase/tests/viagem.test.ts:380-381` (aberta e encerrada) | ✅ PASS |
| VIAG-20: upsert repetido da aberta | 1 linha, `EmViagem` | `supabase/tests/viagem.test.ts:488-489` | ✅ PASS |
| VIAG-21: reenvio do fechamento depois de viagem nova | aceito, `EmViagem` | `supabase/tests/viagem.test.ts:517-518` | ✅ PASS |
| VIAG-22: upsert `EmAndamento` sobre `Finalizada` | `VG005` | `supabase/tests/viagem.test.ts:529-530` | ✅ PASS |
| VIAG-23: fechamento por upsert | linha atualizada, `Disponivel` | `supabase/tests/viagem.test.ts:504-505` | ✅ PASS |
| VIAG-24: `km_rodado = final - inicial` | `234.5` | `supabase/tests/viagem.test.ts:546` | ✅ PASS |
| VIAG-25: `km_rodado` nulo com final nulo | `null` | `supabase/tests/viagem.test.ts:553` | ✅ PASS |
| VIAG-26: `km_rodado` explícito | `428C9` | `supabase/tests/viagem.test.ts:567-568` | ✅ PASS |
| VIAG-27: delete por Admin, Gestor e Motorista | 0 linhas | `supabase/tests/viagem.test.ts:585-586` (3 perfis) | ✅ PASS |
| VIAG-28: Admin/Gestor corrigem o final, sem passar do inicial de viagem com inicial **maior**; `km_rodado` acompanha | aceito; final e km novos | `supabase/tests/viagem.test.ts:614-615` - `toEqual({ hodometro_final: '1400.0', km_rodado: '400.0' })` (Gestor/`Finalizada`, Admin/`Cancelada`); `:638` - corrigir até **igual** ao inicial da viagem seguinte, `'1500.0'` | ✅ PASS |
| VIAG-29: final digitado a mais corrigido para baixo destrava o caminhão, inclusive com cancelada sem final no mesmo inicial | nova viagem com inicial = final corrigido é aceita | `supabase/tests/viagem.test.ts:622` (antes: `VG004`) e `:627-628` (2 viagens, `EmViagem`); `:653-655` - cancelada em 15000 sem final, reaberta em 15000, `'15230.0'` gravado, 3 viagens, `EmViagem` | ✅ PASS |
| VIAG-30: final corrigido > inicial de outra viagem que começou **depois** (`>`) | `VG007` | `supabase/tests/viagem.test.ts:665-666` - `toBe('VG007')`, final continua `'1450.0'`; `:678` - viagem com inicial menor não trava (`'2100.0'`); `:653` - viagem com inicial igual não trava (N08 morre) | ✅ PASS |
| VIAG-31: Admin/Gestor apaga o final, ou preenche final nulo | `VG005` | `supabase/tests/viagem.test.ts:690-691` - `toBe('VG005')`; final intacto (`'1500.0'` / `null`) | ✅ PASS |
| VIAG-32: Motorista muda o final da própria encerrada | `VG005` | `supabase/tests/viagem.test.ts:706-707` - `toBe('VG005')`; `'1500.0'` | ✅ PASS |

**Status**: ✅ Todos os 32 critérios cobertos com o valor da spec. Os três lados do corte do VG007 (inicial menor, igual e maior) estão fixados: `:678`, `:653` e `:665`.

---

## Casos de borda

- [x] Motorista grava viagem de outro motorista em veículo disponível → `42501`: `supabase/tests/rls_perfis.test.ts:155` - `toBe('42501')`, com `veiculoLivreId` (`:150`). O texto sobre `VG001`/`VG002`/`VG003` em veículo ocupado ou indisponível descreve a ordem trigger → RLS. Esses códigos têm testes próprios (VIAG-01, 04 e 05).
- [x] Motorista abre a própria viagem em veículo disponível: `supabase/tests/viagem.test.ts:444` - veículo `EmViagem` depois do insert via `comoUsuario(MOTORISTA_A)`.
- [x] Veículo sem viagem anterior aceita inicial ≥ 0: `supabase/tests/viagem.test.ts:231` (inicial `0`).
- [x] A mensagem do `VG004` não traz hodômetro: `supabase/tests/viagem.test.ts:313-314` - `not.toBe('')` e `not.toMatch(/\d/)`, no insert do Motorista B barrado pelo final do Motorista A.

---

## Sensor de discriminação

O sensor rodou num `git worktree` temporário no scratchpad, em `40cc577`, com symlink para o `node_modules` da árvore real. Cada mutante foi aplicado por substituição exata e única (o script aborta se o trecho não aparece exatamente uma vez). Depois rodei `supabase/tests/viagem.test.ts` (56 testes) e reverti o arquivo com `git checkout` no worktree. Reapliquei o conjunto inteiro, M01..M22 e N01..N12. N03 e N08 foram ajustados ao novo `>`: N03 remove a cláusula, e N08 volta o `>` para `>=`. Não usei `git stash`. O worktree foi removido com `git worktree remove --force`, e o `git status --porcelain` da árvore real ficou idêntico ao baseline (` M .specs/features/eix76-db-viagem/validation.md`, o relatório não commitado da iteração 3).

Linhas abaixo em `supabase/migrations/20261015000100_viagem_regras.sql` de `40cc577`. Nas colunas: ✅ morto, ❌ sobrevivente, ➖ não observável no harness, ≡ equivalente, - ainda não existia.

| # | Linha | Mutação | R1 | R2 | R3 | R4 |
| --- | --- | --- | --- | --- | --- | --- |
| M01 | `:150` | `<` → `<=` no VG004 | ✅ | ✅ | ✅ | ✅ |
| M02 | `:146` | sem `and v.id <> new.id` no último final | ❌ | ✅ | ✅ | ✅ |
| M03 | `:54` | sem a saída antecipada do upsert no ramo INSERT | ✅ | ✅ | ✅ | ✅ |
| M04 | `:184` | sem a guarda `v.status = 'EmViagem'` ao devolver `Disponivel` | ✅ | ✅ | ✅ | ✅ |
| M05 | `:43` | `valida_viagem()` sem `security definer` | ✅ | ✅ | ✅ | ✅ |
| M06 | `:171` | `sincroniza_status_veiculo()` sem `security definer` | ✅ | ✅ | ✅ | ✅ |
| M07 | `:92` | `old.status <> 'EmAndamento'` → `=` | ✅ | ✅ | ✅ | ✅ |
| M08 | `:198` | sem `drop policy viagem_delete` | ✅ | ✅ | ✅ | ✅ |
| M09 | `:68` | checagem VG001 desligada (sobra só o índice) | ✅ | ✅ | ✅ | ✅ |
| M10 | `:65` | disponibilidade checada em todo insert | ✅ | ✅ | ✅ | ✅ |
| M11 | `:177` | insert encerrado também põe `EmViagem` | ✅ | ✅ | ✅ | ✅ |
| M12 | `:133` | update nunca checa hodômetro | ✅ | ✅ | ✅ | ✅ |
| M13 | `:104` | encerrada aceita qualquer mudança do final | ✅ | ✅ | ✅ | ✅ |
| M14 | `:84` | VG006 desligado | ✅ | ✅ | ✅ | ✅ |
| M15 | `:74` | `VG002` → `VG003` | ✅ | ✅ | ✅ | ✅ |
| M16 | `:36` | `km_rodado` com `coalesce(final, inicial)` | ✅ | ✅ | ✅ | ✅ |
| M17 | `:180` | `after update` sem `old.status = 'EmAndamento'` | ✅ | ✅ | ✅ | ✅ |
| M18 | `:60` | sem `for update` no veículo (insert) | ➖ | ➖ | ➖ | ➖ |
| M19 | `:94` | VG005 sem a cláusula do `hodometro_inicial` | ✅ | ✅ | ✅ | ✅ |
| M20 | `:80` | insert já encerrado sai antes da regra de hodômetro | ❌ | ✅ | ✅ | ✅ |
| M21 | `:180` | só `Finalizada` devolve o veículo | ✅ | ✅ | ✅ | ✅ |
| M22 | `:178` | abrir nunca muda o status para `EmViagem` | ✅ | ✅ | ✅ | ✅ |
| N01 | `:105` | sem a checagem de perfil (`coalesce(auth_perfil() ...)`) | - | - | ✅ | ✅ |
| N02 | `:123` | `<` → `<=` no VG007 | - | - | ✅ | ✅ |
| N03 | `:122` | sem `v.hodometro_inicial > old.hodometro_inicial` | - | - | ✅ | ✅ (VIAG-29 `:653`, VIAG-30 `:678`) |
| N04 | `:121` | sem `v.id <> new.id` no VG007 | - | - | ✅ | ≡ |
| N05 | `:106` | sem `old.hodometro_final is null` | - | - | ✅ | ✅ |
| N06 | `:107` | sem `new.hodometro_final is null` | - | - | ✅ | ✅ |
| N07 | `:151` | números de volta na mensagem do VG004 | - | - | ✅ | ✅ |
| N08 | `:122` | `>` → `>=` no corte da viagem posterior | - | - | ❌ | ✅ (VIAG-29 `:653`) |
| N09 | `:105` | só `Admin` corrige (sem `Gestor de Frota`) | - | - | ✅ | ✅ |
| N10 | `:105` | `coalesce(..., false)` → `true` (sem perfil corrige) | - | - | ✅ | ✅ |
| N11 | `:126` | `VG007` → `VG005` | - | - | ✅ | ✅ |
| N12 | `:111` | sem `for update` no veículo (correção) | - | - | ➖ | ➖ |

**N04 (equivalente desde o `>`)**: o trigger é `before update`, então a linha da própria viagem na tabela ainda tem `hodometro_inicial = old.hodometro_inicial`. O VG005 em `:93-95` garante que o inicial de encerrada não muda. Com `v.hodometro_inicial > old.hodometro_inicial`, a própria viagem nunca entra na busca, com ou sem `v.id <> new.id`, e nenhum resultado observável muda. Com o `>=` da iteração 3, a cláusula era necessária e o N04 morria. Hoje ela é redundante, mas inofensiva, e deixa a intenção explícita. Não gera fix.

**M18 e N12 (não observáveis no harness, verificação manual)**: o PGlite é uma conexão só, então gravações concorrentes não acontecem no teste. Os locks são Assumption ("Concorrência"), não AC. O índice (VIAG-02) é a barreira testada para VG001. Para o hodômetro e para a correção, o lock só pode ser provado com duas sessões num Postgres real.

**Profundidade**: P0 (integridade de hodômetro e de viagem, RNF07), com 34 mutantes.
**Resultado**: 31/31 observáveis e não equivalentes mortos; N04 é equivalente; M18 e N12 não são observáveis no PGlite. ✅ PASS.

---

## Qualidade do código

| Princípio | Status |
| --- | --- |
| Código mínimo, sem escopo extra | ✅ Uma migration; T9 mexe só em `valida_viagem()`. A prevenção na tela ficou na EIX-40 (Out of Scope) |
| Mudanças cirúrgicas | ✅ `40cc577` troca um operador e o comentário, acrescenta um teste e ajusta a spec |
| Segue os padrões | ✅ `auth_perfil()` (AD-005), lock `for update` antes da checagem, SQLSTATE próprio `VG007` no cabeçalho |
| Valores asseridos batem com a spec | ✅ |
| Cobertura por camada (cada VG*** com caso que dispara e caso-limite) | ✅ VG001–VG007 têm caso que dispara e caso-limite aceito |
| Todo teste mapeia a AC ou caso de borda | ✅ Todos os 56 citam o VIAG-XX ou o caso de borda no nome |
| Guias seguidos | `AGENTS.md` §2.4, `.claude/CLAUDE.md` §3 e §7 |

O "Reenvio do fechamento depois de uma correção → `VG005`" (Assumption, `Confirmed? n`) não tem teste próprio. O caminho é o mesmo do VIAG-32 (Motorista com final diferente → `VG005`, N01 morto), então não conto como gap.

---

## Gate

Todos rodados na árvore real, sem modificação de código, em `40cc577`:

- Full: `node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects supabase`: 16 suítes, 296 testes, 0 falhas
- Build: `npm run typecheck` exit 0; `npm run lint` exit 0; `npm run test` exit 0. App: 79 suítes e 794 testes. Supabase: 16 suítes e 296 testes
- **Antes da feature** (`be9b7f1`): supabase 15 suítes, 240 testes
- **Depois**: 16 suítes, 296 testes. **Delta**: +56, todos de `viagem.test.ts`. Os testes de `rls`/`rls_perfis` têm a mesma contagem
- Pulados: nenhum. Falhas: nenhuma

---

## Rastreabilidade (recomendação para o `spec.md`)

O verificador não edita a spec.

| Requisito | Antes | Recomendado |
| --- | --- | --- |
| VIAG-01 a VIAG-27 | Verified | Verified (sem regressão) |
| VIAG-28 a VIAG-32 | Implementing | Verified |

Critérios de sucesso: testes e build verdes ✅. `db push` e `gen types` estão fora do alcance do verificador.

---

## Resumo

**Geral**: ✅ Pronto.
**Spec**: 32 critérios e 4 casos de borda, todos com evidência e valor correto.
**Sensor**: 31/31 observáveis e não equivalentes mortos. N08, sobrevivente da iteração 3, morre. N04 é equivalente desde o `>`. M18 e N12 (locks) não são observáveis no PGlite.
**Gate**: verde (794 app + 296 supabase; +56 da feature).
**Revisão manual antes do PR**:
- Antes do `db push`, rodar na nuvem a query do cabeçalho da migration (`supabase/migrations/20261015000100_viagem_regras.sql:10-11`): nenhum veículo com duas viagens `EmAndamento`.
- Os locks `for update` (insert, update do inicial e correção do final) sob concorrência real só podem ser conferidos com duas sessões num Postgres de verdade.
- Depois do push, regerar `src/types/database.ts` com `km_rodado`.
- Avisar a EIX-41: o reenvio do fechamento depois de uma correção volta `VG005` e vai para a fila de revisão.
