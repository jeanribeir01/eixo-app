# EIX-79 Tasks

## Execution Protocol

Usar tlc-spec-driven. Plano aprovado pelo usuário em 16/10/2026. Em 18/10/2026 o usuário autorizou explicitamente commit, push e PR para Jean Ribeiro. Não encerrar a issue no Linear. Execução inline e verificação independente ao concluir.

## Test Coverage Matrix

Guidelines: AGENTS.md §2.5, skills formulario-validado, supabase-query e teste-componente; package.json e testes atuais da feature.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Schema | unit | Limites, obrigatório, inteiro, fuso e virada de ano | veiculos/__tests__/schema.test.ts | quick |
| Repository | unit | Payload, colunas, guarda condicional, zero linhas, RLS, filtros | veiculos/__tests__/repository.test.ts | quick |
| Views | unit | Render, fluxo feliz, cancelamento, loading, erro, legado e inativo | veiculos/__tests__/*View.test.tsx | quick |
| Backend existente | integration | Permissões e proteção contra delete | supabase/tests | build |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Cada tarefa de código | npx.cmd jest --selectProjects app --runInBand src/features/veiculos |
| Build | Conclusão | npm run typecheck; npm run lint; npm run test |

## Execution Plan

```text
T1 → T2 → T3 → T4 → T5 → T6
```

### Phase 1: Ano e contrato

T1 → T2 → T3

### Phase 2: Interface

T4 → T5

### Phase 3: Verificação

T6

## Task Breakdown

### T1: Validar ano de fabricação

**What**: Exigir ano inteiro e limite dinâmico de São Paulo, referenciando migration.
**Where**: `src/features/veiculos/schema.ts`
**Depends on**: None
**Requirement**: ANO-01, ANO-02
**Done when**: Testes de ano obrigatório, limites, inválidos e virada passam.
**Tests**: unit, schema.test.ts
**Gate**: quick

### T2: Completar dados de veículo

**What**: Incluir ano nos tipos derivados e fluxo de leitura/escrita; traduzir 23514.
**Where**: `src/features/veiculos/repository.ts`
**Depends on**: T1
**Reuses**: types.ts, tipos gerados, mock existente
**Requirement**: ANO-03, ANO-04, ANO-05
**Done when**: Ano selecionado/persistido, null aceito na resposta e erros no campo correto; types.ts acompanha o contrato.
**Tests**: unit, repository.test.ts
**Gate**: quick

### T3: Expor inativação e selecionáveis

**What**: Implementar update condicional e consultas por finalidade.
**Where**: `src/features/veiculos/repository.ts`
**Depends on**: T2
**Requirement**: INA-01, INA-02, SEL-02, SEL-03, SEL-04
**Done when**: Query tem id/status; zero linhas falha; delete nunca chamado; selecionáveis usam lista permitida.
**Tests**: unit, repository.test.ts
**Gate**: quick

### T4: Completar formulário

**What**: Campo ano, legado null, status inativo preservado, retry de carga.
**Where**: `src/features/veiculos/VeiculoFormView.tsx`
**Depends on**: T3
**Requirement**: ANO-01, ANO-02, ANO-04, ANO-05, ANO-06
**Done when**: Render/criação/edição/validação/loading/erro e preservação de inativo testados.
**Tests**: unit, VeiculoFormView.test.tsx
**Gate**: quick

### T5: Inativar pela lista e filtrar

**What**: Confirmação, loading, feedback, filtro Inativo e atualização coerente com filtro.
**Where**: `src/features/veiculos/VeiculosListView.tsx`
**Depends on**: T4
**Requirement**: INA-03, INA-04, INA-05, INA-06, INA-07, INA-08, SEL-01
**Done when**: Testes cobrem confirmação/cancelamento/pendência/sucesso/falha/filtros; UI reutilizada sem src/ui.
**Tests**: unit, VeiculosListView.test.tsx
**Gate**: quick

### T6: Validar entrega e segurança

**What**: Checks completos, revisão independente, sensor isolado e evidências.
**Where**: `.specs/features/eix79-ano-inativar/validation.md`
**Depends on**: T5
**Requirement**: INA-09 e todos os critérios
**Done when**: Checks completos passam, regressões revisadas e relatório tem evidência por critério.
**Tests**: integration, suite completa app/Supabase
**Gate**: build

## Execution Status

| Task | Status | Evidence |
| --- | --- | --- |
| T1 | Done | schema: 19 testes verdes |
| T2 | Done | leitura/escrita/erros cobertos em repository.test.ts |
| T3 | Done | repository: 30 testes verdes; atualização de inativo protegida também contra edição concorrente |
| T4 | Done | formulário: 20 testes verdes |
| T5 | Done | lista: 14 testes verdes |
| T6 | Done | typecheck/lint verdes; 900 testes app + 300 backend; Verifier PASS, sensor 6/6 |

Implementação inicialmente mantida sem commits por instrução do usuário; entrega por commit, push e PR autorizada em 18/10/2026. Testes existentes que afirmavam ausência do ano foram atualizados conforme o plano aprovado, mantendo a cobertura anterior.

A verificação de autorização acrescenta quatro casos a `supabase/tests/rls.test.ts`: quatro perfis, cada um com quatro status, conferindo também o estado persistido. Nenhuma policy ou migration alterada.

## Diagram-Definition Cross-Check

T1 sem dependência; T2 depende de T1; T3 de T2; T4 de T3; T5 de T4; T6 de T5. Transições de fase são sequenciais.

## Test Co-location Validation

T1 schema/unit; T2 e T3 repository/unit; T4 e T5 views/unit; T6 suite/integration. Cada entrega inclui seus testes; nenhuma redução de testes existentes.
