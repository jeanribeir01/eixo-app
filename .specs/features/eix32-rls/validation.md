# EIX-32 (US18, RLS) Validation

**Date**: 2026-10-06
**Spec**: `.specs/features/eix32-rls/spec.md`
**Diff range**: `ed63f02..HEAD` (336ea34, fc161b4, 543fa75, debf143), branch `feat/eix-32-us18-rls`
**Verifier**: independent sub-agent (author ≠ verifier)

**Verdict**: PASS

---

## Task Completion

Não há `tasks.md` na pasta da feature (task pequena, spec direta). Os 4 commits do range cobrem: migration `perfil_select` (336ea34), matriz de testes (fc161b4), `src/lib/errors.ts` (543fa75) e troca nos repositórios (debf143). Todos presentes.

---

## Spec-Anchored Acceptance Criteria

| AC | Resultado definido na spec | `file:line` + assertion | Coberto |
| --- | --- | --- | --- |
| RLS-01 | nenhuma tabela de `public` sem RLS, dinâmico, nomeia a tabela | `supabase/tests/rls_perfis.test.ts:117-123` - varre `pg_class` (`relkind in ('r','p')`), `expect(tabelas.rows.length).toBeGreaterThanOrEqual(10)` e `expect(rows.filter(!relrowsecurity).map(relname)).toEqual([])` | PASS |
| RLS-02 | Motorista aprovado vê 0 linhas em movimentacao, divida, categoria, forma_pagamento | `supabase/tests/rls.test.ts:100-111` (anterior à task) - quatro `expect(...rows).toHaveLength(0)`; tabelas populadas em `rls.test.ts:68-80`; perfil padrão do helper é Motorista | PASS |
| RLS-03 | Motorista aprovado vê só as próprias viagens | `supabase/tests/rls.test.ts:134-135` - `toHaveLength(1)` e `rows[0]?.id` `toBe(viagemPropriaId)` (existe viagem alheia, `rls.test.ts:61-66`) | PASS |
| RLS-04 (insert) | insert de viagem para outro motorista rejeitado com `42501` | `supabase/tests/rls_perfis.test.ts:138` - `expect(codigo).toBe('42501')` | PASS |
| RLS-04 (update) | update da viagem alheia afeta 0 linhas e a linha não muda | `supabase/tests/rls.test.ts:145-149` - `update ... returning id` com `expect(semAlteracao.rows).toHaveLength(0)` | PASS com ressalva (ver Lacunas) |
| RLS-05 | Gestor de Frota lê todas as linhas de veiculo, rota, viagem, manutencao | `supabase/tests/rls_perfis.test.ts:149-150` - `expect(esperado).toBeGreaterThan(0)` e `expect(linhas.rows).toHaveLength(esperado)`, com `esperado` = `count(*)` sem RLS (`:50-53`), por tabela (`it.each` em `:143`) | PASS |
| RLS-06 | Gestor de Frota vê 0 linhas das 4 tabelas financeiras | `supabase/tests/rls_perfis.test.ts:158` - `expect(linhas.rows).toHaveLength(0)` (`it.each` de `:154`, tabelas populadas em `:87-106`) | PASS |
| RLS-07 | Gestor e Motorista inserindo em movimentacao recebem `42501` | `supabase/tests/rls_perfis.test.ts:178` - `expect(codigo).toBe('42501')` para os dois perfis (`:164-167`) | PASS |
| RLS-08 | Gestor e Motorista em `resumo_caixa` / `criar_divida` recebem `42501` | `supabase/tests/resumo_caixa.test.ts:261` (`expect(codigo).toBe('42501')`, SALDO-06) e `supabase/tests/divida.test.ts:432` (`expect(criar).toBe('42501')`, DIV-06) | PASS |
| RLS-09 | Admin e Financeiro leem todas as linhas das 4 tabelas | `supabase/tests/rls_perfis.test.ts:193-194` - `toBeGreaterThan(0)` e `toHaveLength(esperado)`, 2 perfis x 4 tabelas (`:183-187`) | PASS |
| RLS-10 | pendente e bloqueado: 0 linhas em categoria, forma_pagamento, divida, movimentacao, veiculo, rota, viagem, manutencao | `supabase/tests/rls_perfis.test.ts:209` - `expect({ tabela, linhas }).toEqual({ tabela, linhas: 0 })` nas 8 tabelas, perfil Admin (pior caso), 2 status (`:202-205`) | PASS |
| RLS-11 | `usuario`: só a própria linha | `supabase/tests/rls_perfis.test.ts:219` - `expect(usuarios.rows.map(id)).toEqual([id])` (a tabela tem outros usuários, criados em `:65-67`) | PASS |
| RLS-12 | `perfil`: só a linha do próprio `perfil_id` | `supabase/tests/rls_perfis.test.ts:229` - `expect(perfis.rows.map(nome)).toEqual(['Financeiro'])` (perfil diferente do padrão, prova que vem do `perfil_id`) | PASS |
| RLS-13 | Ativo lê os 4 perfis | `supabase/tests/rls_perfis.test.ts:238` - `expect([...].sort()).toEqual(['Admin','Financeiro','Gestor de Frota','Motorista'])` | PASS |
| RLS-14 | `42501` traduzido para "Acesso negado. Seu perfil não tem permissão para esta ação." | `src/lib/__tests__/errors.test.ts:5` - `expect(MENSAGEM_ACESSO_NEGADO).toBe('Acesso negado. Seu perfil não tem permissão para esta ação.')` e `:11` - `expect(ehAcessoNegado({ code: '42501' })).toBe(true)`. A string literal é exata e igual à da spec | PASS |
| RLS-15 | código diferente de `42501` não é acesso negado | `src/lib/__tests__/errors.test.ts:17` - `expect(ehAcessoNegado({ code })).toBe(false)` para `23514, 23503, P0001, P0002, 22023, PGRST116, ''` | PASS |
| RLS-16 | categorias, formas de pagamento, movimentações, dívidas e caixa devolvem `{ ok: false }` com a mensagem de RLS-14 | `src/features/categorias/__tests__/categoriasRepository.test.ts:169-176`, `src/features/formas-pagamento/__tests__/formasPagamentoRepository.test.ts:124-130`, `src/features/movimentacoes/__tests__/movimentacoesRepository.test.ts:203` (criar) e `:238-244` (atualizar), `src/features/dividas/__tests__/dividasRepository.test.ts:107` (criar, `it.each`), `src/features/caixa/__tests__/fonteResumoCaixa.test.ts:42-48`. Todos com `toEqual({ ok: false, mensagem: 'Acesso negado. Seu perfil não tem permissão para esta ação.' })` literal | PASS |

**Status**: 16/16 ACs cobertos, com valor igual ao definido na spec. Nenhuma lacuna de precisão que reprove. Ressalvas abaixo.

Critério de sucesso "nenhum repositório compara `'42501'` fora de `src/lib/errors.ts`": `grep -rn 42501 src` fora de testes só acha `src/lib/errors.ts:11,14`. Atendido.

### Edge cases

- [x] anon vê 0 linhas em tudo: `supabase/tests/rls.test.ts:236-256` (mantido).
- [x] tabela nova sem RLS derruba RLS-01 e aparece pelo nome: o mutante M3 (RLS desligado numa migration final) foi morto pelo teste RLS-01.
- [x] aprovado vira Bloqueado e passa a seguir RLS-10 a RLS-12: `comoUsuario` com `status: 'Bloqueado'` em `rls_perfis.test.ts:202-231`; `auth_perfil()` lê o status a cada chamada.

---

## Discrimination Sensor

Escopo crítico (autorização). Profundidade manual, 19 mutações em worktree temporário fora do repo: migration final extra (`20261007000100_mut.sql`) para os mutantes SQL, edição de arquivo para os de TypeScript, tudo revertido a cada rodada.

| # | Mutação | Resultado | Teste que matou |
| --- | --- | --- | --- |
| M1 | `perfil_select` volta a `using (true)` | morto | `rls_perfis.test.ts` RLS-12 (pendente e bloqueado) |
| M2 | `movimentacao_select` aceita Gestor de Frota | morto | RLS-06 (movimentacao) e `movimentacao_regras.test.ts` MOV-07 |
| M3 | `disable row level security` em `forma_pagamento` | morto | RLS-01, RLS-06, RLS-10 e 5 testes de `rls.test.ts` |
| M4 | `auth_perfil()` ignora `status` | morto | RLS-10, RLS-11, RLS-12, `divida.test.ts` DIV-06, `resumo_caixa.test.ts` SALDO-06, `usuario_status.test.ts` |
| M5 | `viagem_insert` aceita qualquer `motorista_id` do Motorista | morto | RLS-04 (insert) |
| M6 | `movimentacao_insert` aceita Gestor de Frota | morto | RLS-07 (Gestor) e MOV-07 |
| M7 | `usuario_select` com `using (true)` | morto | RLS-11 |
| M8 | `viagem_select` mostra todas as viagens ao Motorista | morto | `rls.test.ts` "motorista só enxerga a própria viagem" (RLS-03) |
| M9 | `manutencao_select` com `using (true)` | morto | RLS-10 |
| M10 | Gestor de Frota só vê as próprias viagens | morto | RLS-05 (viagem) |
| M11 | `viagem_update` aceita qualquer perfil, isolado | sobreviveu, equivalente | nenhum, ver abaixo |
| M11b | `viagem_update` e `viagem_select` abertos juntos | morto | `rls.test.ts` update da viagem alheia (RLS-04) e RLS-03 |
| M12 | `ehAcessoNegado` retorna sempre `true` | morto | `errors.test.ts` RLS-15 e 8 testes de repositório |
| M13 | `MENSAGEM_ACESSO_NEGADO` sem o ponto após "negado" | morto | `errors.test.ts` RLS-14 e 6 suítes de RLS-16 |
| M14 | categorias volta à frase própria | morto | `categoriasRepository.test.ts` RLS-16 |
| M15 | formas de pagamento volta à frase própria | morto | `formasPagamentoRepository.test.ts` RLS-16 |
| M16 | movimentações volta à frase própria | morto | `movimentacoesRepository.test.ts` (criar e atualizar) |
| M17 | dívidas volta à frase própria | morto | `dividasRepository.test.ts` |
| M18 | caixa volta à frase própria | morto | `fonteResumoCaixa.test.ts` |

M11 é um mutante equivalente em comportamento: num UPDATE, o Postgres exige que a linha seja visível pela policy de select. Como `viagem_select` já esconde a viagem alheia do Motorista, o update afeta 0 linhas mesmo com `viagem_update` aberta. O resultado do AC (0 linhas, linha intacta) se mantém e é protegido por `viagem_select` (M8, M11b). A policy de update só é exercitada junto com a de select.

**Sensor depth**: P0, manual, mais de 5 mutações
**Result**: 18/18 mutantes comportamentais mortos, 1 equivalente (M11) - PASS

**Isolamento**: `git status --porcelain` da árvore real foi vazio antes e depois (idêntico). O worktree temporário e a junction de `node_modules` foram removidos; `node_modules` real intacto.

---

## Code Quality

| Princípio | Status |
| --- | --- |
| Mínimo de código (errors.ts com 2 exports, migration de 1 policy) | OK |
| Mudanças cirúrgicas (só os repositórios que traduziam `42501`) | OK |
| Sem escopo extra | OK |
| Segue padrões do repo (`it.each`, helpers `comoUsuario`, comentários do porquê em português) | OK |
| Valor asseriado igual ao da spec (frase literal, `42501`, contagem sem RLS) | OK |
| Todo teste novo mapeia para um RLS-NN no nome ou comentário | OK |
| Diretrizes seguidas | AGENTS.md (teste por task, RLS no banco, mensagens em português) |

---

## Gate Check

- `npm run typecheck`: exit 0
- `npm run lint`: exit 0, sem avisos
- `npm run test`: app 56 suítes, 451 testes passando; supabase (PGlite) 12 suítes, 163 testes passando. Total 614 passando, 0 falhando, 0 pulados.
- Os testes só aumentaram no range (arquivos novos `rls_perfis.test.ts` e `errors.test.ts`, mais 1 teste em formas de pagamento); nenhum foi removido. As asserções editadas só trocaram a frase antiga pela da spec, sem ficar menos específicas.

---

## Lacunas e ressalvas (não reprovam)

1. RLS-04 (update): `rls.test.ts:145-149` prova 0 linhas afetadas, mas não relê a linha para confirmar que ficou inalterada. É consequência direta de 0 linhas; risco baixo, mas a asserção é um pouco mais fraca que o texto "leave that row unchanged".
2. RLS-02, RLS-03 e RLS-08 estão provados em arquivos anteriores à task (verificado com `file:line` acima), não em `rls_perfis.test.ts`. A spec e o cabeçalho do arquivo novo declaram isso.
3. RLS-07 cobre só `insert`, que é o que o AC pede.

---

## Requirement Traceability Update

RLS-01 a RLS-16: Implementing -> Verified (evidência acima).

## Summary

**Overall**: Ready

**Spec-anchored check**: 16/16 ACs com valor igual ao da spec, 0 spec-precision gaps reprovadores (1 ressalva em RLS-04)
**Sensor**: 18/18 mutantes comportamentais mortos (1 equivalente)
**Gate**: 614 testes passando (451 app + 163 supabase), typecheck e lint verdes

**Next steps**: revisão humana do PR. Nenhum fix task.
