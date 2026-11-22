/** @jest-environment node */
// Teste do script de simulação de 3 meses (supabase/seed/simulacao-3-meses.sql). Ele roda à mão no
// SQL Editor, na nuvem; aqui roda no PGlite com todas as migrations, para os triggers de viagem,
// hodômetro, litros e status do veículo barrarem um erro antes de alguém rodar no projeto do time.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { criarBanco, comoUsuario, type Banco } from './helpers/db';

const SIMULACAO = readFileSync(path.join(__dirname, '..', 'seed', 'simulacao-3-meses.sql'), 'utf-8');

const ADMIN = { id: '5e000000-0000-0000-0000-0000000000ad', perfil: 'Admin' as const };

const HOJE = `(now() at time zone 'America/Sao_Paulo')::date`;

async function contar(db: Banco, sql: string): Promise<number> {
  const resultado = await db.query<{ total: number }>(`select count(*)::int as total from ${sql}`);
  return resultado.rows[0]!.total;
}

describe('seed de simulação de 3 meses', () => {
  let db: Banco;

  beforeEach(async () => {
    db = await criarBanco();
  });

  afterEach(async () => {
    await db.close();
  });

  it('apaga os dados operacionais que existiam antes', async () => {
    await db.exec(`
      insert into veiculo (placa, marca, modelo, capacidade_carga) values ('XYZ1A23', 'Ford', 'Cargo', 10);
      insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao)
      values ((select id from categoria where titulo = 'Frete'), (select id from forma_pagamento where nome = 'Pix'),
              100, 'Lançamento de teste do time');
    `);

    await db.exec(SIMULACAO);

    expect(await contar(db, `veiculo where placa = 'XYZ1A23'`)).toBe(0);
    expect(await contar(db, `movimentacao where descricao = 'Lançamento de teste do time'`)).toBe(0);
  });

  it('rodar duas vezes dá o mesmo volume, sem duplicar nada', async () => {
    await db.exec(SIMULACAO);
    const viagens = await contar(db, 'viagem');
    const movimentacoes = await contar(db, 'movimentacao');

    await db.exec(SIMULACAO);

    expect(await contar(db, 'viagem')).toBe(viagens);
    expect(await contar(db, 'movimentacao')).toBe(movimentacoes);
    expect(await contar(db, 'usuario')).toBe(7);
  });

  it('cria volume de 3 meses: viagens, lançamentos em todos os meses e manutenções', async () => {
    await db.exec(SIMULACAO);

    expect(await contar(db, `viagem where status = 'Finalizada'`)).toBeGreaterThan(60);
    expect(await contar(db, `viagem where status = 'Cancelada'`)).toBeGreaterThan(0);
    expect(await contar(db, `manutencao where data_conclusao is not null`)).toBeGreaterThan(5);
    // Lançamentos em pelo menos 4 meses de calendário: os 3 de uso e os futuros pendentes.
    expect(
      await contar(
        db,
        `(select distinct date_trunc('month', coalesce(data_pagamento, data_vencimento)) from movimentacao) meses`,
      ),
    ).toBeGreaterThanOrEqual(4);
  });

  it('frota termina com um veículo em cada situação', async () => {
    await db.exec(SIMULACAO);

    const status = await db.query<{ status: string; total: number }>(
      `select status::text, count(*)::int as total from veiculo group by status order by status`,
    );
    expect(Object.fromEntries(status.rows.map((linha) => [linha.status, linha.total]))).toEqual({
      Disponivel: 3,
      EmManutencao: 1,
      EmViagem: 1,
      Inativo: 1,
    });
    expect(await contar(db, `viagem where status = 'EmAndamento'`)).toBe(1);
    expect(await contar(db, `rota where not ativa`)).toBe(1);
    expect(await contar(db, `categoria where titulo = 'Lavagem' and not ativa`)).toBe(1);
  });

  it('motoristas fictícios: 5 ativos, 1 bloqueado e 1 aguardando aprovação', async () => {
    await db.exec(SIMULACAO);

    const status = await db.query<{ status: string; total: number }>(
      `select u.status::text, count(*)::int as total from usuario u
       join perfil p on p.id = u.perfil_id
       where p.nome = 'Motorista' and u.email like '%@simulacao.local'
       group by u.status`,
    );
    expect(Object.fromEntries(status.rows.map((linha) => [linha.status, linha.total]))).toEqual({
      Ativo: 5,
      Bloqueado: 1,
      AguardandoAprovacao: 1,
    });
  });

  it('nada pago no futuro, e só um frete a receber atrasado', async () => {
    await db.exec(SIMULACAO);

    expect(await contar(db, `movimentacao where status_pagamento = 'Pago' and data_pagamento > ${HOJE}`)).toBe(0);
    expect(
      await contar(
        db,
        `movimentacao m join categoria c on c.id = m.categoria_id
         where c.titulo = 'Frete' and m.status_pagamento = 'Pendente' and m.data_vencimento <= ${HOJE}`,
      ),
    ).toBeGreaterThanOrEqual(1);
  });

  it('o caixa fecha positivo e a projeção tem pendências futuras', async () => {
    await db.exec(SIMULACAO);

    const resumo = await comoUsuario(db, ADMIN, async (tx) => {
      const linha = await tx.query<{
        r: { saldoAtualCentavos: number; projecao: { saidasPendentesCentavos: number }[] };
      }>('select resumo_caixa() as r');
      return linha.rows[0]!.r;
    });

    expect(resumo.saldoAtualCentavos).toBeGreaterThan(0);
    expect(resumo.projecao.length).toBeGreaterThan(0);
  });

  it('ranking do período: rotas com lucro e uma rota no prejuízo, veículos com custo por KM', async () => {
    await db.exec(SIMULACAO);

    const { rotas, veiculos } = await comoUsuario(db, ADMIN, async (tx) => {
      const periodo = `(${HOJE} - 91, ${HOJE})`;
      const r = await tx.query<{ lucro_centavos: number }>(
        `select lucro_centavos::int from estatisticas_rotas${periodo}`,
      );
      const v = await tx.query<{ custo_por_km_centavos: number | null }>(
        `select custo_por_km_centavos::int from estatisticas_veiculos${periodo}`,
      );
      return { rotas: r.rows, veiculos: v.rows };
    });

    expect(rotas.length).toBeGreaterThanOrEqual(8);
    expect(rotas.filter((rota) => rota.lucro_centavos > 0).length).toBeGreaterThanOrEqual(3);
    expect(rotas.some((rota) => rota.lucro_centavos < 0)).toBe(true);
    expect(veiculos.filter((veiculo) => veiculo.custo_por_km_centavos !== null).length).toBe(6);
  });

  it('dívidas: a excluída guarda só as 2 parcelas pagas; as ativas têm todas as parcelas', async () => {
    await db.exec(SIMULACAO);

    expect(await contar(db, `divida where not ativa`)).toBe(1);
    expect(
      await contar(
        db,
        `movimentacao m join divida d on d.id = m.divida_id where not d.ativa and m.status_pagamento = 'Pago'`,
      ),
    ).toBe(2);
    expect(await contar(db, `movimentacao m join divida d on d.id = m.divida_id where d.ativa`)).toBe(48 + 12 + 6);
  });
});
