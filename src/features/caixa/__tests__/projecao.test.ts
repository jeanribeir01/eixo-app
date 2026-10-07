import { primeiroMesNegativo, separarJanela, somarMeses } from '../projecao';
import type { MesProjetado } from '../resumoCaixa';

function mes(mesAAAAMM: string, saldoProjetadoCentavos = 100): MesProjetado {
  return { mes: mesAAAAMM, entradasPendentesCentavos: 0, saidasPendentesCentavos: 100, saldoProjetadoCentavos };
}

describe('somarMeses (EIX-74)', () => {
  it.each([
    ['2026-10', 0, '2026-10'],
    ['2026-10', 2, '2026-12'],
    ['2026-10', 3, '2027-01'],
    ['2026-10', 11, '2027-09'],
    ['2026-01', 11, '2026-12'],
    ['2026-12', 1, '2027-01'],
    ['2026-11', 79, '2033-06'],
  ])('%s + %i = %s', (inicio, quantidade, esperado) => {
    expect(somarMeses(inicio, quantidade)).toBe(esperado);
  });
});

describe('separarJanela (EIX-74)', () => {
  it('a janela vai do mês de referência até 11 meses depois, inclusive', () => {
    const meses = [mes('2026-10'), mes('2027-09'), mes('2027-10'), mes('2028-03')];

    const janela = separarJanela(meses, '2026-10');

    expect(janela.proximos.map((item) => item.mes)).toEqual(['2026-10', '2027-09']);
    expect(janela.mesesDepois).toBe(2);
    expect(janela.ultimoMes).toBe('2028-03');
  });

  it('tudo dentro da janela: nada depois', () => {
    const janela = separarJanela([mes('2026-10'), mes('2026-12')], '2026-10');

    expect(janela.proximos).toHaveLength(2);
    expect(janela.mesesDepois).toBe(0);
    expect(janela.ultimoMes).toBeNull();
  });

  it('dívida de 80 parcelas: 12 meses na janela e 68 depois, até junho de 2033', () => {
    const meses = Array.from({ length: 80 }, (_, i) => mes(somarMeses('2026-11', i)));

    const janela = separarJanela(meses, '2026-10');

    // A primeira parcela é em novembro: a janela (out/2026 a set/2027) tem 11 meses com pendência.
    expect(janela.proximos).toHaveLength(11);
    expect(janela.mesesDepois).toBe(69);
    expect(janela.ultimoMes).toBe('2033-06');
  });
});

describe('primeiroMesNegativo (EIX-74)', () => {
  it('acha o primeiro mês negativo mesmo fora da janela de 12 meses', () => {
    const meses = [mes('2026-10', 500), mes('2028-03', -100), mes('2028-04', -200)];

    expect(primeiroMesNegativo(meses)).toBe('2028-03');
  });

  it('sem mês negativo: null', () => {
    expect(primeiroMesNegativo([mes('2026-10', 0), mes('2026-11', 10)])).toBeNull();
  });
});
