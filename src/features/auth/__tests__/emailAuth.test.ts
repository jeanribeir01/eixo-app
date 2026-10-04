import { supabase } from '@/supabase/client';

import { signInWithEmail } from '../emailAuth';

jest.mock('@/supabase/client', () => ({
  supabase: { auth: { signInWithPassword: jest.fn() } },
}));

const signInWithPassword = supabase.auth.signInWithPassword as jest.Mock;

beforeEach(() => {
  signInWithPassword.mockReset();
});

describe('signInWithEmail', () => {
  it('entra com e-mail e senha no Supabase', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: null });

    await expect(signInWithEmail('admin@teste.com', '123456')).resolves.toEqual({ ok: true });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'admin@teste.com', password: '123456' });
  });

  it('credenciais erradas viram invalid_credentials', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { code: 'invalid_credentials' } });

    await expect(signInWithEmail('admin@teste.com', 'errada')).resolves.toEqual({
      ok: false,
      code: 'invalid_credentials',
    });
  });

  it('qualquer outro erro vira unknown', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { code: 'email_not_confirmed' } });

    await expect(signInWithEmail('admin@teste.com', '123456')).resolves.toEqual({ ok: false, code: 'unknown' });
  });

  it('falha de rede vira unknown em vez de lançar', async () => {
    signInWithPassword.mockRejectedValue(new Error('Network request failed'));

    await expect(signInWithEmail('admin@teste.com', '123456')).resolves.toEqual({ ok: false, code: 'unknown' });
  });
});
