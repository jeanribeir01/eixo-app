---
name: supabase-query
description: Escreve consultas e mutações ao Supabase no Eixo App com tipos gerados, RLS e tratamento de erro. Use ao ler ou gravar dados no banco — listar, buscar, inserir, atualizar, soft delete, RPC. Não use para layout de tela (use tela-padrao).
---

# supabase-query

Não existe API intermediária para as operações online do Supabase; nas rotinas offline-first, a UI lê/escreve SQLite e o sincronizador usa o client para drenar a outbox. O RLS continua sendo a fronteira de autorização no backend.

## Antes de escrever

1. Leia a task no Linear e identifique a tabela e o perfil que acessa (Admin, Gestor de Frota, Financeiro, Motorista).
2. Confirme se a tabela **já tem RLS e policy** para esse perfil. Se não tem, o trabalho começa na migration, não na query. Migration já aplicada não se altera sem autorização (`AGENTS.md` §4).
3. Use o client único: `import { supabase } from '@/supabase/client';`. Nunca crie outro `createClient`.

## Onde mora

```
src/features/<modulo>/queries.ts        # funções de acesso a dados da feature
src/features/<modulo>/__tests__/queries.test.ts
```

A tela **não chama `supabase` direto**. Ela chama uma função de `queries.ts`. Isso deixa a tela testável (mock de um módulo, não do client) e concentra a regra de acesso num lugar só.

## Regras de dados

- **Tipos do banco são gerados**, nunca digitados à mão: `supabase gen types typescript`. O `AGENTS.md` cita `src/types/database.ts`; o `.claude/CLAUDE.md` cita `src/supabase/types.ts`. Confira qual arquivo existe no repo; se nenhum existir, peça ao usuário para gerar e diga onde. Não escreva tipo de tabela na mão.
- **Valide a resposta com Zod** nos limites (`safeParse`), como `src/lib/env.ts` faz. Dado externo não é confiável só porque o TypeScript compilou.
- **Dinheiro**: `numeric` no Postgres; inteiro em centavos no cliente. Nunca `float`.
- **Soft delete sempre** em Categoria, Forma de Pagamento e Usuário: `update({ ativa: false })`, **nunca** `.delete()`. Itens inativos saem dos seletores, mas seguem visíveis em lançamentos históricos.
- **IDs são UUID gerados no cliente**, para permitir criar registro offline sem colisão.
- **Datas** em `timestamptz`; ISO 8601 UTC no transporte.
- **Operação que grava em mais de uma tabela** (parcelas de dívida, manutenção + movimentação) **não** é uma sequência de chamadas no cliente: `supabase-js` não faz transação. Vira RPC/Edge Function com transação e rollback. Pare e avise o usuário se a task pedir isso.
- **Agregação de dashboard mora numa view** no banco, nunca somada no cliente (RNF06).

## Molde: leitura

```ts
import { z } from 'zod';

import { supabase } from '@/supabase/client';

const categoriaSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  tipo: z.enum(['Entrada', 'Saida']),
  ativa: z.boolean(),
});

export type Categoria = z.infer<typeof categoriaSchema>;

export type ResultadoLista<T> = { ok: true; data: T[] } | { ok: false; mensagem: string };

export async function listarCategorias(tipo: Categoria['tipo']): Promise<ResultadoLista<Categoria>> {
  const { data, error } = await supabase
    .from('categoria')
    .select('id, titulo, tipo, ativa')
    .eq('tipo', tipo)
    .eq('ativa', true)
    .order('titulo');

  if (error) {
    // RLS negando acesso também cai aqui: para o usuário é só "não foi possível carregar".
    return { ok: false, mensagem: 'Não foi possível carregar as categorias. Tente novamente.' };
  }

  const parsed = z.array(categoriaSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: 'Os dados recebidos são inválidos. Tente novamente.' };
  }

  return { ok: true, data: parsed.data };
}
```

## Molde: mutação com soft delete

```ts
export async function desativarCategoria(id: string) {
  const { error } = await supabase.from('categoria').update({ ativa: false }).eq('id', id);

  if (error) return { ok: false as const, mensagem: 'Não foi possível desativar a categoria.' };
  return { ok: true as const };
}
```

## Tratamento de erro

- Retorne um **resultado** (`{ ok: true, ... } | { ok: false, mensagem }`) em vez de lançar exceção, como `signInWithGoogle` em `src/features/auth/googleAuth.ts`. A tela decide o que mostrar sem conhecer erros do Supabase.
- **Mensagem sempre em português e sem detalhe técnico.** Nunca exiba `error.message` cru do Postgres ao usuário.
- **`select` explícito**: liste as colunas. Sem `select('*')`.
- **Paginação/limite** em listas que podem crescer (`.range()` ou `.limit()`).
- **Nunca** use a chave `service_role` no app. Só a `anon`, que é segura porque o RLS protege.
- Variáveis públicas passam por `src/lib/env.ts`. Segredo nunca entra no código.

## Estados na tela

A tela que consome a query trata **carregando, vazio, erro e sucesso** (skill `tela-padrao`). Um resultado `ok: true` com lista vazia é o estado *vazio*, não erro.

## Teste

Mock do módulo `@/supabase/client`, como `src/features/auth/__tests__/HomeView.test.tsx` faz com `jest.mock('@/supabase/client', ...)`. Cubra: sucesso, lista vazia, erro do Supabase e resposta inválida no Zod. Ver skill `teste-componente`.

## Checklist final

- [ ] Tabela tem RLS e policy para o perfil da task
- [ ] Tipos gerados; nenhum tipo de tabela escrito à mão
- [ ] Resposta validada com Zod
- [ ] Erros viram mensagem em português, sem vazar `error.message`
- [ ] Soft delete onde a regra manda; nenhum `.delete()` físico indevido
- [ ] Nenhum `select('*')`; lista com limite
- [ ] Testes escritos e verdes
