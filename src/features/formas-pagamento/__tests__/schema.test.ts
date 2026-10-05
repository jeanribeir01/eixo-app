import { formaPagamentoSchema } from '../schema';

describe('formaPagamentoSchema', () => {
  it('valida nome válido', () => {
    const resultado = formaPagamentoSchema.safeParse({ nome: 'Dinheiro' });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.nome).toBe('Dinheiro');
    }
  });

  it('recusa nome vazio ou só com espaços', () => {
    const resultado = formaPagamentoSchema.safeParse({ nome: '   ' });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe('Informe o nome da forma de pagamento.');
    }
  });

  it('recusa nome com mais de 60 caracteres', () => {
    const resultado = formaPagamentoSchema.safeParse({ nome: 'a'.repeat(61) });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe('O nome pode ter no máximo 60 caracteres.');
    }
  });

  it('remove espaços em branco no início e no fim', () => {
    const resultado = formaPagamentoSchema.safeParse({ nome: '  Pix  ' });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.nome).toBe('Pix');
    }
  });
});
