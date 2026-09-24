// Harness de teste: sobe um Postgres real em WASM (PGlite), aplica os stubs mínimos
// do Supabase e as migrations reais de supabase/migrations/, e permite rodar
// consultas como se fosse um usuário autenticado de um perfil específico.
//
// Limite honesto (ver design.md): o stub não é o Supabase real. Os testes provam as
// regras escritas em SQL; a aplicação no projeto real é conferida pelo `db push`.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';

const STUBS_PATH = path.join(__dirname, 'supabase-stubs.sql');
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

export type Banco = PGlite;
export type PerfilNome = 'Admin' | 'Gestor de Frota' | 'Financeiro' | 'Motorista';

/** Sobe um banco novo, aplica os stubs e todas as migrations em ordem de nome. */
export async function criarBanco(): Promise<Banco> {
  const db = new PGlite();
  await db.exec(readFileSync(STUBS_PATH, 'utf-8'));

  const arquivosDeMigration = readdirSync(MIGRATIONS_DIR)
    .filter((nome) => nome.endsWith('.sql'))
    .sort();

  for (const arquivo of arquivosDeMigration) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, arquivo), 'utf-8'));
  }

  return db;
}

interface UsuarioDeTeste {
  id: string;
  perfil?: PerfilNome | null;
  nome?: string;
  email?: string;
}

/**
 * Roda `executar` numa transação como o usuário dado: cria a linha em `auth.users`
 * (o `handle_new_user` da migration base cria a linha em `public.usuario` como
 * Motorista), promove o perfil se pedido um diferente, troca para a role
 * `authenticated` e define `auth.uid()` via `request.jwt.claim.sub`. Como qualquer
 * transação, o resultado é gravado ao final (só desfaz se `executar` lançar) — os
 * testes usam IDs únicos por caso para não colidir entre si.
 */
export async function comoUsuario<T>(
  db: Banco,
  usuario: UsuarioDeTeste,
  executar: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, $2, jsonb_build_object('full_name', $3::text))
       on conflict (id) do nothing`,
      [usuario.id, usuario.email ?? `${usuario.id}@teste.local`, usuario.nome ?? 'Usuário de Teste'],
    );

    // Antes de T3 aplicar a migration base, `public.usuario` ainda não existe — o
    // harness precisa funcionar mesmo assim para o smoke test de T1.
    const tabelaUsuarioExiste = await tx.query<{ existe: boolean }>(
      `select exists (
         select 1 from information_schema.tables
         where table_schema = 'public' and table_name = 'usuario'
       ) as existe`,
    );

    if (usuario.perfil && tabelaUsuarioExiste.rows[0]?.existe) {
      await tx.query(
        `update public.usuario set perfil_id = (select id from public.perfil where nome = $2)
         where id = $1`,
        [usuario.id, usuario.perfil],
      );
    }

    await tx.query(`set local role authenticated`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [usuario.id]);

    return executar(tx);
  });
}

/** Roda `executar` sem autenticação (role `anon`, sem `auth.uid()`). */
export async function comoAnonimo<T>(
  db: Banco,
  executar: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`set local role anon`);
    return executar(tx);
  });
}

/** Roda `executar` como superuser, sem RLS, útil para preparar dados de teste. */
export async function comoSuperuser<T>(
  db: Banco,
  executar: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => executar(tx));
}
