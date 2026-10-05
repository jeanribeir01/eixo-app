/** @jest-environment node */
// Testes da migration 20261004000100_movimentacao_regras.sql — spec EIX-33:
// MOV-06 (valor > 0 e Pago exige data_pagamento, rejeitados com 23514) e
// MOV-07 (parcela de dívida não é excluível pela API; Motorista e Gestor de Frota
// continuam sem acesso a movimentacao).

import { criarBanco, comoSuperuser, comoUsuario, type Banco } from './helpers/db';

const FINANCEIRO = { id: '30000000-0000-0000-0000-000000000001', perfil: 'Financeiro' as const };
const MOTORISTA = { id: '30000000-0000-0000-0000-000000000002', perfil: 'Motorista' as const };
const GESTOR = { id: '30000000-0000-0000-0000-000000000003', perfil: 'Gestor de Frota' as const };

// O erro do PGlite traz o SQLSTATE em `code`; é ele que o app traduz em mensagem.
async function codigoDoErro(promessa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promessa;
    return undefined;
  } catch (erro) {
    return (erro as { code?: string }).code;
  }
}

describe('migration movimentacao_regras', () => {
  let db: Banco;
  let categoriaId: string;
  let formaPagamentoId: string;
  let dividaId: string;

  beforeAll(async () => {
    db = await criarBanco();

    const categoria = await db.query<{ id: string }>(`select id from categoria where titulo = 'Frete' limit 1`);
    categoriaId = categoria.rows[0]!.id;
    const forma = await db.query<{ id: string }>(`select id from forma_pagamento where nome = 'Pix' limit 1`);
    formaPagamentoId = forma.rows[0]!.id;

    const divida = await db.query<{ id: string }>(
      `insert into divida (categoria_id, descricao, quantidade_parcelas, valor_parcela, data_vencimento_primeira)
       values ($1, 'Dívida de teste', 2, 100, current_date) returning id`,
      [categoriaId],
    );
    dividaId = divida.rows[0]!.id;
  });

  afterAll(async () => {
    await db.close();
  });

  async function inserirComoSuperuser(descricao: string, opcoes: { dividaId?: string } = {}): Promise<string> {
    return comoSuperuser(db, async (tx) => {
      const linha = await tx.query<{ id: string }>(
        `insert into movimentacao (categoria_id, forma_pagamento_id, divida_id, valor, descricao)
         values ($1, $2, $3, 100, $4) returning id`,
        [categoriaId, formaPagamentoId, opcoes.dividaId ?? null, descricao],
      );
      return linha.rows[0]!.id;
    });
  }

  describe('MOV-06: invariantes de valor e pagamento', () => {
    it('rejeita insert com valor zero (23514)', async () => {
      const codigo = await codigoDoErro(
        comoUsuario(db, FINANCEIRO, (tx) =>
          tx.query(
            `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao)
             values ($1, $2, 0, 'Valor zero')`,
            [categoriaId, formaPagamentoId],
          ),
        ),
      );

      expect(codigo).toBe('23514');
    });

    it('rejeita update que zera o valor (23514)', async () => {
      const id = await inserirComoSuperuser('Para zerar');

      const codigo = await codigoDoErro(
        comoUsuario(db, FINANCEIRO, (tx) => tx.query('update movimentacao set valor = 0 where id = $1', [id])),
      );

      expect(codigo).toBe('23514');
    });

    it('rejeita valor negativo (23514)', async () => {
      const codigo = await codigoDoErro(
        comoUsuario(db, FINANCEIRO, (tx) =>
          tx.query(
            `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao)
             values ($1, $2, -1, 'Negativo')`,
            [categoriaId, formaPagamentoId],
          ),
        ),
      );

      expect(codigo).toBe('23514');
    });

    it('aceita o menor valor positivo (R$ 0,01)', async () => {
      const linha = await comoUsuario(db, FINANCEIRO, (tx) =>
        tx.query<{ valor: string }>(
          `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao)
           values ($1, $2, 0.01, 'Um centavo') returning valor`,
          [categoriaId, formaPagamentoId],
        ),
      );

      expect(Number(linha.rows[0]!.valor)).toBe(0.01);
    });

    it('rejeita Pago sem data_pagamento (23514)', async () => {
      const codigo = await codigoDoErro(
        comoUsuario(db, FINANCEIRO, (tx) =>
          tx.query(
            `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao, status_pagamento)
             values ($1, $2, 10, 'Pago sem data', 'Pago')`,
            [categoriaId, formaPagamentoId],
          ),
        ),
      );

      expect(codigo).toBe('23514');
    });

    it('rejeita update para Pago sem data_pagamento (23514)', async () => {
      const id = await inserirComoSuperuser('Para pagar sem data');

      const codigo = await codigoDoErro(
        comoUsuario(db, FINANCEIRO, (tx) =>
          tx.query(`update movimentacao set status_pagamento = 'Pago' where id = $1`, [id]),
        ),
      );

      expect(codigo).toBe('23514');
    });
  });

  describe('MOV-07: exclusão e acesso por perfil', () => {
    it('Financeiro exclui movimentação avulsa (1 linha)', async () => {
      const id = await inserirComoSuperuser('Avulsa');

      const resultado = await comoUsuario(db, FINANCEIRO, (tx) =>
        tx.query('delete from movimentacao where id = $1 returning id', [id]),
      );

      expect(resultado.rows).toHaveLength(1);
      const restante = await db.query('select id from movimentacao where id = $1', [id]);
      expect(restante.rows).toHaveLength(0);
    });

    it('Financeiro não exclui parcela de dívida (0 linhas, parcela preservada)', async () => {
      const id = await inserirComoSuperuser('Parcela 1/2', { dividaId });

      const resultado = await comoUsuario(db, FINANCEIRO, (tx) =>
        tx.query('delete from movimentacao where id = $1 returning id', [id]),
      );

      expect(resultado.rows).toHaveLength(0);
      const restante = await db.query('select id from movimentacao where id = $1', [id]);
      expect(restante.rows).toHaveLength(1);
    });

    it('Motorista e Gestor de Frota não leem movimentacao', async () => {
      await inserirComoSuperuser('Visível só para o financeiro');

      for (const usuario of [MOTORISTA, GESTOR]) {
        const resultado = await comoUsuario(db, usuario, (tx) => tx.query('select id from movimentacao'));
        expect(resultado.rows).toHaveLength(0);
      }
    });

    it('Motorista e Gestor de Frota não inserem movimentacao (42501)', async () => {
      for (const usuario of [MOTORISTA, GESTOR]) {
        const codigo = await codigoDoErro(
          comoUsuario(db, usuario, (tx) =>
            tx.query(
              `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao)
               values ($1, $2, 10, 'Tentativa')`,
              [categoriaId, formaPagamentoId],
            ),
          ),
        );
        expect(codigo).toBe('42501');
      }
    });

    it('Motorista e Gestor de Frota não alteram nem excluem movimentacao (0 linhas)', async () => {
      const id = await inserirComoSuperuser('Protegida');

      for (const usuario of [MOTORISTA, GESTOR]) {
        const resultado = await comoUsuario(db, usuario, async (tx) => {
          const atualizadas = await tx.query('update movimentacao set valor = 999 where id = $1 returning id', [id]);
          const excluidas = await tx.query('delete from movimentacao where id = $1 returning id', [id]);
          return { atualizadas: atualizadas.rows.length, excluidas: excluidas.rows.length };
        });
        expect(resultado).toEqual({ atualizadas: 0, excluidas: 0 });
      }

      const linha = await db.query<{ valor: string }>('select valor from movimentacao where id = $1', [id]);
      expect(Number(linha.rows[0]!.valor)).toBe(100);
    });
  });
});
