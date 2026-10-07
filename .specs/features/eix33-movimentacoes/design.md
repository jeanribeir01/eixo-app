# EIX-33 Movimentações Design

**Spec**: `.specs/features/eix33-movimentacoes/spec.md`
**Status**: Draft

---

## Architecture Overview

Mesmo molde de Categorias (EIX-28) e Formas de Pagamento (EIX-29): rota fina em `app/(app)/movimentacoes/` → view da feature → repositório que fala com o Supabase e devolve `Resultado<T>`. Sem TanStack Query (não instalado; o padrão do repo é `useState` + `useFocusEffect`). Regras de integridade ficam também no banco, por migration nova.

```mermaid
graph TD
    R[app/(app)/movimentacoes/*] --> L[MovimentacoesListView]
    R --> F[MovimentacaoFormView]
    F --> C[camposMovimentacao config]
    C --> CM[CampoMoeda] & CD[CampoData] & S[ui/Select] & I[ui/Input]
    F --> Z[schema.ts Zod]
    L --> Repo[movimentacoesRepository]
    F --> Repo
    Repo --> CatRepo[categoriasRepository.listarCategorias]
    Repo --> FpRepo[formasPagamentoRepository.listarFormasPagamento]
    Repo --> SB[(Supabase: movimentacao + RLS + checks)]
    CM --> Money[lib/money.ts]
    CD --> Datas[lib/datas.ts]
    L --> Money & Datas
```

Abordagens consideradas:

1. **Repositório + views com `useState` (escolhida)** — idêntica às duas features já mergeadas; o time sabe explicar na banca.
2. TanStack Query — exige dependência nova e ADR a 8 dias da entrega.
3. Filtro de tipo/status no servidor — uma chamada por troca de aba; o volume de um mês é pequeno, então o mês vem do servidor e tipo/status filtram na memória (não é agregação de dashboard, RNF06 não se aplica).

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| Padrão de repositório `Resultado<T>` + `traduzirErro` | `src/features/categorias/categoriasRepository.ts` | Mesmo formato e mensagens |
| `listarCategorias`, `rotuloTipoCategoria` | `src/features/categorias/` | Opções do Select (filtrar `ativa`) e rótulo Entrada/Saída |
| `listarFormasPagamento` | `src/features/formas-pagamento/formasPagamentoRepository.ts` | Opções do Select (filtrar `ativa`) |
| Views de lista/form | `src/features/formas-pagamento/*View.tsx` | Estados carregando/vazio/erro, Snackbar, `router.back()` no sucesso |
| `Screen`, `Input`, `Button`, `Tabs`, `ListItem`, `EmptyState`, `Snackbar`, `Column`, `Text` | `src/ui/` | Toda a UI |
| Guard `podeVerCategorias` | `app/(app)/_layout.tsx`, `src/navigation/menu.ts` | Admin + Financeiro |
| Harness PGlite (`criarBanco`, `comoUsuario`) | `supabase/tests/helpers/db.ts` | Testes da migration |

### Integration Points

| System | Integration Method |
| --- | --- |
| `movimentacao` | `supabase.from('movimentacao')` com join `categoria(id, titulo, tipo, ativa)` e `forma_pagamento(id, nome, ativa)` |
| RLS | Já restringe a Admin/Financeiro (`20260924000500_rls.sql`); migration nova só altera `movimentacao_delete` |
| Aba Financeiro | Novo atalho em `app/(app)/(tabs)/financeiro.tsx` |

---

## Components

### Migration `20261004000100_movimentacao_regras.sql`

- **Purpose**: Valor estritamente positivo e parcela de dívida não excluível via API.
- **Location**: `supabase/migrations/`
- **SQL**: `drop constraint movimentacao_valor_nao_negativo` → `add constraint movimentacao_valor_positivo check (valor > 0)`; `drop policy movimentacao_delete` → recriar com `auth_perfil() in ('Admin','Financeiro') and divida_id is null`.
- **Tests**: `supabase/tests/movimentacao_regras.test.ts`.

### `src/lib/money.ts`

- `digitosParaCentavos(texto: string): number` — mantém só dígitos; limite 999999999999.
- `formatarMoeda(centavos: number): string` — `R$ 1.500,00`, formatação manual (sem depender do Intl do Hermes).
- `centavosParaReais(centavos: number): number` / `reaisParaCentavos(valor: number): number` — conversão só na borda com o Supabase (`Math.round(valor * 100)`).

### `src/lib/datas.ts`

- `mascararData(texto: string): string` — `05102026` → `05/10/2026`.
- `dataBRParaISO(texto: string): string | null` — valida dia/mês reais (31/02 → null).
- `isoParaDataBR(iso: string): string`, `hojeISO(): string` (data local).
- `intervaloDoMes(ano: number, mes: number)` → `{ inicioData, fimData, inicioInstante, fimInstante }` (datas `YYYY-MM-DD` para `data_vencimento`; instantes UTC do início/fim do mês local para `data_inclusao`).
- `nomeDoMes(ano, mes): string` — "Outubro 2026".

### `src/ui/Text.tsx` (estender)

- Novos tons `success` e `danger` (tokens já existem). Uso só no valor, sempre com sinal.

### `src/ui/Select.tsx` (novo primitivo, autorizado)

- **Props**: `label`, `value: string | null`, `options: { value; label; description? }[]`, `onChange(value)`, `placeholder?`, `error?`, `emptyMessage?`, `disabled?`.
- Campo com a aparência do `Input` (Pressable, 44pt) → `Modal` RN com título, lista de `ListItem` e "Cancelar". Mostra o rótulo da opção atual; se o `value` não estiver nas opções (item inativo), usa `fallbackLabel?`.

### `src/features/movimentacoes/types.ts`

- `Movimentacao` = `Pick<Tables<'movimentacao'>, 'id' | 'valor' | 'descricao' | 'data_vencimento' | 'data_pagamento' | 'status_pagamento' | 'data_inclusao' | 'divida_id' | 'categoria_id' | 'forma_pagamento_id'>` + `categoria: Pick<Categoria,'titulo'|'tipo'>` + `forma_pagamento: { nome }`; `valorCentavos` derivado no repositório.
- `rotuloStatus(status, tipo)` → "Pendente" | "Pago" | "Recebido".

### `src/features/movimentacoes/schema.ts`

- `movimentacaoSchema` (Zod 4): `valorCentavos` int 1..999999999999 ("Informe um valor maior que zero."), `descricao` trim 1..120, `categoriaId`/`formaPagamentoId` obrigatórios, `dataVencimento` opcional DD/MM/AAAA, `status`, `dataPagamento` obrigatória via `superRefine` quando `Pago`. Saída transformada para ISO e `data_pagamento: null` quando Pendente.

### `src/features/movimentacoes/movimentacoesRepository.ts`

- `listarMovimentacoesDoMes(ano, mes): Resultado<Movimentacao[]>` — `.or()` de vencimento no mês **ou** sem vencimento com `data_inclusao` no mês; ordenado por data de referência.
- `buscarMovimentacaoPorId(id)`, `criarMovimentacao(input)`, `atualizarMovimentacao(id, input)`, `excluirMovimentacao(id)` (`.delete().eq('id').select('id')`; 0 linhas → "Movimentação não encontrada ou não pode ser excluída.").
- `listarOpcoesMovimentacao()` → categorias e formas **ativas**, reutilizando os repositórios existentes.
- Erros: `42501` → sem permissão; `23514` → "Valor ou data de pagamento inválidos."; `23503` → "Categoria ou forma de pagamento não encontrada."

### Campos e formulário

- `components/CampoMoeda.tsx` — `Input` com `keyboardType="number-pad"`, exibe `formatarMoeda`, guarda centavos.
- `components/CampoData.tsx` — `Input` com máscara + `Button` ghost "Hoje".
- `camposMovimentacao.ts` — array de config `{ nome, tipo: 'moeda'|'texto'|'select'|'data'|'status', rotulo, visivel?(valores) }`; a US09/US03-b acrescentam itens aqui.
- `MovimentacaoFormView.tsx` — renderiza o array, valida com o schema, cria/edita, carrega opções e (na edição) o registro.

### `MovimentacoesListView.tsx`

- Cabeçalho de mês com ‹ ›, `Tabs` tipo e status, `FlatList` de `ListItem`, ações Editar/Excluir (`Alert.alert` com Cancelar/Excluir), estados obrigatórios, guarda de corrida por `useRef` do último pedido.

### Rotas

- `app/(app)/movimentacoes/index.tsx`, `nova.tsx`, `[id]/editar.tsx`; registradas no `Stack.Protected guard={podeVerCategorias}`; atalho na aba Financeiro.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --- | --- | --- |
| Validação do form | `safeParse` + `z.flattenError` | Mensagem embaixo do campo |
| RLS 42501 | `traduzirErro` | Snackbar "Você não tem permissão para registrar movimentações." |
| Check 23514 (passou pelo form) | `traduzirErro` | Snackbar de erro |
| Delete de parcela / id inexistente | 0 linhas afetadas | Snackbar "Movimentação não encontrada ou não pode ser excluída." |
| Falha ao listar | status `erro` | EmptyState com "Tentar novamente" |
| Edição de id inexistente | `maybeSingle` nulo | "Movimentação não encontrada." + Voltar |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| --- | --- | --- | --- |
| Linha com `valor = 0` já na nuvem faria a migration falhar | `supabase/migrations/20260924000400_financeiro.sql:37` | `db push` quebra | Antes do push, rodar `select count(*) from movimentacao where valor <= 0` no SQL Editor; tabela ainda sem tela, esperado 0 |
| `numeric` volta como `number` do PostgREST (float no transporte) | `src/types/database.ts` (`valor: number`) | Arredondamento | Converter na borda com `Math.round(valor*100)`; app inteiro trabalha em centavos |
| `listarCategorias` traz até 500 linhas inclusive inativas | `src/features/categorias/categoriasRepository.ts:93` | Nenhum na escala atual | Filtrar `ativa` no cliente; revisitar se crescer |
| `src/ui/` é área compartilhada | `src/ui/Text.tsx:5` | Mudança visual global | Só acrescenta tons, não altera os existentes; Select é arquivo novo |
| Policy recriada pode divergir de `rls.test.ts` | `supabase/tests/rls.test.ts` | Teste antigo de delete pode quebrar | Rodar a suíte `supabase` inteira no gate do T1 |

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Formatação de moeda | Manual em `lib/money.ts` | Evita depender do suporte a `Intl` pt-BR do Hermes |
| Confirmação de exclusão | `Alert.alert` nativo | Sem primitivo de diálogo; API do próprio React Native |
| Filtro de tipo/status | Na memória, sobre o mês carregado | Uma chamada por mês; troca de aba instantânea |
| Status no form | `Tabs` (Pendente / Pago ou Recebido) | Duas opções; Select seria um toque a mais |
