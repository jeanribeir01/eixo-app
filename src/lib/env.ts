import { z } from 'zod';

// Variáveis públicas do app. Prefixo EXPO_PUBLIC_ = entram no bundle, então aqui só vai o que pode
// ser público por design (anon key é segura porque o RLS protege o banco). Nunca a service_role.
const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: z.string().min(1),
});

type EnvSource = Record<keyof z.infer<typeof envSchema>, string | undefined>;

export type Env = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  googleWebClientId: string;
};

export function parseEnv(source: EnvSource): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    // Falhar cedo e dizer QUAL variável está errada poupa horas de "o login não funciona".
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new Error(
      `Variáveis de ambiente ausentes ou inválidas: ${names.join(', ')}. Copie .env.example para .env e preencha.`,
    );
  }

  return {
    supabaseUrl: result.data.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: result.data.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    googleWebClientId: result.data.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  };
}

// O Expo só substitui process.env.EXPO_PUBLIC_* quando cada variável é escrita pelo nome completo.
// Por isso não dá para passar `process.env` inteiro.
export const env = parseEnv({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});
