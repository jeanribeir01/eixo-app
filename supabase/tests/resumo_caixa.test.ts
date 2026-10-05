/** @jest-environment node */
// Testes da migration 20261005000100_resumo_caixa.sql — spec EIX-35 (SALDO-01 a SALDO-07).
// Cada teste limpa `movimentacao` e monta só os dados do cenário: a RPC soma a tabela inteira.

import { criarBanco, comoAnonimo, comoSuperuser, comoUsuario, type Banco, type PerfilNome } from './helpers/db';

const FINANCEIRO = { id: '35000000-0000-0000-0000-000000000001', perfil: 'Financeiro' as const };
const ADMIN = { id: '35000000-0000-0000-0000-000000000002', perfil: 'Admin' as const };

type Resumo = {
  quantidadeMovimentacoes: number;
  saldoAtualCentavos: number;
  projecao: {
    mes: string;
    entradasPendentesCentavos: number;
    saidasPendentesCentavos: number;
    saldoProjetadoCentavos: number;
  }[];
  semVencimento: { quantidade: number; entradasCentavos: number; saidasCentavos: number };
};

type Lancamento = {
  tipo: 'Entrada' | 'Saida';
  // Em reais, como a coluna `numeric(12,2)` guarda.
  valor: string;
  status: 'Pago' | 'Pendente';
  vencimento?: string | null;
  categoriaInativa?: boolean;
};

async function codigoDoErro(promessa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promessa;
    return undefined;
  } catch (erro) {
    return (erro as { code?: string }).code;
  }
}

describe('migration resumo_caixa', () => {
  let db: Banco;
  let categoriaEntrada: string;
  let categoriaSaida: string;
  let categoriaInativa: string;
  let formaPagamento: string;

  beforeAll(async () => {
    db = await criarBanco();

    const entrada = await db.query<{ id: string }>(`select id from categoria where titulo = 'Frete' and tipo = 'Entrada'`);
    categoriaEntrada = entrada.rows[0]!.id;
    const saida = await db.query<{ id: string }>(`select id from categoria where titulo = 'Combustível' and tipo = 'Saida'`);
    categoriaSaida = saida.rows[0]!.id;
    const inativa = await db.query<{ id: string }>(
      `insert into categoria (titulo, tipo, ativa) values ('Entrada desativada', 'Entrada', false) returning id`,
    );
    categoriaInativa = inativa.rows[0]!.id;
    const forma = await db.query<{ id: string }>(`select id from forma_pagamento where nome = 'Pix'`);
    formaPagamento = forma.rows[0]!.id;
  });

  beforeEach(async () => {
    await db.query('delete from movimentacao');
  });

  afterAll(async () => {
    await db.close();
  });

  async function lancar(...lancamentos: Lancamento[]): Promise<void> {
    await comoSuperuser(db, async (tx) => {
      for (const l of lancamentos) {
        const categoria = l.categoriaInativa ? categoriaInativa : l.tipo === 'Entrada' ? categoriaEntrada : categoriaSaida;
        await tx.query(
          `insert into movimentacao
             (categoria_id, forma_pagamento_id, valor, descricao, status_pagamento, data_vencimento, data_pagamento)
           values ($1, $2, $3::numeric, 'Teste', $4::status_pagamento, $5::date,
                   case when $4 = 'Pago' then date '2026-10-01' end)`,
          [categoria, formaPagamento, l.valor, l.status, l.vencimento ?? null],
        );
      }
    });
  }

  async function resumo(
    referencia: string | null = '2026-10-15',
    usuario: { id: string; perfil: PerfilNome } = FINANCEIRO,
  ): Promise<Resumo> {
    return comoUsuario(db, usuario, async (tx) => {
      const linha = await tx.query<{ r: Resumo }>('select resumo_caixa($1::date) as r', [referencia]);
      return linha.rows[0]!.r;
    });
  }

  describe('SALDO-01: saldo atual soma só o que está Pago', () => {
    it('entradas pagas menos saídas pagas, em centavos, ignorando pendentes', async () => {
      await lancar(
        { tipo: 'Entrada', valor: '1000.50', status: 'Pago' },
        { tipo: 'Saida', valor: '200.25', status: 'Pago' },
        { tipo: 'Entrada', valor: '999.00', status: 'Pendente', vencimento: '2026-10-20' },
        { tipo: 'Saida', valor: '50.00', status: 'Pendente' },
      );

      expect((await resumo()).saldoAtualCentavos).toBe(80025);
    });

    it('categoria desativada continua contando no saldo', async () => {
      await lancar(
        { tipo: 'Entrada', valor: '300.00', status: 'Pago', categoriaInativa: true },
        { tipo: 'Saida', valor: '100.00', status: 'Pago' },
      );

      expect((await resumo()).saldoAtualCentavos).toBe(20000);
    });

    it('Admin também obtém o resumo', async () => {
      await lancar({ tipo: 'Entrada', valor: '10.00', status: 'Pago' });

      expect((await resumo('2026-10-15', ADMIN)).saldoAtualCentavos).toBe(1000);
    });
  });

  describe('SALDO-02: base vazia e contagem', () => {
    it('sem movimentações, devolve tudo zerado', async () => {
      expect(await resumo()).toEqual({
        quantidadeMovimentacoes: 0,
        saldoAtualCentavos: 0,
        projecao: [],
        semVencimento: { quantidade: 0, entradasCentavos: 0, saidasCentavos: 0 },
      });
    });

    it('quantidadeMovimentacoes conta pagas e pendentes, com e sem vencimento', async () => {
      await lancar(
        { tipo: 'Entrada', valor: '10.00', status: 'Pago' },
        { tipo: 'Saida', valor: '10.00', status: 'Pago' },
        { tipo: 'Saida', valor: '10.00', status: 'Pendente', vencimento: '2026-11-05' },
        { tipo: 'Entrada', valor: '10.00', status: 'Pendente' },
      );

      expect((await resumo()).quantidadeMovimentacoes).toBe(4);
    });
  });

  describe('SALDO-03 e SALDO-07: projeção mensal acumulada', () => {
    it('um item por mês com pendência, em ordem, com saldo acumulado a partir do saldo atual', async () => {
      await lancar(
        { tipo: 'Entrada', valor: '1000.00', status: 'Pago' },
        { tipo: 'Entrada', valor: '500.00', status: 'Pendente', vencimento: '2026-10-20' },
        { tipo: 'Saida', valor: '200.00', status: 'Pendente', vencimento: '2026-10-25' },
        { tipo: 'Entrada', valor: '100.00', status: 'Pendente', vencimento: '2027-01-10' },
        { tipo: 'Saida', valor: '2000.00', status: 'Pendente', vencimento: '2026-11-30' },
        { tipo: 'Entrada', valor: '300.00', status: 'Pendente', vencimento: '2026-12-01' },
      );

      expect((await resumo()).projecao).toEqual([
        { mes: '2026-10', entradasPendentesCentavos: 50000, saidasPendentesCentavos: 20000, saldoProjetadoCentavos: 130000 },
        // Mês negativo vem negativo: é o que dispara o alerta da EIX-51.
        { mes: '2026-11', entradasPendentesCentavos: 0, saidasPendentesCentavos: 200000, saldoProjetadoCentavos: -70000 },
        { mes: '2026-12', entradasPendentesCentavos: 30000, saidasPendentesCentavos: 0, saldoProjetadoCentavos: -40000 },
        // Virada de ano: 2027-01 depois de 2026-12.
        { mes: '2027-01', entradasPendentesCentavos: 10000, saidasPendentesCentavos: 0, saldoProjetadoCentavos: -30000 },
      ]);
    });

    it('Pago com vencimento não entra na projeção', async () => {
      await lancar({ tipo: 'Saida', valor: '80.00', status: 'Pago', vencimento: '2026-11-10' });

      expect((await resumo()).projecao).toEqual([]);
    });
  });

  describe('SALDO-04: atrasadas e mês de referência', () => {
    it('pendência vencida em meses anteriores soma no mês de referência', async () => {
      await lancar(
        { tipo: 'Saida', valor: '100.00', status: 'Pendente', vencimento: '2026-08-10' },
        { tipo: 'Entrada', valor: '50.00', status: 'Pendente', vencimento: '2026-09-30' },
        { tipo: 'Entrada', valor: '10.00', status: 'Pendente', vencimento: '2026-10-01' },
        { tipo: 'Saida', valor: '5.00', status: 'Pendente', vencimento: '2026-11-01' },
      );

      expect((await resumo('2026-10-15')).projecao).toEqual([
        { mes: '2026-10', entradasPendentesCentavos: 6000, saidasPendentesCentavos: 10000, saldoProjetadoCentavos: -4000 },
        { mes: '2026-11', entradasPendentesCentavos: 0, saidasPendentesCentavos: 500, saldoProjetadoCentavos: -4500 },
      ]);
    });

    it('só atrasadas: um único item, no mês de referência', async () => {
      await lancar(
        { tipo: 'Saida', valor: '40.00', status: 'Pendente', vencimento: '2026-07-01' },
        { tipo: 'Saida', valor: '60.00', status: 'Pendente', vencimento: '2026-09-15' },
      );

      expect((await resumo('2026-10-15')).projecao).toEqual([
        { mes: '2026-10', entradasPendentesCentavos: 0, saidasPendentesCentavos: 10000, saldoProjetadoCentavos: -10000 },
      ]);
    });

    it('sem referência, o mês atual é o de hoje no fuso de Brasília', async () => {
      const hoje = await db.query<{ mes: string; vencida: string }>(
        `select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') as mes,
                to_char((now() at time zone 'America/Sao_Paulo')::date - 400, 'YYYY-MM-DD') as vencida`,
      );
      const { mes, vencida } = hoje.rows[0]!;
      await lancar({ tipo: 'Saida', valor: '1.00', status: 'Pendente', vencimento: vencida });

      expect((await resumo(null)).projecao.map((item) => item.mes)).toEqual([mes]);
    });
  });

  describe('SALDO-05: pendentes sem vencimento', () => {
    it('ficam fora da projeção e somam em semVencimento por tipo', async () => {
      await lancar(
        { tipo: 'Entrada', valor: '10.00', status: 'Pendente' },
        { tipo: 'Saida', valor: '20.50', status: 'Pendente' },
        // Pago sem vencimento não é pendência.
        { tipo: 'Saida', valor: '999.00', status: 'Pago' },
      );

      const r = await resumo();
      expect(r.projecao).toEqual([]);
      expect(r.semVencimento).toEqual({ quantidade: 2, entradasCentavos: 1000, saidasCentavos: 2050 });
    });
  });

  describe('SALDO-06: acesso restrito', () => {
    it.each([
      ['Motorista', '35000000-0000-0000-0001-000000000001'],
      ['Gestor de Frota', '35000000-0000-0000-0001-000000000002'],
    ] as [PerfilNome, string][])('%s recebe 42501', async (perfil, id) => {
      const codigo = await codigoDoErro(
        comoUsuario(db, { id, perfil }, (tx) => tx.query(`select resumo_caixa('2026-10-15')`)),
      );

      expect(codigo).toBe('42501');
    });

    it.each([
      ['AguardandoAprovacao', '35000000-0000-0000-0002-000000000001'],
      ['Bloqueado', '35000000-0000-0000-0002-000000000002'],
    ] as const)('Financeiro com status %s recebe 42501', async (status, id) => {
      const codigo = await codigoDoErro(
        comoUsuario(db, { id, perfil: 'Financeiro', status }, (tx) => tx.query(`select resumo_caixa('2026-10-15')`)),
      );

      expect(codigo).toBe('42501');
    });

    it('anon recebe 42501', async () => {
      const codigo = await codigoDoErro(comoAnonimo(db, (tx) => tx.query(`select resumo_caixa('2026-10-15')`)));

      expect(codigo).toBe('42501');
    });

    it('roda como security invoker, para o RLS valer nas linhas lidas', async () => {
      const funcao = await db.query<{ prosecdef: boolean }>(`select prosecdef from pg_proc where proname = 'resumo_caixa'`);

      expect(funcao.rows).toEqual([{ prosecdef: false }]);
    });
  });

  describe('SALDO-07: centavos exatos', () => {
    it('0,01 + 0,02 dá exatamente 3 centavos inteiros', async () => {
      await lancar(
        { tipo: 'Entrada', valor: '0.01', status: 'Pago' },
        { tipo: 'Entrada', valor: '0.02', status: 'Pago' },
        { tipo: 'Entrada', valor: '0.10', status: 'Pendente', vencimento: '2026-10-20' },
        { tipo: 'Entrada', valor: '0.20', status: 'Pendente', vencimento: '2026-10-21' },
      );

      const r = await resumo();
      expect(r.saldoAtualCentavos).toBe(3);
      expect(r.projecao[0]!.entradasPendentesCentavos).toBe(30);
      expect(r.projecao[0]!.saldoProjetadoCentavos).toBe(33);
    });
  });
});
