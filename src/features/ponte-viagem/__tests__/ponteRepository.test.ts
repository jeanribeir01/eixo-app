import { MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';

import {
  buscarViagemVinculavel,
  descricaoViagem,
  desvincularLancamento,
  listarLancamentosDaViagem,
  listarViagensVinculaveis,
  rotuloViagem,
  type ViagemVinculavel,
} from '../ponteRepository';

type Resposta = { data: unknown; error: { code: string; message: string } | null };

const METODOS = ['select', 'update', 'eq', 'order'] as const;
type Metodo = (typeof METODOS)[number];
type Builder = Record<Metodo, jest.Mock> & PromiseLike<Resposta>;

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

function responderFrom(resposta: Resposta): Builder {
  const metodos = {} as Record<Metodo, jest.Mock>;
  const builder: Builder = Object.assign(metodos, {
    then: <R1, R2>(
      onFulfilled?: ((valor: Resposta) => R1 | PromiseLike<R1>) | null,
      onRejected?: ((motivo: unknown) => R2 | PromiseLike<R2>) | null,
    ) => Promise.resolve(resposta).then(onFulfilled, onRejected),
  });
  for (const metodo of METODOS) metodos[metodo] = jest.fn(() => builder);
  mockFrom.mockReturnValueOnce(builder);
  return builder;
}

const ok = (data: unknown): Resposta => ({ data, error: null });
const erro = (code: string): Resposta => ({ data: null, error: { code, message: `detalhe técnico ${code}` } });

function viagem(sobrescrever: Partial<ViagemVinculavel> = {}): ViagemVinculavel {
  return {
    id: 'v-1',
    placa: 'ABC1D23',
    cidade_origem: 'São Paulo',
    uf_origem: 'SP',
    cidade_destino: 'Curitiba',
    uf_destino: 'PR',
    status: 'EmAndamento',
    data_inicio: '2026-11-09T13:00:00+00:00',
    data_fim: null,
    ...sobrescrever,
  };
}

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
});

describe('rotuloViagem', () => {
  // PONTE-02
  it('monta "PLACA · Origem/UF → Destino/UF"', () => {
    expect(rotuloViagem(viagem())).toBe('ABC1D23 · São Paulo/SP → Curitiba/PR');
  });
});

describe('descricaoViagem', () => {
  it('mostra o status em português e o dia de início no fuso local', () => {
    expect(descricaoViagem(viagem({ status: 'Finalizada' }))).toBe('Concluída · início 09/11/2026');
  });

  // Lição L-001: 01h de 10/11 em UTC ainda é 09/11 em São Paulo (o jest roda nesse fuso).
  it('usa o dia local, não o de UTC, perto da meia-noite', () => {
    expect(descricaoViagem(viagem({ data_inicio: '2026-11-10T01:30:00+00:00' }))).toBe('Em andamento · início 09/11/2026');
  });

  it('sem data de início mostra só o status', () => {
    expect(descricaoViagem(viagem({ data_inicio: null }))).toBe('Em andamento');
  });
});

describe('listarViagensVinculaveis', () => {
  // ACESSO-01, PONTE-02
  it('chama a RPC e devolve as viagens na ordem recebida', async () => {
    const linhas = [viagem(), viagem({ id: 'v-2', status: 'Finalizada', data_fim: '2026-11-05T10:00:00+00:00' })];
    mockRpc.mockResolvedValueOnce(ok(linhas));

    const resultado = await listarViagensVinculaveis();

    expect(mockRpc).toHaveBeenCalledWith('listar_viagens_vinculaveis');
    expect(resultado).toEqual({ ok: true, data: linhas });
  });

  // ACESSO-03 visto pelo app
  it('42501 vira a mensagem de acesso negado', async () => {
    mockRpc.mockResolvedValueOnce(erro('42501'));

    expect(await listarViagensVinculaveis()).toEqual({ ok: false, mensagem: MENSAGEM_ACESSO_NEGADO });
  });

  // PONTE-09
  it('outro erro vira mensagem em português, sem o texto técnico', async () => {
    mockRpc.mockResolvedValueOnce(erro('XX000'));

    expect(await listarViagensVinculaveis()).toEqual({
      ok: false,
      mensagem: 'Não foi possível carregar as viagens. Tente novamente.',
    });
  });

  it('resposta fora do formato vira erro de dados inválidos', async () => {
    mockRpc.mockResolvedValueOnce(ok([{ id: 'v-1' }]));

    expect(await listarViagensVinculaveis()).toEqual({
      ok: false,
      mensagem: 'Os dados recebidos são inválidos. Tente novamente.',
    });
  });
});

describe('buscarViagemVinculavel', () => {
  // ACESSO-02, PONTE-07
  it('chama a RPC com o id e devolve a viagem', async () => {
    mockRpc.mockResolvedValueOnce(ok([viagem({ id: 'v-9', status: 'Cancelada' })]));

    const resultado = await buscarViagemVinculavel('v-9');

    expect(mockRpc).toHaveBeenCalledWith('buscar_viagem_vinculavel', { p_viagem_id: 'v-9' });
    expect(resultado).toEqual({ ok: true, data: viagem({ id: 'v-9', status: 'Cancelada' }) });
  });

  it('zero linhas vira "Viagem não encontrada."', async () => {
    mockRpc.mockResolvedValueOnce(ok([]));

    expect(await buscarViagemVinculavel('v-x')).toEqual({ ok: false, mensagem: 'Viagem não encontrada.' });
  });

  it('42501 vira a mensagem de acesso negado', async () => {
    mockRpc.mockResolvedValueOnce(erro('42501'));

    expect(await buscarViagemVinculavel('v-1')).toEqual({ ok: false, mensagem: MENSAGEM_ACESSO_NEGADO });
  });
});

describe('listarLancamentosDaViagem', () => {
  // DETALHE-03
  it('filtra por viagem_id e devolve o valor em centavos', async () => {
    const builder = responderFrom(
      ok([
        { id: 'm-1', valor: 8500, descricao: 'Frete', litros: null, categoria: { titulo: 'Frete', tipo: 'Entrada' } },
        // 1,13 não é exato em ponto flutuante (lição L-005).
        { id: 'm-2', valor: 1.13, descricao: 'Diesel', litros: 412.37, categoria: { titulo: 'Combustível', tipo: 'Saida' } },
      ]),
    );

    const resultado = await listarLancamentosDaViagem('v-1');

    expect(mockFrom).toHaveBeenCalledWith('movimentacao');
    expect(builder.eq).toHaveBeenCalledWith('viagem_id', 'v-1');
    expect(resultado).toEqual({
      ok: true,
      data: [
        { id: 'm-1', valorCentavos: 850000, descricao: 'Frete', litros: null, categoria: { titulo: 'Frete', tipo: 'Entrada' } },
        { id: 'm-2', valorCentavos: 113, descricao: 'Diesel', litros: 412.37, categoria: { titulo: 'Combustível', tipo: 'Saida' } },
      ],
    });
  });

  // DETALHE-07
  it('erro vira mensagem em português', async () => {
    responderFrom(erro('XX000'));

    expect(await listarLancamentosDaViagem('v-1')).toEqual({
      ok: false,
      mensagem: 'Não foi possível carregar os lançamentos. Tente novamente.',
    });
  });
});

describe('desvincularLancamento', () => {
  // DETALHE-04, PONTE-05: só tira o viagem_id, sem delete.
  it('grava viagem_id = null só naquele lançamento', async () => {
    const builder = responderFrom(ok([{ id: 'm-1' }]));

    const resultado = await desvincularLancamento('m-1');

    expect(builder.update).toHaveBeenCalledWith({ viagem_id: null });
    expect(builder.eq).toHaveBeenCalledWith('id', 'm-1');
    expect(resultado).toEqual({ ok: true, data: 'm-1' });
  });

  // DETALHE-05
  it('erro do banco vira "Não foi possível desvincular. Tente novamente."', async () => {
    responderFrom(erro('XX000'));

    expect(await desvincularLancamento('m-1')).toEqual({
      ok: false,
      mensagem: 'Não foi possível desvincular. Tente novamente.',
    });
  });

  // DETALHE-05: update barrado pelo RLS volta sem erro e com 0 linhas.
  it('zero linhas atualizadas também é falha', async () => {
    responderFrom(ok([]));

    expect(await desvincularLancamento('m-1')).toEqual({
      ok: false,
      mensagem: 'Não foi possível desvincular. Tente novamente.',
    });
  });
});
