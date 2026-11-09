import {
  dataBRParaISO,
  diasEntre,
  hojeISO,
  intervaloDoMes,
  isoParaDataBR,
  mascararData,
  mesDeHoje,
  nomeDoMes,
  somarMeses,
} from '../datas';

describe('mascararData (MOV-05)', () => {
  it.each([
    ['', ''],
    ['05', '05'],
    ['051', '05/1'],
    ['0510', '05/10'],
    ['05102', '05/10/2'],
    ['05102026', '05/10/2026'],
    ['051020269', '05/10/2026'],
    ['05/10/2026', '05/10/2026'],
    ['a5b1', '51'],
  ])('%p → %p', (entrada, esperado) => {
    expect(mascararData(entrada)).toBe(esperado);
  });
});

describe('dataBRParaISO (MOV-05)', () => {
  it('converte data válida para ISO', () => {
    expect(dataBRParaISO('05/10/2026')).toBe('2026-10-05');
  });

  it.each(['31/02/2026', '29/02/2026', '00/10/2026', '10/13/2026', '05/10/26', '', 'ab/cd/efgh'])(
    'rejeita %p',
    (texto) => {
      expect(dataBRParaISO(texto)).toBeNull();
    },
  );

  it('aceita 29/02 em ano bissexto', () => {
    expect(dataBRParaISO('29/02/2028')).toBe('2028-02-29');
  });
});

describe('isoParaDataBR', () => {
  it('converte ISO para DD/MM/AAAA sem passar por fuso', () => {
    expect(isoParaDataBR('2026-10-05')).toBe('05/10/2026');
  });
});

describe('hojeISO (MOV-05 "Hoje")', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('usa a data local do aparelho', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 5, 23, 30));
    expect(hojeISO()).toBe('2026-10-05');
  });
});

describe('intervaloDoMes (MOV-08)', () => {
  it('devolve o primeiro e o último dia do mês para data_vencimento', () => {
    expect(intervaloDoMes(2026, 2)).toMatchObject({ inicioData: '2026-02-01', fimData: '2026-02-28' });
  });

  it('devolve o início do mês local e o início do mês seguinte como instantes para data_inclusao', () => {
    expect(intervaloDoMes(2026, 10)).toMatchObject({
      inicioInstante: new Date(2026, 9, 1).toISOString(),
      fimInstante: new Date(2026, 10, 1).toISOString(),
    });
  });

  it('vira o ano em dezembro', () => {
    expect(intervaloDoMes(2026, 12)).toEqual({
      inicioData: '2026-12-01',
      fimData: '2026-12-31',
      inicioInstante: new Date(2026, 11, 1).toISOString(),
      fimInstante: new Date(2027, 0, 1).toISOString(),
    });
  });
});

describe('nomeDoMes (MOV-08)', () => {
  it.each([
    [2026, 10, 'Outubro 2026'],
    [2027, 1, 'Janeiro 2027'],
    [2026, 3, 'Março 2026'],
  ])('%i/%i → %s', (ano, mes, esperado) => {
    expect(nomeDoMes(ano, mes)).toBe(esperado);
  });
});

describe('mesDeHoje', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('usa o mês local, mesmo às 23h30 do último dia', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 31, 23, 30));

    expect(mesDeHoje()).toEqual({ ano: 2026, mes: 10 });
  });
});

describe('somarMeses', () => {
  it.each([
    [{ ano: 2026, mes: 12 }, 1, { ano: 2027, mes: 1 }],
    [{ ano: 2026, mes: 1 }, -1, { ano: 2025, mes: 12 }],
    [{ ano: 2026, mes: 3 }, 0, { ano: 2026, mes: 3 }],
    [{ ano: 2026, mes: 3 }, -15, { ano: 2024, mes: 12 }],
  ])('%o + %i → %o', (inicio, meses, esperado) => {
    expect(somarMeses(inicio, meses)).toEqual(esperado);
  });
});

describe('diasEntre', () => {
  it.each([
    ['2026-10-05', '2026-10-05', 0],
    ['2026-10-01', '2026-10-15', 14],
    ['2028-01-01', '2028-12-31', 365],
    ['2026-12-31', '2027-01-01', 1],
    // Atravessa o início do horário de verão em fusos que ainda o adotam: continua inteiro.
    ['2026-03-01', '2026-04-01', 31],
  ])('%s a %s → %i', (inicio, fim, esperado) => {
    expect(diasEntre(inicio, fim)).toBe(esperado);
  });
});
