import {
  anoAtual,
  deslocarAno,
  deslocarMes,
  mesAtual,
  periodoDoAno,
  periodoDoMes,
  rotuloDoPeriodo,
} from '../periodo';

afterEach(() => {
  jest.useRealTimers();
});

describe('períodos do filtro', () => {
  it('mês vai do primeiro ao último dia, inclusive em ano bissexto', () => {
    expect(periodoDoMes(2028, 2)).toEqual({ modo: 'mes', dataInicial: '2028-02-01', dataFinal: '2028-02-29' });
  });

  it('ano vai de 1º de janeiro a 31 de dezembro', () => {
    expect(periodoDoAno(2026)).toEqual({ modo: 'ano', dataInicial: '2026-01-01', dataFinal: '2026-12-31' });
  });

  it('mês e ano atuais usam a data local do aparelho, mesmo às 23h30 do último dia', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 31, 23, 30));

    expect(mesAtual()).toEqual(periodoDoMes(2026, 10));
    expect(anoAtual()).toEqual(periodoDoAno(2026));
  });

  it('avançar de dezembro cai em janeiro do ano seguinte', () => {
    expect(deslocarMes(periodoDoMes(2026, 12), 1)).toEqual(periodoDoMes(2027, 1));
  });

  it('voltar de janeiro cai em dezembro do ano anterior', () => {
    expect(deslocarMes(periodoDoMes(2026, 1), -1)).toEqual(periodoDoMes(2025, 12));
  });

  it('desloca o ano', () => {
    expect(deslocarAno(periodoDoAno(2026), -1)).toEqual(periodoDoAno(2025));
  });

  it('rótulo acompanha o modo', () => {
    expect(rotuloDoPeriodo(periodoDoMes(2026, 11))).toBe('Novembro 2026');
    expect(rotuloDoPeriodo(periodoDoAno(2026))).toBe('2026');
    expect(rotuloDoPeriodo({ modo: 'customizado', dataInicial: '2026-10-01', dataFinal: '2026-10-15' })).toBe(
      '01/10/2026 a 15/10/2026',
    );
  });
});
