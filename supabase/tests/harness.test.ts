/** @jest-environment node */
// Smoke test do harness PGlite (T1): prova que o banco sobe, os stubs aplicam e
// `auth.uid()` funciona antes de qualquer migration real existir.

import { criarBanco, comoUsuario, type Banco } from './helpers/db';

describe('harness PGlite', () => {
  let db: Banco;

  beforeAll(async () => {
    db = await criarBanco();
  });

  afterAll(async () => {
    await db.close();
  });

  it('sobe o banco e roda uma consulta simples como superuser', async () => {
    const resultado = await db.query<{ resultado: number }>('select 1 as resultado');
    expect(resultado.rows[0]?.resultado).toBe(1);
  });

  it('comoUsuario troca para authenticated e auth.uid() retorna o id definido', async () => {
    const idDeTeste = '11111111-1111-1111-1111-111111111111';

    const uid = await comoUsuario(db, { id: idDeTeste }, async (tx) => {
      const resultado = await tx.query<{ uid: string }>('select auth.uid() as uid');
      return resultado.rows[0]?.uid;
    });

    expect(uid).toBe(idDeTeste);
  });
});
