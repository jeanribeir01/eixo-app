// Valores fictícios para os testes: src/lib/env.ts valida as variáveis ao ser importado,
// e nenhum teste deve depender do .env real de quem está rodando.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://projeto-de-teste.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-de-teste';
process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id-de-teste.apps.googleusercontent.com';
