import {
  calcularKmRodado,
  distanciaUltrapassaEstimativa,
  formatarHodometro,
  formatarKm,
  parseHodometro,
} from '../calculo';

describe('calculo de viagem (US08)', () => {
  describe('calcularKmRodado (Cálculo Offline)', () => {
    it('retorna km_rodado quando preenchido pelo banco', () => {
      const km = calcularKmRodado({
        km_rodado: 450.5,
        hodometro_inicial: 10000,
        hodometro_final: 10450.5,
      });
      expect(km).toBe(450.5);
    });

    it('calcula (hodometro_final - hodometro_inicial) offline quando km_rodado é nulo', () => {
      const km = calcularKmRodado({
        km_rodado: null,
        hodometro_inicial: 15200,
        hodometro_final: 15720,
      });
      expect(km).toBe(520);
    });

    it('retorna null se hodometro_final for nulo e km_rodado for nulo (viagem em andamento)', () => {
      const km = calcularKmRodado({
        km_rodado: null,
        hodometro_inicial: 10000,
        hodometro_final: null,
      });
      expect(km).toBeNull();
    });
  });

  describe('distanciaUltrapassaEstimativa (Aviso Visual)', () => {
    it('retorna true quando o km rodado ultrapassa a estimativa em mais de 20%', () => {
      // Estimativa: 100 km; Rodado: 125 km (excede 20%)
      expect(distanciaUltrapassaEstimativa(125, 100)).toBe(true);
      // Estimativa: 400 km; Rodado: 550 km
      expect(distanciaUltrapassaEstimativa(550, 400)).toBe(true);
    });

    it('retorna false quando o km rodado está dentro da estimativa e tolerância', () => {
      // Exato ou menor
      expect(distanciaUltrapassaEstimativa(100, 100)).toBe(false);
      expect(distanciaUltrapassaEstimativa(95, 100)).toBe(false);
      // Até 20%
      expect(distanciaUltrapassaEstimativa(120, 100)).toBe(false);
    });

    it('retorna false se distância for nula ou não definida', () => {
      expect(distanciaUltrapassaEstimativa(null, 100)).toBe(false);
      expect(distanciaUltrapassaEstimativa(120, null)).toBe(false);
      expect(distanciaUltrapassaEstimativa(undefined, undefined)).toBe(false);
    });
  });

  describe('formatadores', () => {
    it('formata quilometragem e hodômetro', () => {
      expect(formatarKm(150.5)).toBe('150,5 km');
      expect(formatarKm(null)).toBe('—');
      expect(formatarHodometro(15230)).toBe('15.230');
      expect(formatarHodometro(null)).toBe('—');
    });
  });

  describe('parseHodometro (entrada pt-BR)', () => {
    it.each([
      ['15000', 15000],
      ['15.000', 15000],
      ['15.000,5', 15000.5],
      ['1.234.567', 1234567],
      ['15000.5', 15000.5],
      ['0', 0],
    ])('lê "%s" como %s', (texto, esperado) => {
      expect(parseHodometro(texto)).toBe(esperado);
    });

    it.each(['', '   ', 'abc', '15,', '15.00.0', '-1'])('recusa "%s"', (texto) => {
      expect(parseHodometro(texto)).toBeNull();
    });
  });
});
