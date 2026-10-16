# EIX-77 · Navegação da S5 — Validação

## Validation: EIX-77 navegação da S5 — PASS

**Data**: 2026-10-16
**Iteração**: 2 de no máximo 3
**Spec**: `.specs/features/eix77-navegacao-s5/spec.md`
**Diff range**: `main..HEAD` em `feat/eix-77-navegacao-s5` (8 commits, `58c8382..71cc77f`; base `main` = `224cd66`)
**Verifier**: sub-agente independente (autor ≠ verificador)

Os 15 requisitos (NAV5-01 a NAV5-15) e as duas edge cases têm evidência, e o valor testado bate com a spec. O sensor matou os 13 mutantes, inclusive os 3 que sobreviveram na iteração 1.

---

## Histórico

| Iteração | Commit | Veredito | O que mudou |
| --- | --- | --- | --- |
| 1 | `ee13514` | Reprovado | Sensor 10/13. Dava para tirar do `Stack.Protected` as rotas `/rotas/[id]/editar`, `/manutencoes/nova` e `/viagens/[id]/fechar` sem quebrar nenhum teste. A edge case 1 dizia "coberto por NAV5-07 a NAV5-10", mas esses ACs não listavam as 3 URLs |
| 2 | `71cc77f` | Aprovado | Só teste e spec, sem mudança de produção. `telasDaFrota` ganhou `/rotas/r1/editar` e `/manutencoes/nova`; o caso NAV5-10 virou `it.each` com `/viagens/nova` e `/viagens/v1/fechar`; NAV5-07 e NAV5-10 da spec listam as 8 URLs |

---

## Conclusão das tasks

| Task | Status | Observação |
| --- | --- | --- |
| T1 Ícones | ✅ Feita | `src/ui/icons.ts` só ganhou linhas (autorizado na spec) |
| T2 Placeholders de Rotas | ✅ Feita | — |
| T3 Placeholders de Manutenção | ✅ Feita | — |
| T4 Placeholders de Viagens | ✅ Feita | — |
| T5 Rotas, títulos e guards | ✅ Feita | Lacuna da iteração 1 fechada em `71cc77f` |
| T6 Hub de Frota | ✅ Feita | — |
| T7 Lista de veículos interna | ✅ Feita | — |

---

## Critérios de aceite contra a spec

| Req | Critério | Resultado esperado pela spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- | --- |
| NAV5-01 | Aba Frota mostra título e entradas | Texto "Frota" + entradas "Veículos", "Rotas", "Manutenções" | `src/navigation/__tests__/FrotaHubView.test.tsx:18` - `expect(screen.getByText('Frota')).toBeOnTheScreen()`; `:19-21` - `getByRole('button', { name: 'Veículos' / 'Rotas' / 'Manutenções' })` | ✅ |
| NAV5-02 | Tocar "Veículos" | `/frota/veiculos` | `src/navigation/__tests__/FrotaHubView.test.tsx:25,33-34` - `expect(mockPush).toHaveBeenCalledTimes(1)`; `toHaveBeenCalledWith('/frota/veiculos')` | ✅ |
| NAV5-03 | Tocar "Rotas" | `/rotas` | `src/navigation/__tests__/FrotaHubView.test.tsx:26,34` - `toHaveBeenCalledWith('/rotas')` | ✅ |
| NAV5-04 | Tocar "Manutenções" | `/manutencoes` | `src/navigation/__tests__/FrotaHubView.test.tsx:27,34` - `toHaveBeenCalledWith('/manutencoes')` | ✅ |
| NAV5-05 | Gestor entra no app | Abre em `/frota` com o hub, não a lista | `__tests__/routes/navegacaoPorPerfil.test.tsx:126` - `expect(router.getPathname()).toBe(rotaInicial)` com `rotaInicial: '/frota'` (`:83`); `src/navigation/__tests__/FrotaRoute.test.tsx:13-15` - a aba renderiza `getByRole('button', { name: 'Veículos' })` e `queryByPlaceholderText('Buscar por placa ou modelo')` ausente | ✅ |
| NAV5-06 | Admin abre as 8 URLs | Headers "Veículos", "Rotas", "Nova rota", "Editar rota", "Manutenções", "Nova manutenção", "Abrir viagem", "Fechar viagem" | `__tests__/routes/navegacaoPorPerfil.test.tsx:423-430` (tabela) + `:437-439` - `headersVisiveis().find((h) => h.props.title === titulo)`; `expect(header).toBeDefined()`; `hideBackButton` `false` | ✅ |
| NAV5-07 | Motorista/Financeiro em `/frota/veiculos`, `/rotas`, `/rotas/nova`, `/rotas/r1/editar`, `/manutencoes`, `/manutencoes/nova` | Volta para a home do perfil (Financeiro `/financeiro`, Motorista `/viagens`) sem mostrar a tela | `__tests__/routes/navegacaoPorPerfil.test.tsx:250-257` (as 6 URLs) + `:268-270` - `findByText(telaInicial)`; `queryByText(tela)).not.toBeOnTheScreen()`; `getPathname()).toBe(rotaInicial)` | ✅ |
| NAV5-08 | Gestor em `/frota/veiculos`, `/rotas`, `/manutencoes` | Mostra a tela pedida | `__tests__/routes/navegacaoPorPerfil.test.tsx:283-284` - `findByText(tela)`; `getPathname()).toBe(rota)` | ✅ |
| NAV5-09 | Motorista em `/viagens/nova` | Mostra abrir viagem | `__tests__/routes/navegacaoPorPerfil.test.tsx:293-294` - `findByText('Tela Abrir Viagem')`; `getPathname()).toBe('/viagens/nova')` | ✅ |
| NAV5-10 | Financeiro em `/viagens/nova` ou `/viagens/v1/fechar` | Volta para a home do perfil (`/financeiro`) | `__tests__/routes/navegacaoPorPerfil.test.tsx:297-300` (as 2 URLs) + `:306-308` - `findByText('Tela Financeiro')`; `queryByText(tela)).not...`; `getPathname()).toBe('/financeiro')` | ✅ |
| NAV5-11 | Cada rota renderiza a view da feature | 8 rotas + aba Viagens → view de `src/features/{rotas,manutencao,viagens}` (e `veiculos`) com as props certas | `__tests__/routes/rotasDaS5.test.tsx:71-84` - `getByText('RotaFormView {"rotaId":"id-1"}')`, `'FecharViagemView {"viagemId":"id-1"}'`, `'ViagensListView {}'` etc. | ✅ |
| NAV5-12 | Nenhuma rota interna com URL de aba | Nenhum `<aba>/index.tsx` ou `<aba>.tsx` fora de `(tabs)` | `__tests__/routes/colisaoComAbas.test.ts:36-37` - `expect(urlsInternas).not.toContain(urlDaAba)`; sanidade do varredor em `:33` | ✅ |
| NAV5-13 | Placeholders | Estado vazio com título e frase | `src/features/rotas/__tests__/placeholders.test.tsx:16-19`, `src/features/manutencao/__tests__/placeholders.test.tsx:15-18`, `src/features/viagens/__tests__/placeholders.test.tsx:17-20` - ícone do módulo, `getByText(titulo)`, `getByText(frase)`, `queryByRole('button')).not...` | ✅ |
| NAV5-14 | Lista de veículos | Sem "Frota" no conteúdo | `src/features/veiculos/__tests__/VeiculosListView.test.tsx:59` - `expect(screen.queryByText('Frota')).not.toBeOnTheScreen()` (+ `:60` "Eixo Certo") | ✅ |
| NAV5-15 | Voltar de `/frota/veiculos` | Retorna ao hub (`/frota`) | `__tests__/routes/navegacaoPorPerfil.test.tsx:473-482` - `navegador.back()`; `findByText('Tela Frota')`; `getPathname()).toBe('/frota')` | ✅ |

**Status**: ✅ Os 15 ACs estão cobertos e o valor testado bate com a spec. Nenhuma falta de precisão aberta.

---

## Sensor de discriminação

Scratch isolado, novo na iteração 2: `git worktree add --detach <scratchpad>/wt HEAD` (em `71cc77f`), com `node_modules` (symlink) e `.expo/types/router.d.ts` (cópia). Cada mutante foi aplicado sobre o scratch limpo (`git checkout -- . && git clean`) e testado com `npx jest <pastas> --selectProjects app`.

| # | Arquivo:linha | Mutação | Testes rodados | It. 1 | It. 2 |
| --- | --- | --- | --- | --- | --- |
| M1 | `app/(app)/_layout.tsx:50` | `guard={podeVerViagens}` → `guard={true}` | `__tests__/routes` | ✅ Morto | ✅ Morto (2 falhas) |
| M2 | `app/(app)/_layout.tsx:43-45` | `rotas/*` movidas para `podeVerCategorias` | `__tests__/routes` | ✅ Morto | ✅ Morto (4 falhas) |
| M3 | `app/(app)/_layout.tsx:44` | título de `rotas/nova` "Nova rota" → "Editar rota" | `__tests__/routes` | ✅ Morto | ✅ Morto |
| M4 | `src/navigation/FrotaHubView.tsx:14` | Veículos `href: '/frota/veiculos'` → `'/frota'` | `src/navigation` | ✅ Morto | ✅ Morto |
| M5 | `app/(app)/frota/index.tsx` (novo) | Recria a rota que colide com a aba Frota | `__tests__/routes` | ✅ Morto | ✅ Morto |
| M6 | `src/navigation/menu.ts:72` | `podeVerViagens: canSeeFrota(usuario)` (exclui Motorista nas telas internas) | `__tests__/routes`, `src/navigation` | ✅ Morto | ✅ Morto |
| M7 | `app/(app)/rotas/[id]/editar.tsx:8` | `<RotaFormView rotaId={id} />` → `<RotaFormView />` | `__tests__/routes` | ✅ Morto | ✅ Morto |
| M8 | `src/features/veiculos/VeiculosListView.tsx:83` | Reinsere `<Text variant="heading">Frota</Text>` | `src/features/veiculos` | ✅ Morto | ✅ Morto |
| M9 | `app/(app)/(tabs)/frota.tsx` | Aba volta a renderizar `VeiculosListView` | `src/navigation`, `__tests__/routes` | ✅ Morto | ✅ Morto |
| M10 | `src/navigation/FrotaHubView.tsx:10` | Manutenções `href: '/manutencoes'` → `'/rotas'` | `src/navigation` | ✅ Morto | ✅ Morto |
| M11 | `app/(app)/_layout.tsx:52` | `viagens/[id]/fechar` fora do `Stack.Protected` | `__tests__/routes` | ❌ Sobreviveu | ✅ Morto (1 falha) |
| M12 | `app/(app)/_layout.tsx:47` | `manutencoes/nova` fora do `Stack.Protected` | `__tests__/routes` | ❌ Sobreviveu | ✅ Morto (2 falhas) |
| M13 | `app/(app)/_layout.tsx:45` | `rotas/[id]/editar` fora do `Stack.Protected` | `__tests__/routes` | ❌ Sobreviveu | ✅ Morto (2 falhas) |

**Profundidade do sensor**: ampliada (13 mutações; RBAC de navegação é caminho de autorização).
**Resultado do sensor**: 13/13 mortos na iteração 2.

**Isolamento**: antes e depois do sensor, `git status --porcelain` da árvore real mostrou só os arquivos do próprio Verifier (`.specs/LESSONS.md` e `.specs/lessons.json` modificados, este `validation.md` sem versionar). Worktree removida com `git worktree remove --force`; `git worktree list` só mostra a árvore principal.

---

## Qualidade de código

| Princípio | Status |
| --- | --- |
| Código mínimo | ✅ Rotas só importam e renderizam a view; placeholders de 11 a 20 linhas |
| Mudanças cirúrgicas | ✅ `src/ui/icons.ts` só ganhou linhas (autorizado na spec); `VeiculosListView` só perdeu o bloco de título; `71cc77f` mexe só em teste e spec |
| Sem escopo extra | ✅ |
| Segue os padrões | ✅ `Stack.Protected` + `useMenu()`, hub no molde do `FinanceiroHubView`, sem valor visual hardcoded |
| Valor testado bate com a spec | ✅ |
| Cobertura por camada (rotas: caminho feliz + borda + erro em toda rota do escopo) | ✅ As 8 rotas novas têm header (Admin) e bloqueio por perfil; as permitidas têm caso de abertura |
| Todo teste mapeia para requisito | ✅ Ícones do hub em `FrotaHubView.test.tsx:37` cobrem a pré-condição da T1; "Operação"/"Cadastros" seguem a premissa de agrupamento da spec |
| Guias do projeto | ✅ `AGENTS.md` §2.5, skill `teste-componente` |

Observação menor, sem efeito no veredito: a T5 lista `src/navigation/__tests__/menu.test.ts` em "Where", mas o arquivo não mudou. `podeVerViagens` em `useMenu()` é coberto pela integração (M6 morre ali).

---

## Edge cases

- [x] URL interna aberta direto aplica o mesmo guard: as 6 URLs de Frota em `__tests__/routes/navegacaoPorPerfil.test.tsx:250-270` (Financeiro e Motorista) e as 2 de Viagens em `:297-308` (Financeiro). M1, M2 e M11 a M13 morrem.
- [x] Voltar de `/frota/veiculos` retorna ao hub: `__tests__/routes/navegacaoPorPerfil.test.tsx:473-482`.

---

## Gate

- **Comando**: `npm run typecheck && npm run lint && npm run test`
- **typecheck**: exit 0. **lint**: exit 0.
- **Projeto app**: 86 suítes, 855 testes, 855 passaram, 0 falharam, 0 pulados.
- **Projeto supabase**: 16 suítes, 296 testes, 296 passaram.
- **Testes do projeto app antes (`main` 224cd66)**: 794 testes / 79 suítes.
- **Depois (HEAD 71cc77f)**: 855 testes / 86 suítes.
- **Delta**: +61 testes, +7 suítes (iteração 1: +56; `71cc77f`: +5). Nenhum teste removido; os testes existentes alterados só ganharam casos.

---

## Rastreabilidade

| Requisito | Status na spec | Status verificado |
| --- | --- | --- |
| NAV5-01 a NAV5-15 | Verified | ✅ Verificado |
| Edge case 1 (guard em URL direta) | (sem ID) | ✅ Verificado |
| Edge case 2 (= NAV5-15) | Verified | ✅ Verificado |

---

## Resumo

**Geral**: ✅ Pronto para o PR.

**Checagem contra a spec**: 15/15 ACs batem com o resultado esperado; nenhuma falta de precisão aberta.
**Sensor**: 13/13 mortos.
**Gate**: 855 + 296 testes, 0 falhas; typecheck e lint limpos.

**O que funciona**: hub de Frota (título, entradas e destinos), Gestor abrindo em `/frota`, os 8 headers, bloqueio por perfil nas 8 URLs novas, as rotas renderizando a view da feature com as props certas, nenhuma colisão de URL com aba, placeholders e lista de veículos sem o título duplicado.

**Revisão manual antes do PR**: avisar o Diogo (EIX-79) de que a `VeiculosListView` perdeu o título e passou a usar `Screen underHeader` (premissa da spec). Conferir num aparelho a seta de voltar do header nativo.
