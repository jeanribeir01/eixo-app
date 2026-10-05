# EIX-33 Movimentações Context

**Gathered:** 2026-10-04
**Spec:** `.specs/features/eix33-movimentacoes/spec.md`
**Status:** Ready for design

---

## Feature Boundary

CRUD de `movimentacao` para Admin e Financeiro: lançar, listar por mês com filtros de tipo e status, editar e excluir — com as invariantes de valor e de pagamento garantidas também no banco.

---

## Implementation Decisions

### Entrada de datas

- Campo de texto com máscara DD/MM/AAAA e atalho "Hoje". Sem `@react-native-community/datetimepicker` (evita dependência nativa e rebuild do dev client antes da entrega).

### Filtro por período

- Navegação por mês (‹ Outubro 2026 ›).
- Data de referência: `data_vencimento`; quando nula, `data_inclusao` no fuso local.

### Exclusão

- Delete físico com diálogo de confirmação.
- Parcela de dívida (`divida_id` preenchido) não é excluível por esta tela; bloqueio também no RLS.

### Seleção de Categoria, Forma de Pagamento e Status

- Novo primitivo `Select` em `src/ui/` (autorizado pelo usuário em 2026-10-04): campo no estilo do `Input` que abre uma lista em modal.

### Agent's Discretion

- Formato do array de configuração dos campos do formulário (pedido da EIX-33 para a US09/US03-b estenderem).
- Status com o primitivo `Tabs` ou com o `Select`.

### Declined / Undiscussed Gray Areas → Assumptions

- Valor zero e exclusão de parcela bloqueados no banco por migration nova — registrado em Assumptions da spec (não confirmado).

---

## Specific References

- Seguir o molde de `src/features/categorias/` e `src/features/formas-pagamento/` (repositório com `Resultado<T>`, views de lista e formulário, rotas sob `Stack.Protected`).

---

## Deferred Ideas

None - discussion stayed within feature scope.
