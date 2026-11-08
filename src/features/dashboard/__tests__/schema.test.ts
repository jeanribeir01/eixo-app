import { z } from 'zod';

import { periodoCustomizadoSchema } from '../schema';

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
});
