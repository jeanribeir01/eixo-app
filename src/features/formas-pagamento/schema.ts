import { z } from 'zod';

export const formaPagamentoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'Informe o nome da forma de pagamento.')
    .max(60, 'O nome pode ter no máximo 60 caracteres.'),
});

export type FormaPagamentoFormValues = z.infer<typeof formaPagamentoSchema>;
