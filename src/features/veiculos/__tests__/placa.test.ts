import { formatarPlaca, isPlacaValida, normalizarPlaca } from '../placa';

describe('normalizarPlaca', () => {
  it('remove hífen e deixa maiúscula (placa antiga)', () => {
    expect(normalizarPlaca('abc-1234')).toBe('ABC1234');
  });

  it('remove espaços e caracteres inválidos (Mercosul)', () => {
    expect(normalizarPlaca('abc 1d23')).toBe('ABC1D23');
  });

  it('trata a mesma placa em formatos diferentes como iguais', () => {
    expect(normalizarPlaca('ABC-1234')).toBe(normalizarPlaca('abc1234'));
  });
});

describe('isPlacaValida', () => {
  it('aceita o formato antigo AAA-1234', () => {
    expect(isPlacaValida(normalizarPlaca('ABC-1234'))).toBe(true);
  });

  it('aceita o formato Mercosul AAA1A23', () => {
    expect(isPlacaValida(normalizarPlaca('ABC1D23'))).toBe(true);
  });

  it('rejeita placa com quantidade errada de caracteres', () => {
    expect(isPlacaValida(normalizarPlaca('ABC-123'))).toBe(false);
  });

  it('rejeita placa fora dos dois padrões aceitos', () => {
    expect(isPlacaValida(normalizarPlaca('AB1-234C'))).toBe(false);
  });
});

describe('formatarPlaca', () => {
  it('reaplica o hífen na placa antiga', () => {
    expect(formatarPlaca(normalizarPlaca('abc1234'))).toBe('ABC-1234');
  });

  it('não adiciona hífen na placa Mercosul', () => {
    expect(formatarPlaca(normalizarPlaca('abc1d23'))).toBe('ABC1D23');
  });
});
