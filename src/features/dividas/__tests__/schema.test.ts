import { z } from 'zod';

import { dividaSchema, somaTotalCentavos, type DividaFormValues } from '../schema';

const valido: DividaFormValues = {
  descricao: '  Financiamento do caminhão  ',
  categoriaId: 'cat-financiamento',
  formaPagamentoId: 'fp-boleto',
  quantidadeParcelas: 12,
  valorParcelaCentavos: 350000,
  dataVencimentoPrimeira: '15/01/2026',
  valorQuitacaoCentavos: null,
};

function errosDe(valores: DividaFormValues) {
  const resultado = dividaSchema.safeParse(valores);
  if (resultado.success) return {};
  return z.flattenError(resultado.error).fieldErrors;
}

describe('somaTotalCentavos', () => {
  it('é quantidade × valor da parcela, em centavos', () => {
    expect(somaTotalCentavos(12, 350000)).toBe(4200000);
    expect(somaTotalCentavos(48, 350010)).toBe(16800480);
  });
});

describe('dividaSchema', () => {
  it('dado válido sai com descrição sem espaços, data em ISO e quitação nula', () => {
    expect(dividaSchema.parse(valido)).toEqual({
      descricao: 'Financiamento do caminhão',
      categoriaId: 'cat-financiamento',
      formaPagamentoId: 'fp-boleto',
      quantidadeParcelas: 12,
      valorParcelaCentavos: 350000,
      dataVencimentoPrimeira: '2026-01-15',
      valorQuitacaoCentavos: null,
    });
  });

  it('menos de 1 parcela pede ao menos 1', () => {
    expect(errosDe({ ...valido, quantidadeParcelas: 0 }).quantidadeParcelas).toEqual(['Informe ao menos 1 parcela.']);
  });

  it('mais de 120 parcelas é recusado; 120 é aceito', () => {
    expect(errosDe({ ...valido, quantidadeParcelas: 121 }).quantidadeParcelas).toEqual(['O máximo é 120 parcelas.']);
    expect(dividaSchema.safeParse({ ...valido, quantidadeParcelas: 120 }).success).toBe(true);
  });

  it('valor da parcela zero pede valor maior que zero', () => {
    expect(errosDe({ ...valido, valorParcelaCentavos: 0 }).valorParcelaCentavos).toEqual([
      'Informe um valor maior que zero.',
    ]);
  });

  it('quitação acima da soma total é recusada; igual à soma é aceita', () => {
    // 12 × R$ 3.500,00 = R$ 42.000,00
    expect(errosDe({ ...valido, valorQuitacaoCentavos: 4200001 }).valorQuitacaoCentavos).toEqual([
      'A quitação não pode passar da soma total.',
    ]);
    expect(dividaSchema.parse({ ...valido, valorQuitacaoCentavos: 4200000 }).valorQuitacaoCentavos).toBe(4200000);
  });

  it('descrição vazia, sem categoria, sem forma e data inválida mostram a mensagem de cada campo', () => {
    const erros = errosDe({
      ...valido,
      descricao: '   ',
      categoriaId: null,
      formaPagamentoId: null,
      dataVencimentoPrimeira: '31/02/2026',
    });

    expect(erros.descricao).toEqual(['Informe a descrição.']);
    expect(erros.categoriaId).toEqual(['Escolha a categoria.']);
    expect(erros.formaPagamentoId).toEqual(['Escolha a forma de pagamento.']);
    expect(erros.dataVencimentoPrimeira).toEqual(['Data inválida. Use DD/MM/AAAA.']);
  });
});
