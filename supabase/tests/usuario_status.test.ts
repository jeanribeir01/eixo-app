/** @jest-environment node */
// Testes da migration 20261002000100_usuario_status.sql — spec.md (EIX-30):
// "Novo usuário entra bloqueado" AC1–AC5 e "Admin não perde o próprio acesso" AC1, AC2, AC4.

import {
  aplicarMigration,
  comoSuperuser,
  comoUsuario,
  criarBanco,
  type Banco,
  type PerfilNome,
  type StatusUsuario,
} from './helpers/db';

const MIGRATION = '20261002000100_usuario_status.sql';

type LinhaUsuario = { status: StatusUsuario; perfil: PerfilNome };

async function lerUsuario(db: Banco, id: string): Promise<LinhaUsuario | undefined> {
  const resultado = await db.query<LinhaUsuario>(
    `select u.status, p.nome as perfil
     from usuario u join perfil p on p.id = u.perfil_id
     where u.id = $1`,
    [id],
  );
  return resultado.rows[0];
}

async function codigoDoErro(promessa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promessa;
    return undefined;
  } catch (erro) {
    return (erro as { code?: string }).code;
  }
}

describe('migration usuario_status: aprovação de usuários', () => {
  let db: Banco;

  beforeAll(async () => {
    db = await criarBanco();
  });

  afterAll(async () => {
    await db.close();
  });

  it('conta nova nasce com status AguardandoAprovacao (AC1)', async () => {
    const id = '30000000-0000-0000-0000-000000000001';
    await comoUsuario(db, { id, status: null }, async () => {});

    expect(await lerUsuario(db, id)).toEqual({ status: 'AguardandoAprovacao', perfil: 'Motorista' });
  });

  it.each<[StatusUsuario, PerfilNome | null, string]>([
    ['AguardandoAprovacao', null, '30000000-0000-0000-0001-000000000001'],
    ['Bloqueado', null, '30000000-0000-0000-0001-000000000002'],
    ['Aprovado', 'Financeiro', '30000000-0000-0000-0001-000000000003'],
  ])('auth_perfil() com status %s devolve %s (AC2)', async (status, esperado, id) => {
    const perfil = await comoUsuario(db, { id, perfil: 'Financeiro', status }, async (tx) => {
      const resultado = await tx.query<{ perfil: PerfilNome | null }>('select auth_perfil() as perfil');
      return resultado.rows[0]?.perfil;
    });

    expect(perfil).toBe(esperado);
  });

  it('usuário não aprovado ainda lê a própria linha de usuario (base da tela "aguardando")', async () => {
    const id = '30000000-0000-0000-0000-000000000002';
    const linhas = await comoUsuario(db, { id, status: null }, async (tx) => {
      const resultado = await tx.query<{ status: StatusUsuario }>('select status from usuario where id = $1', [id]);
      return resultado.rows;
    });

    expect(linhas).toEqual([{ status: 'AguardandoAprovacao' }]);
  });

  describe('viagem do próprio motorista (AC3)', () => {
    const motoristaId = '30000000-0000-0000-0000-000000000003';

    beforeAll(async () => {
      await comoUsuario(db, { id: motoristaId, perfil: 'Motorista' }, async () => {});
      await comoSuperuser(db, async (tx) => {
        const veiculo = await tx.query<{ id: string }>(
          `insert into veiculo (placa, marca, modelo, capacidade_carga)
           values ('STA1B23', 'Volvo', 'FH', 10000) returning id`,
        );
        const rota = await tx.query<{ id: string }>(
          `insert into rota (cidade_origem, cidade_destino, distancia_estimada_km)
           values ('Campinas', 'Santos', 200) returning id`,
        );
        await tx.query(
          `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial) values ($1, $2, $3, 500)`,
          [veiculo.rows[0]!.id, rota.rows[0]!.id, motoristaId],
        );
      });
    });

    it.each<[StatusUsuario, number]>([
      ['Aprovado', 1],
      ['AguardandoAprovacao', 0],
      ['Bloqueado', 0],
    ])('motorista com status %s lê %i viagem(ns) própria(s)', async (status, quantidade) => {
      const total = await comoUsuario(db, { id: motoristaId, perfil: 'Motorista', status }, async (tx) => {
        const resultado = await tx.query('select id from viagem where motorista_id = $1', [motoristaId]);
        return resultado.rows.length;
      });

      expect(total).toBe(quantidade);
    });
  });

  describe('auto-alteração', () => {
    const adminId = '30000000-0000-0000-0000-000000000010';
    const outroId = '30000000-0000-0000-0000-000000000011';

    beforeAll(async () => {
      await comoUsuario(db, { id: adminId, perfil: 'Admin' }, async () => {});
      await comoUsuario(db, { id: outroId, status: null }, async () => {});
    });

    it('Admin não altera o próprio perfil: 42501 (AC1)', async () => {
      const codigo = await codigoDoErro(
        comoUsuario(db, { id: adminId, perfil: 'Admin' }, (tx) =>
          tx.query(
            `update usuario set perfil_id = (select id from perfil where nome = 'Motorista') where id = $1`,
            [adminId],
          ),
        ),
      );

      expect(codigo).toBe('42501');
      expect(await lerUsuario(db, adminId)).toEqual({ status: 'Aprovado', perfil: 'Admin' });
    });

    it('Admin não altera o próprio status: 42501 (AC2)', async () => {
      const codigo = await codigoDoErro(
        comoUsuario(db, { id: adminId, perfil: 'Admin' }, (tx) =>
          tx.query(`update usuario set status = 'Bloqueado' where id = $1`, [adminId]),
        ),
      );

      expect(codigo).toBe('42501');
      expect(await lerUsuario(db, adminId)).toEqual({ status: 'Aprovado', perfil: 'Admin' });
    });

    it('Admin altera perfil e status de outro usuário', async () => {
      await comoUsuario(db, { id: adminId, perfil: 'Admin' }, async (tx) => {
        await tx.query(
          `update usuario set perfil_id = (select id from perfil where nome = 'Gestor de Frota'), status = 'Aprovado'
           where id = $1`,
          [outroId],
        );
      });

      expect(await lerUsuario(db, outroId)).toEqual({ status: 'Aprovado', perfil: 'Gestor de Frota' });
    });

    it('sem usuário logado (SQL Editor) a alteração é aceita (AC4)', async () => {
      await comoSuperuser(db, (tx) =>
        tx.query(
          `update usuario set perfil_id = (select id from perfil where nome = 'Financeiro'), status = 'Bloqueado'
           where id = $1`,
          [adminId],
        ),
      );

      expect(await lerUsuario(db, adminId)).toEqual({ status: 'Bloqueado', perfil: 'Financeiro' });
    });
  });
});

describe('migration usuario_status: backfill de contas existentes', () => {
  const semLinhaId = '31000000-0000-0000-0000-000000000001';
  const comLinhaId = '31000000-0000-0000-0000-000000000002';
  let db: Banco;

  beforeAll(async () => {
    db = await criarBanco({ antesDe: MIGRATION });

    // Conta com linha em usuario (trigger da EIX-27) e já promovida a Admin.
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data) values ($1, 'admin@teste.local', '{"full_name":"Ana"}')`,
      [comLinhaId],
    );
    await db.query(`update usuario set perfil_id = (select id from perfil where nome = 'Admin') where id = $1`, [
      comLinhaId,
    ]);

    // Conta criada antes do trigger existir: sem linha em usuario.
    await db.query(`alter table auth.users disable trigger on_auth_user_created`);
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data) values ($1, 'antigo@teste.local', '{"full_name":"Beto"}')`,
      [semLinhaId],
    );
    await db.query(`alter table auth.users enable trigger on_auth_user_created`);

    await aplicarMigration(db, MIGRATION);
  });

  afterAll(async () => {
    await db.close();
  });

  it('cria a linha que faltava como Motorista aguardando aprovação (AC4)', async () => {
    const linha = await db.query<{ nome: string; email: string }>('select nome, email from usuario where id = $1', [
      semLinhaId,
    ]);

    expect(linha.rows).toEqual([{ nome: 'Beto', email: 'antigo@teste.local' }]);
    expect(await lerUsuario(db, semLinhaId)).toEqual({ status: 'AguardandoAprovacao', perfil: 'Motorista' });
  });

  it('linha existente fica AguardandoAprovacao e mantém o perfil (AC5)', async () => {
    expect(await lerUsuario(db, comLinhaId)).toEqual({ status: 'AguardandoAprovacao', perfil: 'Admin' });
  });
});
