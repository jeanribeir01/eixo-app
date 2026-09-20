---
name: formulario-validado
description: Cria formulário do Eixo App com validação Zod e mensagens de erro em português. Use ao criar ou editar qualquer formulário — cadastro, edição, lançamento, hodômetro. Não use para telas somente de leitura (use tela-padrao).
---

# formulario-validado

Formulário sem validação deixa dado inválido chegar ao banco. Aqui a validação acontece **duas vezes**: no formulário (usabilidade) e no banco (integridade).

## Antes de escrever

1. Leia `DESIGN_CYAN.md` (seções Campo de texto e Botão).
2. Leia os critérios de aceite da task no Linear: as regras de validação estão lá.
3. Confira se já existe um primitivo de campo em `src/ui/`. Hoje **não existe `Input`**: se precisar, pare, avise o usuário e crie o primitivo com autorização (`AGENTS.md` §4), como descrito em `tela-padrao`.
4. **Não instale `react-hook-form`** nem outra lib de formulário sem confirmar com o usuário (`AGENTS.md` §4). Sem ela, use `useState` + `safeParse`, como abaixo.

## Passo 1 — schema Zod, com mensagens em português

O schema mora na feature: `src/features/<modulo>/schema.ts`. Toda mensagem é escrita à mão em português — nunca deixe a mensagem padrão do Zod (em inglês) chegar ao usuário.

```ts
import { z } from 'zod';

export const categoriaSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, 'Informe o título da categoria.')
    .max(60, 'O título pode ter no máximo 60 caracteres.'),
  tipo: z.enum(['Entrada', 'Saida'], { error: 'Escolha Entrada ou Saída.' }),
});

export type CategoriaForm = z.infer<typeof categoriaSchema>;
```

- Zod é v4: a mensagem de tipo inválido vai em `{ error: '...' }`.
- O tipo do formulário vem de `z.infer`, nunca digitado à mão.
- **Dinheiro nunca é `float`.** O campo guarda **centavos como inteiro**: `z.number().int().positive('Informe um valor maior que zero.')`.
- Datas: ISO 8601 UTC no transporte; formate para o fuso local só na exibição.
- Regra de negócio crítica (ex.: `hodometroFinal > hodometroInicial`) vai em `.refine(...)` **e** também em constraint no banco.

## Passo 2 — a tela

```tsx
import { useState } from 'react';
import { z } from 'zod';

import { Button, Column, Screen, Text } from '@/ui';

import { categoriaSchema } from './schema';

type Erros = Partial<Record<'titulo' | 'tipo', string>>;

export function NovaCategoriaView() {
  const [titulo, setTitulo] = useState('');
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  async function handleSalvar() {
    setErroGeral(null);

    const resultado = categoriaSchema.safeParse({ titulo, tipo: 'Saida' });
    if (!resultado.success) {
      // Um erro por campo: a mensagem aparece junto do campo que falhou.
      // z.flattenError é a forma do Zod 4 (o método .flatten() do erro está deprecado).
      const fieldErrors = z.flattenError(resultado.error).fieldErrors;
      setErros({ titulo: fieldErrors.titulo?.[0], tipo: fieldErrors.tipo?.[0] });
      return;
    }
    setErros({});

    setSalvando(true);
    // Envio pelo módulo de queries da feature (skill supabase-query).
    // ...
    setSalvando(false);
  }

  return (
    <Screen>
      <Column gap="md">
        {/* <Input label="Título" value={titulo} onChangeText={setTitulo} error={erros.titulo} /> */}
        <Button label="Salvar" onPress={handleSalvar} loading={salvando} />
        {erroGeral && (
          <Text accessibilityRole="alert" variant="bodySm">
            {erroGeral}
          </Text>
        )}
      </Column>
    </Screen>
  );
}
```

O comentário no lugar do `Input` marca onde o primitivo entra quando existir.

## Regras

- **Nada de envio com dado inválido.** O botão só dispara a chamada depois de `safeParse` ter `success: true`.
- **Botão em loading** durante o envio (`loading={salvando}`): ele já ignora toques repetidos.
- **Erro junto do campo**, em português, com `accessibilityRole="alert"`. Nunca só borda vermelha: cor sozinha não é indicador.
- **Erro de servidor** (rede, RLS, constraint) vira mensagem em português no rodapé do formulário; nunca exiba a mensagem crua do Supabase.
- **Sucesso** devolve feedback visual antes de sair da tela.
- Trate `trim()` em texto livre; string só de espaços é vazia.
- Sem `any`: use o tipo inferido do schema e `unknown` + narrowing quando preciso.

## Teste (obrigatório)

Todo formulário tem teste (skill `teste-componente`) cobrindo no mínimo: render, caminho feliz (envia dado válido), **cada validação dos critérios de aceite** (campo vazio, valor inválido) e estado de loading.

## Checklist final

- [ ] Schema Zod em `schema.ts`, mensagens em português
- [ ] Tipo do formulário via `z.infer`
- [ ] Dinheiro em centavos inteiros
- [ ] Erro por campo + erro geral tratados
- [ ] Loading no botão, sem duplo envio
- [ ] Validação equivalente existe no banco (constraint/RLS) quando é regra crítica
- [ ] Testes escritos e verdes
