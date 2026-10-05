import { resumoCaixaComDados } from '../__mocks__/resumoCaixaMock';
import { resumoCaixaSchema, type ResumoCaixa } from './resumoCaixa';

// Única porta de dados da tela de saldo: a tela só conhece este formato, nunca o Supabase
// (mesmo padrão de `categoriasRepository`).
export type Resultado<T> = { ok: true; data: T } | { ok: false; mensagem: string };

// Dado externo não é confiável só porque o TypeScript compilou: a resposta passa pelo Zod.
export function validarResumoCaixa(data: unknown): Resultado<ResumoCaixa> {
  const parsed = resumoCaixaSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: 'Os dados recebidos são inválidos. Tente novamente.' };
  }
  return { ok: true, data: parsed.data };
}

// TODO(EIX-35): trocar o mock pela leitura da view/RPC do motor de saldo via `supabase`, traduzindo
// o erro para "Não foi possível carregar o saldo. Tente novamente." (sem vazar `error.message`).
// O RLS de `movimentacao` já restringe a Admin e Financeiro.
export async function buscarResumoCaixa(): Promise<Resultado<ResumoCaixa>> {
  return validarResumoCaixa(resumoCaixaComDados);
}
