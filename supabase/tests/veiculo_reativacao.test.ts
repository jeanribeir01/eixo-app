/** @jest-environment node */
// Testes da migration 20261111000200_veiculo_reativacao.sql — EIX-81.
// A reativação é o mesmo UPDATE que o `reativarVeiculo` do app manda pelo PostgREST; cada teste
// confere o status gravado, porque o critério é sobre o que fica no banco, não sobre a tela.

import { criarBanco, comoUsuario, type Banco } from './helpers/db';

const GESTOR = { id: '81100000-0000-0000-0000-000000000001', perfil: 'Gestor de Frota' as const };
const MOTORISTA = { id: '81100000-0000-0000-0000-000000000002', perfil: 'Motorista' as const };

type StatusVeiculo = 'Disponivel' | 'EmViagem' | 'EmManutencao' | 'Inativo';

describe('migration veiculo_reativacao', () => {
  let db: Banco;
  let rotaId: string;
  let placas = 0;

  beforeAll(async () => {
    db = await criarBanco();
    await comoUsuario(db, MOTORISTA, async () => {});

    const rota = await db.query<{ id: string }>(
      `insert into rota (cidade_origem, uf_origem, cidade_destino, uf_destino, distancia_estimada_km)
       values ('São Paulo', 'SP', 'Curitiba', 'PR', 400) returning id`,
    );
    rotaId = rota.rows[0]!.id;
  });

  afterAll(async () => {
    await db.close();
  });

  // Veículo próprio por teste: a viagem e a reativação mudam o status dele.
  async function criarVeiculo(status: StatusVeiculo = 'Disponivel') {
    placas += 1;
    const resultado = await db.query<{ id: string }>(
      `insert into veiculo (placa, marca, modelo, capacidade_carga, status)
       values ($1, 'Volvo', 'FH', 10000, $2) returning id`,
      [`REA${String(placas).padStart(4, '0')}`, status],
    );
    return resultado.rows[0]!.id;
  }

  // Grava como superuser: os triggers valem para qualquer papel.
  async function abrirViagem(veiculoId: string) {
    const resultado = await db.query<{ id: string }>(
      `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial)
       values ($1, $2, $3, 1000) returning id`,
      [veiculoId, rotaId, MOTORISTA.id],
    );
    return resultado.rows[0]!.id;
  }

  // Direto na tabela (superuser) para não depender de categoria e forma de pagamento da RPC:
  // o que importa aqui é existir uma manutenção sem data de conclusão.
  async function abrirManutencao(veiculoId: string) {
    await db.query(
      `insert into manutencao (veiculo_id, descricao, data_manutencao, valor)
       values ($1, 'Troca de pneus', '2026-10-01', 3200)`,
      [veiculoId],
    );
    await db.query(`update veiculo set status = 'EmManutencao' where id = $1`, [veiculoId]);
  }

  // Inativação que o banco permite hoje com pendência aberta (edição + inativar, ou PATCH direto).
  async function inativar(veiculoId: string) {
    await db.query(`update veiculo set status = 'Inativo' where id = $1`, [veiculoId]);
  }

  // O mesmo UPDATE do `reativarVeiculo`, como Gestor de Frota e sob RLS.
  async function reativar(veiculoId: string, status: StatusVeiculo = 'Disponivel') {
    const resultado = await comoUsuario(db, GESTOR, (tx) =>
      tx.query<{ status: StatusVeiculo }>(
        `update veiculo set status = $2 where id = $1 and status = 'Inativo' returning status`,
        [veiculoId, status],
      ),
    );
    return resultado.rows[0]?.status;
  }

  async function statusDoVeiculo(veiculoId: string) {
    const resultado = await db.query<{ status: StatusVeiculo }>('select status from veiculo where id = $1', [veiculoId]);
    return resultado.rows[0]!.status;
  }

  it('reativa como Disponivel quando não há viagem nem manutenção aberta', async () => {
    const veiculoId = await criarVeiculo('Inativo');

    expect(await reativar(veiculoId)).toBe('Disponivel');
    expect(await statusDoVeiculo(veiculoId)).toBe('Disponivel');
  });

  it('reativa como EmViagem quando há viagem em andamento, e a viagem ao fechar devolve Disponivel', async () => {
    const veiculoId = await criarVeiculo();
    const viagemId = await abrirViagem(veiculoId);
    await inativar(veiculoId);

    expect(await reativar(veiculoId)).toBe('EmViagem');

    // Prova que o veículo voltou ao ciclo normal: o `sincroniza_status_veiculo` só libera EmViagem.
    await db.query(`update viagem set status = 'Finalizada', hodometro_final = 1200 where id = $1`, [viagemId]);
    expect(await statusDoVeiculo(veiculoId)).toBe('Disponivel');
  });

  it('reativa como EmManutencao quando há manutenção aberta, e nenhuma viagem abre nele (VG002)', async () => {
    const veiculoId = await criarVeiculo();
    await abrirManutencao(veiculoId);
    await inativar(veiculoId);

    expect(await reativar(veiculoId)).toBe('EmManutencao');
    await expect(abrirViagem(veiculoId)).rejects.toMatchObject({ code: 'VG002' });
  });

  it('dá prioridade à viagem quando há viagem e manutenção abertas', async () => {
    const veiculoId = await criarVeiculo();
    await abrirViagem(veiculoId);
    await db.query(
      `insert into manutencao (veiculo_id, descricao, data_manutencao, valor)
       values ($1, 'Freio', '2026-10-01', 900)`,
      [veiculoId],
    );
    await inativar(veiculoId);

    expect(await reativar(veiculoId)).toBe('EmViagem');
  });

  it('ignora o status pedido pelo cliente e grava o que os fatos dizem', async () => {
    // Um PATCH direto pedindo EmManutencao num veículo sem manutenção não pode inventar pendência.
    const veiculoId = await criarVeiculo('Inativo');

    expect(await reativar(veiculoId, 'EmManutencao')).toBe('Disponivel');
  });

  it('só age na saída de Inativo: as outras trocas de status gravam o que foi pedido', async () => {
    // Sem manutenção aberta; se o trigger agisse aqui, o status viraria Disponivel.
    const veiculoId = await criarVeiculo();
    await db.query(`update veiculo set status = 'EmManutencao' where id = $1`, [veiculoId]);
    expect(await statusDoVeiculo(veiculoId)).toBe('EmManutencao');

    await db.query(`update veiculo set status = 'Inativo' where id = $1`, [veiculoId]);
    expect(await statusDoVeiculo(veiculoId)).toBe('Inativo');
  });
});
