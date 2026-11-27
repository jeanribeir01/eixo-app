import { buscarFluxoMensal } from '@/features/dashboard/graficos/queries';
import { movimentacao } from '@/features/inicio/__mocks__/fixtures';
import { contarVencidos, listarProximosVencimentos } from '@/features/movimentacoes/movimentacoesRepository';

import { resumoCaixaComDados } from '../__mocks__/resumoCaixaMock';
import { buscarResumoCaixa } from '../fonteResumoCaixa';
import { buscarMesEmAndamento, QUANTIDADE_PROXIMOS } from '../mesEmAndamento';

jest.mock('../fonteResumoCaixa', () => ({ buscarResumoCaixa: jest.fn() }));
jest.mock('@/features/dashboard/graficos/queries', () => ({ buscarFluxoMensal: jest.fn() }));
jest.mock('@/features/movimentacoes/movimentacoesRepository', () => ({
  listarProximosVencimentos: jest.fn(),
  contarVencidos: jest.fn(),
}));
jest.mock('@/lib/datas', () => ({ ...jest.requireActual('@/lib/datas'), hojeISO: () => '2026-11-27' }));

const resumo = {
  ...resumoCaixaComDados,
  mesReferencia: '2026-11',
  projecao: [
    { mes: '2026-11', entradasPendentesCentavos: 4747693, saidasPendentesCentavos: 841000, saldoProjetadoCentavos: 0 },
    { mes: '2026-12', entradasPendentesCentavos: 100, saidasPendentesCentavos: 200, saldoProjetadoCentavos: 0 },
  ],
};

function respostasOk() {
  jest.mocked(buscarResumoCaixa).mockResolvedValue({ ok: true, data: resumo });
  jest.mocked(buscarFluxoMensal).mockResolvedValue({
    ok: true,
    data: [
      { mes: '2026-09', entradas_centavos: 1, saidas_centavos: 1 },
      { mes: '2026-11', entradas_centavos: 8505428, saidas_centavos: 9102150 },
    ],
  });
  jest.mocked(listarProximosVencimentos).mockResolvedValue({ ok: true, data: [movimentacao({ id: 'p1' })] });
  jest.mocked(contarVencidos).mockResolvedValue({ ok: true, data: 7 });
}

beforeEach(() => jest.clearAllMocks());

describe('buscarMesEmAndamento', () => {
  it('junta o pago do mês (fluxo), o pendente do mês (projeção), os próximos e os vencidos', async () => {
    respostasOk();

    const resultado = await buscarMesEmAndamento();

    expect(resultado).toEqual({
      ok: true,
      data: {
        mes: '2026-11',
        entradasPagasCentavos: 8505428,
        entradasPendentesCentavos: 4747693,
        saidasPagasCentavos: 9102150,
        saidasPendentesCentavos: 841000,
        proximosVencimentos: [expect.objectContaining({ id: 'p1' })],
        vencidos: 7,
      },
    });
    expect(listarProximosVencimentos).toHaveBeenCalledWith('2026-11-27', QUANTIDADE_PROXIMOS);
    expect(contarVencidos).toHaveBeenCalledWith('2026-11-27');
  });

  it('mês sem pendência nem pagamento vem com zero, não some', async () => {
    respostasOk();
    jest.mocked(buscarResumoCaixa).mockResolvedValue({ ok: true, data: { ...resumo, projecao: [] } });
    jest.mocked(buscarFluxoMensal).mockResolvedValue({ ok: true, data: [] });

    const resultado = await buscarMesEmAndamento();

    expect(resultado).toMatchObject({
      ok: true,
      data: { entradasPagasCentavos: 0, entradasPendentesCentavos: 0, saidasPagasCentavos: 0, saidasPendentesCentavos: 0 },
    });
  });

  it.each([
    ['o resumo', () => jest.mocked(buscarResumoCaixa).mockResolvedValue({ ok: false, mensagem: 'Falhou o resumo.' }), 'Falhou o resumo.'],
    ['o fluxo', () => jest.mocked(buscarFluxoMensal).mockResolvedValue({ ok: false, mensagem: 'Falhou o fluxo.' }), 'Falhou o fluxo.'],
    [
      'os próximos',
      () => jest.mocked(listarProximosVencimentos).mockResolvedValue({ ok: false, mensagem: 'Falhou a lista.' }),
      'Falhou a lista.',
    ],
    ['os vencidos', () => jest.mocked(contarVencidos).mockResolvedValue({ ok: false, mensagem: 'Falhou a contagem.' }), 'Falhou a contagem.'],
  ])('se %s falhar, o mês inteiro vira erro com a mensagem dele', async (_parte, falhar, mensagem) => {
    respostasOk();
    falhar();

    expect(await buscarMesEmAndamento()).toEqual({ ok: false, mensagem });
  });
});
