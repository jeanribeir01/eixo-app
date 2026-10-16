import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

// O app lê deste banco local e não direto do Supabase: o SQLite é a fonte de verdade da UI
// (CLAUDE.md §7), o que permite o motorista trabalhar sem internet.
const sqlite = openDatabaseSync('eixo.db');

// O SQLite vem com chave estrangeira DESLIGADA por padrão, e o pragma vale só por conexão. Sem
// isto, o app aceitaria uma viagem apontando para veículo/rota inexistente, enquanto os testes
// (src/db/testing.ts, que liga o pragma) dariam a falsa impressão de que a FK é garantida.
sqlite.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });
