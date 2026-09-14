// Motivos pelos quais o login com Google pode não concluir.
// A tela nunca inspeciona erros nativos: recebe só um destes códigos e pede a mensagem aqui.
export type AuthErrorCode = 'cancelled' | 'play_services' | 'no_id_token' | 'unknown';

const messages: Record<AuthErrorCode, string | null> = {
  // Cancelar é escolha do usuário, não erro: não mostramos nada (AUTH-04).
  cancelled: null,
  play_services: 'Google Play Services indisponível neste dispositivo.',
  no_id_token: 'Não foi possível obter o token do Google. Tente novamente.',
  unknown: 'Não foi possível entrar. Tente novamente.',
};

export function authErrorMessage(code: AuthErrorCode): string | null {
  return messages[code];
}
