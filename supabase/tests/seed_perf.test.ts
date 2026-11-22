/** @jest-environment node */
// Teste do seed de medição de performance (EIX-71): supabase/seed/perf-200.sql.
// O script roda à mão no SQL Editor, no banco compartilhado do time; aqui roda no PGlite com todas as
// migrations, para provar que ele cria só o que promete e que o modo 'remover' não apaga nada do time.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { criarBanco, type Banco } from './helpers/db';

const CRIAR = readFileSync(path.join(__dirname, '..', 'seed', 'perf-200.sql'), 'utf-8');
const REMOVER = CRIAR.replace("modo text := 'criar';", "modo text := 'remover';");
const DEMO = readFileSync(path.join(__dirname, '..', 'seed', 'demo.sql'), 'utf-8');

const HOJE_SP = `(now() at time zone 'America/Sao_Paulo')::date`;

async function contarMovimentacoes(db: Banco, where = 'true') {
  const resultado = await db.query<{ total: number }>(`select count(*)::int as total from movimentacao where ${where}`);
  return resultado.rows[0]!.total;
}

describe('seed de medição de performance (EIX-71)', () => {
  let db: Banco;

  // Um banco por arquivo, como nos outros testes: subir o PGlite com todas as migrations é a parte
  // cara, e na suíte inteira ele disputa CPU com os outros arquivos. Já passou dos 5s padrão do
  // Jest numa rodada completa, por isso o limite explícito.
  beforeAll(async () => {
    db = await criarBanco();
  }, 30_000);

  // Cada teste começa sem movimentações. Os seeds só escrevem nessa tabela.
  beforeEach(async () => {
    await db.exec('delete from movimentacao');
  });

  afterAll(async () => {
    await db.close();
  });

  it('o modo de remover existe no arquivo (o teste não está trocando texto que sumiu)', () => {
    expect(REMOVER).not.toBe(CRIAR);
  });

  it('cria 200 movimentações, todas no mês atual, que é o mês que a lista abre', async () => {
    await db.exec(CRIAR);

    expect(await contarMovimentacoes(db)).toBe(200);
    expect(await contarMovimentacoes(db, `date_trunc('month', data_vencimento) = date_trunc('month', ${HOJE_SP})`)).toBe(
      200,
    );
  });

  it('mistura entradas e saídas, para a lista ter os dois sinais', async () => {
    await db.exec(CRIAR);

    const tipos = await db.query<{ tipo: string; total: number }>(
      `select c.tipo::text as tipo, count(*)::int as total
       from movimentacao m join categoria c on c.id = m.categoria_id
       group by c.tipo order by c.tipo`,
    );
    expect(tipos.rows).toEqual([
      { tipo: 'Entrada', total: 50 },
      { tipo: 'Saida', total: 150 },
    ]);
  });

  it('pagas só até hoje e pendentes só depois de hoje, em qualquer dia que rodar', async () => {
    await db.exec(CRIAR);

    const fora = await contarMovimentacoes(
      db,
      `(status_pagamento = 'Pago' and data_pagamento > ${HOJE_SP})
       or (status_pagamento = 'Pendente' and data_vencimento <= ${HOJE_SP})`,
    );
    expect(fora).toBe(0);
  });

  it('rodado duas vezes não duplica nada', async () => {
    await db.exec(CRIAR);
    await db.exec(CRIAR);

    expect(await contarMovimentacoes(db)).toBe(200);
  });

  it("o modo 'remover' apaga só as 200 de teste e mantém os lançamentos do time", async () => {
    await db.exec(DEMO);
    await db.exec(CRIAR);
    expect(await contarMovimentacoes(db)).toBe(216);

    await db.exec(REMOVER);

    expect(await contarMovimentacoes(db)).toBe(16);
    expect(await contarMovimentacoes(db, `descricao like 'Perf %'`)).toBe(0);
  });
});
