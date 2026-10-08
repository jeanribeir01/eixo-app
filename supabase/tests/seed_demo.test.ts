/** @jest-environment node */
// Testes dos scripts do ambiente de demonstração (EIX-53): supabase/seed/demo.sql e reset-demo.sql.
// Eles rodam à mão no SQL Editor, na nuvem; aqui rodam no PGlite com todas as migrations, para
// ninguém descobrir um erro de SQL no dia da gravação.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { criarBanco, comoUsuario, type Banco } from './helpers/db';

const DEMO = readFileSync(path.join(__dirname, '..', 'seed', 'demo.sql'), 'utf-8');
const RESET = readFileSync(path.join(__dirname, '..', 'seed', 'reset-demo.sql'), 'utf-8');

const ADMIN = { id: '53000000-0000-0000-0000-000000000001', perfil: 'Admin' as const };

type Resumo = {
  quantidadeMovimentacoes: number;
  saldoAtualCentavos: number;
  projecao: { entradasPendentesCentavos: number; saidasPendentesCentavos: number }[];
};

async function contar(db: Banco, tabela: 'movimentacao' | 'divida' | 'categoria' | 'forma_pagamento') {
  const resultado = await db.query<{ total: number }>(`select count(*)::int as total from ${tabela}`);
  return resultado.rows[0]!.total;
}

// O saldo que o app mostra vem da RPC; ler por ela prova o que aparece na tela do vídeo.
async function resumoComoAdmin(db: Banco): Promise<Resumo> {
  return comoUsuario(db, ADMIN, async (tx) => {
    const linha = await tx.query<{ r: Resumo }>('select resumo_caixa() as r');
    return linha.rows[0]!.r;
  });
}

describe('seed do ambiente de demonstração (EIX-53)', () => {
  let db: Banco;

  beforeEach(async () => {
    db = await criarBanco();
  });

  afterEach(async () => {
    await db.close();
  });

  it('demo.sql cria 16 movimentações e o saldo começa em R$ 8.970,30', async () => {
    await db.exec(DEMO);

    const resumo = await resumoComoAdmin(db);
    expect(resumo.quantidadeMovimentacoes).toBe(16);
    expect(resumo.saldoAtualCentavos).toBe(897030);
  });

  it('demo.sql deixa pendências futuras para a projeção de caixa', async () => {
    await db.exec(DEMO);

    const { projecao } = await resumoComoAdmin(db);
    const entradas = projecao.reduce((soma, mes) => soma + mes.entradasPendentesCentavos, 0);
    const saidas = projecao.reduce((soma, mes) => soma + mes.saidasPendentesCentavos, 0);
    expect(entradas).toBe(1470000);
    expect(saidas).toBe(1030000);
  });

  it('demo.sql: pagas ficam no passado e pendentes no futuro, em qualquer dia que rodar', async () => {
    await db.exec(DEMO);

    const fora = await db.query<{ total: number }>(
      `select count(*)::int as total from movimentacao
       where (status_pagamento = 'Pago' and data_pagamento > (now() at time zone 'America/Sao_Paulo')::date)
          or (status_pagamento = 'Pendente' and data_vencimento <= (now() at time zone 'America/Sao_Paulo')::date)`,
    );
    expect(fora.rows[0]!.total).toBe(0);
  });

  it('demo.sql rodado duas vezes não duplica nada', async () => {
    await db.exec(DEMO);
    await db.exec(DEMO);

    expect(await contar(db, 'movimentacao')).toBe(16);
  });

  it('demo.sql reativa categoria e forma de pagamento padrão desativadas em algum teste', async () => {
    await db.exec(`update categoria set ativa = false where titulo = 'Pedágio'`);
    await db.exec(`update forma_pagamento set ativa = false where nome = 'Pix'`);

    await db.exec(DEMO);

    const categoria = await db.query<{ ativa: boolean }>(`select ativa from categoria where titulo = 'Pedágio'`);
    const forma = await db.query<{ ativa: boolean }>(`select ativa from forma_pagamento where nome = 'Pix'`);
    expect(categoria.rows[0]!.ativa).toBe(true);
    expect(forma.rows[0]!.ativa).toBe(true);
  });

  it('reset-demo.sql apaga todas as movimentações e dívidas, inclusive parcelas, e mantém os catálogos', async () => {
    await db.exec(DEMO);
    // Uma dívida pela RPC do app, como a que o vídeo cria ao vivo: 3 parcelas.
    await comoUsuario(db, ADMIN, (tx) =>
      tx.query(
        `select criar_divida(
           descricao => 'Financiamento do caminhão',
           categoria_id => (select id from categoria where titulo = 'Financiamento'),
           forma_pagamento_id => (select id from forma_pagamento where nome = 'Boleto'),
           quantidade_parcelas => 3,
           valor_parcela => 3500.00,
           data_vencimento_primeira => '2026-11-15'::date,
           valor_quitacao_antecipada => null
         )`,
      ),
    );
    expect(await contar(db, 'movimentacao')).toBe(19);
    const categorias = await contar(db, 'categoria');
    const formas = await contar(db, 'forma_pagamento');

    await db.exec(RESET);

    expect(await contar(db, 'movimentacao')).toBe(0);
    expect(await contar(db, 'divida')).toBe(0);
    expect(await contar(db, 'categoria')).toBe(categorias);
    expect(await contar(db, 'forma_pagamento')).toBe(formas);
  });

  it('reset e demo de novo: o vídeo pode ser regravado', async () => {
    await db.exec(DEMO);
    await db.exec(RESET);
    await db.exec(DEMO);

    const resumo = await resumoComoAdmin(db);
    expect(resumo.quantidadeMovimentacoes).toBe(16);
    expect(resumo.saldoAtualCentavos).toBe(897030);
  });

  it('reset-demo.sql para sem apagar nada se uma manutenção aponta para uma movimentação', async () => {
    await db.exec(DEMO);
    await db.exec(`
      insert into veiculo (placa, marca, modelo, capacidade_carga) values ('ABC1D23', 'Volvo', 'FH 540', 30000);
      insert into manutencao (veiculo_id, descricao, data_manutencao, valor, movimentacao_id)
      values ((select id from veiculo where placa = 'ABC1D23'), 'Troca de pneus', current_date, 3200.00,
              'de000000-0000-4000-8000-000000000009');
    `);

    await expect(db.exec(RESET)).rejects.toThrow('Há manutenções ligadas a movimentações');
    expect(await contar(db, 'movimentacao')).toBe(16);
  });
});
