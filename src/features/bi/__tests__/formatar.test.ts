import { formatarMoeda } from '@/lib/money';

import { formatarIndicador } from '../formatar';

describe('formatarIndicador (BI-23)', () => {
  it.each(['moeda', 'custoPorKm', 'kmPorLitro'] as const)('nulo em %s vira travessão', (unidade) => {
    expect(formatarIndicador(null, unidade)).toBe('—');
  });

  it('moeda usa o mesmo formato do formatarMoeda', () => {
    expect(formatarIndicador(133457, 'moeda')).toBe('R$ 1.334,57');
    expect(formatarIndicador(133457, 'moeda')).toBe(formatarMoeda(133457));
  });

  it('moeda negativa leva o sinal tipográfico na frente', () => {
    expect(formatarIndicador(-10000, 'moeda')).toBe('− R$ 100,00');
    expect(formatarIndicador(-150, 'moeda')).toBe('− R$ 1,50');
  });

  it('R$/KM em centavos vira reais por km', () => {
    expect(formatarIndicador(133, 'custoPorKm')).toBe('R$ 1,33/km');
    expect(formatarIndicador(12345, 'custoPorKm')).toBe('R$ 123,45/km');
  });

  it('R$/KM zero é dado, não travessão', () => {
    expect(formatarIndicador(0, 'custoPorKm')).toBe('R$ 0,00/km');
  });

  it('KM/L sai com duas casas e vírgula', () => {
    expect(formatarIndicador(3.33, 'kmPorLitro')).toBe('3,33 km/L');
    expect(formatarIndicador(12.5, 'kmPorLitro')).toBe('12,50 km/L');
  });
});
