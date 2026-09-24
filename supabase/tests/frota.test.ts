/** @jest-environment node */
// Testes da migration 20260924000300_frota.sql — spec.md:
// P1 Tabelas AC2 (FKs de viagem/manutencao), AC5 (placa repetida + normalizada),
// AC6 e AC7 (hodômetro), AC8 (manutencao.valor negativo) e edge cases de placa e
// viagem aberta.

import { criarBanco, comoSuperuser, type Banco } from './helpers/db';

describe('migration de frota: veiculo, rota, viagem, manutencao', () => {
  let db: Banco;

  beforeAll(async () => {
    db = await criarBanco();
  });

  afterAll(async () => {
    await db.close();
  });

  async function criarVeiculo(placa: string) {
    const resultado = await db.query<{ id: string }>(
      `insert into veiculo (placa, marca, modelo, capacidade_carga)
       values ($1, 'Volvo', 'FH', 10000) returning id`,
      [placa],
    );
    return resultado.rows[0]!.id;
  }

  async function criarRota() {
    const resultado = await db.query<{ id: string }>(
      `insert into rota (cidade_origem, cidade_destino, distancia_estimada_km)
       values ('Origem', 'Destino', 100) returning id`,
    );
    return resultado.rows[0]!.id;
  }

  async function criarMotorista(id: string) {
    await comoSuperuser(db, async (tx) => {
      await tx.query(
        `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, '{}'::jsonb)`,
        [id, `${id}@teste.local`],
      );
    });
    return id;
  }

  it('rejeita placa repetida', async () => {
    await criarVeiculo('ABC1D23');

    await expect(criarVeiculo('ABC1D23')).rejects.toThrow();
  });

  it('rejeita placa em minúscula ou com espaço (trata como a mesma placa em formato errado)', async () => {
    await expect(criarVeiculo('abc2d34')).rejects.toThrow();
    await expect(criarVeiculo('ABC 2D34')).rejects.toThrow();
  });

  it('aceita viagem aberta com hodometro_final nulo', async () => {
    const veiculoId = await criarVeiculo('ABC3D45');
    const rotaId = await criarRota();
    const motoristaId = await criarMotorista('66666666-6666-6666-6666-666666666666');

    const resultado = await db.query<{ id: string; status: string }>(
      `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial)
       values ($1, $2, $3, 1000) returning id, status`,
      [veiculoId, rotaId, motoristaId],
    );

    expect(resultado.rows[0]?.status).toBe('EmAndamento');
  });

  it('rejeita hodometro_final menor ou igual ao inicial', async () => {
    const veiculoId = await criarVeiculo('ABC4D56');
    const rotaId = await criarRota();
    const motoristaId = await criarMotorista('77777777-7777-7777-7777-777777777777');

    await expect(
      db.query(
        `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial, hodometro_final)
         values ($1, $2, $3, 1000, 1000)`,
        [veiculoId, rotaId, motoristaId],
      ),
    ).rejects.toThrow();

    await expect(
      db.query(
        `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial, hodometro_final)
         values ($1, $2, $3, 1000, 900)`,
        [veiculoId, rotaId, motoristaId],
      ),
    ).rejects.toThrow();
  });

  it('rejeita viagem Finalizada sem hodometro_final', async () => {
    const veiculoId = await criarVeiculo('ABC5D67');
    const rotaId = await criarRota();
    const motoristaId = await criarMotorista('88888888-8888-8888-8888-888888888888');

    await expect(
      db.query(
        `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial, status)
         values ($1, $2, $3, 1000, 'Finalizada')`,
        [veiculoId, rotaId, motoristaId],
      ),
    ).rejects.toThrow();
  });

  it('aceita viagem Finalizada com hodometro_final maior que o inicial', async () => {
    const veiculoId = await criarVeiculo('ABC6D78');
    const rotaId = await criarRota();
    const motoristaId = await criarMotorista('99999999-9999-9999-9999-999999999999');

    const resultado = await db.query<{ status: string }>(
      `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial, hodometro_final, status)
       values ($1, $2, $3, 1000, 1200, 'Finalizada') returning status`,
      [veiculoId, rotaId, motoristaId],
    );

    expect(resultado.rows[0]?.status).toBe('Finalizada');
  });

  it('rejeita manutencao com valor negativo', async () => {
    const veiculoId = await criarVeiculo('ABC7D89');

    await expect(
      db.query(
        `insert into manutencao (veiculo_id, descricao, data_manutencao, valor)
         values ($1, 'Troca de óleo', current_date, -50)`,
        [veiculoId],
      ),
    ).rejects.toThrow();
  });

  it('rejeita viagem sem veiculo_id, rota_id ou motorista_id', async () => {
    const veiculoId = await criarVeiculo('ABC8D90');
    const rotaId = await criarRota();
    const motoristaId = await criarMotorista('10101010-1010-1010-1010-101010101010');

    await expect(
      db.query(
        `insert into viagem (rota_id, motorista_id, hodometro_inicial) values ($1, $2, 1000)`,
        [rotaId, motoristaId],
      ),
    ).rejects.toThrow();

    await expect(
      db.query(
        `insert into viagem (veiculo_id, motorista_id, hodometro_inicial) values ($1, $2, 1000)`,
        [veiculoId, motoristaId],
      ),
    ).rejects.toThrow();

    await expect(
      db.query(
        `insert into viagem (veiculo_id, rota_id, hodometro_inicial) values ($1, $2, 1000)`,
        [veiculoId, rotaId],
      ),
    ).rejects.toThrow();
  });

  it('rejeita manutencao sem veiculo_id', async () => {
    await expect(
      db.query(
        `insert into manutencao (descricao, data_manutencao, valor) values ('Revisão', current_date, 100)`,
      ),
    ).rejects.toThrow();
  });
});
