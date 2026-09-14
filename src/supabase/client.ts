import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { env } from '@/lib/env';

import { secureStorage } from './secureStorage';

// Instância única do Supabase no app. Sem API intermediária: o app fala direto com o Supabase,
// e a sessão fica apenas no armazenamento seguro do sistema (RNF04).
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Não há redirect por URL no login nativo: o token chega pelo Google Sign-In.
    detectSessionInUrl: false,
  },
});

// Em React Native o timer de refresh não roda com o app em segundo plano.
// Pausar/retomar junto com o AppState evita tentar renovar o token com o app suspenso.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
