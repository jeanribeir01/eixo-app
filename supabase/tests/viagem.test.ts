/** @jest-environment node */
// Testes da migration 20261015000100_viagem_regras.sql — EIX-76 (banco da US08, EIX-40/EIX-41).
// As regras de viagem moram em trigger, não em RPC: o sync offline grava direto na tabela.
// Os testes gravam como o app gravaria (insert/update/upsert) e conferem o que ficou no banco.

import { criarBanco, comoSuperuser, comoUsuario, type Banco } from './helpers/db';

const MOTORISTA_A = { id: '76100000-0000-0000-0000-000000000001', perfil: 'Motorista' as const };
const MOTORISTA_B = { id: '76100000-0000-0000-0000-000000000002', perfil: 'Motorista' as const };

type StatusVeiculo = 'Disponivel' | 'EmViagem' | 'EmManutencao' | 'Inativo';
type StatusViagem = 'EmAndamento' | 'Finalizada' | 'Cancelada';

type DadosViagem = {
  veiculoId: string;
  motoristaId?: string;
  hodometroInicial?: number;
  hodometroFinal?: number | null;
  status?: StatusViagem;
};

// O erro do PGlite traz o SQLSTATE em `code`; é ele que o app traduz em mensagem.
async function codigoDoErro(promessa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promessa;
    return undefined;
  } catch (erro) {
    return (erro as { code?: string }).code;
  }
}

describe('migration viagem_regras', () => {
  let db: Banco;
  let rotaId: string;
  let placas = 0;

  beforeAll(async () => {
    db = await criarBanco();

    await comoUsuario(db, MOTORISTA_A, async () => {});
    await comoUsuario(db, MOTORISTA_B, async () => {});

    const rota = await db.query<{ id: string }>(
      `insert into rota (cidade_origem, uf_origem, cidade_destino, uf_destino, distancia_estimada_km)
       values ('São Paulo', 'SP', 'Curitiba', 'PR', 400) returning id`,
    );
    rotaId = rota.rows[0]!.id;
  });

  afterAll(async () => {
    await db.close();
  });

  // Veículo próprio por teste: a viagem muda o status dele.
  async function criarVeiculo(status: StatusVeiculo = 'Disponivel') {
    placas += 1;
    const resultado = await db.query<{ id: string }>(
      `insert into veiculo (placa, marca, modelo, capacidade_carga, status)
       values ($1, 'Volvo', 'FH', 10000, $2) returning id`,
      [`VGM${String(placas).padStart(4, '0')}`, status],
    );
    return resultado.rows[0]!.id;
  }

  // Grava como superuser (o RLS fica fora): os triggers valem para qualquer papel.
  async function inserirViagem(dados: DadosViagem) {
    const resultado = await db.query<{ id: string }>(
      `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial, hodometro_final, status)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [
        dados.veiculoId,
        rotaId,
        dados.motoristaId ?? MOTORISTA_A.id,
        dados.hodometroInicial ?? 1000,
        dados.hodometroFinal ?? null,
        dados.status ?? 'EmAndamento',
      ],
    );
    return resultado.rows[0]!.id;
  }

  async function viagensDoVeiculo(veiculoId: string) {
    const resultado = await db.query<{ total: number }>(
      'select count(*)::int as total from viagem where veiculo_id = $1',
      [veiculoId],
    );
    return resultado.rows[0]!.total;
  }

  describe('um veículo, uma viagem em andamento', () => {
    it('rejeita a segunda viagem aberta no mesmo veículo com VG001 e não grava nada (VIAG-01)', async () => {
      const veiculoId = await criarVeiculo();
      await inserirViagem({ veiculoId });

      const codigo = await codigoDoErro(inserirViagem({ veiculoId, motoristaId: MOTORISTA_B.id }));

      expect(codigo).toBe('VG001');
      expect(await viagensDoVeiculo(veiculoId)).toBe(1);
    });

    it('barra no índice único (23505) a escrita que passa por fora do trigger (VIAG-02)', async () => {
      const veiculoId = await criarVeiculo();
      await inserirViagem({ veiculoId });

      // `replica` desliga os triggers comuns: sobra só o índice para segurar a regra.
      const codigo = await codigoDoErro(
        comoSuperuser(db, async (tx) => {
          await tx.query(`set local session_replication_role = replica`);
          await tx.query(
            `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial)
             values ($1, $2, $3, 2000)`,
            [veiculoId, rotaId, MOTORISTA_B.id],
          );
        }),
      );

      expect(codigo).toBe('23505');
      expect(await viagensDoVeiculo(veiculoId)).toBe(1);
    });

    it.each(['Finalizada', 'Cancelada'] as const)(
      'aceita nova viagem aberta depois que a anterior fica %s (VIAG-03)',
      async (encerramento) => {
        const veiculoId = await criarVeiculo();
        const primeiraId = await inserirViagem({ veiculoId });
        await db.query(`update viagem set status = $1, hodometro_final = 1500 where id = $2`, [
          encerramento,
          primeiraId,
        ]);

        await inserirViagem({ veiculoId, hodometroInicial: 1500 });

        const abertas = await db.query<{ total: number }>(
          `select count(*)::int as total from viagem where veiculo_id = $1 and status = 'EmAndamento'`,
          [veiculoId],
        );
        expect(abertas.rows[0]!.total).toBe(1);
        expect(await viagensDoVeiculo(veiculoId)).toBe(2);
      },
    );
  });

  describe('veículo indisponível', () => {
    it('rejeita abrir viagem em veículo EmManutencao com VG002 (VIAG-04)', async () => {
      const veiculoId = await criarVeiculo('EmManutencao');

      const codigo = await codigoDoErro(inserirViagem({ veiculoId }));

      expect(codigo).toBe('VG002');
      expect(await viagensDoVeiculo(veiculoId)).toBe(0);
    });

    it('rejeita abrir viagem em veículo Inativo com VG003 (VIAG-05)', async () => {
      const veiculoId = await criarVeiculo('Inativo');

      const codigo = await codigoDoErro(inserirViagem({ veiculoId }));

      expect(codigo).toBe('VG003');
      expect(await viagensDoVeiculo(veiculoId)).toBe(0);
    });

    it.each([
      ['EmManutencao', 'Finalizada'],
      ['EmManutencao', 'Cancelada'],
      ['Inativo', 'Finalizada'],
      ['Inativo', 'Cancelada'],
    ] as const)('aceita viagem retroativa em veículo %s quando já chega %s (VIAG-06)', async (statusVeiculo, status) => {
      const veiculoId = await criarVeiculo(statusVeiculo);

      await inserirViagem({ veiculoId, hodometroFinal: 1200, status });

      expect(await viagensDoVeiculo(veiculoId)).toBe(1);
    });
  });

  describe('hodômetro não regride', () => {
    it('rejeita hodômetro inicial menor que o último final do veículo com VG004 (VIAG-07)', async () => {
      const veiculoId = await criarVeiculo();
      await inserirViagem({ veiculoId, hodometroInicial: 1000, hodometroFinal: 1500, status: 'Finalizada' });

      const codigo = await codigoDoErro(inserirViagem({ veiculoId, hodometroInicial: 1499 }));

      expect(codigo).toBe('VG004');
      expect(await viagensDoVeiculo(veiculoId)).toBe(1);
    });

    it('compara com o maior final, inclusive de viagem Cancelada (VIAG-07)', async () => {
      const veiculoId = await criarVeiculo();
      await inserirViagem({ veiculoId, hodometroInicial: 1000, hodometroFinal: 1500, status: 'Finalizada' });
      await inserirViagem({ veiculoId, hodometroInicial: 1500, hodometroFinal: 1800, status: 'Cancelada' });

      const codigo = await codigoDoErro(inserirViagem({ veiculoId, hodometroInicial: 1700 }));

      expect(codigo).toBe('VG004');
      expect(await viagensDoVeiculo(veiculoId)).toBe(2);
    });

    it('aceita hodômetro inicial igual ao último final (VIAG-08)', async () => {
      const veiculoId = await criarVeiculo();
      await inserirViagem({ veiculoId, hodometroInicial: 1000, hodometroFinal: 1500, status: 'Finalizada' });

      await inserirViagem({ veiculoId, hodometroInicial: 1500 });

      expect(await viagensDoVeiculo(veiculoId)).toBe(2);
    });

    it('aceita qualquer hodômetro não negativo na primeira viagem do veículo (edge case)', async () => {
      const veiculoId = await criarVeiculo();

      await inserirViagem({ veiculoId, hodometroInicial: 0 });

      expect(await viagensDoVeiculo(veiculoId)).toBe(1);
    });

    it('rejeita baixar o hodômetro inicial de viagem aberta abaixo do último final com VG004 (VIAG-09)', async () => {
      const veiculoId = await criarVeiculo();
      await inserirViagem({ veiculoId, hodometroInicial: 1000, hodometroFinal: 1500, status: 'Finalizada' });
      const abertaId = await inserirViagem({ veiculoId, hodometroInicial: 1600 });

      const codigo = await codigoDoErro(
        db.query('update viagem set hodometro_inicial = 1400 where id = $1', [abertaId]),
      );

      expect(codigo).toBe('VG004');
      const gravada = await db.query<{ hodometro_inicial: string }>(
        'select hodometro_inicial from viagem where id = $1',
        [abertaId],
      );
      expect(gravada.rows[0]!.hodometro_inicial).toBe('1600.0');
    });

    it('barra o Motorista pelo final da viagem de outro motorista, que ele não enxerga (VIAG-10)', async () => {
      const veiculoId = await criarVeiculo();
      await inserirViagem({
        veiculoId,
        motoristaId: MOTORISTA_A.id,
        hodometroInicial: 1000,
        hodometroFinal: 1500,
        status: 'Finalizada',
      });

      const codigo = await codigoDoErro(
        comoUsuario(db, MOTORISTA_B, (tx) =>
          tx.query(
            `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial)
             values ($1, $2, $3, 1499)`,
            [veiculoId, rotaId, MOTORISTA_B.id],
          ),
        ),
      );

      expect(codigo).toBe('VG004');
      expect(await viagensDoVeiculo(veiculoId)).toBe(1);
    });

    it('mantém as checks antigas: final igual ao inicial e Finalizada sem final dão 23514 (VIAG-11)', async () => {
      const veiculoId = await criarVeiculo();

      const finalIgual = await codigoDoErro(inserirViagem({ veiculoId, hodometroInicial: 1000, hodometroFinal: 1000 }));
      const finalizadaSemFinal = await codigoDoErro(inserirViagem({ veiculoId, status: 'Finalizada' }));

      expect(finalIgual).toBe('23514');
      expect(finalizadaSemFinal).toBe('23514');
      expect(await viagensDoVeiculo(veiculoId)).toBe(0);
    });
  });
});
