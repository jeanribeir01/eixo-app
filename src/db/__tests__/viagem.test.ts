import { eq } from 'drizzle-orm';

import * as schema from '../schema';
import { criarBancoDeTeste, type BancoDeTeste } from '../testing';

// Este teste só importa `../schema` e o helper, nunca `@/db/client`: o jest.setup.ts troca o client
// por um objeto vazio, e aqui queremos o SQLite real.
const AGORA = '2026-10-16T12:00:00.000Z';
const VEICULO_ID = '00000000-0000-7000-8000-000000000001';
const ROTA_ID = '00000000-0000-7000-8000-000000000002';
const MOTORISTA_ID = '00000000-0000-7000-8000-000000000003';
// O app gera UUID v7 no cliente (CLAUDE.md §5); estes valores fixos só imitam o formato.
const VIAGEM_ID = '00000000-0000-7000-8000-000000000004';
const OUTRA_VIAGEM_ID = '00000000-0000-7000-8000-000000000005';
const OUTBOX_ID = '00000000-0000-7000-8000-000000000006';

function novaViagem(id: string): schema.NovaViagem {
  return {
    id,
    veiculo_id: VEICULO_ID,
    rota_id: ROTA_ID,
    motorista_id: MOTORISTA_ID,
    hodometro_inicial: 1000,
    status: 'EmAndamento',
    data_inicio: AGORA,
    data_inclusao: AGORA,
    data_atualizacao: AGORA,
  };
}

describe('banco local (SQLite real)', () => {
  let banco: BancoDeTeste;

  beforeEach(() => {
    banco = criarBancoDeTeste();
    // viagem tem FK para veiculo e rota (foreign_keys = ON), então eles vêm primeiro.
    banco.db
      .insert(schema.veiculo)
      .values({
        id: VEICULO_ID,
        placa: 'ABC1D23',
        marca: 'Volvo',
        modelo: 'FH',
        capacidade_carga: 30,
        data_inclusao: AGORA,
        data_atualizacao: AGORA,
      })
      .run();
    banco.db
      .insert(schema.rota)
      .values({
        id: ROTA_ID,
        cidade_origem: 'Recife',
        cidade_destino: 'Salvador',
        uf_origem: 'PE',
        uf_destino: 'BA',
        distancia_estimada_km: 800,
        data_inclusao: AGORA,
        data_atualizacao: AGORA,
      })
      .run();
  });

  // Libera a conexão: sem isso cada teste deixaria um banco em memória aberto.
  afterEach(() => banco.fechar());

  it('grava uma viagem em andamento e lê de volta', () => {
    banco.db.insert(schema.viagem).values(novaViagem(VIAGEM_ID)).run();

    const lida = banco.db.select().from(schema.viagem).where(eq(schema.viagem.id, VIAGEM_ID)).get();

    expect(lida).toMatchObject({
      id: VIAGEM_ID,
      veiculo_id: VEICULO_ID,
      rota_id: ROTA_ID,
      motorista_id: MOTORISTA_ID,
      hodometro_inicial: 1000,
      hodometro_final: null,
      status: 'EmAndamento',
      km_rodado: null,
    });
  });

  it('barra a segunda viagem em andamento do mesmo veículo (viagem_um_andamento_por_veiculo)', () => {
    banco.db.insert(schema.viagem).values(novaViagem(VIAGEM_ID)).run();

    // O índice é parcial (só status EmAndamento): o erro vem do SQLite, antes de qualquer sync.
    expect(() => banco.db.insert(schema.viagem).values(novaViagem(OUTRA_VIAGEM_ID)).run()).toThrow(
      /UNIQUE constraint failed/,
    );
  });

  it('grava um item na outbox com payload JSON e usa os defaults', () => {
    const payload = { id: VIAGEM_ID, hodometro_inicial: 1000 };
    banco.db
      .insert(schema.outbox)
      .values({
        id: OUTBOX_ID,
        entidade: 'viagem',
        operacao: 'insert',
        payload: JSON.stringify(payload),
        criado_em: AGORA,
      })
      .run();

    const item = banco.db.select().from(schema.outbox).where(eq(schema.outbox.id, OUTBOX_ID)).get();

    expect(item?.tentativas).toBe(0);
    expect(item?.ultimo_erro).toBeNull();
    expect(JSON.parse(item?.payload ?? 'null')).toEqual(payload);
  });
});
