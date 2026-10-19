import { Constants } from '@/types/database';

import { rotaSchema } from '../schema';

const inputValido = {
  cidade_origem: 'Curitiba',
  uf_origem: 'PR',
  cidade_destino: 'São Paulo',
  uf_destino: 'SP',
  distancia_estimada_km: '408',
};

function mensagens(input: Record<string, unknown>): string[] {
  const resultado = rotaSchema.safeParse(input);
  return resultado.success ? [] : resultado.error.issues.map((issue) => issue.message);
}

describe('rotaSchema', () => {
  it('aceita uma rota válida e converte a distância para número', () => {
    expect(rotaSchema.parse(inputValido)).toEqual({
      cidade_origem: 'Curitiba',
      uf_origem: 'PR',
      cidade_destino: 'São Paulo',
      uf_destino: 'SP',
      distancia_estimada_km: 408,
    });
  });

  // ROTA-03: a cidade que vai para o banco sai sem espaço nas pontas nem repetido.
  it('devolve as cidades limpas, mantendo maiúscula e acento', () => {
    const rota = rotaSchema.parse({ ...inputValido, cidade_origem: '  Ponta   Grossa ', cidade_destino: ' São  Paulo ' });

    expect(rota.cidade_origem).toBe('Ponta Grossa');
    expect(rota.cidade_destino).toBe('São Paulo');
  });

  it('aceita distância com vírgula decimal', () => {
    expect(rotaSchema.parse({ ...inputValido, distancia_estimada_km: '408,5' }).distancia_estimada_km).toBe(408.5);
  });

  // ROTA-05
  it('rejeita distância vazia ou que não é número', () => {
    expect(mensagens({ ...inputValido, distancia_estimada_km: '' })).toEqual(['Informe a distância estimada em km.']);
    expect(mensagens({ ...inputValido, distancia_estimada_km: '   ' })).toEqual(['Informe a distância estimada em km.']);
    expect(mensagens({ ...inputValido, distancia_estimada_km: 'quatrocentos' })).toEqual([
      'Informe a distância estimada em km.',
    ]);
  });

  it('rejeita distância zero ou negativa', () => {
    expect(mensagens({ ...inputValido, distancia_estimada_km: '0' })).toEqual(['A distância deve ser maior que zero.']);
    expect(mensagens({ ...inputValido, distancia_estimada_km: '-10' })).toEqual(['A distância deve ser maior que zero.']);
  });

  // ROTA-06
  it('aceita até 2 casas decimais, como numeric(10, 2) no banco', () => {
    expect(rotaSchema.safeParse({ ...inputValido, distancia_estimada_km: '408,35' }).success).toBe(true);
    expect(mensagens({ ...inputValido, distancia_estimada_km: '408,355' })).toEqual(['Use no máximo 2 casas decimais.']);
  });

  it('rejeita distância acima do teto de numeric(10, 2)', () => {
    expect(rotaSchema.safeParse({ ...inputValido, distancia_estimada_km: '99999999,99' }).success).toBe(true);
    expect(mensagens({ ...inputValido, distancia_estimada_km: '100000000' })).toEqual(['Distância muito alta.']);
  });

  // ROTA-07
  it('exige as duas cidades, inclusive quando só há espaços', () => {
    expect(mensagens({ ...inputValido, cidade_origem: '', cidade_destino: '   ' })).toEqual([
      'Informe a cidade de origem.',
      'Informe a cidade de destino.',
    ]);
  });

  it('rejeita cidade com mais de 80 caracteres depois de limpa', () => {
    expect(rotaSchema.safeParse({ ...inputValido, cidade_origem: `  ${'a'.repeat(80)}  ` }).success).toBe(true);
    expect(mensagens({ ...inputValido, cidade_destino: 'a'.repeat(81) })).toEqual([
      'A cidade de destino pode ter no máximo 80 caracteres.',
    ]);
  });

  it('exige as duas UFs', () => {
    const { uf_origem: _origem, uf_destino: _destino, ...semUf } = inputValido;

    expect(mensagens(semUf)).toEqual(['Escolha a UF de origem.', 'Escolha a UF de destino.']);
  });

  it('rejeita UF fora do enum do banco', () => {
    expect(mensagens({ ...inputValido, uf_origem: 'XX', uf_destino: 'sp' })).toEqual([
      'Escolha a UF de origem.',
      'Escolha a UF de destino.',
    ]);
  });

  // ROTA-02: a lista de UFs é a do enum `uf` gerado, com as 27 unidades da federação.
  it('aceita cada uma das 27 UFs do enum do banco', () => {
    expect(Constants.public.Enums.uf).toHaveLength(27);
    for (const sigla of Constants.public.Enums.uf) {
      expect(rotaSchema.safeParse({ ...inputValido, uf_origem: sigla, uf_destino: sigla }).success).toBe(true);
    }
  });
});
