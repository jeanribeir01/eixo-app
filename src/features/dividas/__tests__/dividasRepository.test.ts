import { buscarDivida, criarDivida, excluirDivida, listarDividas } from '../dividasRepository';
import type { DividaInput } from '../schema';

type Resposta = { data: unknown; error: { code: string; message: string } | null };

const METODOS = ['select', 'eq', 'order', 'maybeSingle'] as const;
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
    then: <R1, R2>(
      onFulfilled?: ((valor: Resposta) => R1 | PromiseLike<R1>) | null,
      onRejected?: ((motivo: unknown) => R2 | PromiseLike<R2>) | null,
    ) => Promise.resolve(resposta).then(onFulfilled, onRejected),
  });
  for (const metodo of METODOS) {
    metodos[metodo] = metodo === 'maybeSingle' ? jest.fn(() => Promise.resolve(resposta)) : jest.fn(() => builder);
  }
  return builder;
}

function responder(resposta: Resposta): Builder {
  const builder = criarBuilder(resposta);
  mockFrom.mockReturnValueOnce(builder);
  return builder;
}

const ok = (data: unknown): Resposta => ({ data, error: null });
const erro = (code: string): Resposta => ({ data: null, error: { code, message: `detalhe técnico ${code}` } });

// Linha como o PostgREST devolve: dinheiro em reais (number), joins como objeto/array.
// 19.99 e 1.13 não são exatos em binário (19.99 * 100 = 1998.9999999999998): pegam
// conversão de centavos feita sem arredondar.
function linhaDivida(sobrescrever: Record<string, unknown> = {}) {
  return {
    id: 'div-1',
    descricao: 'Financiamento do caminhão',
    quantidade_parcelas: 3,
    valor_parcela: 19.99,
    valor_quitacao_antecipada: null,
    data_vencimento_primeira: '2026-01-15',
    ativa: true,
    categoria: { titulo: 'Financiamento' },
    movimentacao: [
      { id: 'p-3', valor: 19.99, data_vencimento: '2026-03-15', data_pagamento: null, status_pagamento: 'Pendente' },
      { id: 'p-1', valor: 19.99, data_vencimento: '2026-01-15', data_pagamento: '2026-01-15', status_pagamento: 'Pago' },
      { id: 'p-2', valor: 19.99, data_vencimento: '2026-02-15', data_pagamento: null, status_pagamento: 'Pendente' },
    ],
    ...sobrescrever,
  };
}

const input: DividaInput = {
  descricao: 'Financiamento do caminhão',
  categoriaId: 'cat-financiamento',
  formaPagamentoId: 'fp-boleto',
  quantidadeParcelas: 12,
  valorParcelaCentavos: 1999,
  dataVencimentoPrimeira: '2026-01-15',
  valorQuitacaoCentavos: null,
};

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
});

describe('criarDivida', () => {
  it('chama criar_divida com reais e data ISO e devolve o id e a quantidade de parcelas', async () => {
    mockRpc.mockResolvedValueOnce(ok('div-nova'));

    const resultado = await criarDivida({ ...input, valorQuitacaoCentavos: 113 });

    expect(mockRpc).toHaveBeenCalledWith('criar_divida', {
      descricao: 'Financiamento do caminhão',
      categoria_id: 'cat-financiamento',
      forma_pagamento_id: 'fp-boleto',
      quantidade_parcelas: 12,
      valor_parcela: 19.99,
      data_vencimento_primeira: '2026-01-15',
      valor_quitacao_antecipada: 1.13,
    });
    expect(resultado).toEqual({ ok: true, data: { id: 'div-nova', quantidadeParcelas: 12 } });
  });

  it('sem quitação, não envia o parâmetro (a RPC grava null)', async () => {
    mockRpc.mockResolvedValueOnce(ok('div-nova'));

    await criarDivida(input);

    expect(mockRpc.mock.calls[0]?.[1]).not.toHaveProperty('valor_quitacao_antecipada');
  });

  it.each([
    ['42501', 'Acesso negado. Seu perfil não tem permissão para esta ação.'],
    ['22023', 'Categoria ou forma de pagamento inválida. Escolha outra.'],
    ['23514', 'Confira a quantidade de parcelas, o valor e a quitação.'],
    ['XX000', 'Não foi possível registrar a dívida. Tente novamente.'],
  ])('erro %s vira mensagem em português, sem o texto do banco', async (codigo, mensagem) => {
    mockRpc.mockResolvedValueOnce(erro(codigo));

    expect(await criarDivida(input)).toEqual({ ok: false, mensagem });
  });
});

describe('listarDividas', () => {
  it('busca só as ativas e devolve soma total, parcelas pagas e quantidade em centavos inteiros', async () => {
    const builder = responder(ok([linhaDivida()]));

    const resultado = await listarDividas();

    expect(mockFrom).toHaveBeenCalledWith('divida');
    expect(builder.eq).toHaveBeenCalledWith('ativa', true);
    expect(resultado).toEqual({
      ok: true,
      data: [
        {
          id: 'div-1',
          descricao: 'Financiamento do caminhão',
          categoria: { titulo: 'Financiamento' },
          quantidadeParcelas: 3,
          valorParcelaCentavos: 1999,
          somaTotalCentavos: 5997,
          valorQuitacaoCentavos: null,
          dataVencimentoPrimeira: '2026-01-15',
          parcelasPagas: 1,
          ativa: true,
        },
      ],
    });
  });

  it('erro do banco vira mensagem genérica', async () => {
    responder(erro('XX000'));

    expect(await listarDividas()).toEqual({
      ok: false,
      mensagem: 'Não foi possível carregar as dívidas. Tente novamente.',
    });
  });
});

describe('buscarDivida', () => {
  it('devolve as parcelas em ordem de vencimento, numeradas a partir de 1', async () => {
    const builder = responder(ok(linhaDivida({ valor_quitacao_antecipada: 1.13 })));

    const resultado = await buscarDivida('div-1');

    expect(builder.eq).toHaveBeenCalledWith('id', 'div-1');
    expect(resultado.ok && resultado.data.valorQuitacaoCentavos).toBe(113);
    expect(resultado.ok && resultado.data.parcelas).toEqual([
      { id: 'p-1', numero: 1, dataVencimento: '2026-01-15', valorCentavos: 1999, status: 'Pago', dataPagamento: '2026-01-15' },
      { id: 'p-2', numero: 2, dataVencimento: '2026-02-15', valorCentavos: 1999, status: 'Pendente', dataPagamento: null },
      { id: 'p-3', numero: 3, dataVencimento: '2026-03-15', valorCentavos: 1999, status: 'Pendente', dataPagamento: null },
    ]);
  });

  it('dívida não encontrada vira mensagem', async () => {
    responder(ok(null));

    expect(await buscarDivida('div-x')).toEqual({ ok: false, mensagem: 'Dívida não encontrada ou já excluída.' });
  });
});

describe('excluirDivida', () => {
  it('chama excluir_divida e devolve as contagens da RPC', async () => {
    mockRpc.mockResolvedValueOnce(ok({ parcelasRemovidas: 9, parcelasPreservadas: 3 }));

    const resultado = await excluirDivida('div-1');

    expect(mockRpc).toHaveBeenCalledWith('excluir_divida', { id: 'div-1' });
    expect(resultado).toEqual({ ok: true, data: { parcelasRemovidas: 9, parcelasPreservadas: 3 } });
  });

  it('P0002 vira "não encontrada ou já excluída"', async () => {
    mockRpc.mockResolvedValueOnce(erro('P0002'));

    expect(await excluirDivida('div-1')).toEqual({ ok: false, mensagem: 'Dívida não encontrada ou já excluída.' });
  });
});
