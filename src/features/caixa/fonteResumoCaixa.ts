import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { supabase } from '@/supabase/client';

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

// O cálculo inteiro é do RPC `resumo_caixa` da EIX-35 (RNF06); aqui só chamamos e validamos.
// Sem `referencia`, o banco usa "hoje" no fuso de São Paulo.
export async function buscarResumoCaixa(): Promise<Resultado<ResumoCaixa>> {
  const { data, error } = await supabase.rpc('resumo_caixa');

  if (error) {
    // O RPC recusou o perfil (só Admin e Financeiro). Mensagem própria para a tela não
    // sugerir "tente novamente" quando tentar de novo não vai resolver.
    if (ehAcessoNegado(error)) return { ok: false, mensagem: MENSAGEM_ACESSO_NEGADO };
    // Nunca exibe `error.message`: é detalhe técnico do Postgres.
    return { ok: false, mensagem: 'Não foi possível carregar o saldo. Tente novamente.' };
  }

  return validarResumoCaixa(data);
}
