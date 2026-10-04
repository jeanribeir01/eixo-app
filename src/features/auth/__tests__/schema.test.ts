import { loginEmailSchema } from '../schema';

describe('loginEmailSchema', () => {
  it('aceita e-mail e senha, removendo espaços do e-mail', () => {
    expect(loginEmailSchema.parse({ email: ' gestor@teste.com ', senha: 'abc' })).toEqual({
      email: 'gestor@teste.com',
      senha: 'abc',
    });
  });

  it('exige e-mail válido e senha preenchida', () => {
    const resultado = loginEmailSchema.safeParse({ email: 'gestor', senha: '' });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.map((issue) => issue.message)).toEqual([
      'Informe um e-mail válido.',
      'Informe a senha.',
    ]);
  });
});
