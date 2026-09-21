import { z } from 'zod';

// Mensagens escritas à mão em português: a mensagem padrão do Zod nunca chega ao usuário
// (AGENTS.md §2.2, skill formulario-validado).
export const categoriaSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, 'Informe o título da categoria.')
    .max(60, 'O título pode ter no máximo 60 caracteres.'),
  tipo: z.enum(['Entrada', 'Saida'], { error: 'Escolha Entrada ou Saída.' }),
});

export type CategoriaFormValues = z.infer<typeof categoriaSchema>;
