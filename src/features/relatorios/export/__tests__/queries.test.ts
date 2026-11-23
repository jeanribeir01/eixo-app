import { MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';

import { buscarTransacoesDoPeriodo, MENSAGEM_ERRO_RELATORIO } from '../queries';

type Resposta = { data: unknown; error: { code: string; message: string } | null };

const METODOS = ['select', 'or', 'order', 'range'] as const;
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
  for (const metodo of METODOS) metodos[metodo] = jest.fn(() => builder);
  return builder;
}

function responder(resposta: Resposta): Builder {
  const builder = criarBuilder(resposta);
  mockFrom.mockReturnValueOnce(builder);
  return builder;
}

const ok = (data: unknown): Resposta => ({ data, error: null });
const erro = (code: string): Resposta => ({ data: null, error: { code, message: `detalhe técnico ${code}` } });

// Linha como o PostgREST devolve: valor em reais (number), categoria como objeto.
function linha(sobrescrever: Record<string, unknown> = {}) {
  return {
    id: 'mov-1',
    valor: 19.99,
    descricao: 'Pedágio',
    data_vencimento: '2026-11-10',
    data_inclusao: '2026-11-01T12:00:00+00:00',
    status_pagamento: 'Pendente',
    categoria: { titulo: 'Pedágio', tipo: 'Saida' },
    ...sobrescrever,
  };
}

const NOVEMBRO = { dataInicial: '2026-11-01', dataFinal: '2026-11-30' };

beforeEach(() => {
  mockFrom.mockReset();
});

describe('buscarTransacoesDoPeriodo', () => {
  it('filtra pelo vencimento no período ou, sem vencimento, pelo dia local da inclusão (EXP-04)', async () => {
    const builder = responder(ok([]));

    await buscarTransacoesDoPeriodo(NOVEMBRO);

    expect(mockFrom).toHaveBeenCalledWith('movimentacao');
    // O jest roda em America/Sao_Paulo (UTC-3): 01/11 00h local = 03h UTC; 01/12 00h local = 03h UTC.
    expect(builder.or).toHaveBeenCalledWith(
      'and(data_vencimento.gte.2026-11-01,data_vencimento.lte.2026-11-30),' +
        'and(data_vencimento.is.null,data_inclusao.gte."2026-11-01T03:00:00.000Z",' +
        'data_inclusao.lt."2026-12-01T03:00:00.000Z")',
    );
  });

  it('não filtra status: pendentes e pagas entram (EXP-04)', async () => {
    const builder = responder(
      ok([linha({ id: 'a', status_pagamento: 'Pago' }), linha({ id: 'b', status_pagamento: 'Pendente' })]),
    );

    const resultado = await buscarTransacoesDoPeriodo(NOVEMBRO);

    // O builder falso só tem select/or/order/range: um .eq('status_pagamento', ...) quebraria a chamada.
    expect(builder.or).toHaveBeenCalledWith(expect.not.stringContaining('status_pagamento'));
    expect(resultado.ok && resultado.data.map((t) => t.status)).toEqual(['Pago', 'Pendente']);
  });

  it('converte a linha: data de referência, categoria, tipo, centavos e status (EXP-05)', async () => {
    responder(
      ok([
        linha({ id: 'a', valor: 1.13, descricao: 'Frete', categoria: { titulo: 'Frete', tipo: 'Entrada' }, status_pagamento: 'Pago' }),
        // Sem vencimento: 30/11 23h30 em Brasília é 01/12 02h30 em UTC; a data do relatório é 30/11.
        linha({ id: 'b', data_vencimento: null, data_inclusao: '2026-12-01T02:30:00+00:00' }),
      ]),
    );

    const resultado = await buscarTransacoesDoPeriodo(NOVEMBRO);

    expect(resultado).toEqual({
      ok: true,
      data: [
        { id: 'a', dataReferencia: '2026-11-10', descricao: 'Frete', categoria: 'Frete', tipo: 'Entrada', valorCentavos: 113, status: 'Pago' },
        { id: 'b', dataReferencia: '2026-11-30', descricao: 'Pedágio', categoria: 'Pedágio', tipo: 'Saida', valorCentavos: 1999, status: 'Pendente' },
      ],
    });
  });

  it('ordena por data crescente e, no mesmo dia, pela descrição (EXP-05)', async () => {
    responder(
      ok([
        linha({ id: '1', data_vencimento: '2026-11-20', descricao: 'Aluguel' }),
        linha({ id: '2', data_vencimento: '2026-11-05', descricao: 'Pedágio' }),
        linha({ id: '3', data_vencimento: '2026-11-05', descricao: 'Diesel' }),
        linha({ id: '4', data_vencimento: '2026-11-05', descricao: 'Água' }),
      ]),
    );

    const resultado = await buscarTransacoesDoPeriodo(NOVEMBRO);

    // A ordem do banco (id) e a ordem pedida discordam: só a ordenação do relatório dá esta sequência.
    expect(resultado.ok && resultado.data.map((t) => t.descricao)).toEqual(['Água', 'Diesel', 'Pedágio', 'Aluguel']);
  });

  it('pagina de 1000 em 1000, ordenando por id, até vir uma página incompleta (EXP-04)', async () => {
    const pagina1 = Array.from({ length: 1000 }, (_, i) => linha({ id: `p1-${String(i).padStart(4, '0')}` }));
    const pagina2 = [linha({ id: 'p2-1' }), linha({ id: 'p2-2' }), linha({ id: 'p2-3' })];
    const primeira = responder(ok(pagina1));
    const segunda = responder(ok(pagina2));

    const resultado = await buscarTransacoesDoPeriodo(NOVEMBRO);

    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(primeira.order).toHaveBeenCalledWith('id');
    expect(primeira.range).toHaveBeenCalledWith(0, 999);
    expect(segunda.range).toHaveBeenCalledWith(1000, 1999);
    expect(resultado.ok && resultado.data).toHaveLength(1003);
  });

  it('página exatamente cheia pede a próxima, e a vazia encerra (EXP-04)', async () => {
    responder(ok(Array.from({ length: 1000 }, (_, i) => linha({ id: `x-${i}` }))));
    const segunda = responder(ok([]));

    const resultado = await buscarTransacoesDoPeriodo(NOVEMBRO);

    expect(segunda.range).toHaveBeenCalledWith(1000, 1999);
    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(resultado.ok && resultado.data).toHaveLength(1000);
  });

  it('categoria inativa continua no relatório com o título dela (soft delete)', async () => {
    const builder = responder(ok([linha({ categoria: { titulo: 'Pedágio antigo', tipo: 'Saida' } })]));

    const resultado = await buscarTransacoesDoPeriodo(NOVEMBRO);

    // Nada filtra por `ativa`: o lançamento histórico vale mesmo com a categoria desativada.
    expect(builder.select).toHaveBeenCalledWith(expect.not.stringContaining('ativa'));
    expect(builder.or).toHaveBeenCalledWith(expect.not.stringContaining('ativa'));
    expect(resultado.ok && resultado.data[0].categoria).toBe('Pedágio antigo');
  });

  it('42501 vira a mensagem de acesso negado (EXP-17)', async () => {
    responder(erro('42501'));

    expect(await buscarTransacoesDoPeriodo(NOVEMBRO)).toEqual({ ok: false, mensagem: MENSAGEM_ACESSO_NEGADO });
  });

  it('outro erro vira a mensagem genérica, sem o texto do banco (EXP-17)', async () => {
    responder(erro('PGRST000'));

    expect(await buscarTransacoesDoPeriodo(NOVEMBRO)).toEqual({
      ok: false,
      mensagem: 'Não foi possível gerar o relatório. Tente novamente.',
    });
  });

  it('erro na segunda página descarta o que veio antes (EXP-17)', async () => {
    responder(ok(Array.from({ length: 1000 }, (_, i) => linha({ id: `x-${i}` }))));
    responder(erro('PGRST000'));

    expect(await buscarTransacoesDoPeriodo(NOVEMBRO)).toEqual({ ok: false, mensagem: MENSAGEM_ERRO_RELATORIO });
  });

  it('recusa resposta fora do formato (EXP-17)', async () => {
    responder(ok([linha({ valor: 'dezenove' })]));

    expect(await buscarTransacoesDoPeriodo(NOVEMBRO)).toEqual({ ok: false, mensagem: MENSAGEM_ERRO_RELATORIO });
  });
});
