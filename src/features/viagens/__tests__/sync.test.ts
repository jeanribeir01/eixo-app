import { eq } from 'drizzle-orm';

import * as schema from '@/db/schema';
import { criarBancoDeTeste, type BancoDeTeste } from '@/db/testing';
import type { ViagensDb } from '../viagensRepository';
import {
  drenarOutboxViagens,
  ehErroConexao,
  obterStatusOutboxViagens,
  sincronizarSeConectado,
} from '../sync';

const AGORA = '2026-10-18T10:00:00.000Z';
const VEICULO_ID = '00000000-0000-7000-8000-000000000001';
const ROTA_ID = '00000000-0000-7000-8000-000000000002';
const MOTORISTA_ID = '00000000-0000-7000-8000-000000000003';
const VIAGEM_ID = '00000000-0000-7000-8000-000000000004';
const OUTBOX_ID = '00000000-0000-7000-8000-000000000005';

describe('sync de viagens (drenarOutboxViagens)', () => {
  let banco: BancoDeTeste;

  beforeEach(() => {
    banco = criarBancoDeTeste();

    banco.db
      .insert(schema.veiculo)
      .values({
        id: VEICULO_ID,
        placa: 'ABC1D23',
        marca: 'Scania',
        modelo: 'R450',
        capacidade_carga: 30,
        status: 'Disponivel',
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

  afterEach(() => {
    banco.fechar();
  });

  function criarMockSupabase(opcoes: {
    upsertResultado?: { data: unknown; error: { code: string; message: string } | null };
    updateResultado?: { data: unknown; error: { code: string; message: string } | null };
  }) {
    const mockUpsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue(opcoes.upsertResultado ?? { data: null, error: null }),
      }),
    });

    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue(opcoes.updateResultado ?? { data: null, error: null }),
        }),
      }),
    });

    const client = {
      from: jest.fn((tabela: string) => {
        if (tabela === 'viagem') {
          return {
            upsert: mockUpsert,
            update: mockUpdate,
          };
        }
        throw new Error(`Tabela inesperada: ${tabela}`);
      }),
    };

    return { client, mockUpsert, mockUpdate };
  }

  it('retorna resultado zerado quando não há itens na outbox', async () => {
    const { client } = criarMockSupabase({});
    const resultado = await drenarOutboxViagens({}, { db: banco.db as unknown as ViagensDb, supabase: client as never });

    expect(resultado).toEqual({
      total: 0,
      sincronizados: 0,
      falhas: 0,
      conflitos: 0,
      itens: [],
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('drena insert com sucesso, remove da outbox e atualiza km_rodado retornado pelo servidor', async () => {
    // Insere viagem local
    banco.db
      .insert(schema.viagem)
      .values({
        id: VIAGEM_ID,
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
        status: 'EmAndamento',
        km_rodado: null,
        data_inclusao: AGORA,
        data_atualizacao: AGORA,
      })
      .run();

    // Insere item na outbox
    const payloadLocal = {
      id: VIAGEM_ID,
      veiculo_id: VEICULO_ID,
      rota_id: ROTA_ID,
      motorista_id: MOTORISTA_ID,
      hodometro_inicial: 10000,
      status: 'EmAndamento',
      data_inclusao: AGORA,
      data_atualizacao: AGORA,
    };

    banco.db
      .insert(schema.outbox)
      .values({
        id: OUTBOX_ID,
        entidade: 'viagem',
        operacao: 'insert',
        payload: JSON.stringify(payloadLocal),
        tentativas: 0,
        criado_em: AGORA,
      })
      .run();

    const { client, mockUpsert } = criarMockSupabase({
      upsertResultado: {
        data: {
          ...payloadLocal,
          km_rodado: null,
        },
        error: null,
      },
    });

    const resultado = await drenarOutboxViagens({}, { db: banco.db as unknown as ViagensDb, supabase: client as never });

    expect(resultado.total).toBe(1);
    expect(resultado.sincronizados).toBe(1);
    expect(resultado.falhas).toBe(0);
    expect(resultado.conflitos).toBe(0);

    // Garante que o payload enviado ao upsert NÃO contém km_rodado
    expect(mockUpsert).toHaveBeenCalled();
    const payloadEnviado = mockUpsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payloadEnviado.km_rodado).toBeUndefined();
    expect('km_rodado' in payloadEnviado).toBe(false);

    // Garante que o item foi removido da outbox
    const itensOutbox = banco.db.select().from(schema.outbox).all();
    expect(itensOutbox).toHaveLength(0);
  });

  it('drena update de fechamento, remove da outbox e atualiza km_rodado local', async () => {
    banco.db
      .insert(schema.viagem)
      .values({
        id: VIAGEM_ID,
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
        hodometro_final: 10400,
        status: 'Finalizada',
        km_rodado: 400,
        data_inclusao: AGORA,
        data_atualizacao: AGORA,
      })
      .run();

    const payloadUpdate = {
      id: VIAGEM_ID,
      status: 'Finalizada',
      hodometro_final: 10400,
      data_fim: '2026-10-18T18:00:00.000Z',
      data_atualizacao: AGORA,
    };

    banco.db
      .insert(schema.outbox)
      .values({
        id: OUTBOX_ID,
        entidade: 'viagem',
        operacao: 'update',
        payload: JSON.stringify(payloadUpdate),
        tentativas: 0,
        criado_em: AGORA,
      })
      .run();

    const { client, mockUpdate } = criarMockSupabase({
      updateResultado: {
        data: {
          id: VIAGEM_ID,
          km_rodado: 400, // Calculado pelo Postgres
          data_atualizacao: '2026-10-18T18:00:05.000Z',
        },
        error: null,
      },
    });

    const resultado = await drenarOutboxViagens({}, { db: banco.db as unknown as ViagensDb, supabase: client as never });

    expect(resultado.sincronizados).toBe(1);
    expect(mockUpdate).toHaveBeenCalled();

    // Garante que km_rodado NUNCA esteve no payload do update
    const payloadEnviado = mockUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payloadEnviado.km_rodado).toBeUndefined();
    expect('km_rodado' in payloadEnviado).toBe(false);

    // Item foi removido da outbox
    expect(banco.db.select().from(schema.outbox).all()).toHaveLength(0);

    // Viagem local atualizada
    const viagemLocal = banco.db.select().from(schema.viagem).where(eq(schema.viagem.id, VIAGEM_ID)).get();
    expect(viagemLocal?.km_rodado).toBe(400);
  });

  it('em erro de rede, incrementa tentativas, grava ultimo_erro e interrompe a fila', async () => {
    banco.db
      .insert(schema.outbox)
      .values({
        id: OUTBOX_ID,
        entidade: 'viagem',
        operacao: 'insert',
        payload: JSON.stringify({ id: VIAGEM_ID }),
        tentativas: 0,
        criado_em: AGORA,
      })
      .run();

    const { client } = criarMockSupabase({
      upsertResultado: {
        data: null,
        error: { code: 'ECONNREFUSED', message: 'Failed to fetch network request' },
      },
    });

    const resultado = await drenarOutboxViagens({}, { db: banco.db as unknown as ViagensDb, supabase: client as never });

    expect(resultado.sincronizados).toBe(0);
    expect(resultado.falhas).toBe(1);

    // O item continua na outbox com tentativa incrementada
    const item = banco.db.select().from(schema.outbox).where(eq(schema.outbox.id, OUTBOX_ID)).get();
    expect(item?.tentativas).toBe(1);
    expect(item?.ultimo_erro).toContain('network');
  });

  it('em erro de conflito VG005 (viagem já fechada no servidor), marca como conflito para revisão', async () => {
    banco.db
      .insert(schema.outbox)
      .values({
        id: OUTBOX_ID,
        entidade: 'viagem',
        operacao: 'update',
        payload: JSON.stringify({ id: VIAGEM_ID, status: 'Finalizada', hodometro_final: 10400 }),
        tentativas: 0,
        criado_em: AGORA,
      })
      .run();

    const { client } = criarMockSupabase({
      updateResultado: {
        data: null,
        error: { code: 'VG005', message: 'Viagem encerrada não pode ser alterada.' },
      },
    });

    const resultado = await drenarOutboxViagens({}, { db: banco.db as unknown as ViagensDb, supabase: client as never });

    expect(resultado.conflitos).toBe(1);
    expect(resultado.itens[0]?.status).toBe('conflito');

    const item = banco.db.select().from(schema.outbox).where(eq(schema.outbox.id, OUTBOX_ID)).get();
    expect(item?.ultimo_erro).toContain('revisão');
    expect(item?.ultimo_erro).toContain('VG005');
  });

  it('ignora itens que atingiram o limite máximo de tentativas', async () => {
    banco.db
      .insert(schema.outbox)
      .values({
        id: OUTBOX_ID,
        entidade: 'viagem',
        operacao: 'insert',
        payload: JSON.stringify({ id: VIAGEM_ID }),
        tentativas: 5,
        criado_em: AGORA,
        ultimo_erro: 'Erro anterior persistente',
      })
      .run();

    const { client } = criarMockSupabase({});
    const resultado = await drenarOutboxViagens(
      { maxTentativas: 5 },
      { db: banco.db as unknown as ViagensDb, supabase: client as never },
    );

    expect(resultado.falhas).toBe(1);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('obterStatusOutboxViagens calcula pendentes, erros e conflitos corretamente', () => {
    banco.db
      .insert(schema.outbox)
      .values([
        {
          id: 'item-1',
          entidade: 'viagem',
          operacao: 'insert',
          payload: '{}',
          tentativas: 0,
          criado_em: AGORA,
        },
        {
          id: 'item-2',
          entidade: 'viagem',
          operacao: 'update',
          payload: '{}',
          tentativas: 1,
          criado_em: AGORA,
          ultimo_erro: 'Falha de rede',
        },
        {
          id: 'item-3',
          entidade: 'viagem',
          operacao: 'update',
          payload: '{}',
          tentativas: 1,
          criado_em: AGORA,
          ultimo_erro: 'Conflito (VG005): marcado para revisão',
        },
      ])
      .run();

    const status = obterStatusOutboxViagens(banco.db as unknown as ViagensDb);

    expect(status).toEqual({
      pendentes: 3,
      comErro: 2,
      conflitos: 1,
    });
  });

  describe('sincronizarSeConectado', () => {
    it('não drena se o aparelho estiver offline', async () => {
      const mockNetwork = {
        getNetworkStateAsync: jest.fn().mockResolvedValue({
          isConnected: false,
          isInternetReachable: false,
        }),
      };

      const { client } = criarMockSupabase({});
      const resultado = await sincronizarSeConectado(
        {},
        {
          db: banco.db as unknown as ViagensDb,
          supabase: client as never,
          network: mockNetwork as never,
        },
      );

      expect(resultado).toBeNull();
      expect(client.from).not.toHaveBeenCalled();
    });

    it('drena normalmente se o aparelho estiver online', async () => {
      const mockNetwork = {
        getNetworkStateAsync: jest.fn().mockResolvedValue({
          isConnected: true,
          isInternetReachable: true,
        }),
      };

      const { client } = criarMockSupabase({});
      const resultado = await sincronizarSeConectado(
        {},
        {
          db: banco.db as unknown as ViagensDb,
          supabase: client as never,
          network: mockNetwork as never,
        },
      );

      expect(resultado).toEqual({
        total: 0,
        sincronizados: 0,
        falhas: 0,
        conflitos: 0,
        itens: [],
      });
    });
  });

  describe('ehErroConexao', () => {
    it('identifica erros de rede típicos', () => {
      expect(ehErroConexao({ message: 'Network request failed' })).toBe(true);
      expect(ehErroConexao({ message: 'Failed to fetch' })).toBe(true);
      expect(ehErroConexao({ code: 'ECONNREFUSED' })).toBe(true);
      expect(ehErroConexao({ code: 'VG001', message: 'Veículo em viagem' })).toBe(false);
      expect(ehErroConexao(null)).toBe(false);
    });
  });
});
