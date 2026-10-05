import { formatarMes, formatarMoedaComSinal, tomDoValor } from '../formatadores';

describe('formatadores do caixa', () => {
  it('valor com sinal: + para positivo, − para negativo, nada para zero', () => {
    expect(formatarMoedaComSinal(150_050)).toBe('+ R$ 1.500,50');
    expect(formatarMoedaComSinal(-200_000)).toBe('− R$ 2.000,00');
    expect(formatarMoedaComSinal(0)).toBe('R$ 0,00');
  });

  it('negativo pequeno não quebra: o sinal sai do "−", não do valor', () => {
    expect(formatarMoedaComSinal(-5)).toBe('− R$ 0,05');
  });

  it('verde para positivo, vermelho para negativo, neutro para zero', () => {
    expect(tomDoValor(1)).toBe('success');
    expect(tomDoValor(-1)).toBe('danger');
    expect(tomDoValor(0)).toBe('primary');
  });

  it('mês AAAA-MM vira nome do mês por extenso', () => {
    expect(formatarMes('2026-11')).toBe('Novembro de 2026');
    expect(formatarMes('2027-01')).toBe('Janeiro de 2027');
  });
});
