import { z } from 'zod';

import { MAX_DIAS_PERIODO, periodoCustomizadoSchema } from '../schema';

function errosDe(dataInicial: string, dataFinal: string) {
  const resultado = periodoCustomizadoSchema.safeParse({ dataInicial, dataFinal });
  if (resultado.success) throw new Error('Era esperado que a validação falhasse.');
  return z.flattenError(resultado.error).fieldErrors;
}

describe('periodoCustomizadoSchema', () => {
  it('período válido sai em ISO', () => {
    expect(periodoCustomizadoSchema.parse({ dataInicial: '01/10/2026', dataFinal: '15/10/2026' })).toEqual({
      dataInicial: '2026-10-01',
      dataFinal: '2026-10-15',
    });
  });

  it('aceita um período de um único dia', () => {
    expect(periodoCustomizadoSchema.safeParse({ dataInicial: '05/10/2026', dataFinal: '05/10/2026' }).success).toBe(true);
  });

  it('campos vazios têm uma mensagem só, em português', () => {
    expect(errosDe('', '')).toEqual({
      dataInicial: ['Informe a data inicial.'],
      dataFinal: ['Informe a data final.'],
    });
  });

  it('recusa data que não existe no calendário', () => {
    expect(errosDe('31/02/2026', '15/10/2026').dataInicial).toEqual(['Data inválida. Use DD/MM/AAAA.']);
  });

  it('recusa data final anterior à inicial, mesmo em anos diferentes', () => {
    expect(errosDe('01/01/2027', '31/12/2026').dataFinal).toEqual(['A data final não pode ser anterior à data inicial.']);
  });

  it('aceita um ano inteiro, inclusive bissexto (366 dias)', () => {
    expect(MAX_DIAS_PERIODO).toBe(366);
    expect(periodoCustomizadoSchema.safeParse({ dataInicial: '01/01/2028', dataFinal: '31/12/2028' }).success).toBe(true);
  });

  it('recusa período maior que 366 dias', () => {
    expect(errosDe('01/01/2026', '02/01/2027').dataFinal).toEqual(['O período pode ter no máximo 366 dias.']);
  });

  it('recusa o histórico inteiro (1900 a 9999)', () => {
    expect(errosDe('01/01/1900', '31/12/9999').dataFinal).toEqual(['O período pode ter no máximo 366 dias.']);
  });
});
