/** @jest-environment node */
// Testes da migration 20261122000100_graficos_caixa.sql — EIX-45 (US12), gráficos da aba Dashboards.
// Cada teste limpa as movimentações e monta só os dados do cenário: as RPCs somam a tabela inteira.

import { criarBanco, comoAnonimo, comoSuperuser, comoUsuario, type Banco, type PerfilNome } from './helpers/db';

const FINANCEIRO = { id: '45000000-0000-0000-0000-000000000001', perfil: 'Financeiro' as const };
const ADMIN = { id: '45000000-0000-0000-0000-000000000002', perfil: 'Admin' as const };
const GESTOR = { id: '45000000-0000-0000-0000-000000000003', perfil: 'Gestor de Frota' as const };
const MOTORISTA = { id: '45000000-0000-0000-0000-000000000004', perfil: 'Motorista' as const };

type Usuario = { id: string; perfil: PerfilNome };

type LinhaFluxo = { mes: string; entradas_centavos: number; saidas_centavos: number };
type Fatia = { categoria_id: string | null; titulo: string; total_centavos: number; percentual: number };

type Lancamento = {
  // Título de uma categoria já existente (as do seed da migration de catálogos ou as criadas abaixo).
  categoria: string;
  // Em reais, como a coluna `numeric(12,2)` guarda.
  valor: string;
  status: 'Pago' | 'Pendente';
  pagamento: string | null;
};

async function codigoDoErro(promessa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promessa;
    return undefined;
  } catch (erro) {
    return (erro as { code?: string }).code;
  }
}

describe('migration graficos_caixa', () => {
  let db: Banco;
  let formaPagamento: string;

  beforeAll(async () => {
    db = await criarBanco();

    const forma = await db.query<{ id: string }>(`select id from forma_pagamento where nome = 'Pix'`);
    formaPagamento = forma.rows[0]!.id;

    // O seed tem 5 categorias de Saída; estas completam 7 para testar a fatia "Outras". "Seguro" é
    // inativa: o lançamento histórico continua valendo.
    await db.query(`insert into categoria (titulo, tipo) values ('Aluguel', 'Saida'), ('Seguro', 'Saida')`);
    await db.query(`update categoria set ativa = false where titulo = 'Seguro'`);
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
        await tx.query(
          `insert into movimentacao
             (categoria_id, forma_pagamento_id, valor, descricao, status_pagamento, data_vencimento, data_pagamento)
           values ((select id from categoria where titulo = $1), $2, $3::numeric, 'Teste', $4::status_pagamento,
                   $5::date, $5::date)`,
          [l.categoria, formaPagamento, l.valor, l.status, l.pagamento],
        );
      }
    });
  }

  async function fluxo(mesFinal: string | null, meses: number | null, usuario: Usuario = FINANCEIRO) {
    return comoUsuario(db, usuario, async (tx) => {
      const resultado = await tx.query<LinhaFluxo>(
        `select mes, entradas_centavos::float8 as entradas_centavos, saidas_centavos::float8 as saidas_centavos
           from fluxo_caixa_mensal($1::date, $2::int)`,
        [mesFinal, meses],
      );
      return resultado.rows;
    });
  }

  async function despesas(
    dataInicial: string | null = '2026-10-01',
    dataFinal: string | null = '2026-10-31',
    usuario: Usuario = FINANCEIRO,
  ) {
    return comoUsuario(db, usuario, async (tx) => {
      const resultado = await tx.query<Fatia>(
        `select categoria_id, titulo, total_centavos::float8 as total_centavos, percentual::float8 as percentual
           from despesas_por_categoria($1::date, $2::date)`,
        [dataInicial, dataFinal],
      );
      return resultado.rows;
    });
  }

  describe('fluxo_caixa_mensal', () => {
    it('devolve exatamente N meses terminando no mês final, do mais antigo ao mais recente', async () => {
      // Qualquer dia do mês final vale pelo mês inteiro.
      const linhas = await fluxo('2026-11-17', 3);

      expect(linhas.map((l) => l.mes)).toEqual(['2026-09', '2026-10', '2026-11']);
    });

    it.each([
      [6, '2026-06'],
      [12, '2025-12'],
      [24, '2024-12'],
    ])('com %i meses começa em %s', async (meses, primeiro) => {
      const linhas = await fluxo('2026-11-30', meses);

      expect(linhas).toHaveLength(meses);
      expect(linhas[0]!.mes).toBe(primeiro);
      expect(linhas[linhas.length - 1]!.mes).toBe('2026-11');
    });

    it('soma só o que foi pago, no mês da data de pagamento, em centavos', async () => {
      await lancar(
        { categoria: 'Frete', valor: '1000.50', status: 'Pago', pagamento: '2026-10-01' },
        { categoria: 'Frete', valor: '1.13', status: 'Pago', pagamento: '2026-10-31' },
        { categoria: 'Combustível', valor: '200.25', status: 'Pago', pagamento: '2026-10-15' },
        { categoria: 'Pedágio', valor: '1.13', status: 'Pago', pagamento: '2026-11-02' },
        // Pendente nunca entra, nem com data de pagamento agendada.
        { categoria: 'Frete', valor: '999.00', status: 'Pendente', pagamento: '2026-10-20' },
        { categoria: 'Combustível', valor: '50.00', status: 'Pendente', pagamento: null },
        // Antes do horizonte (de setembro a novembro): não entra.
        { categoria: 'Frete', valor: '10.00', status: 'Pago', pagamento: '2026-08-31' },
      );

      expect(await fluxo('2026-11-01', 3)).toEqual([
        { mes: '2026-09', entradas_centavos: 0, saidas_centavos: 0 },
        { mes: '2026-10', entradas_centavos: 100163, saidas_centavos: 20025 },
        { mes: '2026-11', entradas_centavos: 0, saidas_centavos: 113 },
      ]);
    });

    it('não soma pagamento depois do mês final', async () => {
      await lancar({ categoria: 'Frete', valor: '10.00', status: 'Pago', pagamento: '2026-12-01' });

      const linhas = await fluxo('2026-11-15', 3);

      expect(linhas.every((l) => l.entradas_centavos === 0 && l.saidas_centavos === 0)).toBe(true);
    });

    it('máximo vai do mês do primeiro pagamento até o mês final', async () => {
      await lancar(
        { categoria: 'Frete', valor: '10.00', status: 'Pago', pagamento: '2026-07-20' },
        { categoria: 'Combustível', valor: '5.00', status: 'Pago', pagamento: '2026-09-03' },
        // Pendente antigo não puxa o início para trás.
        { categoria: 'Frete', valor: '1.00', status: 'Pendente', pagamento: '2025-01-10' },
        // Pago depois do mês final não estende o fim.
        { categoria: 'Frete', valor: '1.00', status: 'Pago', pagamento: '2026-11-05' },
      );

      expect(await fluxo('2026-10-10', null)).toEqual([
        { mes: '2026-07', entradas_centavos: 1000, saidas_centavos: 0 },
        { mes: '2026-08', entradas_centavos: 0, saidas_centavos: 0 },
        { mes: '2026-09', entradas_centavos: 0, saidas_centavos: 500 },
        { mes: '2026-10', entradas_centavos: 0, saidas_centavos: 0 },
      ]);
    });

    it('máximo sem pagamento até o mês final não devolve linhas', async () => {
      await lancar({ categoria: 'Frete', valor: '10.00', status: 'Pago', pagamento: '2026-12-01' });

      expect(await fluxo('2026-11-30', null)).toEqual([]);
    });

    it.each([
      [null, 6],
      ['2026-11-01', 0],
      ['2026-11-01', 1],
      ['2026-11-01', 7],
      ['2026-11-01', 36],
    ])('mês final %s com %s meses recebe 22023', async (mesFinal, meses) => {
      expect(await codigoDoErro(fluxo(mesFinal, meses))).toBe('22023');
    });

    it('Admin também lê', async () => {
      await lancar({ categoria: 'Frete', valor: '3.00', status: 'Pago', pagamento: '2026-11-01' });

      const linhas = await fluxo('2026-11-01', 3, ADMIN);

      expect(linhas[2]).toEqual({ mes: '2026-11', entradas_centavos: 300, saidas_centavos: 0 });
    });

    it.each([GESTOR, MOTORISTA])('$perfil recebe 42501', async (usuario) => {
      expect(await codigoDoErro(fluxo('2026-11-01', 6, usuario))).toBe('42501');
    });
  });

  describe('despesas_por_categoria', () => {
    it('divide as Saídas pagas do período por categoria, com percentual de 1 casa', async () => {
      await lancar(
        { categoria: 'Combustível', valor: '600.00', status: 'Pago', pagamento: '2026-10-01' },
        { categoria: 'Combustível', valor: '1.13', status: 'Pago', pagamento: '2026-10-31' },
        { categoria: 'Pedágio', valor: '398.87', status: 'Pago', pagamento: '2026-10-15' },
        // Entrada não é despesa.
        { categoria: 'Frete', valor: '5000.00', status: 'Pago', pagamento: '2026-10-10' },
        // Pendente (mesmo agendado) e pago fora do período não entram.
        { categoria: 'Pedágio', valor: '700.00', status: 'Pendente', pagamento: '2026-10-20' },
        { categoria: 'Pedágio', valor: '700.00', status: 'Pago', pagamento: '2026-11-01' },
        { categoria: 'Pedágio', valor: '700.00', status: 'Pago', pagamento: '2026-09-30' },
      );

      const fatias = await despesas();

      expect(fatias.map(({ titulo, total_centavos, percentual }) => ({ titulo, total_centavos, percentual }))).toEqual([
        { titulo: 'Combustível', total_centavos: 60113, percentual: 60.1 },
        { titulo: 'Pedágio', total_centavos: 39887, percentual: 39.9 },
      ]);
      expect(fatias.every((f) => f.categoria_id !== null)).toBe(true);
    });

    it('mostra 5 categorias e soma as demais em "Outras", no fim', async () => {
      await lancar(
        { categoria: 'Combustível', valor: '10.00', status: 'Pago', pagamento: '2026-10-05' },
        { categoria: 'Pedágio', valor: '60.00', status: 'Pago', pagamento: '2026-10-05' },
        { categoria: 'Manutenção', valor: '50.00', status: 'Pago', pagamento: '2026-10-05' },
        // Empate de 40,00: título em ordem alfabética (Aluguel antes de Salário).
        { categoria: 'Salário', valor: '40.00', status: 'Pago', pagamento: '2026-10-05' },
        { categoria: 'Aluguel', valor: '40.00', status: 'Pago', pagamento: '2026-10-05' },
        { categoria: 'Financiamento', valor: '30.00', status: 'Pago', pagamento: '2026-10-05' },
        // Inativa: entra com o próprio título. Maior que as 4 últimas, prova que "Outras" fica no fim.
        { categoria: 'Seguro', valor: '70.00', status: 'Pago', pagamento: '2026-10-05' },
      );

      const fatias = await despesas();

      expect(fatias.map((f) => [f.titulo, f.total_centavos])).toEqual([
        ['Seguro', 7000],
        ['Pedágio', 6000],
        ['Manutenção', 5000],
        ['Aluguel', 4000],
        ['Salário', 4000],
        ['Outras', 4000],
      ]);
      expect(fatias[5]!.categoria_id).toBeNull();
      expect(fatias.map((f) => f.percentual)).toEqual([23.3, 20, 16.7, 13.3, 13.3, 13.3]);
    });

    it('com até 5 categorias não cria "Outras"', async () => {
      await lancar(
        { categoria: 'Combustível', valor: '10.00', status: 'Pago', pagamento: '2026-10-05' },
        { categoria: 'Pedágio', valor: '10.00', status: 'Pago', pagamento: '2026-10-05' },
        { categoria: 'Manutenção', valor: '10.00', status: 'Pago', pagamento: '2026-10-05' },
        { categoria: 'Salário', valor: '10.00', status: 'Pago', pagamento: '2026-10-05' },
        { categoria: 'Aluguel', valor: '10.00', status: 'Pago', pagamento: '2026-10-05' },
      );

      const fatias = await despesas();

      expect(fatias.map((f) => f.titulo)).not.toContain('Outras');
      expect(fatias).toHaveLength(5);
    });

    it('uma categoria só vale 100%', async () => {
      await lancar({ categoria: 'Combustível', valor: '12.34', status: 'Pago', pagamento: '2026-10-05' });

      expect((await despesas()).map((f) => f.percentual)).toEqual([100]);
    });

    it('período sem Saída paga não devolve linhas', async () => {
      await lancar(
        { categoria: 'Frete', valor: '10.00', status: 'Pago', pagamento: '2026-10-05' },
        { categoria: 'Combustível', valor: '10.00', status: 'Pendente', pagamento: null },
      );

      expect(await despesas()).toEqual([]);
    });

    it.each([
      [null, '2026-10-31'],
      ['2026-10-01', null],
      ['2026-10-31', '2026-10-01'],
      // 367 dias: um a mais que o teto.
      ['2026-01-01', '2027-01-02'],
    ])('período %s a %s recebe 22023', async (inicial, final) => {
      expect(await codigoDoErro(despesas(inicial, final))).toBe('22023');
    });

    it('aceita o período de 366 dias', async () => {
      expect(await despesas('2028-01-01', '2028-12-31')).toEqual([]);
    });

    it('Admin também lê', async () => {
      await lancar({ categoria: 'Pedágio', valor: '5.00', status: 'Pago', pagamento: '2026-10-05' });

      expect((await despesas('2026-10-01', '2026-10-31', ADMIN)).map((f) => f.total_centavos)).toEqual([500]);
    });

    it.each([GESTOR, MOTORISTA])('$perfil recebe 42501', async (usuario) => {
      expect(await codigoDoErro(despesas('2026-10-01', '2026-10-31', usuario))).toBe('42501');
    });
  });

  describe('grants', () => {
    it.each([
      ['fluxo_caixa_mensal(date, int)'],
      ['despesas_por_categoria(date, date)'],
    ])('%s: só authenticated executa', async (assinatura) => {
      const resultado = await db.query<{ anon: boolean; publico: boolean; autenticado: boolean }>(
        `select has_function_privilege('anon', $1, 'execute') as anon,
                has_function_privilege('public', $1, 'execute') as publico,
                has_function_privilege('authenticated', $1, 'execute') as autenticado`,
        [assinatura],
      );

      expect(resultado.rows[0]).toEqual({ anon: false, publico: false, autenticado: true });
    });

    it('anônimo não chama', async () => {
      const erro = await codigoDoErro(
        comoAnonimo(db, (tx) => tx.query(`select * from fluxo_caixa_mensal('2026-10-01'::date, 6)`)),
      );

      expect(erro).toBe('42501');
    });
  });
});
