import {
  atualizarFormaPagamento,
  buscarFormaPagamentoPorId,
  criarFormaPagamento,
  definirAtivaFormaPagamento,
  listarFormasPagamento,
} from '../formasPagamentoRepository';

type Resposta = { data: unknown; error: { code: string; message: string } | null };

const METODOS = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit', 'single', 'maybeSingle'] as const;
type Metodo = (typeof METODOS)[number];
type Builder = Record<Metodo, jest.Mock> & PromiseLike<Resposta>;

const mockFrom = jest.fn();

jest.mock('@/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
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
    metodos[metodo] =
      metodo === 'single' || metodo === 'maybeSingle'
        ? jest.fn(() => Promise.resolve(resposta))
        : jest.fn(() => builder);
  }
  return builder;
}

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

const pix = { id: '1', nome: 'Pix', ativa: true };
const boleto = { id: '2', nome: 'Boleto', ativa: true };
const desativada = { id: '3', nome: 'Antiga', ativa: false };

describe('formasPagamentoRepository', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  describe('listarFormasPagamento', () => {
    it('lista ativas e inativas ordenadas por nome', async () => {
      const [query] = responder(ok([pix, boleto, desativada]));

      const resultado = await listarFormasPagamento();

      expect(resultado).toEqual({ ok: true, data: [pix, boleto, desativada] });
      expect(mockFrom).toHaveBeenCalledWith('forma_pagamento');
      expect(query.select).toHaveBeenCalledWith('id, nome, ativa');
      expect(query.order).toHaveBeenCalledWith('nome');
    });

    it('erro do Supabase', async () => {
      responder(erro('PGRST301'));

      expect(await listarFormasPagamento()).toEqual({
        ok: false,
        mensagem: 'Não foi possível carregar as formas de pagamento. Tente novamente.',
      });
    });
  });

  describe('buscarFormaPagamentoPorId', () => {
    it('busca a forma pelo id', async () => {
      const [query] = responder(ok(pix));

      expect(await buscarFormaPagamentoPorId('1')).toEqual({ ok: true, data: pix });
      expect(query.eq).toHaveBeenCalledWith('id', '1');
    });

    it('retorna não encontrada se não existir', async () => {
      responder(ok(null));

      expect(await buscarFormaPagamentoPorId('404')).toEqual({
        ok: false,
        mensagem: 'Forma de pagamento não encontrada.',
      });
    });
  });

  describe('criarFormaPagamento', () => {
    it('grava o nome sem espaços e retorna', async () => {
      const dinheiro = { id: '4', nome: 'Dinheiro', ativa: true };
      const [, insercao] = responder(ok([pix]), ok(dinheiro));

      const resultado = await criarFormaPagamento({ nome: '  Dinheiro  ' });

      expect(resultado).toEqual({ ok: true, data: dinheiro });
      expect(insercao.insert).toHaveBeenCalledWith({ nome: 'Dinheiro' });
    });

    it('não permite duplicada (ignorando maiúsculas e espaços)', async () => {
      responder(ok([pix]));

      const resultado = await criarFormaPagamento({ nome: ' PIX ' });

      expect(resultado).toEqual({
        ok: false,
        mensagem: 'Já existe uma forma de pagamento com esse nome.',
      });
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it('traduz o erro 42501 (RLS) para acesso negado (RLS-16)', async () => {
      responder(ok([pix]), erro('42501'));

      expect(await criarFormaPagamento({ nome: 'Dinheiro' })).toEqual({
        ok: false,
        mensagem: 'Acesso negado. Seu perfil não tem permissão para esta ação.',
      });
    });
  });

  describe('atualizarFormaPagamento', () => {
    it('atualiza nome da forma de pagamento', async () => {
      const atualizada = { ...pix, nome: 'Pix Atualizado' };
      const [, atualizacao] = responder(ok([boleto]), ok(atualizada));

      const resultado = await atualizarFormaPagamento('1', { nome: ' Pix Atualizado ' });

      expect(resultado).toEqual({ ok: true, data: atualizada });
      expect(atualizacao.update).toHaveBeenCalledWith({ nome: 'Pix Atualizado' });
      expect(atualizacao.eq).toHaveBeenCalledWith('id', '1');
    });

    it('não conta a própria forma como duplicada', async () => {
      responder(ok([pix]), ok(pix));

      expect(await atualizarFormaPagamento('1', { nome: 'pix' })).toEqual({
        ok: true,
        data: pix,
      });
    });
  });

  describe('definirAtivaFormaPagamento', () => {
    it('atualiza coluna ativa para false (desativar)', async () => {
      const [query] = responder(ok({ ...pix, ativa: false }));

      const resultado = await definirAtivaFormaPagamento('1', false);

      expect(resultado).toEqual({ ok: true, data: { ...pix, ativa: false } });
      expect(query.update).toHaveBeenCalledWith({ ativa: false });
      expect(query.eq).toHaveBeenCalledWith('id', '1');
    });
  });
});
