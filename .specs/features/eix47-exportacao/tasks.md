# EIX-47 · US14 — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline (sem `design.md`). Funções puras montam o CSV e o HTML do PDF; um módulo fino fala com `expo-file-system`, `expo-print` e `expo-sharing`; o componente orquestra alerta, loading e feedback. Decisões no `spec.md`.
**Status**: Done (Verifier PASS na rodada 2, ver validation.md)

---

## Test Coverage Matrix

> Guidelines found: `AGENTS.md` §2.5 ("render do componente, caminho feliz e as validações citadas nos critérios de aceite"), `package.json` (jest project `app`), `.claude/skills/teste-componente`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Funções puras (CSV, HTML, nome) | unit | Cada AC de formato: BOM, `;`, CRLF, aspas, apóstrofo, valor, escape HTML, totais, paginação, nome por modo | `src/features/relatorios/export/__tests__/*.test.ts` | `npx jest src/features/relatorios --selectProjects app` |
| Consulta (supabase mockado) | unit | Filtro do período, paginação de 1000, ordem, erro genérico e 42501, Zod recusa formato errado | `src/features/relatorios/export/__tests__/*.test.ts` | `npx jest src/features/relatorios --selectProjects app` |
| Arquivo e compartilhamento (módulos Expo mockados) | unit | Grava com nome e conteúdo certos, mime type, sharing indisponível, erro de escrita | `src/features/relatorios/export/__tests__/*.test.ts` | `npx jest src/features/relatorios --selectProjects app` |
| Componente / tela | unit (Testing Library) | Render, alerta de formato, loading, sucesso, cada erro, período vazio, perfil | `src/features/**/__tests__/*.test.tsx` | `npx jest src/features/relatorios src/features/dashboard --selectProjects app` |
| Dependências e ADR | none | build gate only | - | `npm run typecheck && npm run lint` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks with unit tests only | `npx jest src/features/relatorios --selectProjects app` |
| Build | End of phase / no-test tasks | `npm run typecheck && npm run lint && npm run test` |

---

## Execution Plan

### Phase 1: Dependências

```
T1
```

### Phase 2: Montagem do arquivo e dados

```
T1 → T2 → T3 → T4
```

### Phase 3: Componente e tela

```
T4 → T5 → T6
```

---

## Task Breakdown

### T1: ✅ Instalar `expo-print` e `expo-sharing` e registrar o ADR

**What**: Dependências nas versões do SDK 57 (lockfile gerado com npm 10), ADR 0006 e `EXPO_PUBLIC_NOME_EMPRESA` no `.env.example`.
**Where**: `package.json`, `package-lock.json`, `docs/adr/0006-exportacao-relatorios.md`, `.env.example`
**Depends on**: None
**Reuses**: `docs/adr/0005-reanimated-motion.md` (formato)
**Requirement**: EXP-10, EXP-15

**Tools**:

- MCP: NONE
- Skill: `create-adr`

**Done when**:

- [x] `npx -y npm@10 ci --dry-run --ignore-scripts` passa
- [x] Gate build passa

**Tests**: none
**Gate**: build

---

### T2: ✅ Montar CSV, HTML do PDF e nome do arquivo

**What**: Funções puras: linha do relatório a partir da movimentação, `gerarCsv`, `gerarHtmlPdf`, `nomeDoArquivo` e o nome da empresa.
**Where**: `src/features/relatorios/export/{linhas,csv,pdf,arquivo,empresa}.ts`
**Depends on**: T1
**Reuses**: `src/lib/money.ts` (`formatarMoeda`), `src/lib/datas.ts` (`isoParaDataBR`), `src/features/movimentacoes/types.ts` (`rotuloStatus`), `src/ui/tokens.ts` (cores do PDF)
**Requirement**: EXP-05, EXP-06, EXP-07, EXP-08, EXP-09, EXP-10, EXP-11, EXP-12, EXP-13, EXP-14

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] Testes cobrem CSV com acentos, aspas, `;`, quebra de linha, fórmula, valor 1,13 e milhar; PDF com 300 linhas, cabeçalho repetido, totais uma vez no fim, escape HTML, empresa vazia; nome nos três modos
- [x] Gate quick passa

**Tests**: unit
**Gate**: quick

---

### T3: ✅ Consulta das transações do período

**What**: `buscarTransacoesDoPeriodo(periodo)` com o filtro da data de referência, paginação de 1000 e ordem do spec.
**Where**: `src/features/relatorios/export/queries.ts`
**Depends on**: T2
**Reuses**: `src/features/movimentacoes/movimentacoesRepository.ts` (filtro `or` e `dataDeReferencia`), `src/lib/errors.ts`
**Requirement**: EXP-04, EXP-05, EXP-17

**Tools**:

- MCP: NONE
- Skill: `supabase-query`

**Done when**:

- [x] Testes cobrem filtro com as datas do período, 2 páginas (1000 + 3), ordem por data e descrição, 42501, erro genérico e linha inválida
- [x] Gate quick passa

**Tests**: unit
**Gate**: quick

---

### T4: ✅ Gravar o arquivo e abrir o Share Sheet

**What**: `gerarArquivoCsv`, `gerarArquivoPdf` e `compartilharArquivo`, devolvendo `Resultado`.
**Where**: `src/features/relatorios/export/compartilhar.ts`
**Depends on**: T3
**Reuses**: `src/lib/storage.ts` (uso do `File` do `expo-file-system`)
**Requirement**: EXP-12, EXP-14, EXP-15, EXP-18, EXP-19

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] Testes cobrem nome e conteúdo gravados, PDF A4 movido para o nome do período, mime type, sharing indisponível e erro de escrita
- [x] Gate quick passa

**Tests**: unit
**Gate**: quick

---

### T5: ✅ Componente "Exportar"

**What**: `ExportarRelatorio` com o botão primário, alerta de formato, aviso de período vazio, loading e callback de feedback.
**Where**: `src/features/relatorios/export/ExportarRelatorio.tsx`
**Depends on**: T4
**Reuses**: `src/features/movimentacoes/components/AnexoComprovante.tsx` (alerta com opções), `src/ui` (`Button`, `Column`, `Text`)
**Requirement**: EXP-03, EXP-15, EXP-16, EXP-17, EXP-18, EXP-19, EXP-20, EXP-21, EXP-22

**Tools**:

- MCP: NONE
- Skill: `teste-componente`, `tela-padrao`

**Done when**:

- [x] Testes cobrem render, alerta sem consulta, CSV e PDF com sucesso, loading, cada erro, período vazio com Cancelar e com Gerar mesmo assim
- [x] Gate quick passa

**Tests**: unit
**Gate**: quick

---

### T6: ✅ Exportar na aba Dashboards

**What**: `RankingView` mostra o `ExportarRelatorio` abaixo do filtro para Admin e Financeiro e o feedback dele no Snackbar da tela.
**Where**: `src/features/dashboard/ranking/RankingView.tsx`
**Depends on**: T5
**Reuses**: o `erroGraficos` da própria `RankingView`
**Requirement**: EXP-01, EXP-02, EXP-15

**Tools**:

- MCP: NONE
- Skill: `teste-componente`

**Done when**:

- [x] Teste da `RankingView` cobre botão para Financeiro, ausência para Gestor e Snackbar de sucesso com o período em uso
- [x] Gate build passa

**Tests**: unit
**Gate**: build
