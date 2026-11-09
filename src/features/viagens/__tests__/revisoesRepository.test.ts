import { MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';

import {
  contarRevisoesPendentes,
  listarRevisoesPendentes,
  resolverRevisao,
} from '../revisoesRepository';
import type { RevisaoViagem } from '../types';

// Client falso no mesmo padrão dos outros repositórios: registra os métodos da query e devolve a
// resposta enfileirada. Nenhum teste toca o Supabase real.
type Resposta = {
  data: unknown;
  error: { code: string; message: string } | null;
  count?: number | null;
};

const METODOS = ['select', 'update', 'eq', 'order', 'limit', 'maybeSingle'] as const;
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
      metodo === 'maybeSingle'
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

const ok = (data: unknown, count?: number | null): Resposta => ({ data, error: null, count });
const erro = (code: string): Resposta => ({
  data: null,
  error: { code, message: `detalhe técnico ${code}` },
});

const revisao: RevisaoViagem = {
  id: 'revisao-1',
  viagem_id: 'viagem-1',
  solicitante_id: 'motorista-1',
  motorista_id: 'motorista-1',
  motorista_nome: 'Carlos Motorista',
  veiculo_id: 'veiculo-1',
  veiculo_placa: 'BRA2E19',
  rota_id: 'rota-1',
  rota_trecho: 'São Paulo/SP → Campinas/SP',
  codigo: 'VG005',
  mensagem: 'A viagem já foi encerrada no servidor.',
  payload: { status: 'Finalizada' },
  status: 'Pendente',
  observacao: null,
  resolvido_por: null,
  resolvido_em: null,
  data_inclusao: '2026-10-26T12:00:00.000Z',
  data_atualizacao: '2026-10-26T12:00:00.000Z',
};

describe('revisoesRepository', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  describe('contarRevisoesPendentes', () => {
    it('conta apenas revisões Pendente no servidor', async () => {
      const [query] = responder(ok(null, 3));

      expect(await contarRevisoesPendentes()).toEqual({ ok: true, data: 3 });
      expect(mockFrom).toHaveBeenCalledWith('viagem_revisao');
      expect(query.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
      expect(query.eq).toHaveBeenCalledWith('status', 'Pendente');
    });

    it('trata contagem nula como zero', async () => {
      responder(ok(null, null));

      expect(await contarRevisoesPendentes()).toEqual({ ok: true, data: 0 });
    });

    it('erro do Supabase vira mensagem em português', async () => {
      responder(erro('PGRST301'));

      expect(await contarRevisoesPendentes()).toEqual({
        ok: false,
        mensagem: 'Não foi possível contar as revisões pendentes.',
      });
    });

    it('erro de RLS vira mensagem de acesso negado', async () => {
      responder(erro('42501'));

      expect(await contarRevisoesPendentes()).toEqual({
        ok: false,
        mensagem: MENSAGEM_ACESSO_NEGADO,
      });
    });
  });

  describe('listarRevisoesPendentes', () => {
    it('lista as revisões pendentes mais recentes primeiro', async () => {
      const [query] = responder(ok([revisao]));

      expect(await listarRevisoesPendentes()).toEqual({ ok: true, data: [revisao] });
      expect(query.eq).toHaveBeenCalledWith('status', 'Pendente');
      expect(query.order).toHaveBeenCalledWith('data_inclusao', { ascending: false });
      expect(query.limit).toHaveBeenCalledWith(100);
    });

    it('rejeita resposta fora do contrato', async () => {
      responder(ok([{ ...revisao, payload: [] }]));

      expect(await listarRevisoesPendentes()).toEqual({
        ok: false,
        mensagem: 'Os dados recebidos das revisões são inválidos.',
      });
    });

    it('erro do Supabase vira mensagem em português', async () => {
      responder(erro('PGRST301'));

      expect(await listarRevisoesPendentes()).toEqual({
        ok: false,
        mensagem: 'Não foi possível carregar as revisões. Tente novamente.',
      });
    });
  });

  describe('resolverRevisao', () => {
    it('grava a decisão e a observação limpa na revisão pendente', async () => {
      const [query] = responder(ok({ ...revisao, status: 'Resolvida', observacao: 'Conferido' }));

      const resultado = await resolverRevisao('revisao-1', {
        status: 'Resolvida',
        observacao: '  Conferido  ',
      });

      expect(resultado).toEqual({
        ok: true,
        data: { ...revisao, status: 'Resolvida', observacao: 'Conferido' },
      });
      expect(query.update).toHaveBeenCalledWith({
        status: 'Resolvida',
        observacao: 'Conferido',
      });
      expect(query.eq).toHaveBeenCalledWith('id', 'revisao-1');
      expect(query.eq).toHaveBeenCalledWith('status', 'Pendente');
    });

    it('observação vazia vira null', async () => {
      const [query] = responder(ok({ ...revisao, status: 'Descartada', observacao: null }));

      await resolverRevisao('revisao-1', { status: 'Descartada', observacao: '   ' });

      expect(query.update).toHaveBeenCalledWith({ status: 'Descartada', observacao: null });
    });

    it('não encontra a revisão quando ela já foi decidida', async () => {
      responder(ok(null));

      expect(await resolverRevisao('revisao-1', { status: 'Resolvida' })).toEqual({
        ok: false,
        mensagem: 'Revisão não encontrada ou já resolvida.',
      });
    });

    it('valida a decisão antes de chamar o servidor', async () => {
      expect(
        await resolverRevisao('revisao-1', {
          // @ts-expect-error decisão fora do enum é rejeitada pelo schema
          status: 'Pendente',
        }),
      ).toEqual({ ok: false, mensagem: 'Selecione uma decisão para a revisão.' });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('erro de RLS vira mensagem de acesso negado', async () => {
      responder(erro('42501'));

      expect(await resolverRevisao('revisao-1', { status: 'Resolvida' })).toEqual({
        ok: false,
        mensagem: MENSAGEM_ACESSO_NEGADO,
      });
    });
  });
});
