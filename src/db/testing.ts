import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';

import * as schema from './schema';

// SOMENTE PARA TESTE. `better-sqlite3` é devDependency e é módulo nativo do Node: este arquivo
// nunca pode ser importado pelo app (o app usa `expo-sqlite`, ver `client.ts`).
export type BancoDeTeste = {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: Database.Database;
  fechar: () => void;
};

// Cria um SQLite real em memória com as MESMAS migrations do app. Assim o teste prova que o SQL
// gerado pelo drizzle-kit funciona (índice único parcial, defaults, FKs), o que um mock não provaria.
export function criarBancoDeTeste(): BancoDeTeste {
  const sqlite = new Database(':memory:');
  // O SQLite não aplica FK por padrão. O app liga o mesmo pragma ao abrir o banco (`client.ts`),
  // então o teste se comporta como o app: viagem apontando para veículo inexistente é rejeitada.
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(__dirname, 'migrations') });
  return { db, sqlite, fechar: () => sqlite.close() };
}
