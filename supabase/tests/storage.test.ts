/** @jest-environment node */
// Testes da migration 20260924000600_storage_comprovantes.sql — spec.md:
// P1 Comprovantes no Storage AC1 (bucket privado), AC2 (Admin/Financeiro
// leem/enviam/apagam) e AC3 (outros perfis rejeitados).

import { criarBanco, comoUsuario, type Banco } from './helpers/db';

describe('migration storage: bucket comprovantes', () => {
  let db: Banco;

  beforeAll(async () => {
    db = await criarBanco();
  });

  afterAll(async () => {
    await db.close();
  });

  it('cria o bucket comprovantes com public = false', async () => {
    const resultado = await db.query<{ id: string; public: boolean }>(
      `select id, public from storage.buckets where id = 'comprovantes'`,
    );

    expect(resultado.rows).toHaveLength(1);
    expect(resultado.rows[0]?.public).toBe(false);
  });

  it('financeiro envia e lê objeto no bucket comprovantes', async () => {
    await comoUsuario(db, { id: '50000000-0000-0000-0000-000000000001', perfil: 'Financeiro' }, async (tx) => {
      const enviado = await tx.query<{ id: string }>(
        `insert into storage.objects (bucket_id, name, owner)
         values ('comprovantes', 'nota-fiscal.pdf', $1) returning id`,
        ['50000000-0000-0000-0000-000000000001'],
      );
      expect(enviado.rows[0]?.id).toBeDefined();

      const lido = await tx.query('select id from storage.objects where bucket_id = $1', ['comprovantes']);
      expect(lido.rows.length).toBeGreaterThan(0);
    });
  });

  it('admin apaga objeto do bucket comprovantes', async () => {
    const adminId = '50000000-0000-0000-0000-000000000002';

    await comoUsuario(db, { id: adminId, perfil: 'Admin' }, async (tx) => {
      const enviado = await tx.query<{ id: string }>(
        `insert into storage.objects (bucket_id, name, owner)
         values ('comprovantes', 'comprovante-admin.pdf', $1) returning id`,
        [adminId],
      );

      const apagado = await tx.query('delete from storage.objects where id = $1 returning id', [
        enviado.rows[0]!.id,
      ]);
      expect(apagado.rows).toHaveLength(1);
    });
  });

  it('rejeita motorista e gestor de frota ao ler ou enviar objeto no bucket comprovantes', async () => {
    await comoUsuario(db, { id: '50000000-0000-0000-0000-000000000003', perfil: 'Motorista' }, async (tx) => {
      const lido = await tx.query('select id from storage.objects where bucket_id = $1', ['comprovantes']);
      expect(lido.rows).toHaveLength(0);
    });

    await expect(
      comoUsuario(db, { id: '50000000-0000-0000-0000-000000000004', perfil: 'Motorista' }, async (tx) => {
        await tx.query(
          `insert into storage.objects (bucket_id, name, owner)
           values ('comprovantes', 'tentativa-motorista.pdf', $1) returning id`,
          ['50000000-0000-0000-0000-000000000004'],
        );
      }),
    ).rejects.toThrow();

    await expect(
      comoUsuario(db, { id: '50000000-0000-0000-0000-000000000005', perfil: 'Gestor de Frota' }, async (tx) => {
        await tx.query(
          `insert into storage.objects (bucket_id, name, owner)
           values ('comprovantes', 'tentativa-gestor.pdf', $1) returning id`,
          ['50000000-0000-0000-0000-000000000005'],
        );
      }),
    ).rejects.toThrow();
  });
});
