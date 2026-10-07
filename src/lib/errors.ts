// Recusa de permissão vinda do banco (US18). O RLS é a única fronteira de autorização: se a
// tela deixou passar uma ação que o perfil não pode fazer, quem segura é o banco, e o usuário
// precisa de uma frase clara em vez de um erro técnico.
//
// Só insert barrado por policy e RPC com checagem de perfil chegam aqui como erro. Select,
// update e delete barrados pelo RLS voltam com 0 linhas, sem erro — limite do Postgres
// registrado na spec da EIX-32.

export const MENSAGEM_ACESSO_NEGADO = 'Acesso negado. Seu perfil não tem permissão para esta ação.';

// 42501 = insufficient_privilege: o código do "new row violates row-level security policy" e o
// que as RPCs (criar_divida, resumo_caixa...) lançam quando o perfil não pode.
export function ehAcessoNegado(error: { code: string }): boolean {
  return error.code === '42501';
}
