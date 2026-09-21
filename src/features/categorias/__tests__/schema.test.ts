import { z } from 'zod';

import { categoriaSchema } from '../schema';

describe('categoriaSchema', () => {
  it('aceita título e tipo válidos', () => {
    const resultado = categoriaSchema.safeParse({ titulo: 'Combustível', tipo: 'Saida' });

    expect(resultado.success).toBe(true);
  });

  it('rejeita título vazio com mensagem em português', () => {
    const resultado = categoriaSchema.safeParse({ titulo: '', tipo: 'Entrada' });

    expect(resultado.success).toBe(false);
    if (resultado.success) return;
    expect(z.flattenError(resultado.error).fieldErrors.titulo).toEqual(['Informe o título da categoria.']);
  });

  it('rejeita título só com espaços (trim)', () => {
    const resultado = categoriaSchema.safeParse({ titulo: '   ', tipo: 'Entrada' });

    expect(resultado.success).toBe(false);
  });

  it('rejeita tipo fora de Entrada/Saida', () => {
    const resultado = categoriaSchema.safeParse({ titulo: 'Combustível', tipo: 'Invalido' });

    expect(resultado.success).toBe(false);
    if (resultado.success) return;
    expect(z.flattenError(resultado.error).fieldErrors.tipo).toEqual(['Escolha Entrada ou Saída.']);
  });
});
