import { eq } from 'drizzle-orm';

import * as schema from '@/db/schema';
import { criarBancoDeTeste, type BancoDeTeste } from '@/db/testing';
import { definirUsuarioLocal, obterGeracaoLocal } from '../sessaoLocal';
import { baixarViagens } from '../syncPull';
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
const OUTBOX_ID_2 = '00000000-0000-7000-8000-000000000006';
const USUARIO_ID = 'usuario-a';
const OUTRO_USUARIO_ID = 'usuario-b';

type RespostaSupabase = { data: unknown; error: { code?: string; message?: string } | null };

function viagemServidor(overrides: Record<string, unknown> = {}) {
  return {
    id: VIAGEM_ID,
    veiculo_id: VEICULO_ID,
    rota_id: ROTA_ID,
    motorista_id: MOTORISTA_ID,
    hodometro_inicial: 10000,
    hodometro_final: null,
    data_inicio: AGORA,
    data_fim: null,
    status: 'EmAndamento',
    km_rodado: null,
    data_inclusao: AGORA,
    data_atualizacao: AGORA,
    ...overrides,
  };
}

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

    banco.db
      .insert(schema.usuarioCache)
      .values({
        id: MOTORISTA_ID,
        nome: 'Carlos da Silva',
        email: 'carlos@transportadora.com',
        status: 'Ativo',
        perfil: 'Motorista',
        data_atualizacao: AGORA,
      })
      .run();
  });

  afterEach(() => {
    definirUsuarioLocal(null);
    banco.fechar();
  });

  function criarMockSupabase(opcoes: {
    upsertResultado?: RespostaSupabase;
    updateResultado?: RespostaSupabase;
    selectResultado?: RespostaSupabase;
    revisaoResultado?: { error: { code?: string; message?: string } | null };
  } = {}) {
    const mockUpsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        maybeSingle: jest
          .fn()
          .mockResolvedValue(opcoes.upsertResultado ?? { data: null, error: null }),
      }),
    });

    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          maybeSingle: jest
            .fn()
            .mockResolvedValue(opcoes.updateResultado ?? { data: null, error: null }),
        }),
      }),
    });

    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest
          .fn()
          .mockResolvedValue(opcoes.selectResultado ?? { data: null, error: null }),
      }),
    });

    const mockUpsertRevisao = jest
      .fn()
      .mockResolvedValue(opcoes.revisaoResultado ?? { error: null });

    const client = {
      from: jest.fn((tabela: string) => {
        if (tabela === 'viagem') {
          return { upsert: mockUpsert, update: mockUpdate, select: mockSelect };
        }
        if (tabela === 'viagem_revisao') {
          return { upsert: mockUpsertRevisao };
        }
        throw new Error(`Tabela inesperada: ${tabela}`);
      }),
    };

    return { client, mockUpsert, mockUpdate, mockSelect, mockUpsertRevisao };
  }

  function inserirViagemLocal(overrides: Partial<typeof schema.viagem.$inferInsert> = {}) {
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
        ...overrides,
      })
      .run();
  }

  function inserirOutbox(
    overrides: Partial<typeof schema.outbox.$inferInsert> = {},
    id = OUTBOX_ID,
  ) {
    banco.db
      .insert(schema.outbox)
      .values({
        id,
        usuario_id: USUARIO_ID,
        entidade: 'viagem',
        operacao: 'insert',
        payload: JSON.stringify({ id: VIAGEM_ID }),
        tentativas: 0,
        criado_em: AGORA,
        ...overrides,
      })
      .run();
  }

  it('retorna resultado zerado quando não há itens na outbox do usuário', async () => {
    const { client } = criarMockSupabase({});
    const resultado = await drenarOutboxViagens(
      { usuarioId: USUARIO_ID },
      { db: banco.db as unknown as ViagensDb, supabase: client as never },
    );

    expect(resultado).toEqual({
      total: 0,
      sincronizados: 0,
      falhas: 0,
      conflitos: 0,
      semConexao: false,
      itens: [],
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('drena insert com sucesso, remove da outbox e atualiza km_rodado do servidor', async () => {
    inserirViagemLocal();
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
    inserirOutbox({ payload: JSON.stringify(payloadLocal) });

    const { client, mockUpsert } = criarMockSupabase({
      upsertResultado: { data: viagemServidor(), error: null },
    });

    const resultado = await drenarOutboxViagens(
      { usuarioId: USUARIO_ID },
      { db: banco.db as unknown as ViagensDb, supabase: client as never },
    );

    expect(resultado.total).toBe(1);
    expect(resultado.sincronizados).toBe(1);
    expect(resultado.falhas).toBe(0);
    expect(resultado.conflitos).toBe(0);
    expect(resultado.semConexao).toBe(false);

    expect(mockUpsert).toHaveBeenCalled();
    const payloadEnviado = mockUpsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payloadEnviado.km_rodado).toBeUndefined();
    expect('km_rodado' in payloadEnviado).toBe(false);

    expect(banco.db.select().from(schema.outbox).all()).toHaveLength(0);
  });

  it('drena update de fechamento, remove da outbox e atualiza km_rodado local', async () => {
    inserirViagemLocal({
      hodometro_final: 10400,
      status: 'Finalizada',
      km_rodado: 400,
    });
    inserirOutbox({
      operacao: 'update',
      payload: JSON.stringify({
        id: VIAGEM_ID,
        status: 'Finalizada',
        hodometro_final: 10400,
        data_fim: '2026-10-18T18:00:00.000Z',
        data_atualizacao: AGORA,
      }),
    });

    const { client, mockUpdate } = criarMockSupabase({
      updateResultado: {
        data: viagemServidor({
          status: 'Finalizada',
          hodometro_final: 10400,
          km_rodado: 400,
          data_fim: '2026-10-18T18:00:00.000Z',
          data_atualizacao: '2026-10-18T18:00:05.000Z',
        }),
        error: null,
      },
    });

    const resultado = await drenarOutboxViagens(
      { usuarioId: USUARIO_ID },
      { db: banco.db as unknown as ViagensDb, supabase: client as never },
    );

    expect(resultado.sincronizados).toBe(1);
    expect(mockUpdate).toHaveBeenCalled();

    const payloadEnviado = mockUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payloadEnviado.km_rodado).toBeUndefined();
    expect('km_rodado' in payloadEnviado).toBe(false);
    expect(banco.db.select().from(schema.outbox).all()).toHaveLength(0);

    const viagemLocal = banco.db
      .select()
      .from(schema.viagem)
      .where(eq(schema.viagem.id, VIAGEM_ID))
      .get();
    expect(viagemLocal?.km_rodado).toBe(400);
    expect(viagemLocal?.em_revisao).toBe(false);
  });

  it('em erro de conexão, usa backoff sem gastar tentativa e interrompe a fila', async () => {
    inserirOutbox();

    const { client } = criarMockSupabase({
      upsertResultado: {
        data: null,
        error: { code: 'ECONNREFUSED', message: 'Failed to fetch network request' },
      },
    });

    const resultado = await drenarOutboxViagens(
      { usuarioId: USUARIO_ID, agora: new Date(AGORA) },
      { db: banco.db as unknown as ViagensDb, supabase: client as never },
    );

    expect(resultado.sincronizados).toBe(0);
    expect(resultado.falhas).toBe(1);
    expect(resultado.semConexao).toBe(true);

    const item = banco.db.select().from(schema.outbox).where(eq(schema.outbox.id, OUTBOX_ID)).get();
    expect(item?.status).toBe('pendente');
    expect(item?.tentativas).toBe(0);
    expect(item?.codigo_erro).toBe('CONEXAO');
    expect(item?.proxima_tentativa_em).not.toBeNull();
    expect(item?.ultimo_erro).toContain('Sem conexão');
  });

  it('em erro de negócio desconhecido, incrementa tentativa e agenda nova tentativa', async () => {
    inserirOutbox();

    const { client } = criarMockSupabase({
      upsertResultado: {
        data: null,
        error: { code: 'XX000', message: 'Falha interna inesperada.' },
      },
    });

    const resultado = await drenarOutboxViagens(
      { usuarioId: USUARIO_ID, agora: new Date(AGORA) },
      { db: banco.db as unknown as ViagensDb, supabase: client as never },
    );

    expect(resultado.falhas).toBe(1);
    expect(resultado.conflitos).toBe(0);

    const item = banco.db.select().from(schema.outbox).where(eq(schema.outbox.id, OUTBOX_ID)).get();
    expect(item?.status).toBe('pendente');
    expect(item?.tentativas).toBe(1);
    expect(item?.codigo_erro).toBe('XX000');
    expect(item?.proxima_tentativa_em).not.toBeNull();
  });

  it('em conflito VG005, aplica a versão do servidor e leva a operação para revisão', async () => {
    inserirViagemLocal();
    inserirOutbox({
      operacao: 'update',
      payload: JSON.stringify({ id: VIAGEM_ID, status: 'Finalizada', hodometro_final: 10400 }),
    });

    const servidor = viagemServidor({
      status: 'Finalizada',
      hodometro_final: 10450,
      km_rodado: 450,
      data_fim: '2026-10-18T18:00:00.000Z',
      data_atualizacao: '2026-10-18T18:00:05.000Z',
    });
    const { client, mockUpsertRevisao } = criarMockSupabase({
      updateResultado: {
        data: null,
        error: { code: 'VG005', message: 'Viagem encerrada não pode ser alterada.' },
      },
      selectResultado: { data: servidor, error: null },
    });

    const resultado = await drenarOutboxViagens(
      { usuarioId: USUARIO_ID },
      { db: banco.db as unknown as ViagensDb, supabase: client as never },
    );

    expect(resultado.conflitos).toBe(1);
    expect(resultado.itens[0]?.status).toBe('conflito');
    expect(resultado.itens[0]?.codigo).toBe('VG005');

    const revisao = mockUpsertRevisao.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(mockUpsertRevisao.mock.calls[0]?.[1]).toEqual({
      onConflict: 'id',
      ignoreDuplicates: true,
    });
    expect(revisao).toMatchObject({
      id: OUTBOX_ID,
      viagem_id: VIAGEM_ID,
      solicitante_id: USUARIO_ID,
      codigo: 'VG005',
      status: 'Pendente',
    });
    expect(revisao.motorista_nome).toBe('Carlos da Silva');
    expect(revisao.veiculo_placa).toBe('ABC1D23');

    const item = banco.db.select().from(schema.outbox).where(eq(schema.outbox.id, OUTBOX_ID)).get();
    expect(item?.status).toBe('revisao');
    expect(item?.codigo_erro).toBe('VG005');

    const viagemLocal = banco.db
      .select()
      .from(schema.viagem)
      .where(eq(schema.viagem.id, VIAGEM_ID))
      .get();
    expect(viagemLocal?.status).toBe('Finalizada');
    expect(viagemLocal?.hodometro_final).toBe(10450);
    expect(viagemLocal?.em_revisao).toBe(true);
  });

  it('em zero linhas no update, preserva o dado local e abre revisão VIAGEM_AUSENTE', async () => {
    inserirViagemLocal();
    inserirOutbox({
      operacao: 'update',
      payload: JSON.stringify({ id: VIAGEM_ID, status: 'Finalizada', hodometro_final: 10400 }),
    });

    const { client, mockUpsertRevisao } = criarMockSupabase({
      updateResultado: { data: null, error: null },
      selectResultado: { data: null, error: null },
    });

    const resultado = await drenarOutboxViagens(
      { usuarioId: USUARIO_ID },
      { db: banco.db as unknown as ViagensDb, supabase: client as never },
    );

    expect(resultado.conflitos).toBe(1);
    expect(resultado.itens[0]?.codigo).toBe('VIAGEM_AUSENTE');
    expect(mockUpsertRevisao).toHaveBeenCalledTimes(1);

    const item = banco.db.select().from(schema.outbox).where(eq(schema.outbox.id, OUTBOX_ID)).get();
    expect(item?.status).toBe('revisao');
    expect(item?.codigo_erro).toBe('VIAGEM_AUSENTE');

    const viagemLocal = banco.db
      .select()
      .from(schema.viagem)
      .where(eq(schema.viagem.id, VIAGEM_ID))
      .get();
    expect(viagemLocal?.status).toBe('EmAndamento');
    expect(viagemLocal?.em_revisao).toBe(true);
  });

  it('encaminha para revisão quando o item atinge o limite de tentativas', async () => {
    inserirOutbox({ tentativas: 5 });

    const { client, mockUpsertRevisao } = criarMockSupabase({});
    const resultado = await drenarOutboxViagens(
      { usuarioId: USUARIO_ID, maxTentativas: 5 },
      { db: banco.db as unknown as ViagensDb, supabase: client as never },
    );

    expect(resultado.conflitos).toBe(1);
    expect(resultado.itens[0]?.codigo).toBe('MAX_TENTATIVAS');
    expect(mockUpsertRevisao).toHaveBeenCalledTimes(1);

    const item = banco.db.select().from(schema.outbox).where(eq(schema.outbox.id, OUTBOX_ID)).get();
    expect(item?.status).toBe('revisao');
    expect(item?.codigo_erro).toBe('MAX_TENTATIVAS');
  });

  it('encaminha payload sem id para revisão sem apagar a outbox', async () => {
    inserirOutbox({ payload: JSON.stringify({}) });

    const { client, mockUpsertRevisao } = criarMockSupabase({});
    const resultado = await drenarOutboxViagens(
      { usuarioId: USUARIO_ID },
      { db: banco.db as unknown as ViagensDb, supabase: client as never },
    );

    expect(resultado.conflitos).toBe(1);
    expect(resultado.itens[0]?.codigo).toBe('PAYLOAD_SEM_ID');
    expect(mockUpsertRevisao).toHaveBeenCalledTimes(1);

    const item = banco.db.select().from(schema.outbox).where(eq(schema.outbox.id, OUTBOX_ID)).get();
    expect(item?.status).toBe('revisao');
  });

  it('respeita o dono da outbox e não drena a fila de outra conta', async () => {
    inserirOutbox({ usuario_id: OUTRO_USUARIO_ID }, OUTBOX_ID_2);
    inserirOutbox({}, OUTBOX_ID);

    const { client } = criarMockSupabase({
      upsertResultado: { data: viagemServidor(), error: null },
    });

    const resultado = await drenarOutboxViagens(
      { usuarioId: USUARIO_ID },
      { db: banco.db as unknown as ViagensDb, supabase: client as never },
    );

    expect(resultado.total).toBe(1);
    expect(banco.db.select().from(schema.outbox).all()).toHaveLength(1);
    expect(banco.db.select().from(schema.outbox).get()?.usuario_id).toBe(OUTRO_USUARIO_ID);
  });

  it('não tenta item com backoff ainda no futuro', async () => {
    inserirOutbox({ proxima_tentativa_em: '2026-10-18T10:05:00.000Z' });

    const { client } = criarMockSupabase({});
    const resultado = await drenarOutboxViagens(
      { usuarioId: USUARIO_ID, agora: new Date(AGORA) },
      { db: banco.db as unknown as ViagensDb, supabase: client as never },
    );

    expect(resultado.total).toBe(0);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('descarta a resposta quando a conta muda durante o envio e preserva a outbox', async () => {
    definirUsuarioLocal(USUARIO_ID);
    inserirViagemLocal();
    inserirOutbox({
      operacao: 'update',
      payload: JSON.stringify({ id: VIAGEM_ID, status: 'Finalizada', hodometro_final: 10400 }),
    });

    let liberarResposta: ((resposta: RespostaSupabase) => void) | undefined;
    const resposta = new Promise<RespostaSupabase>((resolve) => {
      liberarResposta = resolve;
    });
    const maybeSingle = jest.fn().mockReturnValue(resposta);
    const client = {
      from: jest.fn(() => ({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({ maybeSingle })),
          })),
        })),
      })),
    };

    const promessa = drenarOutboxViagens(
      { usuarioId: USUARIO_ID },
      { db: banco.db as unknown as ViagensDb, supabase: client as never },
    );

    // A requisição já está em voo quando a conta muda (logout/troca de usuário).
    definirUsuarioLocal(OUTRO_USUARIO_ID);
    liberarResposta?.({
      data: viagemServidor({
        status: 'Finalizada',
        hodometro_final: 10450,
        data_fim: '2026-10-18T18:00:00.000Z',
        data_atualizacao: '2026-10-18T18:00:05.000Z',
      }),
      error: null,
    });

    const resultado = await promessa;

    expect(resultado.sessaoAlterada).toBe(true);
    expect(resultado.sincronizados).toBe(0);

    const item = banco.db.select().from(schema.outbox).where(eq(schema.outbox.id, OUTBOX_ID)).get();
    expect(item?.status).toBe('pendente');

    const viagem = banco.db.select().from(schema.viagem).where(eq(schema.viagem.id, VIAGEM_ID)).get();
    expect(viagem?.status).toBe('EmAndamento');
    expect(viagem?.hodometro_final).toBeNull();
  });

  it('não grava a página de viagens que chega depois da troca de conta', async () => {
    definirUsuarioLocal(USUARIO_ID);
    const geracaoLocal = obterGeracaoLocal();

    let liberarPagina: ((pagina: RespostaSupabase) => void) | undefined;
    const pagina = new Promise<RespostaSupabase>((resolve) => {
      liberarPagina = resolve;
    });
    const range = jest.fn().mockReturnValue(pagina);
    const client = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            order: jest.fn(() => ({ range })),
          })),
        })),
      })),
    };

    const promessa = baixarViagens({
      db: banco.db as unknown as ViagensDb,
      supabase: client as never,
      usuarioId: USUARIO_ID,
      geracaoLocal,
    });

    definirUsuarioLocal(OUTRO_USUARIO_ID);
    liberarPagina?.({ data: [viagemServidor()], error: null });

    const resultado = await promessa;

    expect(resultado).toMatchObject({ ok: false, sessaoAlterada: true });
    expect(banco.db.select().from(schema.viagem).all()).toHaveLength(0);
  });

  it('obterStatusOutboxViagens separa pendentes, erros não-rede e revisão, por dono', () => {
    inserirOutbox({}, 'item-1');
    inserirOutbox(
      {
        id: 'item-2',
        ultimo_erro: 'Sem conexão',
        codigo_erro: 'CONEXAO',
        proxima_tentativa_em: '2026-10-18T10:00:05.000Z',
      },
      'item-2',
    );
    inserirOutbox(
      {
        id: 'item-3',
        tentativas: 1,
        ultimo_erro: 'Falha desconhecida',
        codigo_erro: 'XX000',
      },
      'item-3',
    );
    inserirOutbox(
      {
        id: 'item-4',
        status: 'revisao',
        ultimo_erro: 'Conflito (VG005)',
        codigo_erro: 'VG005',
      },
      'item-4',
    );
    inserirOutbox(
      {
        id: 'item-5',
        usuario_id: OUTRO_USUARIO_ID,
        ultimo_erro: 'Falha de outra conta',
        codigo_erro: 'XX000',
      },
      'item-5',
    );

    const status = obterStatusOutboxViagens(banco.db as unknown as ViagensDb, USUARIO_ID);

    expect(status).toEqual({
      pendentes: 3,
      comErro: 1,
      conflitos: 1,
      emRevisao: 1,
    });
  });

  describe('sincronizarSeConectado', () => {
    it('não sincroniza se o aparelho estiver offline', async () => {
      const mockNetwork = {
        getNetworkStateAsync: jest.fn().mockResolvedValue({
          isConnected: false,
          isInternetReachable: false,
        }),
      };

      const { client } = criarMockSupabase({});
      const resultado = await sincronizarSeConectado(USUARIO_ID, {
        db: banco.db as unknown as ViagensDb,
        supabase: client as never,
        network: mockNetwork as never,
      });

      expect(resultado).toBeNull();
      expect(client.from).not.toHaveBeenCalled();
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
