import { z } from 'zod';

import { movimentacaoSchema, type MovimentacaoFormValues } from '../schema';
import { rotuloStatus } from '../types';

const valido: MovimentacaoFormValues = {
  valorCentavos: 150000,
  descricao: '  Frete Curitiba  ',
  categoriaId: 'cat-1',
  formaPagamentoId: 'fp-1',
  dataVencimento: '',
  status: 'Pendente',
      caminhoComprovante: null,
  dataPagamento: '',
};

function errosDe(valores: MovimentacaoFormValues) {
  const resultado = movimentacaoSchema.safeParse(valores);
  if (resultado.success) return {};
  return z.flattenError(resultado.error).fieldErrors;
}

describe('movimentacaoSchema', () => {
  it('Pendente válido sai com descrição sem espaços, datas nulas e data de pagamento nula', () => {
    expect(movimentacaoSchema.parse(valido)).toEqual({
      valorCentavos: 150000,
      descricao: 'Frete Curitiba',
      categoriaId: 'cat-1',
      formaPagamentoId: 'fp-1',
      dataVencimento: null,
      status: 'Pendente',
      caminhoComprovante: null,
      dataPagamento: null,
    });
  });

  it('converte as datas DD/MM/AAAA para ISO', () => {
    const saida = movimentacaoSchema.parse({
      ...valido,
      dataVencimento: '10/11/2026',
      status: 'Pago',
      caminhoComprovante: null,
      dataPagamento: '05/10/2026',
    });

    expect(saida.dataVencimento).toBe('2026-11-10');
    expect(saida.dataPagamento).toBe('2026-10-05');
  });

  it('Pendente descarta data de pagamento digitada', () => {
    expect(movimentacaoSchema.parse({ ...valido, dataPagamento: '05/10/2026' }).dataPagamento).toBeNull();
  });

  it('valor zero → "Informe um valor maior que zero." (MOV-03)', () => {
    expect(errosDe({ ...valido, valorCentavos: 0 }).valorCentavos).toEqual(['Informe um valor maior que zero.']);
  });

  it('descrição vazia ou só espaços → "Informe a descrição." (MOV-04)', () => {
    expect(errosDe({ ...valido, descricao: '   ' }).descricao).toEqual(['Informe a descrição.']);
  });

  it('descrição com mais de 120 caracteres é rejeitada', () => {
    expect(errosDe({ ...valido, descricao: 'a'.repeat(121) }).descricao).toEqual([
      'A descrição pode ter no máximo 120 caracteres.',
    ]);
    expect(errosDe({ ...valido, descricao: 'a'.repeat(120) }).descricao).toBeUndefined();
  });

  it('sem categoria → "Escolha a categoria." (MOV-04)', () => {
    expect(errosDe({ ...valido, categoriaId: null }).categoriaId).toEqual(['Escolha a categoria.']);
  });

  it('sem forma de pagamento → "Escolha a forma de pagamento." (MOV-04)', () => {
    expect(errosDe({ ...valido, formaPagamentoId: null }).formaPagamentoId).toEqual(['Escolha a forma de pagamento.']);
  });

  it('Pago sem data de pagamento → "Informe a data de pagamento." (MOV-05)', () => {
    expect(errosDe({ ...valido, status: 'Pago',
      caminhoComprovante: null, dataPagamento: '' }).dataPagamento).toEqual([
      'Informe a data de pagamento.',
    ]);
  });

  it('data inválida → "Data inválida. Use DD/MM/AAAA." (MOV-05)', () => {
    expect(errosDe({ ...valido, dataVencimento: '31/02/2026' }).dataVencimento).toEqual([
      'Data inválida. Use DD/MM/AAAA.',
    ]);
    expect(errosDe({ ...valido, status: 'Pago',
      caminhoComprovante: null, dataPagamento: '05/10' }).dataPagamento).toEqual([
      'Data inválida. Use DD/MM/AAAA.',
    ]);
  });
});

describe('rotuloStatus (MOV-01 AC13)', () => {
  it.each([
    ['Pago', 'Entrada', 'Recebido'],
    ['Pago', 'Saida', 'Pago'],
    ['Pendente', 'Entrada', 'Pendente'],
    ['Pendente', 'Saida', 'Pendente'],
  ] as const)('%s + %s → %s', (status, tipo, esperado) => {
    expect(rotuloStatus(status, tipo)).toBe(esperado);
  });
});
