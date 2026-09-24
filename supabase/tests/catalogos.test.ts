/** @jest-environment node */
// Testes da migration 20260924000200_catalogos.sql — spec.md:
// P1 Dados padrão AC2 (categorias), AC3 (formas de pagamento), AC4 (seed idempotente).

import { criarBanco, type Banco } from './helpers/db';

describe('migration de catálogos: categoria e forma_pagamento', () => {
  let db: Banco;

  beforeAll(async () => {
    db = await criarBanco();
  });

  afterAll(async () => {
    await db.close();
  });

  it('insere as 6 categorias padrão, todas ativas, com Frete como única Entrada', async () => {
    const resultado = await db.query<{ titulo: string; tipo: string; ativa: boolean }>(
      'select titulo, tipo, ativa from categoria',
    );

    expect(resultado.rows).toHaveLength(6);
    expect(resultado.rows.every((linha) => linha.ativa)).toBe(true);

    const saida = resultado.rows.filter((linha) => linha.tipo === 'Saida').map((linha) => linha.titulo);
    const entrada = resultado.rows.filter((linha) => linha.tipo === 'Entrada').map((linha) => linha.titulo);

    expect(saida.sort()).toEqual(
      ['Combustível', 'Pedágio', 'Manutenção', 'Salário', 'Financiamento'].sort(),
    );
    expect(entrada).toEqual(['Frete']);
  });

  it('insere as 4 formas de pagamento padrão, todas ativas', async () => {
    const resultado = await db.query<{ nome: string; ativa: boolean }>(
      'select nome, ativa from forma_pagamento',
    );

    expect(resultado.rows).toHaveLength(4);
    expect(resultado.rows.every((linha) => linha.ativa)).toBe(true);
    expect(resultado.rows.map((linha) => linha.nome).sort()).toEqual(
      ['Boleto', 'Pix', 'TED', 'Cartão Corporativo'].sort(),
    );
  });

  it('reaplicar o seed de categoria e forma_pagamento mantém um único registro por nome', async () => {
    await db.query(
      `insert into categoria (titulo, tipo) values
         ('Combustível', 'Saida'), ('Pedágio', 'Saida'), ('Manutenção', 'Saida'),
         ('Salário', 'Saida'), ('Financiamento', 'Saida'), ('Frete', 'Entrada')
       on conflict (titulo, tipo) do nothing`,
    );
    await db.query(
      `insert into forma_pagamento (nome) values
         ('Boleto'), ('Pix'), ('TED'), ('Cartão Corporativo')
       on conflict (nome) do nothing`,
    );

    const categorias = await db.query<{ total: string }>('select count(*)::text as total from categoria');
    const formas = await db.query<{ total: string }>('select count(*)::text as total from forma_pagamento');

    expect(categorias.rows[0]?.total).toBe('6');
    expect(formas.rows[0]?.total).toBe('4');
  });
});
