---
name: tela-padrao
description: Monta uma tela nova do Eixo App seguindo o design system (DESIGN_CYAN.md) e a estrutura de rotas/features. Use ao criar qualquer tela, lista, detalhe ou dashboard — "criar tela de X", "nova tela", "listar Y". Não use para formulário (use formulario-validado) nem para acesso a dados (use supabase-query).
---

# tela-padrao

Toda tela do app nasce do mesmo molde. Sem isso cada dev gera a tela de um jeito e o app fica inconsistente.

## Antes de escrever

1. Leia `DESIGN_CYAN.md` na raiz (obrigatório, `AGENTS.md` §0).
2. Leia a task do Linear (`EIX-XX`) e trate os critérios de aceite como especificação.
3. Liste os primitivos de `src/ui/index.ts`. Hoje: `Screen`, `Text`, `Button`, `Card`, `Column`, `Avatar`.

## Onde cada arquivo mora

```
app/(grupo)/nome-da-rota.tsx        # rota fina: só importa e renderiza a View
src/features/<modulo>/NomeView.tsx  # a tela de verdade
src/features/<modulo>/__tests__/NomeView.test.tsx
```

- A rota **não tem lógica nem estilo**. Exemplo real: `app/(app)/index.tsx` só retorna `<HomeView />`.
- A tela mora em `src/features/<modulo>/`. Feature é autocontida: componentes, hooks, queries e testes dentro da própria pasta.
- Import de UI sempre por `@/ui`: `import { Button, Card, Column, Screen, Text } from '@/ui';`

## Molde

```tsx
import { Button, Card, Column, Screen, Text } from '@/ui';

export function ExemploView() {
  return (
    <Screen>
      <Column gap="sm">
        <Text variant="display">Título da tela</Text>
        <Text tone="body">Uma linha de contexto.</Text>
      </Column>

      <Card>
        <Text weight="medium">Conteúdo do cartão</Text>
      </Card>

      {/* Um único botão primário por tela. Secundários usam variant="ghost". */}
      <Button label="Salvar" onPress={handleSalvar} />
    </Screen>
  );
}
```

## Regras

- **Só primitivos.** A tela não chama `StyleSheet.create` nem usa `View`/`Text` do React Native direto para estilo visual. Para agrupar, use `Column`.
- **Zero valor hardcoded**: sem hex, `padding: 16`, `fontSize: 14`. Espaçamento vira `<Column gap="md">`; cor e tipografia vêm de `Text` (`tone`, `variant`).
- **Um único elemento cyan preenchido por tela** — a ação primária.
- **Alvo de toque ≥ 44pt.** O `Button` já respeita; em qualquer elemento tocável novo, use `touchTarget`.
- **Responsivo** (RNF02): sem largura fixa; testa em celular pequeno, grande e tablet.
- **Comentário explica o porquê**, não o quê.

## Estados obrigatórios em tela de dados

Toda tela que busca dados trata os **quatro** estados. Nenhum pode ficar de fora:

| Estado | Faça |
|---|---|
| Carregando | Indicador visível; nunca tela em branco |
| Vazio | Mensagem curta + ação para criar o primeiro item |
| Erro | Mensagem em português + "Tentar novamente" |
| Sucesso | Feedback da ação (mensagem de sucesso) |

Toda ação do usuário (salvar, excluir) devolve feedback: loading no botão (`loading` do `Button`) + mensagem de sucesso ou de erro.

## Quando o primitivo não existe

`src/ui/` é área compartilhada: **não altere sem autorização explícita** do usuário (`AGENTS.md` §4). Se a tela precisa de algo que não existe (`Input`, `Snackbar`, `EmptyState`, `ListItem`):

1. Pare e avise o usuário qual primitivo falta.
2. Com autorização, crie o primitivo em `src/ui/`, exporte em `src/ui/index.ts`, siga `DESIGN_CYAN.md` e escreva o teste dele.
3. Só depois monte a tela.

Nunca improvise um estilo local para "quebrar o galho".

## Checklist final

- [ ] Rota fina em `app/`, tela em `src/features/`
- [ ] Só primitivos de `@/ui`; nenhum hex/spacing/fontSize solto
- [ ] Carregando, vazio, erro e sucesso tratados
- [ ] Um único cyan preenchido
- [ ] Teste escrito (skill `teste-componente`)
- [ ] `npm run typecheck && npm run lint && npm run test`
