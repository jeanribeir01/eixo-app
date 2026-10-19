import { veiculoSchema } from '../schema';

const inputValido = {
  placa: 'ABC-1234',
  marca: 'Volvo',
  modelo: 'FH 540',
  ano_fabricacao: '2020',
  capacidade_carga: '12,5',
  status: 'Disponivel',
};

function mensagens(input: Record<string, unknown>): string[] {
  const resultado = veiculoSchema.safeParse(input);
  return resultado.success ? [] : resultado.error.issues.map((issue) => issue.message);
}

describe('veiculoSchema', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-16T12:00:00Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('aceita um veículo válido, normaliza a placa antiga e converte a capacidade com vírgula', () => {
    expect(veiculoSchema.parse(inputValido)).toEqual({
      placa: 'ABC1234',
      marca: 'Volvo',
      modelo: 'FH 540',
      ano_fabricacao: 2020,
      capacidade_carga: 12.5,
      status: 'Disponivel',
    });
  });

  it('ano: aceita os limites 1950 e ano atual + 1 (ANO-01)', () => {
    expect(veiculoSchema.parse({ ...inputValido, ano_fabricacao: '1950' }).ano_fabricacao).toBe(1950);
    expect(veiculoSchema.parse({ ...inputValido, ano_fabricacao: '2027' }).ano_fabricacao).toBe(2027);
  });

  it.each(['1949', '2028'])('ano: rejeita %s fora dos limites (ANO-01)', (ano) => {
    expect(mensagens({ ...inputValido, ano_fabricacao: ano })).toEqual(['Informe um ano entre 1950 e 2027.']);
  });

  it.each(['', '   ', undefined, null])('ano: exige preenchimento %s (ANO-02)', (ano) => {
    expect(mensagens({ ...inputValido, ano_fabricacao: ano })).toEqual(['Informe o ano de fabricação.']);
  });

  it.each(['abc', '2020.5', '2020,5'])('ano: rejeita valor não inteiro %s (ANO-02)', (ano) => {
    expect(mensagens({ ...inputValido, ano_fabricacao: ano })).toEqual(['Informe um ano inteiro.']);
  });

  it('ano: recalcula limite em São Paulo mesmo após importar o schema (ANO-01)', () => {
    jest.setSystemTime(new Date('2027-01-01T02:59:59Z'));
    expect(veiculoSchema.safeParse({ ...inputValido, ano_fabricacao: '2028' }).success).toBe(false);
    jest.setSystemTime(new Date('2027-01-01T03:00:00Z'));
    expect(veiculoSchema.parse({ ...inputValido, ano_fabricacao: '2028' }).ano_fabricacao).toBe(2028);
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
    // "Inativo" entrou no enum na EIX-56.
    expect(veiculoSchema.safeParse({ ...inputValido, status: 'Inativo' }).success).toBe(true);
    expect(mensagens({ ...inputValido, status: 'Vendido' })).toEqual(['Escolha o status do veículo.']);
  });
});
