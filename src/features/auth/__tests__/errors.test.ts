import { authErrorMessage } from '../errors';

describe('authErrorMessage', () => {
  it('cancelamento não gera mensagem (AUTH-04)', () => {
    expect(authErrorMessage('cancelled')).toBeNull();
  });

  it('Play Services indisponível (AUTH-05)', () => {
    expect(authErrorMessage('play_services')).toBe('Google Play Services indisponível neste dispositivo.');
  });

  it('sem idToken (AUTH-06)', () => {
    expect(authErrorMessage('no_id_token')).toBe('Não foi possível obter o token do Google. Tente novamente.');
  });

  it('erro do Supabase ou qualquer outro (AUTH-07)', () => {
    expect(authErrorMessage('unknown')).toBe('Não foi possível entrar. Tente novamente.');
  });
});
