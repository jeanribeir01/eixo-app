# EIX-33 · US03 — Registro de Movimentações

## Problem Statement

O gestor financeiro não tem como lançar entradas e saídas no app: a tabela `movimentacao` existe (EIX-27) mas não há tela, e sem lançamentos não existe saldo (US05), parcela de dívida (US04) nem comprovante (US03-b). Esta task entrega o CRUD de movimentações que o resto do módulo financeiro usa como base.

## Goals

- [ ] Admin e Financeiro lançam, editam, listam e excluem movimentações reais no Supabase.
- [ ] Nenhum lançamento inválido (valor ≤ 0, Pago sem data de pagamento) chega ao banco — nem pelo app, nem pela API direta.
- [ ] O formulário fica pronto para ser estendido pela US09 (viagem) e pela US03-b (anexo) sem reescrita.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Anexo de comprovante | EIX-34 (Eduardo), começa depois do merge desta |
| Vincular movimentação a viagem | US09, épico 2 |
| Criar/editar parcelas de dívida | EIX-36 (RPC `criar_divida`) |
| Saldo e projeção | EIX-35 / EIX-51 |
| Offline (outbox/SQLite) | CLAUDE.md §7: só viagens e hodômetro são offline obrigatórios; financeiro começa online |
| Calendário nativo | Decidido campo DD/MM/AAAA (sem dependência nem rebuild) |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Entrada de data | Input de texto com máscara DD/MM/AAAA + atalho "Hoje" | Sem dependência nativa nem rebuild do dev client a 8 dias da entrega | y |
| Filtro por período | Navegação por mês; data de referência = `data_vencimento`, ou `data_inclusao` (fuso local) quando não há vencimento | Conversa com a projeção mensal da US05 | y |
| Exclusão | Delete físico com confirmação; parcela de dívida (`divida_id` preenchido) não é excluível aqui | Movimentação não está na lista de soft delete do CLAUDE.md; parcela pertence à dívida (EIX-36) | y |
| Seletor | Novo primitivo `Select` em `src/ui/` (campo + lista em modal) | Autorizado pelo usuário; reutilizável na EIX-34/EIX-50 | y |
| Valor zero no banco | Migration nova troca `movimentacao_valor_nao_negativo (valor >= 0)` por `valor > 0` | AC proíbe zero; AGENTS.md §2.4 exige a regra no banco também | n |
| Bloqueio de exclusão de parcela no banco | Migration nova recria `movimentacao_delete` com `divida_id is null`; a RPC da EIX-36 roda fora do RLS e continua podendo apagar parcelas pendentes | Regra crítica no banco sem travar a EIX-36 | n |
| Tipo Entrada/Saída | Derivado de `categoria.tipo`; não existe coluna de tipo em `movimentacao` | Schema da EIX-27 | y |
| Rótulo do status | Enum do banco `Pendente`/`Pago`; exibido como "Pago" para Saída e "Recebido" para Entrada | AC fala em "Pago/Recebido"; o enum tem um valor só | y |
| Status Pendente com data de pagamento | Ao salvar Pendente, `data_pagamento` é gravada `null` e o campo fica oculto | Evita dado ambíguo; o banco aceita, o app não produz | y |
| Data de pagamento futura | Permitida | Nenhum AC restringe; pagamento agendado é caso real | y |
| Limites de texto e valor | Descrição 1–120 caracteres; valor de R$ 0,01 a R$ 9.999.999.999,99 | `numeric(12,2)`; 120 cabe numa linha de lista | y |
| Dinheiro no cliente | Centavos inteiros no form; convertido para reais (2 casas) só na chamada ao Supabase | CLAUDE.md §5: nunca float para dinheiro | y |
| Categoria/forma inativa | Não aparece no `Select` de novo lançamento; continua exibida no lançamento antigo e mantida ao editar | Regra de soft delete do CLAUDE.md §5 | y |
| Quem acessa | Admin e Financeiro (guard `podeVerCategorias`, atalho na aba Financeiro); RLS já restringe | Mesmo padrão de Categorias/Formas | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Lançar movimentação ⭐ MVP

**User Story**: As a gestor financeiro, I want to register an entrada or saída so that the caixa reflects real money flow.

**Why P1**: Sem lançamento não há saldo, dívida nem comprovante.

**Acceptance Criteria**:

1. WHEN the user opens "Nova movimentação" THEN the system SHALL show fields Valor (R$), Descrição, Categoria, Forma de Pagamento, Data de Vencimento, Status (default Pendente).
2. WHEN the user saves a valid form THEN the system SHALL insert one row in `movimentacao` and show a success Snackbar "Movimentação registrada." and return to the list.
3. The system SHALL let the database fill `data_inclusao` and `data_atualizacao`; the form SHALL NOT send either field.
4. WHEN the user types digits in Valor THEN the system SHALL display them as BRL currency (e.g. typing `1234` shows `R$ 12,34`).
5. IF Valor is empty or R$ 0,00 THEN the system SHALL block saving with "Informe um valor maior que zero." under the field.
6. IF Descrição is empty after trim THEN the system SHALL block saving with "Informe a descrição." under the field.
7. IF Categoria or Forma de Pagamento is not chosen THEN the system SHALL block saving with "Escolha a categoria." / "Escolha a forma de pagamento." under the field.
8. WHEN the user chooses Status Pago/Recebido THEN the system SHALL show the field Data de Pagamento/Recebimento.
9. IF Status is Pago/Recebido and Data de Pagamento is empty THEN the system SHALL block saving with "Informe a data de pagamento." under the field.
10. IF a date field holds text that is not a valid DD/MM/AAAA date THEN the system SHALL block saving with "Data inválida. Use DD/MM/AAAA." under that field.
11. WHEN the user taps "Hoje" next to a date field THEN the system SHALL fill it with the current local date.
12. The Categoria and Forma de Pagamento selectors SHALL list only active items; Categoria SHALL show its tipo (Entrada/Saída).
13. WHEN Status is Pago/Recebido THEN the status option SHALL read "Recebido" for an Entrada category and "Pago" for a Saída category.
14. IF the Supabase call fails THEN the system SHALL keep the form filled, stop the button loading and show an error Snackbar with a Portuguese message (42501 → "Você não tem permissão para registrar movimentações.").
15. WHILE saving the system SHALL show loading on the Salvar button and ignore repeated taps.

**Independent Test**: Logado como Financeiro, criar "Frete", Entrada, R$ 1.500,00, Pago com data de hoje → aparece na lista do mês.

---

### P1: Banco garante as invariantes ⭐ MVP

**User Story**: As a tech lead, I want the database to reject invalid movimentações so that a direct API call cannot bypass the form.

**Why P1**: AGENTS.md §2.4 e AC "validação no form E no banco".

**Acceptance Criteria**:

1. IF an insert or update sets `valor <= 0` THEN the database SHALL reject it with a check violation (23514).
2. IF an insert or update sets `status_pagamento = 'Pago'` with `data_pagamento` null THEN the database SHALL reject it with a check violation (23514).
3. IF an authenticated user deletes a movimentação with `divida_id` not null THEN the database SHALL delete zero rows.
4. IF a user with perfil Motorista or Gestor de Frota reads or writes `movimentacao` THEN the database SHALL return no rows / reject the write (existing RLS, regression-tested).

**Independent Test**: Teste de banco (PGlite, projeto `supabase` do Jest) executando os comandos acima.

---

### P1: Listar e filtrar ⭐ MVP

**User Story**: As a gestor financeiro, I want to browse movimentações by month, tipo and status so that I find a lançamento quickly.

**Why P1**: Sem lista o lançamento não pode ser conferido nem editado.

**Acceptance Criteria**:

1. WHEN the list opens THEN the system SHALL show movimentações of the current month, using `data_vencimento`, or `data_inclusao` in local time when there is no vencimento.
2. WHEN the user taps ‹ or › THEN the system SHALL load the previous/next month and show its name ("Outubro 2026").
3. WHEN the user picks a tipo tab (Todas / Entradas / Saídas) THEN the system SHALL show only movimentações whose categoria has that tipo.
4. WHEN the user picks a status tab (Todos / Pendentes / Pagos) THEN the system SHALL show only movimentações with that `status_pagamento`.
5. Each row SHALL show descrição, categoria, date of reference (DD/MM), status label and valor with sign: `+ R$ 1.500,00` for Entrada and `− R$ 80,00` for Saída.
6. WHILE loading the system SHALL show a loading indicator; IF loading fails THEN it SHALL show an error state with "Tentar novamente"; WHEN the filtered result is empty THEN it SHALL show an empty state with "Nova movimentação".
7. The list SHALL show Entrada/Saída color only on the valor text, always together with the `+`/`−` sign.

**Independent Test**: Com lançamentos em setembro e outubro, alternar mês e abas e conferir as linhas.

---

### P1: Editar e excluir ⭐ MVP

**User Story**: As a gestor financeiro, I want to fix or remove a wrong lançamento so that the caixa stays correct.

**Why P1**: Está nos critérios da EIX-33.

**Acceptance Criteria**:

1. WHEN the user taps "Editar" on a row THEN the system SHALL open the form filled with that movimentação's data.
2. WHEN the user saves an edit THEN the system SHALL update the row and show "Movimentação atualizada."; `data_atualizacao` SHALL be set by the database trigger.
3. WHEN the user taps "Excluir" THEN the system SHALL ask for confirmation in a dialog ("Excluir movimentação?" with Cancelar / Excluir).
4. WHEN the user confirms THEN the system SHALL delete the row, remove it from the list and show "Movimentação excluída."
5. WHEN the user cancels THEN the system SHALL keep the row unchanged.
6. IF the movimentação is a parcela de dívida (`divida_id` not null) THEN the system SHALL hide "Excluir" and show the caption "Parcela de dívida".
7. IF the edited movimentação uses an inactive categoria or forma THEN the system SHALL keep and display it in the field.

**Independent Test**: Editar valor de um lançamento e excluir outro, conferindo lista e Snackbars.

---

## Edge Cases

- IF the user opens the edit route with an id that does not exist or is not visible by RLS THEN the system SHALL show "Movimentação não encontrada." with a "Voltar" action.
- IF there is no active categoria or forma de pagamento THEN the selector SHALL show "Nenhuma opção cadastrada." and saving SHALL stay blocked by the required-field message.
- WHEN a date is 31/02/2026 THEN validation SHALL reject it as "Data inválida. Use DD/MM/AAAA."
- WHEN the month changes while a request is in flight THEN the system SHALL show only the result of the latest month requested.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| MOV-01 | P1: Lançar — campos e default (1, 12, 13) | Tasks | Implementing |
| MOV-02 | P1: Lançar — salvar e datas automáticas (2, 3, 14, 15) | Tasks | Implementing |
| MOV-03 | P1: Lançar — máscara de valor (4, 5) | Tasks | Implementing |
| MOV-04 | P1: Lançar — validações de texto/seleção (6, 7) | Tasks | Implementing |
| MOV-05 | P1: Lançar — datas e pagamento condicional (8, 9, 10, 11) | Tasks | Implementing |
| MOV-06 | P1: Banco — valor > 0 e Pago exige data (1, 2) | Tasks | Implementing |
| MOV-07 | P1: Banco — parcela não excluível e RLS (3, 4) | Tasks | Implementing |
| MOV-08 | P1: Listar — mês e filtros (1–4) | Tasks | Implementing |
| MOV-09 | P1: Listar — linha e estados (5–7) | Tasks | Implementing |
| MOV-10 | P1: Editar (1, 2, 7) | Tasks | Implementing |
| MOV-11 | P1: Excluir com confirmação (3–6) | Tasks | Implementing |

**Coverage:** 11 total, 0 mapped to tasks, 11 unmapped ⚠️ (mapeados na fase Tasks)

---

## Success Criteria

- [ ] Financeiro registra uma entrada paga e uma saída pendente em menos de 1 minuto cada.
- [ ] Inserir `valor = 0` ou `Pago` sem data direto na API falha no banco.
- [ ] Roteiro do vídeo (EIX-55) passa: "Entrada Pago exige data" e "valor negativo → erro".
