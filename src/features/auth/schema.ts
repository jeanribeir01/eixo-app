import { z } from 'zod';

export const loginEmailSchema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail.').pipe(z.email('Informe um e-mail válido.')),
  senha: z.string().min(1, 'Informe a senha.'),
});

export type LoginEmailForm = z.infer<typeof loginEmailSchema>;
