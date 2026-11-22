import { MENSAGEM_DADOS_INVALIDOS, MENSAGEM_PERIODO_INVALIDO } from '@/features/bi/queries';
import { MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';

import { buscarDespesasPorCategoria, buscarFluxoMensal, MENSAGEM_ERRO_GRAFICO } from '../queries';

type Resposta = { data: unknown; error: { code: string; message: string } | null };

const mockRpc = jest.fn();

jest.mock('@/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

const ok = (data: unknown): Resposta => ({ data, error: null });
const erro = (code: string): Resposta => ({ data: null, error: { code, message: `detalhe técnico ${code}` } });

const PERIODO = { dataInicial: '2026-11-01', dataFinal: '2026-11-30' };

beforeEach(() => {
  mockRpc.mockReset();
});

describe('buscarFluxoMensal', () => {
  it('chama a RPC com o mês final e o horizonte e devolve os meses na ordem do banco', async () => {
    const meses = [
      { mes: '2026-10', entradas_centavos: 100163, saidas_centavos: 20025 },
      { mes: '2026-11', entradas_centavos: 0, saidas_centavos: 113 },
    ];
    mockRpc.mockResolvedValue(ok(meses));

    const resultado = await buscarFluxoMensal('2026-11-30', 6);

    expect(mockRpc).toHaveBeenCalledWith('fluxo_caixa_mensal', { mes_final: '2026-11-30', meses: 6 });
    expect(resultado).toEqual({ ok: true, data: meses });
  });

  it('"Máximo" manda meses nulo', async () => {
    mockRpc.mockResolvedValue(ok([]));

    const resultado = await buscarFluxoMensal('2026-11-30', null);

    expect(mockRpc).toHaveBeenCalledWith('fluxo_caixa_mensal', { mes_final: '2026-11-30', meses: null });
    expect(resultado).toEqual({ ok: true, data: [] });
  });

  it.each([
    ['42501', MENSAGEM_ACESSO_NEGADO],
    ['22023', MENSAGEM_PERIODO_INVALIDO],
    ['PGRST000', MENSAGEM_ERRO_GRAFICO],
  ])('erro %s vira mensagem em português', async (codigo, mensagem) => {
    mockRpc.mockResolvedValue(erro(codigo));

    expect(await buscarFluxoMensal('2026-11-30', 6)).toEqual({ ok: false, mensagem });
  });

  it('recusa resposta fora do formato', async () => {
    mockRpc.mockResolvedValue(ok([{ mes: '2026-11', entradas_centavos: 10.5, saidas_centavos: 0 }]));

    expect(await buscarFluxoMensal('2026-11-30', 6)).toEqual({ ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS });
  });
});

describe('buscarDespesasPorCategoria', () => {
  it('chama a RPC com o período e aceita a fatia "Outras" com categoria nula', async () => {
    const fatias = [
      { categoria_id: 'c-1', titulo: 'Combustível', total_centavos: 60113, percentual: 60.1 },
      { categoria_id: null, titulo: 'Outras', total_centavos: 39887, percentual: 39.9 },
    ];
    mockRpc.mockResolvedValue(ok(fatias));

    const resultado = await buscarDespesasPorCategoria(PERIODO);

    expect(mockRpc).toHaveBeenCalledWith('despesas_por_categoria', {
      data_inicial: '2026-11-01',
      data_final: '2026-11-30',
    });
    expect(resultado).toEqual({ ok: true, data: fatias });
  });

  it.each([
    ['42501', MENSAGEM_ACESSO_NEGADO],
    ['22023', MENSAGEM_PERIODO_INVALIDO],
    ['PGRST000', MENSAGEM_ERRO_GRAFICO],
  ])('erro %s vira mensagem em português', async (codigo, mensagem) => {
    mockRpc.mockResolvedValue(erro(codigo));

    expect(await buscarDespesasPorCategoria(PERIODO)).toEqual({ ok: false, mensagem });
  });

  it('recusa resposta fora do formato', async () => {
    mockRpc.mockResolvedValue(ok([{ categoria_id: 'c-1', titulo: 'Combustível', total_centavos: '60113' }]));

    expect(await buscarDespesasPorCategoria(PERIODO)).toEqual({ ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS });
  });
});
