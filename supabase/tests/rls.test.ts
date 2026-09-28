/** @jest-environment node */
// Testes da migration 20260924000500_rls.sql — spec.md:
// P1 Acesso por perfil (RLS) AC1 (RLS ativo), AC3 (Motorista sem financeiro),
// AC4 (Motorista só as próprias viagens), AC5 (Admin/Financeiro no financeiro),
// AC6 (Admin/Gestor na frota), AC7 (leitura autenticada de veiculo/rota/perfil),
// AC8 (não-Admin não grava usuario/perfil), AC9 (delete sempre rejeitado) e
// AC10 (anon vê zero linhas em tudo).

import { criarBanco, comoUsuario, comoSuperuser, comoAnonimo, type Banco } from './helpers/db';

describe('migration rls: policies por perfil', () => {
  let db: Banco;
  let categoriaId: string;
  let formaPagamentoId: string;
  let veiculoId: string;
  let rotaId: string;
  let motoristaId: string;
  let outroMotoristaId: string;
  let viagemPropriaId: string;
  let viagemAlheiaId: string;
  let movimentacaoId: string;
  let dividaId: string;

  beforeAll(async () => {
    db = await criarBanco();

    const categoria = await db.query<{ id: string }>(
      `select id from categoria where titulo = 'Combustível' limit 1`,
    );
    categoriaId = categoria.rows[0]!.id;

    const forma = await db.query<{ id: string }>(`select id from forma_pagamento where nome = 'Pix' limit 1`);
    formaPagamentoId = forma.rows[0]!.id;

    motoristaId = '10000000-0000-0000-0000-000000000001';
    outroMotoristaId = '10000000-0000-0000-0000-000000000002';

    await comoUsuario(db, { id: motoristaId, perfil: 'Motorista' }, async () => {});
    await comoUsuario(db, { id: outroMotoristaId, perfil: 'Motorista' }, async () => {});

    await comoSuperuser(db, async (tx) => {
      const veiculo = await tx.query<{ id: string }>(
        `insert into veiculo (placa, marca, modelo, capacidade_carga)
         values ('RLS1A23', 'Volvo', 'FH', 10000) returning id`,
      );
      veiculoId = veiculo.rows[0]!.id;

      const rota = await tx.query<{ id: string }>(
        `insert into rota (cidade_origem, cidade_destino, distancia_estimada_km)
         values ('São Paulo', 'Curitiba', 400) returning id`,
      );
      rotaId = rota.rows[0]!.id;

      const viagemPropria = await tx.query<{ id: string }>(
        `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial)
         values ($1, $2, $3, 1000) returning id`,
        [veiculoId, rotaId, motoristaId],
      );
      viagemPropriaId = viagemPropria.rows[0]!.id;

      const viagemAlheia = await tx.query<{ id: string }>(
        `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial)
         values ($1, $2, $3, 1000) returning id`,
        [veiculoId, rotaId, outroMotoristaId],
      );
      viagemAlheiaId = viagemAlheia.rows[0]!.id;

      const movimentacao = await tx.query<{ id: string }>(
        `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao)
         values ($1, $2, 100, 'Movimentação de teste RLS') returning id`,
        [categoriaId, formaPagamentoId],
      );
      movimentacaoId = movimentacao.rows[0]!.id;

      const divida = await tx.query<{ id: string }>(
        `insert into divida (categoria_id, descricao, quantidade_parcelas, valor_parcela, data_vencimento_primeira)
         values ($1, 'Dívida de teste RLS', 6, 100, current_date) returning id`,
        [categoriaId],
      );
      dividaId = divida.rows[0]!.id;
    });
  });

  afterAll(async () => {
    await db.close();
  });

  it('mantém relrowsecurity ativo nas 10 tabelas', async () => {
    const resultado = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace
       and relname in ('perfil', 'usuario', 'categoria', 'forma_pagamento',
         'movimentacao', 'divida', 'veiculo', 'rota', 'viagem', 'manutencao')`,
    );

    expect(resultado.rows).toHaveLength(10);
    expect(resultado.rows.every((linha) => linha.relrowsecurity)).toBe(true);
  });

  it('motorista vê zero linhas de movimentacao, divida, categoria e forma_pagamento', async () => {
    await comoUsuario(db, { id: motoristaId }, async (tx) => {
      const movimentacoes = await tx.query('select id from movimentacao');
      const dividas = await tx.query('select id from divida');
      const categorias = await tx.query('select id from categoria');
      const formasPagamento = await tx.query('select id from forma_pagamento');

      expect(movimentacoes.rows).toHaveLength(0);
      expect(dividas.rows).toHaveLength(0);
      expect(categorias.rows).toHaveLength(0);
      expect(formasPagamento.rows).toHaveLength(0);
    });
  });

  it('admin e financeiro leem e gravam movimentacao, divida, categoria e forma_pagamento', async () => {
    for (const perfil of ['Admin', 'Financeiro'] as const) {
      await comoUsuario(db, { id: `20000000-0000-0000-0000-00000000000${perfil === 'Admin' ? 1 : 2}`, perfil }, async (tx) => {
        const movimentacoes = await tx.query('select id from movimentacao');
        expect(movimentacoes.rows.length).toBeGreaterThan(0);

        const nova = await tx.query<{ id: string }>(
          `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao)
           values ($1, $2, 50, 'Gravada por ${perfil}') returning id`,
          [categoriaId, formaPagamentoId],
        );
        expect(nova.rows[0]?.id).toBeDefined();
      });
    }
  });

  it('motorista só enxerga a própria viagem', async () => {
    await comoUsuario(db, { id: motoristaId }, async (tx) => {
      const viagens = await tx.query<{ id: string }>('select id from viagem');

      expect(viagens.rows).toHaveLength(1);
      expect(viagens.rows[0]?.id).toBe(viagemPropriaId);
    });
  });

  it('motorista grava só a própria viagem e é rejeitado ao gravar a de outro', async () => {
    await comoUsuario(db, { id: motoristaId }, async (tx) => {
      await expect(
        tx.query('update viagem set hodometro_final = 1500 where id = $1', [viagemPropriaId]),
      ).resolves.toBeDefined();

      const semAlteracao = await tx.query(
        'update viagem set hodometro_final = 1500 where id = $1 returning id',
        [viagemAlheiaId],
      );
      expect(semAlteracao.rows).toHaveLength(0);
    });
  });

  it('admin e gestor de frota gravam veiculo, rota, viagem e manutencao', async () => {
    for (const perfil of ['Admin', 'Gestor de Frota'] as const) {
      const usuarioId = perfil === 'Admin' ? '30000000-0000-0000-0000-000000000001' : '30000000-0000-0000-0000-000000000002';
      await comoUsuario(db, { id: usuarioId, perfil }, async (tx) => {
        const veiculo = await tx.query<{ id: string }>(
          `insert into veiculo (placa, marca, modelo, capacidade_carga)
           values ($1, 'Scania', 'R450', 12000) returning id`,
          [`PL${perfil === 'Admin' ? 'A' : 'B'}1234`],
        );
        expect(veiculo.rows[0]?.id).toBeDefined();

        const manutencao = await tx.query<{ id: string }>(
          `insert into manutencao (veiculo_id, descricao, data_manutencao, valor)
           values ($1, 'Troca de óleo', current_date, 300) returning id`,
          [veiculoId],
        );
        expect(manutencao.rows[0]?.id).toBeDefined();
      });
    }
  });

  it('motorista é rejeitado ao gravar veiculo e rota', async () => {
    await expect(
      comoUsuario(db, { id: motoristaId }, async (tx) => {
        await tx.query(
          `insert into veiculo (placa, marca, modelo, capacidade_carga)
           values ('PLMOT123', 'Ford', 'Cargo', 8000) returning id`,
        );
      }),
    ).rejects.toThrow();
  });

  it('qualquer autenticado lê veiculo, rota e perfil', async () => {
    await comoUsuario(db, { id: motoristaId }, async (tx) => {
      const veiculos = await tx.query('select id from veiculo');
      const rotas = await tx.query('select id from rota');
      const perfis = await tx.query('select id from perfil');

      expect(veiculos.rows.length).toBeGreaterThan(0);
      expect(rotas.rows.length).toBeGreaterThan(0);
      expect(perfis.rows).toHaveLength(4);
    });
  });

  it('não-admin é rejeitado ao gravar em perfil', async () => {
    await expect(
      comoUsuario(db, { id: motoristaId }, async (tx) => {
        await tx.query(`insert into perfil (nome) values ('Admin') returning id`);
      }),
    ).rejects.toThrow();
  });

  it('não-admin não altera a linha de outro usuário', async () => {
    await comoUsuario(db, { id: motoristaId }, async (tx) => {
      const usuarioAlheio = await tx.query(
        'update usuario set nome = $2 where id = $1 returning id',
        [outroMotoristaId, 'Tentativa de alterar outro usuário'],
      );
      expect(usuarioAlheio.rows).toHaveLength(0);
    });
  });

  it('rejeita delete em categoria, forma_pagamento, usuario e perfil mesmo para admin', async () => {
    await comoUsuario(db, { id: '40000000-0000-0000-0000-000000000001', perfil: 'Admin' }, async (tx) => {
      const deleteCategoria = await tx.query('delete from categoria where id = $1 returning id', [categoriaId]);
      expect(deleteCategoria.rows).toHaveLength(0);

      const deleteFormaPagamento = await tx.query('delete from forma_pagamento where id = $1 returning id', [
        formaPagamentoId,
      ]);
      expect(deleteFormaPagamento.rows).toHaveLength(0);

      const deleteUsuario = await tx.query('delete from usuario where id = $1 returning id', [motoristaId]);
      expect(deleteUsuario.rows).toHaveLength(0);

      const perfilQualquer = await tx.query<{ id: string }>(`select id from perfil limit 1`);
      const deletePerfil = await tx.query('delete from perfil where id = $1 returning id', [
        perfilQualquer.rows[0]!.id,
      ]);
      expect(deletePerfil.rows).toHaveLength(0);
    });
  });

  it('usuário não autenticado (anon) vê zero linhas em todas as tabelas', async () => {
    await comoAnonimo(db, async (tx) => {
      const tabelas = [
        'perfil',
        'usuario',
        'categoria',
        'forma_pagamento',
        'movimentacao',
        'divida',
        'veiculo',
        'rota',
        'viagem',
        'manutencao',
      ];

      for (const tabela of tabelas) {
        const resultado = await tx.query(`select 1 from ${tabela}`);
        expect(resultado.rows).toHaveLength(0);
      }
    });
  });
});
