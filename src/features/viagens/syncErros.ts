// Erros do Supabase que o sync precisa distinguir: falha de rede (não gasta tentativa e usa
// backoff) versus erro de negócio/RLS (vai para revisão ou falha permanente).
export type ErroComCodigo = { code?: string; message?: string } | null | undefined;

export function ehErroConexao(error: ErroComCodigo): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  const code = error.code ?? '';

  return (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('timeout') ||
    msg.includes('failed to fetch') ||
    msg.includes('connection') ||
    msg.includes('network request failed') ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND'
  );
}

export const MENSAGEM_SEM_CONEXAO =
  'Sem conexão com o servidor. Os dados continuam salvos no dispositivo.';

export const MENSAGEM_SESSAO_ALTERADA =
  'A conta mudou durante a sincronização. Os dados pendentes foram preservados para a próxima entrada.';
