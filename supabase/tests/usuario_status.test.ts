/** @jest-environment node */
// Testes das migrations da EIX-30 (20260930000100..300 e 20261002000100_usuario_backfill) — spec.md:
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

// Primeira migration da EIX-30 e todas as que vêm depois dela, na ordem de nome.
const PRIMEIRA_MIGRATION = '20260930000100_status_usuario.sql';
const MIGRATIONS_EIX30 = [
  PRIMEIRA_MIGRATION,
  '20260930000200_protege_proprio_usuario.sql',
  '20260930000300_viagem_select_aprovado.sql',
  '20261002000100_usuario_backfill.sql',
];

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
    ['Ativo', 'Financeiro', '30000000-0000-0000-0001-000000000003'],
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
      ['Ativo', 1],
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

  it.each<[StatusUsuario, boolean]>([
    ['Ativo', true],
    ['AguardandoAprovacao', false],
    ['Bloqueado', false],
  ])('com status %s, lê veiculo e rota: %s', async (status, le) => {
    const id = `30000000-0000-0000-0003-00000000000${status.length % 10}`;
    await comoSuperuser(db, async (tx) => {
      await tx.query(
        `insert into veiculo (placa, marca, modelo, capacidade_carga)
         values ('VRA1B23', 'Scania', 'R450', 20000) on conflict do nothing`,
      );
      await tx.query(
        `insert into rota (cidade_origem, cidade_destino, distancia_estimada_km) values ('Jundiaí', 'Sorocaba', 90)`,
      );
    });

    const totais = await comoUsuario(db, { id, perfil: 'Motorista', status }, async (tx) => {
      const veiculos = await tx.query('select id from veiculo');
      const rotas = await tx.query('select id from rota');
      return [veiculos.rows.length > 0, rotas.rows.length > 0];
    });

    expect(totais).toEqual([le, le]);
  });

  describe('auto-alteração', () => {
    const adminId = '30000000-0000-0000-0000-000000000010';
    const outroId = '30000000-0000-0000-0000-000000000011';

    beforeAll(async () => {
      await comoUsuario(db, { id: adminId, perfil: 'Admin' }, async () => {});
      await comoUsuario(db, { id: outroId, status: null }, async () => {});
    });

    it('Admin não altera o próprio perfil: P0001 (AC1)', async () => {
      const codigo = await codigoDoErro(
        comoUsuario(db, { id: adminId, perfil: 'Admin' }, (tx) =>
          tx.query(
            `update usuario set perfil_id = (select id from perfil where nome = 'Motorista') where id = $1`,
            [adminId],
          ),
        ),
      );

      expect(codigo).toBe('P0001');
      expect(await lerUsuario(db, adminId)).toEqual({ status: 'Ativo', perfil: 'Admin' });
    });

    it('Admin não altera o próprio status: P0001 (AC2)', async () => {
      const codigo = await codigoDoErro(
        comoUsuario(db, { id: adminId, perfil: 'Admin' }, (tx) =>
          tx.query(`update usuario set status = 'Bloqueado' where id = $1`, [adminId]),
        ),
      );

      expect(codigo).toBe('P0001');
      expect(await lerUsuario(db, adminId)).toEqual({ status: 'Ativo', perfil: 'Admin' });
    });

    it('Admin altera perfil e status de outro usuário', async () => {
      await comoUsuario(db, { id: adminId, perfil: 'Admin' }, async (tx) => {
        await tx.query(
          `update usuario set perfil_id = (select id from perfil where nome = 'Gestor de Frota'), status = 'Ativo'
           where id = $1`,
          [outroId],
        );
      });

      expect(await lerUsuario(db, outroId)).toEqual({ status: 'Ativo', perfil: 'Gestor de Frota' });
    });

    it.each<PerfilNome>(['Gestor de Frota', 'Financeiro', 'Motorista'])(
      '%s aprovado não altera perfil nem status de outro usuário (Admin gerencia AC9)',
      async (perfil) => {
        const naoAdminId = `30000000-0000-0000-0002-00000000000${perfil.length % 10}`;
        const alvoId = '30000000-0000-0000-0000-000000000012';
        await comoUsuario(db, { id: alvoId, perfil: 'Motorista', status: null }, async () => {});

        const alteradas = await comoUsuario(db, { id: naoAdminId, perfil }, async (tx) => {
          const resultado = await tx.query(
            `update usuario set perfil_id = (select id from perfil where nome = 'Admin'), status = 'Ativo'
             where id = $1 returning id`,
            [alvoId],
          );
          return resultado.rows.length;
        });

        expect(alteradas).toBe(0);
        expect(await lerUsuario(db, alvoId)).toEqual({ status: 'AguardandoAprovacao', perfil: 'Motorista' });
      },
    );

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

describe('migrations da EIX-30: contas que já existiam', () => {
  const ativoId = '31000000-0000-0000-0000-000000000002';
  const inativoId = '31000000-0000-0000-0000-000000000003';
  const semLinhaId = '31000000-0000-0000-0000-000000000001';
  let db: Banco;

  beforeAll(async () => {
    db = await criarBanco({ antesDe: PRIMEIRA_MIGRATION });

    // Contas com linha em usuario (trigger da EIX-27): uma Admin ativa, outra desativada
    // pelo soft delete antigo (`ativo = false`).
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data) values ($1, 'admin@teste.local', '{"full_name":"Ana"}')`,
      [ativoId],
    );
    await db.query(`update usuario set perfil_id = (select id from perfil where nome = 'Admin') where id = $1`, [
      ativoId,
    ]);
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data) values ($1, 'inativo@teste.local', '{"full_name":"Caio"}')`,
      [inativoId],
    );
    await db.query(`update usuario set ativo = false where id = $1`, [inativoId]);

    // Conta criada antes do trigger existir: sem linha em usuario.
    await db.query(`alter table auth.users disable trigger on_auth_user_created`);
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data) values ($1, 'antigo@teste.local', '{"full_name":"Beto"}')`,
      [semLinhaId],
    );
    await db.query(`alter table auth.users enable trigger on_auth_user_created`);

    for (const migration of MIGRATIONS_EIX30) {
      await aplicarMigration(db, migration);
    }
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

  it('conta ativa continua com acesso e mantém o perfil (AC5)', async () => {
    expect(await lerUsuario(db, ativoId)).toEqual({ status: 'Ativo', perfil: 'Admin' });
  });

  it('conta desativada vira Bloqueado (AC5)', async () => {
    expect(await lerUsuario(db, inativoId)).toEqual({ status: 'Bloqueado', perfil: 'Motorista' });
  });
});
