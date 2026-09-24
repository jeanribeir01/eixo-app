/** @jest-environment node */
// Testes da migration 20260924000100_base_perfil_usuario.sql — spec.md:
// P1 Tabelas AC1 (tabelas existem), P1 Dados padrão AC1 e AC4 (seed idempotente),
// P1 Tabelas AC4 (data_atualizacao), P1 RLS AC2 e edge case de auth_perfil() sem
// linha em usuario.

import { criarBanco, comoSuperuser, comoUsuario, type Banco } from './helpers/db';

describe('migration base: perfil, usuario e funções', () => {
  let db: Banco;

  beforeAll(async () => {
    db = await criarBanco();
  });

  afterAll(async () => {
    await db.close();
  });

  it('cria as tabelas perfil e usuario em public', async () => {
    const resultado = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name in ('perfil', 'usuario')
       order by table_name`,
    );

    expect(resultado.rows.map((linha) => linha.table_name)).toEqual(['perfil', 'usuario']);
  });

  it('insere os 4 perfis padrão do domínio', async () => {
    const resultado = await db.query<{ nome: string }>('select nome from perfil');

    expect(resultado.rows.map((linha) => linha.nome).sort()).toEqual(
      ['Admin', 'Financeiro', 'Gestor de Frota', 'Motorista'].sort(),
    );
  });

  it('reaplicar o seed de perfis mantém um único registro por nome', async () => {
    await db.query(
      `insert into perfil (nome) values
         ('Admin'), ('Gestor de Frota'), ('Financeiro'), ('Motorista')
       on conflict (nome) do nothing`,
    );

    const resultado = await db.query<{ total: string }>('select count(*)::text as total from perfil');
    expect(resultado.rows[0]?.total).toBe('4');
  });

  it('insert em auth.users cria usuario com perfil Motorista, nome e google_subject_id', async () => {
    const idDoUsuario = '22222222-2222-2222-2222-222222222222';

    await comoSuperuser(db, async (tx) => {
      await tx.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         values ($1, $2, jsonb_build_object('full_name', $3::text, 'sub', $4::text))`,
        [idDoUsuario, 'motorista@teste.local', 'Motorista de Teste', 'google-sub-123'],
      );

      const usuario = await tx.query<{
        nome: string;
        google_subject_id: string;
        perfil_nome: string;
      }>(
        `select u.nome, u.google_subject_id, p.nome as perfil_nome
         from usuario u
         join perfil p on p.id = u.perfil_id
         where u.id = $1`,
        [idDoUsuario],
      );

      expect(usuario.rows[0]?.nome).toBe('Motorista de Teste');
      expect(usuario.rows[0]?.google_subject_id).toBe('google-sub-123');
      expect(usuario.rows[0]?.perfil_nome).toBe('Motorista');
    });
  });

  it('update em usuario grava now() em data_atualizacao', async () => {
    // `now()` é constante dentro de uma transação — precisa de duas transações
    // (insert e update) para observar o relógio avançar entre elas.
    const idDoUsuario = '33333333-3333-3333-3333-333333333333';

    await comoSuperuser(db, async (tx) => {
      await tx.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         values ($1, $2, '{}'::jsonb)`,
        [idDoUsuario, 'atualizado@teste.local'],
      );
    });

    const antes = await db.query<{ data_atualizacao: string }>(
      'select data_atualizacao from usuario where id = $1',
      [idDoUsuario],
    );

    await comoSuperuser(db, async (tx) => {
      await tx.query('update usuario set nome = $2 where id = $1', [idDoUsuario, 'Nome Atualizado']);
    });

    const depois = await db.query<{ data_atualizacao: string }>(
      'select data_atualizacao from usuario where id = $1',
      [idDoUsuario],
    );

    expect(new Date(depois.rows[0]!.data_atualizacao).getTime()).toBeGreaterThan(
      new Date(antes.rows[0]!.data_atualizacao).getTime(),
    );
  });

  it('auth_perfil() retorna o perfil do usuário logado', async () => {
    const idDoUsuario = '44444444-4444-4444-4444-444444444444';

    const perfil = await comoUsuario(db, { id: idDoUsuario, perfil: 'Financeiro' }, async (tx) => {
      const resultado = await tx.query<{ perfil: string }>('select auth_perfil() as perfil');
      return resultado.rows[0]?.perfil;
    });

    expect(perfil).toBe('Financeiro');
  });

  it('auth_perfil() retorna nulo quando o usuário autenticado não tem linha em usuario', async () => {
    const idSemUsuario = '55555555-5555-5555-5555-555555555555';

    const perfil = await db.transaction(async (tx) => {
      await tx.query(`set local role authenticated`);
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [idSemUsuario]);
      const resultado = await tx.query<{ perfil: string | null }>('select auth_perfil() as perfil');
      return resultado.rows[0]?.perfil;
    });

    expect(perfil).toBeNull();
  });
});
