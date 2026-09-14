import { parseEnv } from '../env';

const valid = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefgh.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiJ9.chave-anon',
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '1234567890-abc.apps.googleusercontent.com',
};

describe('parseEnv (AUTH-12)', () => {
  it('devolve as variáveis tipadas quando todas são válidas', () => {
    expect(parseEnv(valid)).toEqual({
      supabaseUrl: 'https://abcdefgh.supabase.co',
      supabaseAnonKey: 'eyJhbGciOiJIUzI1NiJ9.chave-anon',
      googleWebClientId: '1234567890-abc.apps.googleusercontent.com',
    });
  });

  it.each(Object.keys(valid))('lança erro citando %s quando ela está ausente', (name) => {
    const source = { ...valid, [name]: undefined };

    expect(() => parseEnv(source)).toThrow(name);
  });

  it.each(Object.keys(valid))('lança erro citando %s quando ela está vazia', (name) => {
    const source = { ...valid, [name]: '' };

    expect(() => parseEnv(source)).toThrow(name);
  });

  it('lança erro citando EXPO_PUBLIC_SUPABASE_URL quando não é uma URL', () => {
    expect(() => parseEnv({ ...valid, EXPO_PUBLIC_SUPABASE_URL: 'nao-e-url' })).toThrow('EXPO_PUBLIC_SUPABASE_URL');
  });

  it('não cita variáveis válidas na mensagem de erro', () => {
    let message = '';
    try {
      parseEnv({ ...valid, EXPO_PUBLIC_SUPABASE_ANON_KEY: undefined });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    expect(message).not.toContain('EXPO_PUBLIC_SUPABASE_URL');
    expect(message).not.toContain('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  });
});
