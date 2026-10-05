/** @jest-environment node */
// Testes da migration 20261005000200_divida.sql — spec EIX-36 (DIV-01 a DIV-06).
// As RPCs gravam em `divida` e `movimentacao`; cada teste confere a tabela depois da chamada,
// não só o retorno, porque o AC é sobre o que fica gravado.

import type { Transaction } from '@electric-sql/pglite';

import { criarBanco, comoAnonimo, comoSuperuser, comoUsuario, type Banco, type PerfilNome } from './helpers/db';

const FINANCEIRO = { id: '36000000-0000-0000-0000-000000000001', perfil: 'Financeiro' as const };
const ADMIN = { id: '36000000-0000-0000-0000-000000000002', perfil: 'Admin' as const };

type Parcela = {
  valor: string;
  descricao: string;
  categoria_id: string;
  forma_pagamento_id: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status_pagamento: 'Pendente' | 'Pago';
};

type DadosDivida = {
  descricao?: string;
  categoriaId?: string;
  formaPagamentoId?: string;
  quantidadeParcelas?: number;
  // Em reais, como a coluna `numeric(12,2)` guarda.
  valorParcela?: string;
  dataVencimentoPrimeira?: string;
  valorQuitacaoAntecipada?: string | null;
};

async function codigoDoErro(promessa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promessa;
    return undefined;
  } catch (erro) {
    return (erro as { code?: string }).code;
  }
}

describe('migration divida', () => {
  let db: Banco;
  let categoriaFinanciamento: string;
  let categoriaEntrada: string;
  let categoriaSaidaInativa: string;
  let formaBoleto: string;
  let formaInativa: string;

  beforeAll(async () => {
    db = await criarBanco();

    const financiamento = await db.query<{ id: string }>(
      `select id from categoria where titulo = 'Financiamento' and tipo = 'Saida'`,
    );
    categoriaFinanciamento = financiamento.rows[0]!.id;
    const entrada = await db.query<{ id: string }>(`select id from categoria where titulo = 'Frete' and tipo = 'Entrada'`);
    categoriaEntrada = entrada.rows[0]!.id;
    const inativa = await db.query<{ id: string }>(
      `insert into categoria (titulo, tipo, ativa) values ('Saída desativada', 'Saida', false) returning id`,
    );
    categoriaSaidaInativa = inativa.rows[0]!.id;
    const boleto = await db.query<{ id: string }>(`select id from forma_pagamento where nome = 'Boleto'`);
    formaBoleto = boleto.rows[0]!.id;
    const formaDesativada = await db.query<{ id: string }>(
      `insert into forma_pagamento (nome, ativa) values ('Cheque', false) returning id`,
    );
    formaInativa = formaDesativada.rows[0]!.id;
  });

  beforeEach(async () => {
    await db.query('delete from movimentacao');
    await db.query('delete from divida');
  });

  afterAll(async () => {
    await db.close();
  });

  function chamarCriar(tx: Transaction, dados: DadosDivida = {}) {
    return tx.query<{ id: string }>(
      `select criar_divida(
         descricao => $1,
         categoria_id => $2,
         forma_pagamento_id => $3,
         quantidade_parcelas => $4,
         valor_parcela => $5::numeric,
         data_vencimento_primeira => $6::date,
         valor_quitacao_antecipada => $7::numeric
       ) as id`,
      [
        dados.descricao ?? 'Financiamento do caminhão',
        dados.categoriaId ?? categoriaFinanciamento,
        dados.formaPagamentoId ?? formaBoleto,
        dados.quantidadeParcelas ?? 12,
        dados.valorParcela ?? '3500.00',
        dados.dataVencimentoPrimeira ?? '2026-01-15',
        dados.valorQuitacaoAntecipada ?? null,
      ],
    );
  }

  async function criarComo(usuario: typeof FINANCEIRO | typeof ADMIN, dados: DadosDivida = {}): Promise<string> {
    const resultado = await comoUsuario(db, usuario, (tx) => chamarCriar(tx, dados));
    return resultado.rows[0]!.id;
  }

  async function parcelasDa(dividaId: string): Promise<Parcela[]> {
    const resultado = await db.query<Parcela>(
      `select valor::text as valor, descricao, categoria_id, forma_pagamento_id,
              data_vencimento::text as data_vencimento, data_pagamento::text as data_pagamento, status_pagamento
       from movimentacao where divida_id = $1 order by data_vencimento`,
      [dividaId],
    );
    return resultado.rows;
  }

  async function contagens(): Promise<{ dividas: number; movimentacoes: number }> {
    const dividas = await db.query<{ n: number }>('select count(*)::int as n from divida');
    const movimentacoes = await db.query<{ n: number }>('select count(*)::int as n from movimentacao');
    return { dividas: dividas.rows[0]!.n, movimentacoes: movimentacoes.rows[0]!.n };
  }

  describe('DIV-01: criar dívida com parcelas', () => {
    it('grava a dívida ativa com os dados informados e devolve o id', async () => {
      const id = await criarComo(FINANCEIRO, { valorQuitacaoAntecipada: '38000.00' });

      const divida = await db.query<{
        descricao: string;
        categoria_id: string;
        quantidade_parcelas: number;
        valor_parcela: string;
        data_vencimento_primeira: string;
        valor_quitacao_antecipada: string | null;
        ativa: boolean;
      }>(
        `select descricao, categoria_id, quantidade_parcelas, valor_parcela::text as valor_parcela,
                data_vencimento_primeira::text as data_vencimento_primeira,
                valor_quitacao_antecipada::text as valor_quitacao_antecipada, ativa
         from divida where id = $1`,
        [id],
      );

      expect(divida.rows).toEqual([
        {
          descricao: 'Financiamento do caminhão',
          categoria_id: categoriaFinanciamento,
          quantidade_parcelas: 12,
          valor_parcela: '3500.00',
          data_vencimento_primeira: '2026-01-15',
          valor_quitacao_antecipada: '38000.00',
          ativa: true,
        },
      ]);
    });

    it.each([12, 24, 48])('gera exatamente %i parcelas ligadas à dívida', async (quantidade) => {
      const id = await criarComo(ADMIN, { quantidadeParcelas: quantidade });

      const parcelas = await parcelasDa(id);
      expect(parcelas).toHaveLength(quantidade);
      expect((await contagens()).movimentacoes).toBe(quantidade);
    });

    it('cria toda parcela Pendente, sem data de pagamento, com valor, descrição, categoria e forma da chamada', async () => {
      const id = await criarComo(FINANCEIRO, { quantidadeParcelas: 3, valorParcela: '3500.10' });

      const esperada = {
        valor: '3500.10',
        descricao: 'Financiamento do caminhão',
        categoria_id: categoriaFinanciamento,
        forma_pagamento_id: formaBoleto,
        data_pagamento: null,
        status_pagamento: 'Pendente',
      };
      const parcelas = await parcelasDa(id);
      expect(parcelas).toEqual([
        { ...esperada, data_vencimento: '2026-01-15' },
        { ...esperada, data_vencimento: '2026-02-15' },
        { ...esperada, data_vencimento: '2026-03-15' },
      ]);
    });

    it('sem valor de quitação antecipada, grava null', async () => {
      const id = await criarComo(FINANCEIRO);

      const divida = await db.query<{ valor_quitacao_antecipada: string | null }>(
        'select valor_quitacao_antecipada from divida where id = $1',
        [id],
      );
      expect(divida.rows[0]!.valor_quitacao_antecipada).toBeNull();
    });

    it('com 1 parcela, cria uma só, vencendo na data da primeira', async () => {
      const id = await criarComo(FINANCEIRO, { quantidadeParcelas: 1, dataVencimentoPrimeira: '2026-11-20' });

      const parcelas = await parcelasDa(id);
      expect(parcelas.map((p) => p.data_vencimento)).toEqual(['2026-11-20']);
    });
  });

  describe('DIV-02: vencimentos mês a mês', () => {
    it('parcela n vence na data da primeira + n meses (12 parcelas)', async () => {
      const id = await criarComo(FINANCEIRO, { quantidadeParcelas: 12, dataVencimentoPrimeira: '2026-03-10' });

      const vencimentos = (await parcelasDa(id)).map((p) => p.data_vencimento);
      expect(vencimentos).toEqual([
        '2026-03-10',
        '2026-04-10',
        '2026-05-10',
        '2026-06-10',
        '2026-07-10',
        '2026-08-10',
        '2026-09-10',
        '2026-10-10',
        '2026-11-10',
        '2026-12-10',
        '2027-01-10',
        '2027-02-10',
      ]);
    });

    it('dia 31 vira o último dia do mês curto e volta a 31 no mês seguinte (ancorado na 1ª)', async () => {
      const id = await criarComo(FINANCEIRO, { quantidadeParcelas: 4, dataVencimentoPrimeira: '2026-01-31' });

      const vencimentos = (await parcelasDa(id)).map((p) => p.data_vencimento);
      expect(vencimentos).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    });

    it('29/02 em ano bissexto: fevereiro seguinte cai em 28', async () => {
      const id = await criarComo(FINANCEIRO, { quantidadeParcelas: 13, dataVencimentoPrimeira: '2028-02-29' });

      const vencimentos = (await parcelasDa(id)).map((p) => p.data_vencimento);
      expect(vencimentos[1]).toBe('2028-03-29');
      expect(vencimentos[12]).toBe('2029-02-28');
    });

    it('vira o ano: 15/12/2026 com 3 parcelas vence em 15/12, 15/01/2027 e 15/02/2027', async () => {
      const id = await criarComo(FINANCEIRO, { quantidadeParcelas: 3, dataVencimentoPrimeira: '2026-12-15' });

      const vencimentos = (await parcelasDa(id)).map((p) => p.data_vencimento);
      expect(vencimentos).toEqual(['2026-12-15', '2027-01-15', '2027-02-15']);
    });

    it('48 parcelas atravessam 4 anos sem pular nem repetir mês', async () => {
      const id = await criarComo(FINANCEIRO, { quantidadeParcelas: 48, dataVencimentoPrimeira: '2026-10-05' });

      const vencimentos = (await parcelasDa(id)).map((p) => p.data_vencimento);
      expect(vencimentos[0]).toBe('2026-10-05');
      expect(vencimentos[47]).toBe('2030-09-05');
      expect(new Set(vencimentos.map((v) => v.slice(0, 7))).size).toBe(48);
    });
  });

  describe('DIV-03: rollback', () => {
    it('se a 7ª parcela falha, nem a dívida nem as 6 primeiras parcelas ficam gravadas', async () => {
      // Trigger de teste: derruba o insert da parcela que vence em 15/07/2026 (a 7ª de uma
      // dívida que começa em 15/01/2026). As 6 anteriores já foram inseridas quando ela falha.
      await comoSuperuser(db, async (tx) => {
        await tx.query(`
          create function falha_na_setima_parcela() returns trigger language plpgsql as $$
          begin
            if new.divida_id is not null and new.data_vencimento = date '2026-07-15' then
              raise exception 'falha simulada na 7ª parcela';
            end if;
            return new;
          end;
          $$`);
        await tx.query(`
          create trigger falha_na_setima_parcela before insert on movimentacao
          for each row execute function falha_na_setima_parcela()`);
      });

      try {
        const antes = await contagens();

        const codigo = await codigoDoErro(
          comoUsuario(db, FINANCEIRO, (tx) => chamarCriar(tx, { quantidadeParcelas: 12, dataVencimentoPrimeira: '2026-01-15' })),
        );

        expect(codigo).toBe('P0001');
        expect(await contagens()).toEqual(antes);
      } finally {
        await db.query('drop trigger falha_na_setima_parcela on movimentacao');
        await db.query('drop function falha_na_setima_parcela()');
      }
    });

    it('chamada rejeitada pela validação não deixa dívida nem parcela', async () => {
      const antes = await contagens();

      await codigoDoErro(comoUsuario(db, FINANCEIRO, (tx) => chamarCriar(tx, { valorParcela: '0' })));

      expect(await contagens()).toEqual(antes);
    });
  });

  describe('DIV-04: validação no banco', () => {
    it.each([0, 121])('rejeita %i parcelas com 23514', async (quantidade) => {
      const codigo = await codigoDoErro(
        comoUsuario(db, FINANCEIRO, (tx) => chamarCriar(tx, { quantidadeParcelas: quantidade })),
      );

      expect(codigo).toBe('23514');
      expect(await contagens()).toEqual({ dividas: 0, movimentacoes: 0 });
    });

    it('aceita 120 parcelas (limite)', async () => {
      const id = await criarComo(FINANCEIRO, { quantidadeParcelas: 120 });

      expect(await parcelasDa(id)).toHaveLength(120);
    });

    it.each(['0', '-100.00'])('rejeita valor de parcela %s com 23514', async (valor) => {
      const codigo = await codigoDoErro(comoUsuario(db, FINANCEIRO, (tx) => chamarCriar(tx, { valorParcela: valor })));

      expect(codigo).toBe('23514');
    });

    it.each([
      ['acima da soma total', '42000.01'],
      ['zero', '0'],
      ['negativa', '-1.00'],
    ])('rejeita quitação antecipada %s com 23514', async (_caso, quitacao) => {
      // 12 × 3.500,00 = 42.000,00
      const codigo = await codigoDoErro(
        comoUsuario(db, FINANCEIRO, (tx) => chamarCriar(tx, { valorQuitacaoAntecipada: quitacao })),
      );

      expect(codigo).toBe('23514');
    });

    it('aceita quitação antecipada igual à soma total', async () => {
      const id = await criarComo(FINANCEIRO, { valorQuitacaoAntecipada: '42000.00' });

      expect(await parcelasDa(id)).toHaveLength(12);
    });

    it('rejeita categoria de entrada, inativa ou inexistente com 22023', async () => {
      for (const categoriaId of [categoriaEntrada, categoriaSaidaInativa, '00000000-0000-0000-0000-0000000000ff']) {
        const codigo = await codigoDoErro(comoUsuario(db, FINANCEIRO, (tx) => chamarCriar(tx, { categoriaId })));
        expect(codigo).toBe('22023');
      }
      expect(await contagens()).toEqual({ dividas: 0, movimentacoes: 0 });
    });

    it('rejeita forma de pagamento inativa ou inexistente com 22023', async () => {
      for (const formaPagamentoId of [formaInativa, '00000000-0000-0000-0000-0000000000fe']) {
        const codigo = await codigoDoErro(comoUsuario(db, FINANCEIRO, (tx) => chamarCriar(tx, { formaPagamentoId })));
        expect(codigo).toBe('22023');
      }
      expect(await contagens()).toEqual({ dividas: 0, movimentacoes: 0 });
    });
  });

  describe('DIV-05: excluir dívida preservando pagas', () => {
    async function pagarParcelas(dividaId: string, quantidade: number): Promise<void> {
      await db.query(
        `update movimentacao set status_pagamento = 'Pago', data_pagamento = data_vencimento
         where id in (
           select id from movimentacao where divida_id = $1 order by data_vencimento limit $2
         )`,
        [dividaId, quantidade],
      );
    }

    function chamarExcluir(tx: Transaction, id: string) {
      return tx.query<{ resultado: { parcelasRemovidas: number; parcelasPreservadas: number } }>(
        'select excluir_divida(id => $1) as resultado',
        [id],
      );
    }

    it('remove as 9 pendentes, preserva as 3 pagas ligadas à dívida e devolve as contagens', async () => {
      const id = await criarComo(FINANCEIRO);
      await pagarParcelas(id, 3);

      const resposta = await comoUsuario(db, FINANCEIRO, (tx) => chamarExcluir(tx, id));

      expect(resposta.rows[0]!.resultado).toEqual({ parcelasRemovidas: 9, parcelasPreservadas: 3 });
      const restantes = await parcelasDa(id);
      expect(restantes).toHaveLength(3);
      expect(restantes.every((p) => p.status_pagamento === 'Pago')).toBe(true);
      expect(restantes.map((p) => p.data_vencimento)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
    });

    it('marca a dívida como inativa e mantém a linha', async () => {
      const id = await criarComo(ADMIN);

      await comoUsuario(db, ADMIN, (tx) => chamarExcluir(tx, id));

      const divida = await db.query<{ ativa: boolean }>('select ativa from divida where id = $1', [id]);
      expect(divida.rows).toEqual([{ ativa: false }]);
    });

    it('não mexe nas parcelas de outra dívida', async () => {
      const alvo = await criarComo(FINANCEIRO, { quantidadeParcelas: 2 });
      const outra = await criarComo(FINANCEIRO, { quantidadeParcelas: 5 });

      await comoUsuario(db, FINANCEIRO, (tx) => chamarExcluir(tx, alvo));

      expect(await parcelasDa(outra)).toHaveLength(5);
    });

    it('dívida inexistente ou já excluída recebe P0002', async () => {
      const id = await criarComo(FINANCEIRO);
      await comoUsuario(db, FINANCEIRO, (tx) => chamarExcluir(tx, id));

      const jaExcluida = await codigoDoErro(comoUsuario(db, FINANCEIRO, (tx) => chamarExcluir(tx, id)));
      const inexistente = await codigoDoErro(
        comoUsuario(db, FINANCEIRO, (tx) => chamarExcluir(tx, '00000000-0000-0000-0000-0000000000fd')),
      );

      expect(jaExcluida).toBe('P0002');
      expect(inexistente).toBe('P0002');
    });
  });

  describe('DIV-06: acesso restrito', () => {
    it.each([
      ['Motorista', '36000000-0000-0000-0000-000000000011'],
      ['Gestor de Frota', '36000000-0000-0000-0000-000000000012'],
    ] as [PerfilNome, string][])('%s recebe 42501 em criar_divida e excluir_divida', async (perfil, usuarioId) => {
      const dividaId = await criarComo(FINANCEIRO);

      const criar = await codigoDoErro(comoUsuario(db, { id: usuarioId, perfil }, (tx) => chamarCriar(tx)));
      const excluir = await codigoDoErro(
        comoUsuario(db, { id: usuarioId, perfil }, (tx) => tx.query('select excluir_divida(id => $1)', [dividaId])),
      );

      expect(criar).toBe('42501');
      expect(excluir).toBe('42501');
      expect(await parcelasDa(dividaId)).toHaveLength(12);
    });

    it.each([
      ['AguardandoAprovacao', '36000000-0000-0000-0000-000000000021'],
      ['Bloqueado', '36000000-0000-0000-0000-000000000022'],
    ] as const)('Financeiro com status %s recebe 42501', async (status, usuarioId) => {
      const codigo = await codigoDoErro(
        comoUsuario(db, { id: usuarioId, perfil: 'Financeiro', status }, (tx) => chamarCriar(tx)),
      );

      expect(codigo).toBe('42501');
    });

    it('anon recebe 42501 nas duas RPCs', async () => {
      const criar = await codigoDoErro(comoAnonimo(db, (tx) => chamarCriar(tx)));
      const excluir = await codigoDoErro(
        comoAnonimo(db, (tx) => tx.query('select excluir_divida(id => $1)', ['00000000-0000-0000-0000-0000000000fd'])),
      );

      expect(criar).toBe('42501');
      expect(excluir).toBe('42501');
    });

    it('Admin não grava nem apaga divida direto pela tabela, só pelas RPCs', async () => {
      const id = await criarComo(ADMIN);

      const insert = await codigoDoErro(
        comoUsuario(db, ADMIN, (tx) =>
          tx.query(
            `insert into divida (categoria_id, descricao, quantidade_parcelas, valor_parcela, data_vencimento_primeira)
             values ($1, 'Sem parcelas', 2, 100, current_date)`,
            [categoriaFinanciamento],
          ),
        ),
      );
      const update = await comoUsuario(db, ADMIN, (tx) =>
        tx.query(`update divida set quantidade_parcelas = 2 where id = $1 returning id`, [id]),
      );
      const remocao = await comoUsuario(db, ADMIN, (tx) => tx.query(`delete from divida where id = $1 returning id`, [id]));

      expect(insert).toBe('42501');
      expect(update.rows).toHaveLength(0);
      expect(remocao.rows).toHaveLength(0);
      const divida = await db.query<{ quantidade_parcelas: number }>(
        'select quantidade_parcelas from divida where id = $1',
        [id],
      );
      expect(divida.rows).toEqual([{ quantidade_parcelas: 12 }]);
    });

    it('Admin e Financeiro continuam lendo divida', async () => {
      const id = await criarComo(FINANCEIRO);

      for (const usuario of [ADMIN, FINANCEIRO]) {
        const linhas = await comoUsuario(db, usuario, (tx) => tx.query<{ id: string }>('select id from divida'));
        expect(linhas.rows.map((linha) => linha.id)).toEqual([id]);
      }
    });
  });
});
