import { veiculoSchema } from '../schema';

// TODO(EIX-37): testes de "ano inválido" (antes de 1950 / depois do ano atual + 1) entram junto com
// o campo Ano de Fabricação, que depende de uma migration que ainda não existe.

const inputValido = {
  placa: 'ABC-1234',
  marca: 'Volvo',
  modelo: 'FH 540',
  capacidade_carga: '12,5',
  status: 'Disponivel',
};

function mensagens(input: Record<string, unknown>): string[] {
  const resultado = veiculoSchema.safeParse(input);
  return resultado.success ? [] : resultado.error.issues.map((issue) => issue.message);
}

describe('veiculoSchema', () => {
  it('aceita um veículo válido, normaliza a placa antiga e converte a capacidade com vírgula', () => {
    expect(veiculoSchema.parse(inputValido)).toEqual({
      placa: 'ABC1234',
      marca: 'Volvo',
      modelo: 'FH 540',
      capacidade_carga: 12.5,
      status: 'Disponivel',
    });
  });

  it('aceita placa no padrão Mercosul e salva sem espaço e em maiúscula', () => {
    expect(veiculoSchema.parse({ ...inputValido, placa: 'abc 1d23' }).placa).toBe('ABC1D23');
  });

  it('rejeita placa fora dos dois padrões com mensagem em português', () => {
    expect(mensagens({ ...inputValido, placa: '1234ABC' })).toEqual([
      'Placa inválida. Use o formato AAA-1234 ou o padrão Mercosul AAA1A23.',
    ]);
  });

  it('exige placa, marca e modelo', () => {
    expect(mensagens({ ...inputValido, placa: ' ', marca: '', modelo: '   ' })).toEqual(
      expect.arrayContaining(['Informe a placa.', 'Informe a marca.', 'Informe o modelo.']),
    );
  });

  it('rejeita capacidade de carga zero ou negativa', () => {
    expect(mensagens({ ...inputValido, capacidade_carga: '0' })).toEqual(['A capacidade de carga deve ser maior que zero.']);
    expect(mensagens({ ...inputValido, capacidade_carga: '-1' })).toEqual(['A capacidade de carga deve ser maior que zero.']);
  });

  it('rejeita capacidade vazia ou que não é número', () => {
    expect(mensagens({ ...inputValido, capacidade_carga: '' })).toEqual(['Informe a capacidade de carga em toneladas.']);
    expect(mensagens({ ...inputValido, capacidade_carga: 'doze' })).toEqual(['Informe a capacidade de carga em toneladas.']);
  });

  it('aceita até 2 casas decimais, como numeric(10, 2) no banco', () => {
    expect(veiculoSchema.safeParse({ ...inputValido, capacidade_carga: '12,35' }).success).toBe(true);
    expect(mensagens({ ...inputValido, capacidade_carga: '12,345' })).toEqual(['Use no máximo 2 casas decimais.']);
  });

  it('aceita só os status que existem no enum do banco', () => {
    expect(veiculoSchema.safeParse({ ...inputValido, status: 'EmManutencao' }).success).toBe(true);
    expect(mensagens({ ...inputValido, status: 'Inativo' })).toEqual(['Escolha o status do veículo.']);
  });
});
