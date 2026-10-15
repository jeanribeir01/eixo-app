/** @jest-environment node */
// Testes da migration 20261015000100_viagem_regras.sql — EIX-76 (banco da US08, EIX-40/EIX-41).
// As regras de viagem moram em trigger, não em RPC: o sync offline grava direto na tabela.
// Os testes gravam como o app gravaria (insert/update/upsert) e conferem o que ficou no banco.

import { randomUUID } from 'node:crypto';

import { criarBanco, comoSuperuser, comoUsuario, type Banco } from './helpers/db';

const MOTORISTA_A = { id: '76100000-0000-0000-0000-000000000001', perfil: 'Motorista' as const };
const MOTORISTA_B = { id: '76100000-0000-0000-0000-000000000002', perfil: 'Motorista' as const };
const ADMIN = { id: '76100000-0000-0000-0000-000000000003', perfil: 'Admin' as const };
const GESTOR = { id: '76100000-0000-0000-0000-000000000004', perfil: 'Gestor de Frota' as const };

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

    it.each(['Finalizada', 'Cancelada'] as const)(
      'rejeita com VG004 a viagem que já chega %s com hodômetro abaixo do último final (VIAG-07)',
      async (status) => {
        const veiculoId = await criarVeiculo();
        await inserirViagem({ veiculoId, hodometroInicial: 1000, hodometroFinal: 1500, status: 'Finalizada' });

        const codigo = await codigoDoErro(
          inserirViagem({ veiculoId, hodometroInicial: 1400, hodometroFinal: 1450, status }),
        );

        expect(codigo).toBe('VG004');
        expect(await viagensDoVeiculo(veiculoId)).toBe(1);
      },
    );

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

    it('ignora o próprio hodômetro final ao conferir o inicial da viagem (VIAG-09)', async () => {
      // Viagem aberta com o final já preenchido: o "último final" é das OUTRAS viagens do
      // veículo, então subir o inicial de 1000 para 1100 (abaixo do próprio final) passa.
      const veiculoId = await criarVeiculo();
      const id = await inserirViagem({ veiculoId, hodometroInicial: 1000, hodometroFinal: 1500 });

      await db.query('update viagem set hodometro_inicial = 1100 where id = $1', [id]);

      const gravada = await db.query<{ hodometro_inicial: string }>(
        'select hodometro_inicial from viagem where id = $1',
        [id],
      );
      expect(gravada.rows[0]!.hodometro_inicial).toBe('1100.0');
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

    it('não expõe no texto do VG004 o hodômetro de viagens que o Motorista não enxerga (edge case)', async () => {
      const veiculoId = await criarVeiculo();
      await inserirViagem({
        veiculoId,
        motoristaId: MOTORISTA_A.id,
        hodometroInicial: 1000,
        hodometroFinal: 1500,
        status: 'Finalizada',
      });

      let mensagem = '';
      try {
        await comoUsuario(db, MOTORISTA_B, (tx) =>
          tx.query(
            `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial)
             values ($1, $2, $3, 1499)`,
            [veiculoId, rotaId, MOTORISTA_B.id],
          ),
        );
      } catch (erro) {
        mensagem = (erro as { message?: string }).message ?? '';
      }

      expect(mensagem).not.toBe('');
      expect(mensagem).not.toMatch(/\d/);
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

  describe('viagem encerrada é terminal', () => {
    async function lerViagem(id: string) {
      const resultado = await db.query<{
        status: StatusViagem;
        hodometro_inicial: string;
        hodometro_final: string | null;
        veiculo_id: string;
      }>('select status, hodometro_inicial, hodometro_final, veiculo_id from viagem where id = $1', [id]);
      return resultado.rows[0]!;
    }

    it.each([
      ['Finalizada', `status = 'EmAndamento'`],
      ['Cancelada', `status = 'Finalizada'`],
      ['Finalizada', 'hodometro_final = 1600'],
      ['Finalizada', 'hodometro_inicial = 1100'],
    ] as const)('rejeita alterar viagem %s com %s usando VG005 (VIAG-17)', async (status, alteracao) => {
      const veiculoId = await criarVeiculo();
      const id = await inserirViagem({ veiculoId, hodometroInicial: 1000, hodometroFinal: 1500, status });

      const codigo = await codigoDoErro(db.query(`update viagem set ${alteracao} where id = $1`, [id]));

      expect(codigo).toBe('VG005');
      expect(await lerViagem(id)).toMatchObject({ status, hodometro_inicial: '1000.0', hodometro_final: '1500.0' });
    });

    it('aceita regravar viagem encerrada com os mesmos status e hodômetros (VIAG-18)', async () => {
      const veiculoId = await criarVeiculo();
      const id = await inserirViagem({ veiculoId, hodometroInicial: 1000, hodometroFinal: 1500, status: 'Finalizada' });

      const resultado = await db.query(
        `update viagem set status = 'Finalizada', hodometro_inicial = 1000, hodometro_final = 1500
         where id = $1 returning id`,
        [id],
      );

      expect(resultado.rows).toHaveLength(1);
    });

    it.each([
      ['aberta', 'EmAndamento', null],
      ['encerrada', 'Finalizada', 1500],
    ] as const)('rejeita trocar o veículo de viagem %s com VG006 (VIAG-19)', async (_rotulo, status, hodometroFinal) => {
      const veiculoId = await criarVeiculo();
      const outroVeiculoId = await criarVeiculo();
      const id = await inserirViagem({ veiculoId, hodometroInicial: 1000, hodometroFinal, status });

      const codigo = await codigoDoErro(
        db.query('update viagem set veiculo_id = $1 where id = $2', [outroVeiculoId, id]),
      );

      expect(codigo).toBe('VG006');
      expect((await lerViagem(id)).veiculo_id).toBe(veiculoId);
    });
  });

  async function statusDoVeiculo(veiculoId: string) {
    const resultado = await db.query<{ status: StatusVeiculo }>('select status from veiculo where id = $1', [veiculoId]);
    return resultado.rows[0]!.status;
  }

  describe('status automático do veículo', () => {
    it('põe o veículo EmViagem quando a viagem abre (VIAG-12)', async () => {
      const veiculoId = await criarVeiculo();

      await inserirViagem({ veiculoId });

      expect(await statusDoVeiculo(veiculoId)).toBe('EmViagem');
    });

    it.each(['Finalizada', 'Cancelada'] as const)(
      'devolve o veículo para Disponivel quando a viagem fica %s (VIAG-13)',
      async (encerramento) => {
        const veiculoId = await criarVeiculo();
        const id = await inserirViagem({ veiculoId });
        expect(await statusDoVeiculo(veiculoId)).toBe('EmViagem');

        await db.query('update viagem set status = $1, hodometro_final = 1500 where id = $2', [encerramento, id]);

        expect(await statusDoVeiculo(veiculoId)).toBe('Disponivel');
      },
    );

    it('mantém Inativo o veículo inativado durante a viagem (VIAG-14)', async () => {
      const veiculoId = await criarVeiculo();
      const id = await inserirViagem({ veiculoId });
      await db.query(`update veiculo set status = 'Inativo' where id = $1`, [veiculoId]);

      await db.query(`update viagem set status = 'Finalizada', hodometro_final = 1500 where id = $1`, [id]);

      expect(await statusDoVeiculo(veiculoId)).toBe('Inativo');
    });

    it.each([
      ['Disponivel', 'Finalizada'],
      ['EmManutencao', 'Cancelada'],
    ] as const)('não mexe no veículo %s quando a viagem já chega %s (VIAG-15)', async (statusVeiculo, status) => {
      const veiculoId = await criarVeiculo(statusVeiculo);

      await inserirViagem({ veiculoId, hodometroFinal: 1500, status });

      expect(await statusDoVeiculo(veiculoId)).toBe(statusVeiculo);
    });

    it('muda o status quando o Motorista abre e fecha a própria viagem, sem policy de update em veiculo (VIAG-16)', async () => {
      const veiculoId = await criarVeiculo();

      const id = await comoUsuario(db, MOTORISTA_A, async (tx) => {
        const resultado = await tx.query<{ id: string }>(
          `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial)
           values ($1, $2, $3, 1000) returning id`,
          [veiculoId, rotaId, MOTORISTA_A.id],
        );
        return resultado.rows[0]!.id;
      });
      expect(await statusDoVeiculo(veiculoId)).toBe('EmViagem');

      await comoUsuario(db, MOTORISTA_A, (tx) =>
        tx.query(`update viagem set status = 'Finalizada', hodometro_final = 1500 where id = $1`, [id]),
      );
      expect(await statusDoVeiculo(veiculoId)).toBe('Disponivel');
    });
  });

  describe('upsert idempotente (sync offline)', () => {
    // Mesmo formato do upsert do PostgREST (`Prefer: resolution=merge-duplicates`): o `id`
    // vem do celular e toda coluna enviada é sobrescrita no conflito.
    function upsertComoMotorista(dados: DadosViagem & { id: string }) {
      return comoUsuario(db, MOTORISTA_A, (tx) =>
        tx.query(
          `insert into viagem (id, veiculo_id, rota_id, motorista_id, hodometro_inicial, hodometro_final, status)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (id) do update set
             veiculo_id = excluded.veiculo_id,
             rota_id = excluded.rota_id,
             motorista_id = excluded.motorista_id,
             hodometro_inicial = excluded.hodometro_inicial,
             hodometro_final = excluded.hodometro_final,
             status = excluded.status`,
          [
            dados.id,
            dados.veiculoId,
            rotaId,
            MOTORISTA_A.id,
            dados.hodometroInicial ?? 1000,
            dados.hodometroFinal ?? null,
            dados.status ?? 'EmAndamento',
          ],
        ),
      );
    }

    it('aceita reenviar a mesma viagem aberta: uma linha só e veículo EmViagem (VIAG-20)', async () => {
      const veiculoId = await criarVeiculo();
      const id = randomUUID();

      await upsertComoMotorista({ id, veiculoId });
      await upsertComoMotorista({ id, veiculoId });

      expect(await viagensDoVeiculo(veiculoId)).toBe(1);
      expect(await statusDoVeiculo(veiculoId)).toBe('EmViagem');
    });

    it('fecha a viagem por upsert e devolve o veículo para Disponivel (VIAG-23)', async () => {
      const veiculoId = await criarVeiculo();
      const id = randomUUID();
      await upsertComoMotorista({ id, veiculoId });
      expect(await statusDoVeiculo(veiculoId)).toBe('EmViagem');

      await upsertComoMotorista({ id, veiculoId, hodometroFinal: 1500, status: 'Finalizada' });

      const gravada = await db.query<{ status: StatusViagem; hodometro_final: string }>(
        'select status, hodometro_final from viagem where id = $1',
        [id],
      );
      expect(gravada.rows[0]).toEqual({ status: 'Finalizada', hodometro_final: '1500.0' });
      expect(await statusDoVeiculo(veiculoId)).toBe('Disponivel');
    });

    it('reenvio atrasado do fechamento não libera o veículo que já abriu outra viagem (VIAG-21)', async () => {
      const veiculoId = await criarVeiculo();
      const primeiraId = randomUUID();
      await upsertComoMotorista({ id: primeiraId, veiculoId });
      await upsertComoMotorista({ id: primeiraId, veiculoId, hodometroFinal: 1500, status: 'Finalizada' });
      await upsertComoMotorista({ id: randomUUID(), veiculoId, hodometroInicial: 1500 });

      await upsertComoMotorista({ id: primeiraId, veiculoId, hodometroFinal: 1500, status: 'Finalizada' });

      expect(await viagensDoVeiculo(veiculoId)).toBe(2);
      expect(await statusDoVeiculo(veiculoId)).toBe('EmViagem');
    });

    it('rejeita com VG005 o reenvio de "abrir" para uma viagem já Finalizada (VIAG-22)', async () => {
      const veiculoId = await criarVeiculo();
      const id = randomUUID();
      await upsertComoMotorista({ id, veiculoId });
      await upsertComoMotorista({ id, veiculoId, hodometroFinal: 1500, status: 'Finalizada' });

      const codigo = await codigoDoErro(upsertComoMotorista({ id, veiculoId }));

      expect(codigo).toBe('VG005');
      expect(await statusDoVeiculo(veiculoId)).toBe('Disponivel');
    });
  });

  describe('quilometragem rodada', () => {
    async function kmRodado(id: string) {
      const resultado = await db.query<{ km_rodado: string | null }>('select km_rodado from viagem where id = $1', [id]);
      return resultado.rows[0]!.km_rodado;
    }

    it('calcula km_rodado = final - inicial quando a viagem fecha (VIAG-24)', async () => {
      const veiculoId = await criarVeiculo();
      const id = await inserirViagem({ veiculoId, hodometroInicial: 1000 });

      await db.query(`update viagem set status = 'Finalizada', hodometro_final = 1234.5 where id = $1`, [id]);

      expect(await kmRodado(id)).toBe('234.5');
    });

    it('deixa km_rodado nulo enquanto a viagem está aberta (VIAG-25)', async () => {
      const veiculoId = await criarVeiculo();
      const id = await inserirViagem({ veiculoId, hodometroInicial: 1000 });

      expect(await kmRodado(id)).toBeNull();
    });

    it('rejeita gravar km_rodado à mão com 428C9 (VIAG-26)', async () => {
      const veiculoId = await criarVeiculo();

      const codigo = await codigoDoErro(
        db.query(
          `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial, km_rodado)
           values ($1, $2, $3, 1000, 50)`,
          [veiculoId, rotaId, MOTORISTA_A.id],
        ),
      );

      expect(codigo).toBe('428C9');
      expect(await viagensDoVeiculo(veiculoId)).toBe(0);
    });
  });

  describe('viagem não é apagada', () => {
    it.each([
      ['Admin', ADMIN],
      ['Gestor de Frota', GESTOR],
      ['Motorista dono da viagem', MOTORISTA_A],
    ] as const)('delete como %s afeta 0 linhas e a viagem continua (VIAG-27)', async (_perfil, usuario) => {
      const veiculoId = await criarVeiculo();
      const id = await inserirViagem({ veiculoId, motoristaId: MOTORISTA_A.id });

      const resultado = await comoUsuario(db, usuario, (tx) =>
        tx.query('delete from viagem where id = $1 returning id', [id]),
      );

      expect(resultado.rows).toHaveLength(0);
      expect(await viagensDoVeiculo(veiculoId)).toBe(1);
    });
  });
});
