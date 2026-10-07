/** @jest-environment node */
// Matriz de acesso por perfil da EIX-32 (US18) — spec .specs/features/eix32-rls/spec.md.
// Cada teste chama o banco como o PostgREST chama (role `authenticated` + `auth.uid()`),
// sem passar pela UI: é a prova de que esconder a tela (US17) não é a única barreira.
//
// O que já tinha prova antes desta task continua nos arquivos de origem e não é repetido
// aqui: Motorista sem financeiro e só as próprias viagens (rls.test.ts), RPCs recusando
// perfil (divida.test.ts DIV-06, resumo_caixa.test.ts SALDO-06).

import {
  comoSuperuser,
  comoUsuario,
  criarBanco,
  type Banco,
  type PerfilNome,
  type StatusUsuario,
} from './helpers/db';

const ADMIN = '32000000-0000-0000-0000-000000000001';
const FINANCEIRO = '32000000-0000-0000-0000-000000000002';
const GESTOR = '32000000-0000-0000-0000-000000000003';
const MOTORISTA = '32000000-0000-0000-0000-000000000004';
const OUTRO_MOTORISTA = '32000000-0000-0000-0000-000000000005';

const NAO_APROVADOS: [StatusUsuario, string][] = [
  ['AguardandoAprovacao', '32000000-0000-0000-0001-000000000001'],
  ['Bloqueado', '32000000-0000-0000-0001-000000000002'],
];

const TABELAS_FINANCEIRAS = ['movimentacao', 'divida', 'categoria', 'forma_pagamento'] as const;
const TABELAS_FROTA = ['veiculo', 'rota', 'viagem', 'manutencao'] as const;

async function codigoDoErro(promessa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promessa;
    return undefined;
  } catch (erro) {
    return (erro as { code?: string }).code;
  }
}

describe('EIX-32: RLS por perfil', () => {
  let db: Banco;
  let categoriaId: string;
  let formaPagamentoId: string;
  let veiculoId: string;
  let rotaId: string;

  // Total de linhas sem RLS: "lê todas" (RLS-05, RLS-09) compara com isto, não com "> 0".
  async function totalSemRls(tabela: string): Promise<number> {
    const resultado = await db.query<{ total: number }>(`select count(*)::int as total from ${tabela}`);
    return resultado.rows[0]!.total;
  }

  beforeAll(async () => {
    db = await criarBanco();

    const perfis: [string, PerfilNome][] = [
      [ADMIN, 'Admin'],
      [FINANCEIRO, 'Financeiro'],
      [GESTOR, 'Gestor de Frota'],
      [MOTORISTA, 'Motorista'],
      [OUTRO_MOTORISTA, 'Motorista'],
    ];
    for (const [id, perfil] of perfis) {
      await comoUsuario(db, { id, perfil }, async () => {});
    }

    // Uma linha em cada tabela, para que "zero linhas" signifique bloqueio e não tabela vazia.
    await comoSuperuser(db, async (tx) => {
      categoriaId = (await tx.query<{ id: string }>(`select id from categoria limit 1`)).rows[0]!.id;
      formaPagamentoId = (await tx.query<{ id: string }>(`select id from forma_pagamento limit 1`)).rows[0]!.id;

      veiculoId = (
        await tx.query<{ id: string }>(
          `insert into veiculo (placa, marca, modelo, capacidade_carga)
           values ('EIX3200', 'Volvo', 'FH', 10000) returning id`,
        )
      ).rows[0]!.id;
      rotaId = (
        await tx.query<{ id: string }>(
          `insert into rota (cidade_origem, cidade_destino, distancia_estimada_km)
           values ('Campinas', 'Santos', 160) returning id`,
        )
      ).rows[0]!.id;

      await tx.query(
        `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial)
         values ($1, $2, $3, 1000), ($1, $2, $4, 2000)`,
        [veiculoId, rotaId, MOTORISTA, OUTRO_MOTORISTA],
      );
      await tx.query(
        `insert into manutencao (veiculo_id, descricao, data_manutencao, valor)
         values ($1, 'Troca de pneus', current_date, 1200)`,
        [veiculoId],
      );
      await tx.query(
        `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao)
         values ($1, $2, 100, 'Movimentação EIX-32')`,
        [categoriaId, formaPagamentoId],
      );
      await tx.query(
        `insert into divida (categoria_id, descricao, quantidade_parcelas, valor_parcela, data_vencimento_primeira)
         values ($1, 'Dívida EIX-32', 3, 100, current_date)`,
        [categoriaId],
      );
    });
  });

  afterAll(async () => {
    await db.close();
  });

  it('nenhuma tabela do schema public fica sem RLS (RLS-01)', async () => {
    // Varre o catálogo em vez de uma lista fixa: tabela criada numa task futura sem
    // `enable row level security` derruba este teste e aparece pelo nome.
    const tabelas = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relkind in ('r', 'p')`,
    );

    expect(tabelas.rows.length).toBeGreaterThanOrEqual(10);
    expect(tabelas.rows.filter((linha) => !linha.relrowsecurity).map((linha) => linha.relname)).toEqual([]);
  });

  describe('Motorista', () => {
    it('é rejeitado com 42501 ao criar viagem para outro motorista (RLS-04)', async () => {
      const codigo = await codigoDoErro(
        comoUsuario(db, { id: MOTORISTA, perfil: 'Motorista' }, (tx) =>
          tx.query(
            `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial)
             values ($1, $2, $3, 3000)`,
            [veiculoId, rotaId, OUTRO_MOTORISTA],
          ),
        ),
      );

      expect(codigo).toBe('42501');
    });
  });

  describe('Gestor de Frota', () => {
    it.each(TABELAS_FROTA)('lê todas as linhas de %s (RLS-05)', async (tabela) => {
      const esperado = await totalSemRls(tabela);

      await comoUsuario(db, { id: GESTOR, perfil: 'Gestor de Frota' }, async (tx) => {
        const linhas = await tx.query(`select id from ${tabela}`);

        expect(esperado).toBeGreaterThan(0);
        expect(linhas.rows).toHaveLength(esperado);
      });
    });

    it.each(TABELAS_FINANCEIRAS)('vê zero linhas de %s (RLS-06)', async (tabela) => {
      await comoUsuario(db, { id: GESTOR, perfil: 'Gestor de Frota' }, async (tx) => {
        const linhas = await tx.query(`select id from ${tabela}`);

        expect(linhas.rows).toHaveLength(0);
      });
    });
  });

  describe('insert em movimentacao fora do financeiro (RLS-07)', () => {
    it.each([
      [GESTOR, 'Gestor de Frota'],
      [MOTORISTA, 'Motorista'],
    ] as [string, PerfilNome][])('%s → 42501', async (id, perfil) => {
      const codigo = await codigoDoErro(
        comoUsuario(db, { id, perfil }, (tx) =>
          tx.query(
            `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao)
             values ($1, $2, 10, 'Tentativa fora do perfil')`,
            [categoriaId, formaPagamentoId],
          ),
        ),
      );

      expect(codigo).toBe('42501');
    });
  });

  describe('Admin e Financeiro (RLS-09)', () => {
    const casos = (['Admin', 'Financeiro'] as const).flatMap((perfil) =>
      TABELAS_FINANCEIRAS.map((tabela) => [perfil, tabela] as const),
    );

    it.each(casos)('%s lê todas as linhas de %s', async (perfil, tabela) => {
      const esperado = await totalSemRls(tabela);

      await comoUsuario(db, { id: perfil === 'Admin' ? ADMIN : FINANCEIRO, perfil }, async (tx) => {
        const linhas = await tx.query(`select id from ${tabela}`);

        expect(esperado).toBeGreaterThan(0);
        expect(linhas.rows).toHaveLength(esperado);
      });
    });
  });

  describe('usuário não aprovado', () => {
    // Perfil Admin de propósito: o pior caso. Se o status não cortasse o acesso, este
    // usuário leria tudo.
    it.each(NAO_APROVADOS)(
      '%s vê zero linhas nas tabelas de financeiro e frota (RLS-10)',
      async (status, id) => {
        await comoUsuario(db, { id, perfil: 'Admin', status }, async (tx) => {
          for (const tabela of [...TABELAS_FINANCEIRAS, ...TABELAS_FROTA]) {
            const linhas = await tx.query(`select id from ${tabela}`);

            expect({ tabela, linhas: linhas.rows.length }).toEqual({ tabela, linhas: 0 });
          }
        });
      },
    );

    it.each(NAO_APROVADOS)('%s lê só a própria linha de usuario (RLS-11)', async (status, id) => {
      await comoUsuario(db, { id, perfil: 'Admin', status }, async (tx) => {
        const usuarios = await tx.query<{ id: string }>('select id from usuario');

        expect(usuarios.rows.map((linha) => linha.id)).toEqual([id]);
      });
    });

    it.each(NAO_APROVADOS)('%s lê só a linha do próprio perfil (RLS-12)', async (status, id) => {
      // Financeiro, e não o Motorista padrão, para provar que a linha vem do perfil_id do
      // próprio usuário e não de um "Motorista" fixo.
      await comoUsuario(db, { id, perfil: 'Financeiro', status }, async (tx) => {
        const perfis = await tx.query<{ nome: string }>('select nome from perfil');

        expect(perfis.rows.map((linha) => linha.nome)).toEqual(['Financeiro']);
      });
    });
  });

  it('usuário Ativo lê os 4 perfis (RLS-13)', async () => {
    await comoUsuario(db, { id: MOTORISTA, perfil: 'Motorista' }, async (tx) => {
      const perfis = await tx.query<{ nome: string }>('select nome from perfil');

      expect(perfis.rows.map((linha) => linha.nome).sort()).toEqual(['Admin', 'Financeiro', 'Gestor de Frota', 'Motorista']);
    });
  });
});
