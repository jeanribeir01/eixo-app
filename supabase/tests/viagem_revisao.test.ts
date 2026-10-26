/** @jest-environment node */
// Testes da migration 20261026000100_viagem_revisao.sql — EIX-41.
// A fila de revisão é o destino dos conflitos que o sync não pode resolver sozinho no aparelho.
// O motorista abre a revisão; só Admin/Gestor leem a fila inteira e decidem. A autoria da decisão
// é do banco, não do payload do cliente.

import { randomUUID } from 'node:crypto';

import { criarBanco, comoAnonimo, comoUsuario, type Banco } from './helpers/db';

const MOTORISTA_A = { id: '76200000-0000-0000-0000-000000000001', perfil: 'Motorista' as const };
const MOTORISTA_B = { id: '76200000-0000-0000-0000-000000000002', perfil: 'Motorista' as const };
const ADMIN = { id: '76200000-0000-0000-0000-000000000003', perfil: 'Admin' as const };
const GESTOR = { id: '76200000-0000-0000-0000-000000000004', perfil: 'Gestor de Frota' as const };
const FINANCEIRO = { id: '76200000-0000-0000-0000-000000000005', perfil: 'Financeiro' as const };

type ErroDoBanco = { code?: string; message?: string };

type RevisaoDeTeste = {
  id: string;
  viagem_id: string;
  solicitante_id: string;
  codigo: string;
  mensagem: string;
  payload: Record<string, unknown>;
  status?: 'Pendente' | 'Resolvida' | 'Descartada';
};

function novaRevisao(overrides: Partial<RevisaoDeTeste> = {}): RevisaoDeTeste {
  return {
    id: randomUUID(),
    viagem_id: randomUUID(),
    solicitante_id: MOTORISTA_A.id,
    codigo: 'VG005',
    mensagem: 'Viagem encerrada não pode ser alterada.',
    payload: { id: 'viagem-local', status: 'Finalizada', hodometro_final: 10400 },
    status: 'Pendente',
    ...overrides,
  };
}

async function erroDoBanco(promessa: Promise<unknown>): Promise<ErroDoBanco | null> {
  try {
    await promessa;
    return null;
  } catch (erro) {
    return erro as ErroDoBanco;
  }
}

async function inserirRevisao(
  db: Banco,
  usuario: { id: string; perfil: 'Admin' | 'Gestor de Frota' | 'Financeiro' | 'Motorista' },
  revisao: RevisaoDeTeste,
) {
  return comoUsuario(db, usuario, async (tx) => {
    const resultado = await tx.query<{ id: string; status: string }>(
      `insert into viagem_revisao
         (id, viagem_id, solicitante_id, codigo, mensagem, payload, status)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7)
       returning id, status`,
      [
        revisao.id,
        revisao.viagem_id,
        revisao.solicitante_id,
        revisao.codigo,
        revisao.mensagem,
        JSON.stringify(revisao.payload),
        revisao.status ?? 'Pendente',
      ],
    );
    return resultado.rows[0]!;
  });
}

describe('migration viagem_revisao', () => {
  let db: Banco;

  beforeAll(async () => {
    db = await criarBanco();
    for (const usuario of [MOTORISTA_A, MOTORISTA_B, ADMIN, GESTOR, FINANCEIRO]) {
      await comoUsuario(db, usuario, async () => {});
    }
  });

  afterAll(async () => {
    await db.close();
  });

  it('motorista cria a própria revisão como Pendente e consegue acompanhá-la', async () => {
    const revisao = novaRevisao();

    const criada = await inserirRevisao(db, MOTORISTA_A, revisao);
    expect(criada).toEqual({ id: revisao.id, status: 'Pendente' });

    const lida = await comoUsuario(db, MOTORISTA_A, (tx) =>
      tx.query<{ id: string; status: string; resolvido_por: string | null }>(
        'select id, status, resolvido_por from viagem_revisao where id = $1',
        [revisao.id],
      ),
    );
    expect(lida.rows).toEqual([{ id: revisao.id, status: 'Pendente', resolvido_por: null }]);
  });

  it('motorista não cria revisão em nome de outro usuário', async () => {
    const revisao = novaRevisao({ solicitante_id: MOTORISTA_B.id });

    const erro = await erroDoBanco(inserirRevisao(db, MOTORISTA_A, revisao));

    expect(erro?.code).toBe('42501');
    const total = await db.query<{ total: number }>(
      'select count(*)::int as total from viagem_revisao where id = $1',
      [revisao.id],
    );
    expect(total.rows[0]!.total).toBe(0);
  });

  it('motorista não enxerga a revisão de outro motorista', async () => {
    const revisaoDeA = novaRevisao();
    await inserirRevisao(db, MOTORISTA_A, revisaoDeA);

    const visiveisParaB = await comoUsuario(db, MOTORISTA_B, (tx) =>
      tx.query('select id from viagem_revisao where id = $1', [revisaoDeA.id]),
    );

    expect(visiveisParaB.rows).toHaveLength(0);
  });

  it('Admin e Gestor leem a fila inteira; Financeiro não lê nem cria', async () => {
    const revisaoDeA = novaRevisao();
    const revisaoDeB = novaRevisao({ solicitante_id: MOTORISTA_B.id });
    await inserirRevisao(db, MOTORISTA_A, revisaoDeA);
    await inserirRevisao(db, MOTORISTA_B, revisaoDeB);

    for (const gestor of [ADMIN, GESTOR]) {
      const fila = await comoUsuario(db, gestor, (tx) =>
        tx.query<{ id: string }>('select id from viagem_revisao where id = any($1::uuid[])', [
          [revisaoDeA.id, revisaoDeB.id],
        ]),
      );
      expect(fila.rows.map((linha) => linha.id).sort()).toEqual(
        [revisaoDeA.id, revisaoDeB.id].sort(),
      );
    }

    const filaFinanceiro = await comoUsuario(db, FINANCEIRO, (tx) =>
      tx.query('select id from viagem_revisao'),
    );
    expect(filaFinanceiro.rows).toHaveLength(0);

    const erro = await erroDoBanco(
      inserirRevisao(db, FINANCEIRO, novaRevisao({ solicitante_id: FINANCEIRO.id })),
    );
    expect(erro?.code).toBe('42501');
  });

  it('Gestor resolve e o banco grava a autoria real, ignorando o resolvido_por do cliente', async () => {
    const revisao = novaRevisao();
    await inserirRevisao(db, MOTORISTA_A, revisao);

    const resolvida = await comoUsuario(db, GESTOR, (tx) =>
      tx.query<{
        status: string;
        observacao: string | null;
        resolvido_por: string | null;
        resolvido_em: string | null;
      }>(
        `update viagem_revisao
            set status = 'Resolvida',
                observacao = 'Hodômetro conferido com o gestor.',
                resolvido_por = $2,
                resolvido_em = '2000-01-01T00:00:00Z'
          where id = $1
          returning status, observacao, resolvido_por, resolvido_em`,
        [revisao.id, ADMIN.id],
      ),
    );

    expect(resolvida.rows[0]?.status).toBe('Resolvida');
    expect(resolvida.rows[0]?.observacao).toBe('Hodômetro conferido com o gestor.');
    expect(resolvida.rows[0]?.resolvido_por).toBe(GESTOR.id);
    expect(resolvida.rows[0]?.resolvido_em).not.toBe('2000-01-01T00:00:00Z');
    expect(resolvida.rows[0]?.resolvido_em).not.toBeNull();

    // O solicitante continua enxergando a própria revisão depois da decisão.
    const lidaPeloMotorista = await comoUsuario(db, MOTORISTA_A, (tx) =>
      tx.query<{ status: string }>('select status from viagem_revisao where id = $1', [revisao.id]),
    );
    expect(lidaPeloMotorista.rows[0]?.status).toBe('Resolvida');
  });

  it('motorista não resolve a própria revisão', async () => {
    const revisao = novaRevisao();
    await inserirRevisao(db, MOTORISTA_A, revisao);

    const atualizadas = await comoUsuario(db, MOTORISTA_A, (tx) =>
      tx.query(
        `update viagem_revisao set status = 'Resolvida', observacao = 'Resolvi sozinho'
          where id = $1 returning id`,
        [revisao.id],
      ),
    );

    expect(atualizadas.rows).toHaveLength(0);

    const noBanco = await db.query<{ status: string; resolvido_por: string | null }>(
      'select status, resolvido_por from viagem_revisao where id = $1',
      [revisao.id],
    );
    expect(noBanco.rows[0]).toEqual({ status: 'Pendente', resolvido_por: null });
  });

  it('rejeita revisão que já nasce resolvida ou descartada', async () => {
    for (const status of ['Resolvida', 'Descartada'] as const) {
      const revisao = novaRevisao({ status });

      const erro = await erroDoBanco(inserirRevisao(db, MOTORISTA_A, revisao));

      expect(erro?.code).toBe('23514');
      expect(erro?.message).toContain('Pendente');
    }
  });

  it('protege os dados de origem da revisão depois de criada', async () => {
    const revisao = novaRevisao();
    await inserirRevisao(db, MOTORISTA_A, revisao);

    const erro = await erroDoBanco(
      comoUsuario(db, GESTOR, (tx) =>
        tx.query(
          `update viagem_revisao set payload = '{"adulterado":true}'::jsonb where id = $1`,
          [revisao.id],
        ),
      ),
    );

    expect(erro?.code).toBe('23514');
    expect(erro?.message).toContain('origem');
  });

  it('Admin não apaga a trilha da revisão', async () => {
    const revisao = novaRevisao();
    await inserirRevisao(db, MOTORISTA_A, revisao);

    const excluidas = await comoUsuario(db, ADMIN, (tx) =>
      tx.query('delete from viagem_revisao where id = $1 returning id', [revisao.id]),
    );
    expect(excluidas.rows).toHaveLength(0);

    const total = await db.query<{ total: number }>(
      'select count(*)::int as total from viagem_revisao where id = $1',
      [revisao.id],
    );
    expect(total.rows[0]!.total).toBe(1);
  });

  it('reenviar o mesmo id com on conflict do nothing mantém uma única revisão', async () => {
    const revisao = novaRevisao();
    await inserirRevisao(db, MOTORISTA_A, revisao);

    const reenvio = await comoUsuario(db, MOTORISTA_A, (tx) =>
      tx.query(
        `insert into viagem_revisao
           (id, viagem_id, solicitante_id, codigo, mensagem, payload)
         values ($1, $2, $3, $4, $5, $6::jsonb)
         on conflict (id) do nothing`,
        [
          revisao.id,
          revisao.viagem_id,
          revisao.solicitante_id,
          revisao.codigo,
          revisao.mensagem,
          JSON.stringify(revisao.payload),
        ],
      ),
    );
    expect(reenvio.rows).toHaveLength(0);

    const total = await db.query<{ total: number }>(
      'select count(*)::int as total from viagem_revisao where id = $1',
      [revisao.id],
    );
    expect(total.rows[0]!.total).toBe(1);
  });

  it('payload precisa ser um objeto JSON', async () => {
    const erro = await erroDoBanco(
      comoUsuario(db, MOTORISTA_A, (tx) =>
        tx.query(
          `insert into viagem_revisao (id, viagem_id, solicitante_id, codigo, mensagem, payload)
           values ($1, $2, $3, 'VG005', 'teste', '[]'::jsonb)`,
          [randomUUID(), randomUUID(), MOTORISTA_A.id],
        ),
      ),
    );

    expect(erro?.code).toBe('23514');
  });

  it('mantém RLS ativo na tabela', async () => {
    const resultado = await db.query<{ relrowsecurity: boolean }>(
      `select relrowsecurity from pg_class
        where relnamespace = 'public'::regnamespace and relname = 'viagem_revisao'`,
    );
    expect(resultado.rows[0]?.relrowsecurity).toBe(true);
  });

  it('não permite anon ler nem gravar', async () => {
    const revisao = novaRevisao();
    await inserirRevisao(db, MOTORISTA_A, revisao);

    const leitura = await comoAnonimo(db, (tx) => tx.query('select id from viagem_revisao'));
    expect(leitura.rows).toHaveLength(0);

    const erro = await erroDoBanco(
      comoAnonimo(db, (tx) =>
        tx.query(
          `insert into viagem_revisao (id, viagem_id, solicitante_id, codigo, mensagem, payload)
           values ($1, $2, $3, 'VG005', 'teste anon', '{}'::jsonb)`,
          [randomUUID(), randomUUID(), MOTORISTA_A.id],
        ),
      ),
    );
    expect(erro).not.toBeNull();
  });
});
