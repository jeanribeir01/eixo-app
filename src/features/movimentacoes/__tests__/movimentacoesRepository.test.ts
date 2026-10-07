import { listarCategorias } from '@/features/categorias/categoriasRepository';
import { listarFormasPagamento } from '@/features/formas-pagamento/formasPagamentoRepository';
import { intervaloDoMes } from '@/lib/datas';

import {
  atualizarMovimentacao,
  buscarMovimentacaoPorId,
  criarMovimentacao,
  excluirMovimentacao,
  listarMovimentacoesDoMes,
  listarOpcoesMovimentacao,
} from '../movimentacoesRepository';
import type { MovimentacaoInput } from '../schema';

type Resposta = { data: unknown; error: { code: string; message: string } | null };

const METODOS = ['select', 'insert', 'update', 'delete', 'eq', 'or', 'order', 'limit', 'single', 'maybeSingle'] as const;
type Metodo = (typeof METODOS)[number];
type Builder = Record<Metodo, jest.Mock> & PromiseLike<Resposta>;

const mockFrom = jest.fn();

jest.mock('@/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

jest.mock('@/features/categorias/categoriasRepository', () => ({ listarCategorias: jest.fn() }));
jest.mock('@/features/formas-pagamento/formasPagamentoRepository', () => ({ listarFormasPagamento: jest.fn() }));

const mockListarCategorias = listarCategorias as jest.MockedFunction<typeof listarCategorias>;
const mockListarFormas = listarFormasPagamento as jest.MockedFunction<typeof listarFormasPagamento>;

function criarBuilder(resposta: Resposta): Builder {
  const metodos = {} as Record<Metodo, jest.Mock>;
  const builder: Builder = Object.assign(metodos, {
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

function responder(resposta: Resposta): Builder {
  const builder = criarBuilder(resposta);
  mockFrom.mockReturnValueOnce(builder);
  return builder;
}

const ok = (data: unknown): Resposta => ({ data, error: null });
const erro = (code: string): Resposta => ({ data: null, error: { code, message: `detalhe técnico ${code}` } });

// Linha como o PostgREST devolve: valor em reais (number), joins como objetos.
function linha(sobrescrever: Record<string, unknown> = {}) {
  return {
    id: 'mov-1',
    valor: 19.99,
    descricao: 'Pedágio',
    categoria_id: 'cat-1',
    forma_pagamento_id: 'fp-1',
    divida_id: null,
    data_vencimento: '2026-10-10',
    data_pagamento: null,
    data_inclusao: '2026-10-01T12:00:00+00:00',
    status_pagamento: 'Pendente',
    categoria: { titulo: 'Pedágio', tipo: 'Saida', ativa: true },
    forma_pagamento: { nome: 'Pix', ativa: true },
    ...sobrescrever,
  };
}

const input: MovimentacaoInput = {
  valorCentavos: 150000,
  descricao: 'Frete',
  categoriaId: 'cat-2',
  formaPagamentoId: 'fp-1',
  dataVencimento: '2026-10-20',
  status: 'Pago',
  dataPagamento: '2026-10-05',
};

beforeEach(() => {
  mockFrom.mockReset();
  mockListarCategorias.mockReset();
  mockListarFormas.mockReset();
});

describe('listarMovimentacoesDoMes (MOV-08)', () => {
  it('filtra pelo vencimento no mês ou, sem vencimento, pela inclusão no mês', async () => {
    const query = responder(ok([linha()]));
    const mes = intervaloDoMes(2026, 10);

    await listarMovimentacoesDoMes(2026, 10);

    expect(mockFrom).toHaveBeenCalledWith('movimentacao');
    expect(query.or).toHaveBeenCalledWith(
      `and(data_vencimento.gte.${mes.inicioData},data_vencimento.lte.${mes.fimData}),` +
        `and(data_vencimento.is.null,data_inclusao.gte."${mes.inicioInstante}",data_inclusao.lt."${mes.fimInstante}")`,
    );
  });

  it('converte o valor para centavos e expõe categoria e forma', async () => {
    responder(ok([linha()]));

    const resultado = await listarMovimentacoesDoMes(2026, 10);

    expect(resultado).toEqual({
      ok: true,
      data: [
        {
          id: 'mov-1',
          valorCentavos: 1999,
          descricao: 'Pedágio',
          categoria_id: 'cat-1',
          forma_pagamento_id: 'fp-1',
          divida_id: null,
          data_vencimento: '2026-10-10',
          data_pagamento: null,
          data_inclusao: '2026-10-01T12:00:00+00:00',
          status_pagamento: 'Pendente',
          categoria: { titulo: 'Pedágio', tipo: 'Saida', ativa: true },
          formaPagamento: { nome: 'Pix', ativa: true },
        },
      ],
    });
  });

  it('ordena pela data de referência (vencimento ou inclusão)', async () => {
    responder(
      ok([
        linha({ id: 'c', data_vencimento: '2026-10-20' }),
        linha({ id: 'a', data_vencimento: null, data_inclusao: '2026-10-02T15:00:00+00:00' }),
        linha({ id: 'b', data_vencimento: '2026-10-10' }),
      ]),
    );

    const resultado = await listarMovimentacoesDoMes(2026, 10);

    expect(resultado.ok && resultado.data.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('erro do Supabase vira mensagem em português', async () => {
    responder(erro('PGRST301'));

    expect(await listarMovimentacoesDoMes(2026, 10)).toEqual({
      ok: false,
      mensagem: 'Não foi possível carregar as movimentações. Tente novamente.',
    });
  });

  it('resposta fora do formato esperado', async () => {
    responder(ok([{ id: 'mov-1' }]));

    expect(await listarMovimentacoesDoMes(2026, 10)).toEqual({
      ok: false,
      mensagem: 'Os dados recebidos são inválidos. Tente novamente.',
    });
  });
});

describe('buscarMovimentacaoPorId (MOV-10)', () => {
  it('busca pelo id', async () => {
    const query = responder(ok(linha()));

    const resultado = await buscarMovimentacaoPorId('mov-1');

    expect(query.eq).toHaveBeenCalledWith('id', 'mov-1');
    expect(resultado.ok && resultado.data.valorCentavos).toBe(1999);
  });

  it('id inexistente → "Movimentação não encontrada."', async () => {
    responder(ok(null));

    expect(await buscarMovimentacaoPorId('x')).toEqual({ ok: false, mensagem: 'Movimentação não encontrada.' });
  });
});

describe('criarMovimentacao (MOV-02)', () => {
  it('grava em reais e sem as datas automáticas do banco', async () => {
    const query = responder(ok(linha({ valor: 1500 })));

    const resultado = await criarMovimentacao(input);

    expect(query.insert).toHaveBeenCalledWith({
      categoria_id: 'cat-2',
      forma_pagamento_id: 'fp-1',
      valor: 1500,
      descricao: 'Frete',
      data_vencimento: '2026-10-20',
      data_pagamento: '2026-10-05',
      status_pagamento: 'Pago',
    });
    expect(resultado.ok && resultado.data.valorCentavos).toBe(150000);
  });

  it.each([
    ['42501', 'Acesso negado. Seu perfil não tem permissão para esta ação.'],
    ['23514', 'Valor ou data de pagamento inválidos.'],
    ['23503', 'Categoria ou forma de pagamento não encontrada.'],
    ['XX000', 'Não foi possível registrar a movimentação. Tente novamente.'],
  ])('erro %s → "%s"', async (code, mensagem) => {
    responder(erro(code));

    expect(await criarMovimentacao(input)).toEqual({ ok: false, mensagem });
  });
});

describe('atualizarMovimentacao (MOV-10)', () => {
  it('atualiza o registro pelo id com os mesmos campos da criação', async () => {
    const query = responder(ok(linha({ valor: 1500 })));

    await atualizarMovimentacao('mov-1', input);

    expect(query.update).toHaveBeenCalledWith({
      categoria_id: 'cat-2',
      forma_pagamento_id: 'fp-1',
      valor: 1500,
      descricao: 'Frete',
      data_vencimento: '2026-10-20',
      data_pagamento: '2026-10-05',
      status_pagamento: 'Pago',
    });
    expect(query.eq).toHaveBeenCalledWith('id', 'mov-1');
  });

  it('nenhuma linha afetada → "Movimentação não encontrada."', async () => {
    responder(ok(null));

    expect(await atualizarMovimentacao('x', input)).toEqual({ ok: false, mensagem: 'Movimentação não encontrada.' });
  });

  it('erro 42501 vira acesso negado (RLS-16)', async () => {
    responder(erro('42501'));

    expect(await atualizarMovimentacao('mov-1', input)).toEqual({
      ok: false,
      mensagem: 'Acesso negado. Seu perfil não tem permissão para esta ação.',
    });
  });
});

describe('excluirMovimentacao (MOV-11)', () => {
  it('apaga pelo id e confirma pela linha devolvida', async () => {
    const query = responder(ok([{ id: 'mov-1' }]));

    expect(await excluirMovimentacao('mov-1')).toEqual({ ok: true, data: 'mov-1' });
    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('id', 'mov-1');
  });

  it('0 linhas (parcela de dívida ou id inexistente) → mensagem da spec', async () => {
    responder(ok([]));

    expect(await excluirMovimentacao('parcela')).toEqual({
      ok: false,
      mensagem: 'Movimentação não encontrada ou não pode ser excluída.',
    });
  });

  it('erro do Supabase', async () => {
    responder(erro('XX000'));

    expect(await excluirMovimentacao('mov-1')).toEqual({
      ok: false,
      mensagem: 'Não foi possível excluir a movimentação. Tente novamente.',
    });
  });
});

describe('listarOpcoesMovimentacao (MOV-01 AC12)', () => {
  it('devolve só categorias e formas ativas', async () => {
    mockListarCategorias.mockResolvedValue({
      ok: true,
      data: [
        { id: 'c1', titulo: 'Frete', tipo: 'Entrada', ativa: true },
        { id: 'c2', titulo: 'Antiga', tipo: 'Saida', ativa: false },
      ],
    });
    mockListarFormas.mockResolvedValue({
      ok: true,
      data: [
        { id: 'f1', nome: 'Pix', ativa: true },
        { id: 'f2', nome: 'Cheque', ativa: false },
      ],
    });

    expect(await listarOpcoesMovimentacao()).toEqual({
      ok: true,
      data: {
        categorias: [{ id: 'c1', titulo: 'Frete', tipo: 'Entrada', ativa: true }],
        formasPagamento: [{ id: 'f1', nome: 'Pix', ativa: true }],
      },
    });
  });

  it('repassa o erro de quem falhou', async () => {
    mockListarCategorias.mockResolvedValue({ ok: false, mensagem: 'Falhou categorias.' });
    mockListarFormas.mockResolvedValue({ ok: true, data: [] });

    expect(await listarOpcoesMovimentacao()).toEqual({ ok: false, mensagem: 'Falhou categorias.' });
  });
});
