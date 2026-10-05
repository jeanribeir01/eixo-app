import { centavosParaReais, digitosParaCentavos, formatarMoeda, reaisParaCentavos } from '../money';

describe('digitosParaCentavos (MOV-03)', () => {
  it('lê os dígitos digitados como centavos', () => {
    expect(digitosParaCentavos('1234')).toBe(1234);
  });

  it('ignora o que não é dígito, inclusive a própria máscara', () => {
    expect(digitosParaCentavos('R$ 12,34')).toBe(1234);
    expect(digitosParaCentavos('abc')).toBe(0);
    expect(digitosParaCentavos('')).toBe(0);
  });

  it('para de crescer em 12 dígitos (limite de numeric(12,2))', () => {
    expect(digitosParaCentavos('999999999999')).toBe(999999999999);
    expect(digitosParaCentavos('9999999999995')).toBe(999999999999);
  });
});

describe('formatarMoeda (MOV-03, MOV-09)', () => {
  it.each([
    [0, 'R$ 0,00'],
    [5, 'R$ 0,05'],
    [1234, 'R$ 12,34'],
    [150000, 'R$ 1.500,00'],
    [999999999999, 'R$ 9.999.999.999,99'],
  ])('%i centavos → %s', (centavos, esperado) => {
    expect(formatarMoeda(centavos)).toBe(esperado);
  });
});

describe('conversão na borda com o Supabase', () => {
  it('centavos viram reais com duas casas', () => {
    expect(centavosParaReais(150000)).toBe(1500);
    expect(centavosParaReais(1999)).toBe(19.99);
  });

  it('reais voltam para centavos inteiros sem erro de ponto flutuante', () => {
    expect(reaisParaCentavos(19.99)).toBe(1999);
    expect(reaisParaCentavos(0.1 + 0.2)).toBe(30);
  });
});
