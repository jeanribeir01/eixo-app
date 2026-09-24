/** @jest-environment node */
// Testes da migration 20260924000400_financeiro.sql — spec.md:
// P1 Tabelas AC1 (10 tabelas), AC2 (viagem_id/divida_id anuláveis), AC3 (FKs
// obrigatórias de movimentacao), AC4 (data_atualizacao), AC5 (Pago sem
// data_pagamento), AC9 (valor/valor_parcela negativos) e o edge case de
// Pendente com data_pagamento preenchida.

import { criarBanco, comoSuperuser, type Banco } from './helpers/db';

describe('migration financeira: divida e movimentacao', () => {
  let db: Banco;
  let categoriaId: string;
  let formaPagamentoId: string;

  beforeAll(async () => {
    db = await criarBanco();

    const categoria = await db.query<{ id: string }>(
      `select id from categoria where titulo = 'Combustível' limit 1`,
    );
    categoriaId = categoria.rows[0]!.id;

    const forma = await db.query<{ id: string }>(`select id from forma_pagamento where nome = 'Pix' limit 1`);
    formaPagamentoId = forma.rows[0]!.id;
  });

  afterAll(async () => {
    await db.close();
  });

  it('cria as 10 tabelas do domínio em public', async () => {
    const resultado = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public'
       and table_name in ('perfil', 'usuario', 'categoria', 'forma_pagamento',
         'movimentacao', 'divida', 'veiculo', 'rota', 'viagem', 'manutencao')`,
    );

    expect(resultado.rows).toHaveLength(10);
  });

  it('aceita movimentacao sem viagem_id e sem divida_id', async () => {
    const resultado = await db.query<{ id: string }>(
      `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao)
       values ($1, $2, 100, 'Despesa de escritório') returning id`,
      [categoriaId, formaPagamentoId],
    );

    expect(resultado.rows[0]?.id).toBeDefined();
  });

  it('rejeita movimentacao com viagem_id ou divida_id inexistente', async () => {
    const idInexistente = '00000000-0000-0000-0000-000000000000';

    await expect(
      db.query(
        `insert into movimentacao (categoria_id, forma_pagamento_id, viagem_id, valor, descricao)
         values ($1, $2, $3, 100, 'Com viagem inexistente')`,
        [categoriaId, formaPagamentoId, idInexistente],
      ),
    ).rejects.toThrow();

    await expect(
      db.query(
        `insert into movimentacao (categoria_id, forma_pagamento_id, divida_id, valor, descricao)
         values ($1, $2, $3, 100, 'Com dívida inexistente')`,
        [categoriaId, formaPagamentoId, idInexistente],
      ),
    ).rejects.toThrow();
  });

  it('rejeita movimentacao Pago sem data_pagamento', async () => {
    await expect(
      db.query(
        `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao, status_pagamento)
         values ($1, $2, 100, 'Pago sem data', 'Pago')`,
        [categoriaId, formaPagamentoId],
      ),
    ).rejects.toThrow();
  });

  it('aceita movimentacao Pendente com data_pagamento preenchida (pagamento agendado)', async () => {
    const resultado = await db.query<{ status_pagamento: string }>(
      `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao, status_pagamento, data_pagamento)
       values ($1, $2, 100, 'Pagamento agendado', 'Pendente', current_date + 5)
       returning status_pagamento`,
      [categoriaId, formaPagamentoId],
    );

    expect(resultado.rows[0]?.status_pagamento).toBe('Pendente');
  });

  it('rejeita movimentacao com valor negativo', async () => {
    await expect(
      db.query(
        `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao)
         values ($1, $2, -10, 'Valor negativo')`,
        [categoriaId, formaPagamentoId],
      ),
    ).rejects.toThrow();
  });

  it('rejeita divida com valor_parcela negativo', async () => {
    await expect(
      db.query(
        `insert into divida (categoria_id, descricao, quantidade_parcelas, valor_parcela, data_vencimento_primeira)
         values ($1, 'Financiamento do caminhão', 12, -100, current_date)`,
        [categoriaId],
      ),
    ).rejects.toThrow();
  });

  it('atualiza data_atualizacao de movimentacao no update', async () => {
    const inserida = await db.query<{ id: string }>(
      `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao)
       values ($1, $2, 50, 'Para atualizar') returning id`,
      [categoriaId, formaPagamentoId],
    );
    const id = inserida.rows[0]!.id;

    const antes = await db.query<{ data_atualizacao: string }>(
      'select data_atualizacao from movimentacao where id = $1',
      [id],
    );

    await comoSuperuser(db, async (tx) => {
      await tx.query('update movimentacao set descricao = $2 where id = $1', [id, 'Atualizada']);
    });

    const depois = await db.query<{ data_atualizacao: string }>(
      'select data_atualizacao from movimentacao where id = $1',
      [id],
    );

    expect(new Date(depois.rows[0]!.data_atualizacao).getTime()).toBeGreaterThan(
      new Date(antes.rows[0]!.data_atualizacao).getTime(),
    );
  });
});
