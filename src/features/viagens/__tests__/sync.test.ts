import { eq } from 'drizzle-orm';

import * as local from '@/db/schema';
import { criarBancoDeTeste, type BancoDeTeste } from '@/db/testing';
import type { supabase } from '@/supabase/client';

import {
  baixarDadosDoServidor,
  ehErroConexao,
  enviarPendencias,
  ESPERA_BASE_MS,
  MAX_TENTATIVAS,
  MENSAGEM_ABERTURA_RECUSADA,
  MENSAGEM_FECHADA_NO_SERVIDOR,
  MENSAGEM_VIAGEM_SUMIU_NO_SERVIDOR,
  obterStatusOutbox,
  sincronizarViagens,
  type DependenciasSync,
} from '../sync';
import { abrirViagem, fecharViagem, MENSAGENS_ERRO_VIAGEM, setDb, type ViagensDb } from '../viagensRepository';

// O sync sempre recebe o cliente por parâmetro nos testes; o client real nem é criado.
jest.mock('@/supabase/client', () => ({ supabase: {} }));

const AGORA = '2026-10-18T10:00:00.000Z';

type ErroTeste = { code: string; message: string; details?: string };
type Resposta = { data?: unknown; error?: ErroTeste | null };

// Uma chamada ao PostgREST, registrada para o teste conferir o que subiu.
type Chamada = {
  tabela: string;
  operacao: 'upsert' | 'update' | 'select';
  valor?: unknown;
  opcoes?: unknown;
  colunas?: string;
  filtros: [string, unknown][];
};

const SEM_REDE: ErroTeste = { code: '', message: 'TypeError: Network request failed' };
const erro = (code: string): ErroTeste => ({ code, message: `detalhe ${code}` });

// Supabase falso: guarda cada chamada e pergunta ao teste o que responder, já com os filtros.
function criarSupabase(responder: (chamada: Chamada) => Resposta = () => ({})) {
  const chamadas: Chamada[] = [];

  function construtor(chamada: Chamada) {
    chamadas.push(chamada);
    const resolver = () => Promise.resolve({ data: null, error: null, ...responder(chamada) });
    const builder = {
      select: (colunas?: string) => {
        chamada.colunas ??= colunas;
        return builder;
      },
      eq: (coluna: string, valor: unknown) => {
        chamada.filtros.push([coluna, valor]);
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle: resolver,
      then: <R>(ok: (valor: Awaited<ReturnType<typeof resolver>>) => R) => resolver().then(ok),
    };
    return builder;
  }

  const getSession = jest.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } });
  const cliente = {
    auth: { getSession },
    from: (tabela: string) => ({
      upsert: (valor: unknown, opcoes: unknown) => construtor({ tabela, operacao: 'upsert', valor, opcoes, filtros: [] }),
      update: (valor: unknown) => construtor({ tabela, operacao: 'update', valor, filtros: [] }),
      select: (colunas: string) => construtor({ tabela, operacao: 'select', colunas, filtros: [] }),
    }),
  };

  return { cliente: cliente as unknown as typeof supabase, chamadas, getSession };
}

describe('sincronização de viagens', () => {
  let banco: BancoDeTeste;
  let deps: (cliente: typeof supabase) => DependenciasSync;

  function semearVeiculo(id: string, status: local.Veiculo['status'] = 'Disponivel') {
    banco.db
      .insert(local.veiculo)
      .values({
        id,
        placa: `PLC${id}`,
        marca: 'Scania',
        modelo: 'R450',
        capacidade_carga: 30,
        status,
        data_inclusao: AGORA,
        data_atualizacao: AGORA,
      })
      .run();
  }

  async function abrir(veiculo_id = 'veic-1', hodometro_inicial = 15000) {
    const resultado = await abrirViagem({ veiculo_id, rota_id: 'rota-1', motorista_id: 'mot-1', hodometro_inicial });
    if (!resultado.ok) throw new Error(resultado.mensagem);
    return resultado.data;
  }

  async function abrirEFechar(veiculo_id = 'veic-1') {
    const viagem = await abrir(veiculo_id);
    const fechada = await fecharViagem(viagem.id, { hodometro_final: 15400 });
    if (!fechada.ok) throw new Error(fechada.mensagem);
    return fechada.data;
  }

  const fila = () => banco.db.select().from(local.outbox).all();
  const viagemLocal = (id: string) => banco.db.select().from(local.viagem).where(eq(local.viagem.id, id)).get();

  beforeEach(() => {
    banco = criarBancoDeTeste();
    setDb(banco.db as unknown as ViagensDb);
    deps = (cliente) => ({ db: banco.db as unknown as ViagensDb, supabase: cliente });
    semearVeiculo('veic-1');
    semearVeiculo('veic-2');
    banco.db
      .insert(local.rota)
      .values({
        id: 'rota-1',
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
    jest.useRealTimers();
    banco.fechar();
  });

  describe('enviarPendencias', () => {
    it('sobe abertura e fechamento na ordem em que aconteceram e esvazia a fila', async () => {
      const viagem = await abrirEFechar();
      const { cliente, chamadas } = criarSupabase((chamada) =>
        chamada.operacao === 'update' ? { data: { id: viagem.id } } : {},
      );

      const resultado = await enviarPendencias(deps(cliente));

      expect(resultado).toEqual({ enviados: 2, falhas: 0, conflitos: 0, semConexao: false });
      expect(chamadas.map((chamada) => chamada.operacao)).toEqual(['upsert', 'update']);
      expect(chamadas[0]?.valor).not.toHaveProperty('km_rodado');
      expect(chamadas[1]?.valor).toEqual({ status: 'Finalizada', hodometro_final: 15400, data_fim: viagem.data_fim });
      // Mesmo filtro do fechamento online: não regrava viagem que outra pessoa já encerrou.
      expect(chamadas[1]?.filtros).toEqual([
        ['id', viagem.id],
        ['status', 'EmAndamento'],
      ]);
      expect(fila()).toHaveLength(0);
    });

    it('sobe a abertura como upsert que ignora id repetido: reenviar não duplica nem altera a viagem', async () => {
      await abrir();
      const { cliente, chamadas } = criarSupabase();

      await enviarPendencias(deps(cliente));

      expect(chamadas[0]?.opcoes).toEqual({ onConflict: 'id', ignoreDuplicates: true });
      expect(fila()).toHaveLength(0);
    });

    it('sem rede, para o lote sem gastar tentativa e mantém tudo pendente', async () => {
      await abrirEFechar();
      const { cliente, chamadas } = criarSupabase(() => ({ error: SEM_REDE }));

      const resultado = await enviarPendencias(deps(cliente));

      expect(resultado.semConexao).toBe(true);
      expect(chamadas).toHaveLength(1);
      expect(fila().map((item) => [item.situacao, item.tentativas])).toEqual([
        ['pendente', 0],
        ['pendente', 0],
      ]);
    });

    it('erro temporário agenda nova tentativa com espera e segura o fechamento da mesma viagem', async () => {
      jest.useFakeTimers({ now: new Date(AGORA) });
      const viagem = await abrirEFechar();
      const outra = await abrir('veic-2');
      const { cliente, chamadas } = criarSupabase((chamada) =>
        chamada.valor && (chamada.valor as { id?: string }).id === viagem.id ? { error: erro('57014') } : {},
      );

      const resultado = await enviarPendencias(deps(cliente));

      // A abertura da viagem 1 falhou: o fechamento dela não sobe antes; a viagem 2 segue.
      expect(chamadas.map((chamada) => [chamada.operacao, (chamada.valor as { id: string }).id])).toEqual([
        ['upsert', viagem.id],
        ['upsert', outra.id],
      ]);
      expect(resultado).toMatchObject({ enviados: 1, falhas: 0 });
      const [abertura, fechamento] = fila();
      expect(abertura).toMatchObject({
        situacao: 'pendente',
        tentativas: 1,
        proxima_tentativa_em: new Date(Date.parse(AGORA) + ESPERA_BASE_MS).toISOString(),
      });
      expect(fechamento).toMatchObject({ situacao: 'pendente', tentativas: 0 });
    });

    it('item em espera não sobe antes da hora e sobe depois dela', async () => {
      jest.useFakeTimers({ now: new Date(AGORA) });
      await abrir();
      banco.db
        .update(local.outbox)
        .set({ tentativas: 1, proxima_tentativa_em: new Date(Date.parse(AGORA) + ESPERA_BASE_MS).toISOString() })
        .run();
      const { cliente, chamadas } = criarSupabase();

      await enviarPendencias(deps(cliente));
      expect(chamadas).toHaveLength(0);

      jest.setSystemTime(Date.parse(AGORA) + ESPERA_BASE_MS);
      await enviarPendencias(deps(cliente));
      expect(chamadas).toHaveLength(1);
      expect(fila()).toHaveLength(0);
    });

    it('depois de MAX_TENTATIVAS erros temporários vira falha visível', async () => {
      await abrir();
      banco.db.update(local.outbox).set({ tentativas: MAX_TENTATIVAS - 1 }).run();
      const { cliente } = criarSupabase(() => ({ error: erro('PGRST000') }));

      const resultado = await enviarPendencias(deps(cliente));

      expect(resultado.falhas).toBe(1);
      expect(fila()[0]).toMatchObject({ situacao: 'falha', tentativas: MAX_TENTATIVAS, proxima_tentativa_em: null });
    });

    it('abertura recusada vira falha, cancela a viagem no aparelho e marca o fechamento dela', async () => {
      const viagem = await abrirEFechar();
      const { cliente, chamadas } = criarSupabase(() => ({ error: erro('VG001') }));

      const resultado = await enviarPendencias(deps(cliente));

      expect(resultado).toMatchObject({ enviados: 0, falhas: 1, conflitos: 0 });
      expect(chamadas).toHaveLength(1);
      expect(fila().map((item) => [item.operacao, item.situacao, item.ultimo_erro])).toEqual([
        ['insert', 'falha', MENSAGENS_ERRO_VIAGEM.VG001],
        ['update', 'falha', MENSAGEM_ABERTURA_RECUSADA],
      ]);
      expect(viagemLocal(viagem.id)?.status).toBe('Cancelada');
    });

    it('abertura recusada libera o veículo: depois de sincronizar, outra viagem abre nele', async () => {
      const recusada = await abrir();
      const { cliente } = criarSupabase((chamada) => {
        if (chamada.operacao === 'upsert') return { error: erro('VG004') };
        if (chamada.tabela === 'veiculo') {
          return {
            data: [
              {
                id: 'veic-1',
                placa: 'PLCveic-1',
                marca: 'Scania',
                modelo: 'R450',
                capacidade_carga: 30,
                status: 'Disponivel',
                ano_fabricacao: null,
                data_inclusao: AGORA,
                data_atualizacao: AGORA,
              },
            ],
          };
        }
        return { data: [] };
      });

      const envio = await sincronizarViagens({}, deps(cliente));

      // Disputa de hodômetro vai para revisão do gestor (critério da EIX-41).
      expect(envio).toMatchObject({ conflitos: 1 });
      expect(fila()[0]).toMatchObject({ situacao: 'conflito', ultimo_erro: MENSAGENS_ERRO_VIAGEM.VG004 });
      // A viagem recusada continua visível no aparelho (tem item na fila), mas cancelada.
      expect(viagemLocal(recusada.id)?.status).toBe('Cancelada');
      expect((await abrirViagem({ veiculo_id: 'veic-1', rota_id: 'rota-1', motorista_id: 'mot-1', hodometro_inicial: 15000 })).ok).toBe(
        true,
      );
    });

    it('reenvio de um fechamento que já tinha subido conta como enviado', async () => {
      const viagem = await abrirEFechar();
      banco.db.delete(local.outbox).where(eq(local.outbox.operacao, 'insert')).run();
      const { cliente, chamadas } = criarSupabase((chamada) =>
        chamada.operacao === 'select' ? { data: { status: 'Finalizada', hodometro_final: 15400 } } : {},
      );

      const resultado = await enviarPendencias(deps(cliente));

      expect(resultado.enviados).toBe(1);
      expect(chamadas.map((chamada) => chamada.operacao)).toEqual(['update', 'select']);
      expect(chamadas[1]?.filtros).toEqual([['id', viagem.id]]);
      expect(fila()).toHaveLength(0);
    });

    it.each([
      ['encerrada no servidor com outro hodômetro', { data: { status: 'Finalizada', hodometro_final: 15999 } }, 'conflito', MENSAGEM_FECHADA_NO_SERVIDOR],
      ['cancelada pelo gestor', { data: { status: 'Cancelada', hodometro_final: null } }, 'conflito', MENSAGEM_FECHADA_NO_SERVIDOR],
      ['que o servidor não tem (ou o RLS esconde)', { data: null }, 'falha', MENSAGEM_VIAGEM_SUMIU_NO_SERVIDOR],
    ] as const)('fechamento que não atualiza nada, de viagem %s, não some da fila', async (_caso, servidor, situacao, mensagem) => {
      await abrirEFechar();
      banco.db.delete(local.outbox).where(eq(local.outbox.operacao, 'insert')).run();
      const { cliente } = criarSupabase((chamada) => (chamada.operacao === 'select' ? servidor : {}));

      await enviarPendencias(deps(cliente));

      expect(fila()[0]).toMatchObject({ situacao, ultimo_erro: mensagem });
    });

    it('fechamento recusado por VG005 vai para revisão do gestor', async () => {
      await abrirEFechar();
      banco.db.delete(local.outbox).where(eq(local.outbox.operacao, 'insert')).run();
      const { cliente } = criarSupabase(() => ({ error: erro('VG005') }));

      const resultado = await enviarPendencias(deps(cliente));

      expect(resultado.conflitos).toBe(1);
      expect(fila()[0]).toMatchObject({ situacao: 'conflito', ultimo_erro: MENSAGENS_ERRO_VIAGEM.VG005 });
    });

    it('item corrompido vira falha e não trava os outros', async () => {
      await abrir();
      banco.db
        .insert(local.outbox)
        .values({ id: '0-corrompido', entidade: 'viagem', operacao: 'insert', payload: '{quebrado', criado_em: '2000-01-01T00:00:00.000Z' })
        .run();
      const { cliente } = criarSupabase();

      const resultado = await enviarPendencias(deps(cliente));

      expect(resultado).toMatchObject({ enviados: 1, falhas: 1 });
      expect(fila()).toEqual([expect.objectContaining({ id: '0-corrompido', situacao: 'falha' })]);
    });

    it('falhas e conflitos antigos não ocupam o lote: o pendente novo ainda sobe', async () => {
      for (let i = 0; i < 60; i++) {
        banco.db
          .insert(local.outbox)
          .values({
            id: `falha-${i}`,
            entidade: 'viagem',
            operacao: 'insert',
            payload: '{}',
            criado_em: '2000-01-01T00:00:00.000Z',
            situacao: i % 2 ? 'falha' : 'conflito',
          })
          .run();
      }
      await abrir();
      const { cliente, chamadas } = criarSupabase();

      await enviarPendencias(deps(cliente));

      expect(chamadas).toHaveLength(1);
      expect(obterStatusOutbox(banco.db as unknown as ViagensDb)).toEqual({ pendentes: 0, falhas: 30, conflitos: 30 });
    });
  });

  describe('baixarDadosDoServidor', () => {
    const veiculoServidor = (id: string, status = 'Disponivel') => ({
      id,
      placa: `PLC${id}`,
      marca: 'Volvo',
      modelo: 'FH',
      capacidade_carga: 25,
      status,
      ano_fabricacao: 2020,
      data_inclusao: AGORA,
      data_atualizacao: AGORA,
    });
    const rotaServidor = {
      id: 'rota-1',
      cidade_origem: 'Recife',
      cidade_destino: 'Salvador',
      uf_origem: 'PE',
      uf_destino: 'BA',
      distancia_estimada_km: 820,
      ativa: true,
      data_inclusao: AGORA,
      data_atualizacao: AGORA,
    };
    const viagemServidor = (id: string, extra: Record<string, unknown> = {}) => ({
      id,
      veiculo_id: 'veic-1',
      rota_id: 'rota-1',
      motorista_id: 'mot-9',
      hodometro_inicial: 20000,
      hodometro_final: 20500,
      data_inicio: AGORA,
      data_fim: AGORA,
      status: 'Finalizada',
      km_rodado: 500,
      data_inclusao: AGORA,
      data_atualizacao: AGORA,
      motorista: { id: 'mot-9', nome: 'Ana Souza' },
      ...extra,
    });

    function servidor(viagens: unknown[], veiculos = [veiculoServidor('veic-1'), veiculoServidor('veic-2')]) {
      return criarSupabase((chamada) => {
        if (chamada.tabela === 'veiculo') return { data: veiculos };
        if (chamada.tabela === 'rota') return { data: [rotaServidor] };
        return { data: viagens };
      });
    }

    it('copia veículos, rotas, viagens e o nome do motorista para o aparelho', async () => {
      const { cliente, chamadas } = servidor([viagemServidor('v-servidor')]);

      expect(await baixarDadosDoServidor(deps(cliente))).toEqual({ ok: true });

      expect(banco.db.select().from(local.veiculo).where(eq(local.veiculo.id, 'veic-1')).get()).toMatchObject({
        marca: 'Volvo',
        ano_fabricacao: 2020,
      });
      expect(banco.db.select().from(local.rota).get()?.distancia_estimada_km).toBe(820);
      expect(viagemLocal('v-servidor')).toMatchObject({ status: 'Finalizada', km_rodado: 500 });
      expect(banco.db.select().from(local.motorista).all()).toEqual([{ id: 'mot-9', nome: 'Ana Souza' }]);
      // Só o nome do motorista: o e-mail nunca vem para o aparelho.
      expect(chamadas.find((chamada) => chamada.tabela === 'viagem')?.colunas).toContain('motorista:usuario!viagem_motorista_id_fkey (id, nome)');
    });

    it('não sobrescreve a viagem com mudança pendente no aparelho', async () => {
      const viagem = await abrirEFechar();
      const { cliente } = servidor([viagemServidor(viagem.id, { status: 'EmAndamento', hodometro_final: null })]);

      await baixarDadosDoServidor(deps(cliente));

      expect(viagemLocal(viagem.id)).toMatchObject({ status: 'Finalizada', hodometro_final: 15400 });
    });

    it('servidor vence quando não há nada pendente (conflito já registrado na fila)', async () => {
      const viagem = await abrirEFechar();
      banco.db.update(local.outbox).set({ situacao: 'conflito' }).run();
      const { cliente } = servidor([viagemServidor(viagem.id, { hodometro_final: 15999, km_rodado: 999 })]);

      await baixarDadosDoServidor(deps(cliente));

      expect(viagemLocal(viagem.id)).toMatchObject({ hodometro_final: 15999, km_rodado: 999 });
    });

    it('apaga a viagem que o servidor não devolve mais, mas guarda a que tem item na fila', async () => {
      banco.db
        .insert(local.viagem)
        .values({
          id: 'v-de-outro-usuario',
          veiculo_id: 'veic-1',
          rota_id: 'rota-1',
          motorista_id: 'mot-outro',
          hodometro_inicial: 1,
          hodometro_final: 2,
          status: 'Finalizada',
          data_inclusao: AGORA,
          data_atualizacao: AGORA,
        })
        .run();
      const recusada = await abrir('veic-2');
      banco.db.update(local.outbox).set({ situacao: 'falha' }).run();
      const { cliente } = servidor([]);

      await baixarDadosDoServidor(deps(cliente));

      expect(viagemLocal('v-de-outro-usuario')).toBeUndefined();
      expect(viagemLocal(recusada.id)).toBeDefined();
    });

    it('mantém ocupado o veículo da viagem aberta no aparelho que ainda não subiu', async () => {
      await abrir();
      const { cliente } = servidor([]);

      await baixarDadosDoServidor(deps(cliente));

      expect(banco.db.select().from(local.veiculo).where(eq(local.veiculo.id, 'veic-1')).get()?.status).toBe('EmViagem');
      expect(banco.db.select().from(local.veiculo).where(eq(local.veiculo.id, 'veic-2')).get()?.status).toBe('Disponivel');
    });

    it('sem rede, não mexe no que o aparelho já tem', async () => {
      const viagem = await abrir();
      const { cliente } = criarSupabase(() => ({ error: SEM_REDE }));

      expect(await baixarDadosDoServidor(deps(cliente))).toMatchObject({ ok: false, semConexao: true });
      expect(viagemLocal(viagem.id)).toBeDefined();
    });
  });

  describe('sincronizarViagens', () => {
    it('sem sessão não envia nada: o RLS recusaria tudo e os itens virariam falha', async () => {
      await abrir();
      const { cliente, chamadas, getSession } = criarSupabase();
      getSession.mockResolvedValue({ data: { session: null } });

      expect(await sincronizarViagens({}, deps(cliente))).toBeNull();
      expect(chamadas).toHaveLength(0);
      expect(fila()[0]?.situacao).toBe('pendente');
    });

    it('envia e depois baixa; com baixar: false, só envia', async () => {
      await abrir();
      const { cliente, chamadas } = criarSupabase((chamada) => (chamada.operacao === 'select' ? { data: [] } : {}));

      await sincronizarViagens({ baixar: false }, deps(cliente));
      expect(chamadas.map((chamada) => chamada.tabela)).toEqual(['viagem']);

      await sincronizarViagens({}, deps(cliente));
      expect(chamadas.map((chamada) => chamada.tabela)).toEqual(['viagem', 'veiculo', 'rota', 'viagem']);
    });

    it('não tenta baixar se a rede caiu durante o envio', async () => {
      await abrir();
      const { cliente, chamadas } = criarSupabase(() => ({ error: SEM_REDE }));

      expect(await sincronizarViagens({}, deps(cliente))).toMatchObject({ semConexao: true });
      expect(chamadas).toHaveLength(1);
    });
  });

  it('ehErroConexao separa a rede caída (sem código) do erro que o servidor respondeu', () => {
    expect(ehErroConexao(SEM_REDE)).toBe(true);
    expect(ehErroConexao(erro('VG001'))).toBe(false);
    expect(ehErroConexao(erro('PGRST301'))).toBe(false);
  });
});
