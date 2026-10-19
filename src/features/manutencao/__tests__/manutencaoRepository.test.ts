import {
  buscarVeiculoComHistorico,
  concluirManutencao,
  listarFormasPagamentoAtivas,
  listarManutencoes,
  listarVeiculosSelecionaveis,
  registrarManutencao,
} from '../manutencaoRepository';
import type { ManutencaoInput } from '../schema';

// Nenhum teste chama o banco real: o client é trocado por um query builder falso. Cada chamada a
// `supabase.from()` consome a próxima resposta da fila e devolve um builder que registra os métodos
// chamados; `supabase.rpc()` devolve a resposta da sua própria fila.
type Resposta = { data: unknown; error: { code: string; message: string } | null };

const METODOS = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'order', 'limit', 'single', 'maybeSingle'] as const;
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

function criarBuilder(resposta: Resposta): Builder {
  const metodos = {} as Record<Metodo, jest.Mock>;
  const builder: Builder = Object.assign(metodos, {
    // A query do supabase-js é "thenable": `await` direto no builder devolve a resposta.
    then: <R1, R2>(
      onFulfilled?: ((valor: Resposta) => R1 | PromiseLike<R1>) | null,
      onRejected?: ((motivo: unknown) => R2 | PromiseLike<R2>) | null,
    ) => Promise.resolve(resposta).then(onFulfilled, onRejected),
  });
  for (const metodo of METODOS) {
    metodos[metodo] =
      metodo === 'single' || metodo === 'maybeSingle'
        ? jest.fn(() => Promise.resolve(resposta))
        : jest.fn(() => builder);
  }
  return builder;
}

// Enfileira as respostas na ordem das chamadas a `from()` e devolve os builders para asserção.
function responder(...respostas: Resposta[]): Builder[] {
  const builders = respostas.map(criarBuilder);
  const fila = [...builders];
  mockFrom.mockImplementation(() => {
    const proximo = fila.shift();
    if (!proximo) throw new Error('from() chamado mais vezes que o esperado');
    return proximo;
  });
  return builders;
}

const ok = (data: unknown): Resposta => ({ data, error: null });
const erro = (code: string): Resposta => ({ data: null, error: { code, message: `detalhe técnico ${code}` } });

const MENSAGEM_ACESSO_NEGADO = 'Acesso negado. Seu perfil não tem permissão para esta ação.';
const MENSAGEM_DADOS_INVALIDOS = 'Os dados recebidos são inválidos. Tente novamente.';

const input: ManutencaoInput = {
  veiculoId: 'v1',
  dataManutencao: '2026-10-18',
  descricao: 'Troca de pneus',
  valorCentavos: 113,
  formaPagamentoId: 'f1',
  statusPagamento: 'Pago',
};

// Linhas como o PostgREST devolve: valor `numeric` em reais.
const linha = (
  id: string,
  data_manutencao: string,
  data_conclusao: string | null,
  extra: Record<string, unknown> = {},
) => ({
  id,
  veiculo_id: 'v1',
  descricao: `Serviço ${id}`,
  data_manutencao,
  valor: 1.13,
  data_conclusao,
  ...extra,
});

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
});

describe('registrarManutencao', () => {
  // MAN-05, MAN-16, MAN-41
  it('chama registrar_manutencao com o valor em reais e não escreve direto em nenhuma tabela', async () => {
    mockRpc.mockResolvedValue(ok('m1'));

    const resultado = await registrarManutencao(input);

    expect(resultado).toEqual({ ok: true, data: 'm1' });
    expect(mockRpc).toHaveBeenCalledWith('registrar_manutencao', {
      veiculo_id: 'v1',
      descricao: 'Troca de pneus',
      data_manutencao: '2026-10-18',
      // 113 centavos viram exatamente 1.13, sem resíduo de ponto flutuante (L-005).
      valor: 1.13,
      forma_pagamento_id: 'f1',
      status_pagamento: 'Pago',
    });
    // A transação (manutenção + despesa + status) é da RPC: o app não toca nas tabelas.
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it.each([
    // MAN-13
    ['MN001', 'Veículo em viagem não pode entrar em manutenção. Feche a viagem antes.'],
    // MAN-14
    ['22023', 'Forma de pagamento inativa. Escolha outra.'],
    // MAN-39
    ['MN002', 'Veículo inativo não pode receber manutenção.'],
    ['MN003', 'A categoria Manutenção está inativa. Peça ao Financeiro para reativá-la.'],
    ['P0002', 'Veículo não encontrado.'],
    ['23514', 'Confira o valor e a data da manutenção.'],
    ['42501', MENSAGEM_ACESSO_NEGADO],
    ['XX000', 'Não foi possível registrar a manutenção. Tente novamente.'],
  ])('traduz o erro %s sem o texto do Postgres', async (code, mensagem) => {
    mockRpc.mockResolvedValue(erro(code));

    expect(await registrarManutencao(input)).toEqual({ ok: false, mensagem });
  });

  it('resposta que não é o id da manutenção é rejeitada pelo Zod', async () => {
    mockRpc.mockResolvedValue(ok(null));

    expect(await registrarManutencao(input)).toEqual({ ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS });
  });
});

describe('concluirManutencao', () => {
  // MAN-20, MAN-21: o status final do veículo decide qual Snackbar a tela mostra.
  it.each(['Disponivel', 'EmManutencao'])('chama concluir_manutencao e devolve o status final %s', async (status) => {
    mockRpc.mockResolvedValue(ok(status));

    expect(await concluirManutencao('m1')).toEqual({ ok: true, data: status });
    expect(mockRpc).toHaveBeenCalledWith('concluir_manutencao', { id: 'm1' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it.each([
    ['P0002', 'Manutenção não encontrada ou já concluída.'],
    ['42501', MENSAGEM_ACESSO_NEGADO],
    ['XX000', 'Não foi possível concluir a manutenção. Tente novamente.'],
  ])('traduz o erro %s', async (code, mensagem) => {
    mockRpc.mockResolvedValue(erro(code));

    expect(await concluirManutencao('m1')).toEqual({ ok: false, mensagem });
  });

  it('status fora do enum é rejeitado pelo Zod', async () => {
    mockRpc.mockResolvedValue(ok('Quebrado'));

    expect(await concluirManutencao('m1')).toEqual({ ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS });
  });
});

describe('listarManutencoes', () => {
  // MAN-18: abertas primeiro; em cada grupo, da data da manutenção mais recente para a mais antiga.
  it('põe as abertas antes das concluídas, mantendo a data mais recente primeiro em cada grupo', async () => {
    // O banco devolve por data decrescente, misturando abertas e concluídas.
    const [query] = responder(
      ok([
        linha('c1', '2026-10-17', '2026-10-17T15:00:00Z', { veiculo: { placa: 'ABC1234' } }),
        linha('a1', '2026-10-16', null, { veiculo: { placa: 'ABC1234' } }),
        linha('c2', '2026-10-10', '2026-10-18T09:00:00Z', { veiculo: { placa: 'BRA2E19' } }),
        linha('a2', '2026-10-05', null, { veiculo: { placa: 'BRA2E19' } }),
      ]),
    );

    const resultado = await listarManutencoes();

    expect(resultado.ok && resultado.data.map((item) => item.id)).toEqual(['a1', 'a2', 'c1', 'c2']);
    expect(mockFrom).toHaveBeenCalledWith('manutencao');
    expect(query.select).toHaveBeenCalledWith(
      'id, veiculo_id, descricao, data_manutencao, valor, data_conclusao, veiculo(placa)',
    );
    expect(query.order).toHaveBeenCalledWith('data_manutencao', { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(500);
  });

  it('entrega a placa e o valor em centavos, nunca o numeric em reais', async () => {
    responder(ok([linha('a1', '2026-10-16', null, { veiculo: { placa: 'ABC1234' } })]));

    expect(await listarManutencoes()).toEqual({
      ok: true,
      data: [
        {
          id: 'a1',
          veiculo_id: 'v1',
          descricao: 'Serviço a1',
          data_manutencao: '2026-10-16',
          data_conclusao: null,
          valorCentavos: 113,
          placa: 'ABC1234',
        },
      ],
    });
  });

  it('lista vazia é sucesso, não erro', async () => {
    responder(ok([]));

    expect(await listarManutencoes()).toEqual({ ok: true, data: [] });
  });

  it('erro do Supabase vira mensagem em português', async () => {
    responder(erro('PGRST301'));

    expect(await listarManutencoes()).toEqual({
      ok: false,
      mensagem: 'Não foi possível carregar as manutenções. Tente novamente.',
    });
  });

  it('resposta fora do formato esperado é rejeitada pelo Zod', async () => {
    responder(ok([linha('a1', '2026-10-16', null, { veiculo: null })]));

    expect(await listarManutencoes()).toEqual({ ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS });
  });
});

describe('buscarVeiculoComHistorico', () => {
  const veiculo = { id: 'v1', placa: 'ABC1234', marca: 'Volvo', modelo: 'FH 540', status: 'EmManutencao' };

  // MAN-35: histórico da data mais recente para a mais antiga, abertas e concluídas juntas.
  it('busca o veículo com as manutenções, da mais recente para a mais antiga', async () => {
    const [query] = responder(
      ok({
        ...veiculo,
        manutencao: [
          linha('m1', '2026-09-01', '2026-09-02T10:00:00Z'),
          linha('m3', '2026-10-16', null),
          linha('m2', '2026-10-01', '2026-10-02T10:00:00Z'),
        ],
      }),
    );

    const resultado = await buscarVeiculoComHistorico('v1');

    expect(resultado.ok && resultado.data.manutencoes.map((item) => item.id)).toEqual(['m3', 'm2', 'm1']);
    expect(resultado.ok && resultado.data).toMatchObject(veiculo);
    expect(resultado.ok && resultado.data.manutencoes[0]).toEqual({
      id: 'm3',
      veiculo_id: 'v1',
      descricao: 'Serviço m3',
      data_manutencao: '2026-10-16',
      data_conclusao: null,
      valorCentavos: 113,
    });
    expect(mockFrom).toHaveBeenCalledWith('veiculo');
    expect(query.select).toHaveBeenCalledWith(
      'id, placa, marca, modelo, status, manutencao(id, veiculo_id, descricao, data_manutencao, valor, data_conclusao)',
    );
    expect(query.eq).toHaveBeenCalledWith('id', 'v1');
  });

  it('veículo sem manutenção devolve histórico vazio', async () => {
    responder(ok({ ...veiculo, manutencao: [] }));

    expect(await buscarVeiculoComHistorico('v1')).toEqual({ ok: true, data: { ...veiculo, manutencoes: [] } });
  });

  // MAN-38
  it('veículo inexistente ou escondido pelo RLS vira "Veículo não encontrado."', async () => {
    responder(ok(null));

    expect(await buscarVeiculoComHistorico('x')).toEqual({ ok: false, mensagem: 'Veículo não encontrado.' });
  });

  it('erro do Supabase vira mensagem em português', async () => {
    responder(erro('PGRST301'));

    expect(await buscarVeiculoComHistorico('v1')).toEqual({
      ok: false,
      mensagem: 'Não foi possível carregar o veículo. Tente novamente.',
    });
  });

  it('resposta fora do formato esperado é rejeitada pelo Zod', async () => {
    responder(ok({ ...veiculo, status: 'Parado', manutencao: [] }));

    expect(await buscarVeiculoComHistorico('v1')).toEqual({ ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS });
  });
});

describe('listarVeiculosSelecionaveis', () => {
  // MAN-02
  it('lista só os veículos que não estão inativos, por placa', async () => {
    const volvo = { id: 'v1', placa: 'ABC1234', marca: 'Volvo', modelo: 'FH 540', status: 'EmViagem' };
    const [query] = responder(ok([volvo]));

    expect(await listarVeiculosSelecionaveis()).toEqual({ ok: true, data: [volvo] });
    expect(mockFrom).toHaveBeenCalledWith('veiculo');
    expect(query.select).toHaveBeenCalledWith('id, placa, marca, modelo, status');
    expect(query.neq).toHaveBeenCalledWith('status', 'Inativo');
    expect(query.order).toHaveBeenCalledWith('placa');
  });

  it('erro do Supabase vira mensagem em português', async () => {
    responder(erro('PGRST301'));

    expect(await listarVeiculosSelecionaveis()).toEqual({
      ok: false,
      mensagem: 'Não foi possível carregar os veículos. Tente novamente.',
    });
  });
});

describe('listarFormasPagamentoAtivas', () => {
  // MAN-03, MAN-32: o filtro de ativas e a ordem por nome moram na RPC (provados no PGlite).
  it('chama listar_formas_pagamento_ativas e não lê a tabela direto', async () => {
    const formas = [
      { id: 'f1', nome: 'Boleto' },
      { id: 'f2', nome: 'Pix' },
    ];
    mockRpc.mockResolvedValue(ok(formas));

    expect(await listarFormasPagamentoAtivas()).toEqual({ ok: true, data: formas });
    expect(mockRpc).toHaveBeenCalledWith('listar_formas_pagamento_ativas');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('erro do Supabase vira mensagem em português', async () => {
    mockRpc.mockResolvedValue(erro('PGRST301'));

    expect(await listarFormasPagamentoAtivas()).toEqual({
      ok: false,
      mensagem: 'Não foi possível carregar as formas de pagamento. Tente novamente.',
    });
  });

  it('42501 da RPC vira mensagem de acesso negado', async () => {
    mockRpc.mockResolvedValue(erro('42501'));

    expect(await listarFormasPagamentoAtivas()).toEqual({ ok: false, mensagem: MENSAGEM_ACESSO_NEGADO });
  });

  it('resposta fora do formato vira mensagem de dados inválidos', async () => {
    mockRpc.mockResolvedValue(ok([{ id: 1 }]));

    expect(await listarFormasPagamentoAtivas()).toEqual({ ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS });
  });
});
