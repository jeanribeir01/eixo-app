import { defineConfig } from 'drizzle-kit';

// driver 'expo' gera as migrations como módulo JS que o app importa e aplica na abertura
// (ADR 0004), em vez de arquivos .sql soltos que o Metro não consegue empacotar.
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
});
