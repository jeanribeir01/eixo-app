---
name: teste-componente
description: Escreve testes Jest + Testing Library para componentes, telas e funções do Eixo App. Use em toda task — "toda task entrega teste" — ao criar ou alterar componente, tela, formulário, store ou função de acesso a dados.
---

# teste-componente

`AGENTS.md` §2.5: **toda task entrega teste.** Mínimo: render do componente, caminho feliz e as validações citadas nos critérios de aceite.

## Stack

- `jest` com preset `jest-expo`
- `@testing-library/react-native` (matchers como `toBeOnTheScreen`, `toBeDisabled`, `toHaveStyle` já vêm no v13)
- Alias `@/` já mapeado no Jest para `src/`
- Setup em `jest.setup.ts`: variáveis de ambiente fictícias. **Nenhum teste depende do `.env` real.**

Rodar: `npm run test` (ou `npx jest caminho/do/arquivo`).

## Onde o teste mora

Ao lado do que testa, em `__tests__/`:

```
src/features/<modulo>/__tests__/NomeView.test.tsx
src/ui/__tests__/Button.test.tsx
```

Testes de rota/guard ficam em `__tests__/routes/` na raiz (ex.: `authGuard.test.tsx`).

## Molde

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { NomeView } from '../NomeView';

describe('NomeView', () => {
  it('renderiza o título e o botão primário', () => {
    render(<NomeView />);

    expect(screen.getByText('Título da tela')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeOnTheScreen();
  });

  it('caminho feliz: dispara a ação ao tocar no botão', () => {
    const onSalvar = jest.fn();
    render(<NomeView onSalvar={onSalvar} />);

    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSalvar).toHaveBeenCalledTimes(1);
  });
});
```

## O que cobrir

| Sempre | Quando existir |
|---|---|
| Render sem quebrar | Estado **carregando** (indicador visível) |
| Caminho feliz | Estado **vazio** (mensagem + ação) |
| Cada validação dos critérios de aceite | Estado **erro** (mensagem em português) |
| | Botão em `loading`: desabilitado e ignora toques |
| | Regra de permissão por perfil |

Nomeie o teste com o comportamento observável, em português, citando o critério quando houver (`'loading: fica desabilitado e ignora toques (AUTH-03)'`).

## Como consultar elementos

Prefira, nesta ordem, o que o usuário percebe:

1. `getByRole('button', { name: '...' })` — botões (o `Button` já define `accessibilityRole` e `accessibilityLabel`)
2. `getByText('...')` — texto visível
3. `getByLabelText` / `getByPlaceholderText` — campos
4. `getByTestId` — **último recurso**, para o que não tem texto nem papel (ex.: `button-loading`)

Use `queryBy*` para afirmar que algo **não** está na tela, e `findBy*`/`waitFor` para o que aparece depois de uma promise.

## Mocks

- **Supabase**: mocke o módulo, nunca chame a rede. Exemplo real de `HomeView.test.tsx`:

  ```ts
  jest.mock('@/supabase/client', () => ({ supabase: { auth: {} } }));
  ```

- **Funções da feature** (login, queries): `jest.mock('../googleAuth', () => ({ signOut: jest.fn() }))` e `mockResolvedValue(...)` por teste.
- **Reset entre testes**: `beforeEach(() => { (fn as jest.Mock).mockReset(); })`.
- **Zustand**: defina o estado com `useSessionStore.setState({ ... })` no início de cada teste.
- Sem `any`: para castar um mock, use `as jest.Mock` ou `as unknown as Tipo`, como nos testes existentes.

## Testar o design system

Componentes de `src/ui/` são testados contra os **tokens**, nunca contra hex digitado no teste:

```tsx
import { colors } from '../tokens';

expect(screen.getByRole('button', { name: 'Continuar' })).toHaveStyle({
  backgroundColor: colors.accent,
  minHeight: 44, // alvo de toque mínimo
});
```

## Regras

- Teste comportamento, não implementação: não afirme sobre estado interno nem sobre quantas vezes renderizou.
- Um teste, um comportamento.
- Teste que só passa porque o mock devolve o que ele mesmo escreveu não prova nada: afirme sobre o que a tela mostra ou sobre a chamada feita.
- Nunca use `.skip`/`.only` no que for entregue.
- Corrija o teste quebrado que **você** causou; não apague o teste para passar.

## Antes de dizer "terminei"

```bash
npm run typecheck
npm run lint
npm run test
```

Os três precisam passar. Se um falhar, mostre a saída ao usuário — não diga que está pronto.
