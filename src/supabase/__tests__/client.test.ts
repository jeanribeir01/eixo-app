import { createClient } from '@supabase/supabase-js';

import '../client';
import { secureStorage } from '../secureStorage';

// jest.mock é içado para antes dos imports pelo babel-jest, então os imports acima já recebem os mocks.
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ auth: { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() } })),
}));

jest.mock('@/lib/env', () => ({
  env: {
    supabaseUrl: 'https://abcdefgh.supabase.co',
    supabaseAnonKey: 'chave-anon',
    googleWebClientId: 'web-client-id',
  },
}));

jest.mock('../secureStorage', () => ({
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

describe('supabase client (AUTH-10)', () => {
  it('persiste a sessão usando apenas o adapter do SecureStore', () => {
    expect(createClient).toHaveBeenCalledWith('https://abcdefgh.supabase.co', 'chave-anon', {
      auth: {
        storage: secureStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  });
});
