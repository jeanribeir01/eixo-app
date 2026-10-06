import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '../errors';

describe('MENSAGEM_ACESSO_NEGADO (RLS-14)', () => {
  it('é a frase que o Snackbar mostra', () => {
    expect(MENSAGEM_ACESSO_NEGADO).toBe('Acesso negado. Seu perfil não tem permissão para esta ação.');
  });
});

describe('ehAcessoNegado', () => {
  it('reconhece 42501, a recusa do RLS ou da checagem de perfil numa RPC (RLS-14)', () => {
    expect(ehAcessoNegado({ code: '42501' })).toBe(true);
  });

  it.each(['23514', '23503', 'P0001', 'P0002', '22023', 'PGRST116', ''])(
    'não trata %p como acesso negado (RLS-15)',
    (code) => {
      expect(ehAcessoNegado({ code })).toBe(false);
    },
  );
});
