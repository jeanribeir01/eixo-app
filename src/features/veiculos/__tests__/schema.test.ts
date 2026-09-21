import { anoFabricacaoMaximo, veiculoInputSchema } from '../schema';

const inputValido = {
  placa: 'ABC-1234',
  marca: 'Volvo',
  modelo: 'FH 540',
  anoFabricacao: 2020,
  capacidadeCarga: 12.5,
};

describe('veiculoInputSchema', () => {
  it('aceita um veículo válido e normaliza a placa antiga', () => {
    const resultado = veiculoInputSchema.parse(inputValido);
    expect(resultado.placa).toBe('ABC1234');
  });

  it('aceita placa no padrão Mercosul', () => {
    const resultado = veiculoInputSchema.parse({ ...inputValido, placa: 'abc1d23' });
    expect(resultado.placa).toBe('ABC1D23');
  });

  it('rejeita placa fora dos padrões aceitos', () => {
    const resultado = veiculoInputSchema.safeParse({ ...inputValido, placa: '1234ABC' });
    expect(resultado.success).toBe(false);
  });

  it('rejeita ano de fabricação anterior a 1950', () => {
    const resultado = veiculoInputSchema.safeParse({ ...inputValido, anoFabricacao: 1949 });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toBe('Ano de fabricação não pode ser anterior a 1950.');
    }
  });

  it('rejeita ano de fabricação maior que o ano atual + 1', () => {
    const resultado = veiculoInputSchema.safeParse({
      ...inputValido,
      anoFabricacao: anoFabricacaoMaximo() + 1,
    });
    expect(resultado.success).toBe(false);
  });

  it('aceita o limite superior do ano (ano atual + 1)', () => {
    const resultado = veiculoInputSchema.safeParse({ ...inputValido, anoFabricacao: anoFabricacaoMaximo() });
    expect(resultado.success).toBe(true);
  });

  it('rejeita capacidade de carga zero ou negativa', () => {
    expect(veiculoInputSchema.safeParse({ ...inputValido, capacidadeCarga: 0 }).success).toBe(false);
    expect(veiculoInputSchema.safeParse({ ...inputValido, capacidadeCarga: -1 }).success).toBe(false);
  });
});
