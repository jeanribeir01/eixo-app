import { formatarMes, formatarMoeda, formatarMoedaComSinal, tomDoValor } from '../formatadores';

// O Intl separa "R$" do número com espaço não separável (U+00A0).
const NBSP = ' ';

describe('formatadores do caixa', () => {
  it('formata centavos em reais no padrão brasileiro', () => {
    expect(formatarMoeda(1_250_000)).toBe(`R$${NBSP}12.500,00`);
    expect(formatarMoeda(5)).toBe(`R$${NBSP}0,05`);
  });

  it('valor com sinal: + para positivo, − para negativo, nada para zero', () => {
    expect(formatarMoedaComSinal(150_050)).toBe(`+ R$${NBSP}1.500,50`);
    expect(formatarMoedaComSinal(-200_000)).toBe(`− R$${NBSP}2.000,00`);
    expect(formatarMoedaComSinal(0)).toBe(`R$${NBSP}0,00`);
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
