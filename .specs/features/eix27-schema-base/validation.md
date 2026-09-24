# EIX-27 schema base Validation

**Date**: 2026-09-24
**Spec**: `.specs/features/eix27-schema-base/spec.md`
**Diff range**: `main...HEAD` (887e2de..c343167, 12 commits)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

tasks.md header still shows `**Status**: In Progress` (spec.md:12 equivalent in tasks.md:12),
but all migrations, seeds, RLS, storage policies, tests, types and README sections described in
tasks.md exist and pass. No task is flagged blocked/partial in the file body.

---

## Spec-Anchored Acceptance Criteria

### P1: Tabelas e integridade

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: 10 tabelas em `public` | as 10 tabelas nomeadas existem | `supabase/tests/financeiro.test.ts:31-40` - `expect(resultado.rows).toHaveLength(10)` (query filtra pelas 10 tabelas nomeadas) | ✅ PASS |
| AC2: `viagem_id`/`divida_id` nulos com FK | insert sem os dois campos é aceito; insert com id inexistente é rejeitado (prova a FK) | `supabase/tests/financeiro.test.ts:42-50` - `expect(resultado.rows[0]?.id).toBeDefined()`; `financeiro.test.ts:52-70` - `.rejects.toThrow()` | ✅ PASS |
| AC3: FKs obrigatórias (`usuario.perfil_id`, `movimentacao.categoria_id`/`forma_pagamento_id`, `divida.categoria_id`, `viagem.veiculo_id`/`rota_id`/`motorista_id`, `manutencao.veiculo_id`) | insert sem cada FK obrigatória é rejeitado | `supabase/tests/frota.test.ts:134-159` (viagem: 3 combinações omitindo cada FK) - `.rejects.toThrow()`; `frota.test.ts:161-167` (manutencao sem veiculo_id) - `.rejects.toThrow()` | ⚠️ Spec-precision gap parcial — `movimentacao.categoria_id`/`forma_pagamento_id`, `divida.categoria_id` e `usuario.perfil_id` "not null" não têm teste explícito de rejeição sem o campo (só provados pela definição `not null` na migration, sem asserção de teste). `viagem.*` e `manutencao.veiculo_id` estão cobertos. |
| AC4: update grava `now()` em `data_atualizacao` | timestamp depois > timestamp antes | `supabase/tests/base_perfil_usuario.test.ts:90-106` - `expect(new Date(depois...).getTime()).toBeGreaterThan(new Date(antes...).getTime())`; `supabase/tests/financeiro.test.ts:113-138` mesmo padrão para `movimentacao` | ✅ PASS (só `usuario` e `movimentacao` diretamente testados; trigger é genérica e idêntica nas outras 8 tabelas — ver Discrimination Sensor) |
| AC5: `movimentacao Pago` sem `data_pagamento` rejeitado | insert `status_pagamento='Pago'` sem `data_pagamento` lança erro | `supabase/tests/financeiro.test.ts:72-80` - `.rejects.toThrow()` | ✅ PASS |
| AC6: placa repetida rejeitada | segunda `insert` com mesma placa lança erro | `supabase/tests/frota.test.ts:47-51` - `expect(criarVeiculo('ABC1D23')).rejects.toThrow()` | ✅ PASS |
| AC7: `hodometro_final <= hodometro_inicial` rejeitado | insert com final igual e com final menor ambos lançam erro | `supabase/tests/frota.test.ts:72-92` - dois `.rejects.toThrow()` (1000/1000 e 1000/900) | ✅ PASS |
| AC8: `status='Finalizada'` sem `hodometro_final` rejeitado | insert lança erro | `supabase/tests/frota.test.ts:94-106` - `.rejects.toThrow()` | ✅ PASS |
| AC9: valores monetários negativos rejeitados (`movimentacao.valor`, `divida.valor_parcela`, `manutencao.valor`) | insert com valor negativo lança erro nas 3 tabelas | `supabase/tests/financeiro.test.ts:93-101` (`movimentacao.valor`); `financeiro.test.ts:103-111` (`divida.valor_parcela`); `supabase/tests/frota.test.ts:122-132` (`manutencao.valor`) - todos `.rejects.toThrow()` | ✅ PASS |

### P1: Dados padrão

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: 4 perfis (Admin, Gestor de Frota, Financeiro, Motorista) | exatamente esses 4 nomes | `supabase/tests/base_perfil_usuario.test.ts:30-36` - `expect(...sort()).toEqual(['Admin','Financeiro','Gestor de Frota','Motorista'].sort())` | ✅ PASS |
| AC2: 6 categorias ativas nos tipos certos | Combustível/Pedágio/Manutenção/Salário/Financiamento=Saida, Frete=Entrada, todas ativas | `supabase/tests/catalogos.test.ts:18-33` - `toHaveLength(6)`, `.every(ativa)===true`, listas exatas de saida/entrada | ✅ PASS |
| AC3: 4 formas de pagamento ativas (Boleto, Pix, TED, Cartão Corporativo) | exatamente esses 4 nomes, ativos | `supabase/tests/catalogos.test.ts:35-45` - `toHaveLength(4)`, `.every(ativa)`, lista exata | ✅ PASS |
| AC4: seed idempotente (perfil, categoria, forma_pagamento) | reaplicar o insert não duplica | `supabase/tests/base_perfil_usuario.test.ts:38-47` (`total==='4'`); `supabase/tests/catalogos.test.ts:47-65` (`categorias total==='6'`, `formas total==='4'`) | ✅ PASS |

### P1: Acesso por perfil (RLS)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: RLS ativo nas 10 tabelas | `relrowsecurity = true` nas 10 | `supabase/tests/rls.test.ts:88-98` - `toHaveLength(10)` + `.every(relrowsecurity)===true` | ✅ PASS |
| AC2: `handle_new_user` cria `usuario` com perfil Motorista | insert em `auth.users` cria linha com `perfil_nome='Motorista'`, nome e google_subject_id corretos | `supabase/tests/base_perfil_usuario.test.ts:49-75` - `expect(usuario.rows[0]?.perfil_nome).toBe('Motorista')` (+ nome, google_subject_id) | ✅ PASS |
| AC3: Motorista vê zero linhas de `movimentacao`, `divida`, `categoria`, `forma_pagamento` | 4 queries retornam 0 linhas | `supabase/tests/rls.test.ts:100-112` - `toHaveLength(0)` × 4 | ✅ PASS |
| AC4: Motorista só vê a própria `viagem` | select retorna 1 linha = a própria | `supabase/tests/rls.test.ts:130-137` - `toHaveLength(1)` + `.toBe(viagemPropriaId)` | ✅ PASS |
| AC5: Admin/Financeiro leem e gravam `movimentacao`, `divida`, `categoria`, `forma_pagamento` | select > 0 e insert aceito, para os 2 perfis | `supabase/tests/rls.test.ts:114-128` - `.length` `toBeGreaterThan(0)` + insert `.id` `toBeDefined()` — só testa `movimentacao`, não repete para `divida`/`categoria`/`forma_pagamento` | ⚠️ Spec-precision gap — só `movimentacao` é exercitada nesse teste; `divida`/`categoria`/`forma_pagamento` para Admin/Financeiro não têm teste RLS direto de escrita (mas storage/catalog select coberto indiretamente por outros testes de leitura, não por Admin/Financeiro explicitamente) |
| AC6: Admin/Gestor gravam `veiculo`, `rota`, `viagem`, `manutencao` | insert aceito nos 2 perfis | `supabase/tests/rls.test.ts:153-172` - `veiculo` e `manutencao` `.id` `toBeDefined()` para Admin e Gestor; `viagem` update coberto em `rls.test.ts:139-151` (só motorista testado ali, não Admin/Gestor grava viagem nova); `rota` insert por Admin/Gestor não testado diretamente | ⚠️ Spec-precision gap — `rota` insert e `viagem` insert por Admin/Gestor não exercitados explicitamente |
| AC7: qualquer autenticado lê `veiculo`, `rota`, `perfil` | select > 0 (veiculo/rota) e = 4 (perfil) | `supabase/tests/rls.test.ts:185-195` - `.length` `toBeGreaterThan(0)` ×2 + `toHaveLength(4)` | ✅ PASS |
| AC8: não-Admin rejeitado ao gravar `usuario`/`perfil` | insert em `perfil` lança erro; update em `usuario` alheio afeta 0 linhas | `supabase/tests/rls.test.ts:197-213` - `.rejects.toThrow()` (perfil) + `toHaveLength(0)` (usuario) | ✅ PASS |
| AC9: delete rejeitado em `categoria`/`forma_pagamento`/`usuario`/`perfil` mesmo para Admin | delete afeta 0 linhas nas 4 tabelas | `supabase/tests/rls.test.ts:215-234` - `toHaveLength(0)` ×4 | ✅ PASS |
| AC10: não autenticado vê 0 linhas em todas | select em cada uma das 10 tabelas retorna 0 | `supabase/tests/rls.test.ts:236-256` - loop `toHaveLength(0)` para as 10 tabelas | ✅ PASS |

### P1: Comprovantes no Storage

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: bucket `comprovantes` com `public=false` | 1 linha, `public===false` | `supabase/tests/storage.test.ts:19-26` - `toHaveLength(1)` + `.toBe(false)` | ✅ PASS |
| AC2: Admin/Financeiro leem, enviam e apagam | insert/select para Financeiro; insert/delete para Admin | `supabase/tests/storage.test.ts:28-57` - `.id` `toBeDefined()`, `.length` `toBeGreaterThan(0)`, `toHaveLength(1)` (delete) | ✅ PASS |
| AC3: outro perfil rejeitado ao ler/enviar | Motorista: select=0 linhas, insert lança erro; Gestor de Frota: insert lança erro | `supabase/tests/storage.test.ts:59-84` - `toHaveLength(0)` + 2× `.rejects.toThrow()` | ✅ PASS |

### P2: Tipos e documentação

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: `src/types/database.ts` com as 10 tabelas | arquivo gerado presente, contém as 10 tabelas | `src/types/database.ts` — presença confirmada por leitura direta; enums `perfil_nome`/`tipo_categoria`/`status_veiculo`/`status_viagem`/`status_pagamento` em `src/types/database.ts:432-436`; nenhuma asserção de teste automatizado confere as 10 tabelas no arquivo de tipos | ⚠️ Spec-precision gap — nenhum teste Jest confere `database.ts`; confirmado só por leitura manual do Verifier (presença das 10 tabelas e 5 enums visualmente confirmada) |
| AC2: README descreve CLI, migrations, regenerar tipos | passos presentes | `README.md:132-159` - seção "3.1 Banco de dados: migrations e tipos" cobre `supabase link`, `db push`, `gen types typescript` | ✅ PASS (conteúdo confirmado por leitura; não é um AC testável por Jest) |
| AC3: `npm run typecheck` passa com `database.ts` presente | exit 0 | comando `npm run typecheck` rodado pelo Verifier em 2026-09-24, sem saída de erro (ver Gate Check) | ✅ PASS |

**Status**: ⚠️ Spec-precision gaps flagged (4) — nenhum GAP verdadeiro (nenhum AC sem cobertura alguma); os gaps são de granularidade de teste, não de comportamento não implementado. O comportamento SQL correspondente a cada gap listado é coberto indiretamente pela trigger genérica / policy genérica (`set_data_atualizacao()`, tabela de policies única por perfil aplicada a todas as tabelas do grupo) e confirmado por leitura de código, mas sem asserção de teste direta e isolada para cada tabela/perfil citado.

---

## Discrimination Sensor

Executado em worktree isolado (`git worktree add`), `node_modules` symlink do repo real,
`node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects supabase`.
`git stash` nunca usado. Baseline `git status --porcelain` do tree real: vazio antes e depois de
todas as mutações (confirmado).

| Mutação | File:line | Descrição | Killed? |
| --- | --- | --- | --- |
| 1 | `supabase/migrations/20260924000400_financeiro.sql:39` | `movimentacao_pago_tem_data_pagamento check (...)` trocado por `check (true)` (removeu a regra "Pago exige data_pagamento") | ✅ Killed — `financeiro.test.ts:72-80` falhou |
| 2 | `supabase/migrations/20260924000300_frota.sql:53` | `viagem_hodometro_final_maior`: `hodometro_final > hodometro_inicial` → `>=` | ✅ Killed — `frota.test.ts:72-92` falhou |
| 3 | `supabase/migrations/20260924000500_rls.sql:93-95` | `movimentacao_select`: adicionado `'Motorista'` à lista de perfis permitidos | ✅ Killed — `rls.test.ts:100-112` falhou |
| 4 | `supabase/migrations/20260924000300_frota.sql:17` | Removida a constraint `veiculo_placa_unique unique (placa)` | ✅ Killed — `frota.test.ts:47-51` falhou |
| 5 | `supabase/migrations/20260924000600_storage_comprovantes.sql:6` | Bucket `comprovantes` criado com `public = true` em vez de `false` | ✅ Killed — `storage.test.ts:19-26` falhou |

**Sensor depth**: lightweight (5 mutações manuais, acima do mínimo de 1-3 do tier padrão)
**Result**: 5/5 killed - PASS ✅

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ — migrations, tests e types correspondem ao escopo da spec |
| Surgical changes | ✅ — nenhum arquivo fora de `supabase/`, `src/types/database.ts`, `README.md`, `.specs/`, `docs/adr/`, `.claude/CLAUDE.md`, `package.json`/`package-lock.json`, `tsconfig.json` |
| No scope creep | ✅ — nenhuma feature de módulo (US01-14) implementada |
| Matches patterns | ✅ — snake_case, trigger única reaproveitada, policies seguindo a tabela do design.md |
| Spec-anchored outcome check (asserted values match spec) | ⚠️ 4 spec-precision gaps de granularidade (ver acima) — nenhuma asserção incorreta encontrada |
| Per-layer Coverage Expectation met (domain 1:1 ACs; routes happy+edge+error) | ⚠️ Parcial — AC3, AC5, AC6 (RLS) e P2-AC1 não têm 1:1 direto por tabela/perfil |
| Every test maps to a spec requirement - no unclaimed tests | ✅ — todo teste tem comentário de cabeçalho referenciando spec.md por migration |
| Documented guidelines followed | ✅ — AGENTS.md/CLAUDE.md: RLS em toda tabela, soft delete, `numeric` para dinheiro, IDs uuid, migrations em SQL versionado — todos seguidos |

---

## Edge Cases

- [x] `movimentacao Pendente` com `data_pagamento` preenchida é aceita — `supabase/tests/financeiro.test.ts:82-91` (`status_pagamento` retorna `'Pendente'`)
- [x] `viagem.hodometro_final` nulo com `status='EmAndamento'` é aceita — `supabase/tests/frota.test.ts:58-70` (`status` retorna `'EmAndamento'`)
- [x] `auth_perfil()` retorna nulo quando o usuário autenticado não tem linha em `usuario` — `supabase/tests/base_perfil_usuario.test.ts:120-131` (`toBeNull()`); a negação de acesso decorrente disso é coberta indiretamente por todas as policies usarem `auth_perfil() in (...)`, que nunca casa com `null`
- [x] placa com caixa/espaço diferente é tratada como formato inválido (rejeitada, não "mesma placa" silenciosamente aceita) — `supabase/tests/frota.test.ts:53-56` (`abc2d34` e `ABC 2D34` ambos `.rejects.toThrow()`). Nota: a spec descreve o edge case como "tratar como a mesma placa" — o design.md esclarece que a regra real é rejeitar o formato não normalizado (não normalizar silenciosamente), o que é o comportamento implementado e testado; texto do teste já documenta essa interpretação.

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm test` (rodados individualmente pelo Verifier em 2026-09-24)
- **typecheck**: 0 erros (`tsc --noEmit`, saída limpa)
- **lint**: 0 erros/avisos reportados (`expo lint`, saída limpa)
- **test**: `jest --selectProjects app` → 10 suites, 63 testes, todos passaram; `--selectProjects supabase` → 7 suites, 45 testes, todos passaram
- **Total**: 17 suites, 108 testes, 0 falhas, 0 skipped
- **Test count before feature**: N/A — feature cria os 7 arquivos de teste de `supabase/tests/` do zero; nenhuma migration nem teste supabase existia em `main`
- **Test count after feature**: 45 (supabase) + 63 (app, inalterado pela feature)
- **Delta**: +45 novos testes (supabase)
- **Skipped tests**: nenhum
- **Failures**: nenhuma

---

## Requirement Traceability (observação, não corrigido)

`spec.md` linha ~171-189 mostra a tabela de Requirement Traceability com todos os 16 IDs
(DB-01..DB-07, SEED-01, RLS-01..05, STO-01, TYPE-01, DOC-01) com Phase="Design" e
Status="Implementing", e o rodapé declara "Coverage: 16 total, 0 mapped to tasks, 16 unmapped".
Isso parece desatualizado/incorreto face ao código real (todos os 16 requisitos têm evidência
`file:line` acima), incluindo DOC-01 — reportado aqui sem correção, conforme instrução do
orquestrador.

---

## Verdict

**PASS ✅** — Todos os 16 requisitos da spec têm evidência `file:line` real (evidence-or-zero
satisfeito); nenhum GAP verdadeiro encontrado, só 4 spec-precision gaps de granularidade de
teste (comportamento coberto por regra/policy genérica, sem teste isolado por tabela/perfil
citado no AC). Gates (typecheck, lint, test) passam limpos. Sensor de discriminação mata 5/5
mutações injetadas, incluindo as 5 sugeridas pelo orquestrador (check `data_pagamento`, `>`→`>=`
no hodômetro, `'Motorista'` numa policy financeira, `unique` da placa, bucket público).
