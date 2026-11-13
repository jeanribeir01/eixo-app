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
  viagemId: null,
  litros: '',
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
      viagemId: null,
      litros: null,
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

// US09 (EIX-42): vínculo com viagem e litros do Combustível.
describe('movimentacaoSchema — viagem e litros', () => {
  const combustivel = (sobrescrever: Partial<MovimentacaoFormValues>) => ({
    ...valido,
    combustivel: true,
    ...sobrescrever,
  });

  function errosLitros(valores: MovimentacaoFormValues & { combustivel: boolean }) {
    const resultado = movimentacaoSchema.safeParse(valores);
    if (resultado.success) return undefined;
    return z.flattenError(resultado.error).fieldErrors.litros;
  }

  // PONTE-04
  it('viagem escolhida sai como viagemId', () => {
    expect(movimentacaoSchema.parse({ ...valido, viagemId: 'v-1' }).viagemId).toBe('v-1');
  });

  // PONTE-06
  it('sem viagem sai viagemId null', () => {
    expect(movimentacaoSchema.parse(valido).viagemId).toBeNull();
  });

  // LITROS-03
  it('Combustível vinculado sem litros → "Informe a quantidade em litros."', () => {
    expect(errosLitros(combustivel({ viagemId: 'v-1', litros: '  ' }))).toEqual(['Informe a quantidade em litros.']);
  });

  // Assumption da spec: sem viagem, litros é opcional.
  it('Combustível sem viagem e sem litros é válido e sai com litros null', () => {
    expect(movimentacaoSchema.parse(combustivel({ viagemId: null, litros: '' })).litros).toBeNull();
  });

  it.each([
    ['412,37', 412.37],
    ['412.5', 412.5],
    ['0,01', 0.01],
    ['999999,99', 999999.99],
  ])('Combustível com litros "%s" sai com %s', (texto, numero) => {
    expect(movimentacaoSchema.parse(combustivel({ viagemId: 'v-1', litros: texto })).litros).toBe(numero);
  });

  // LITROS-04
  it.each(['0', '0,00', '1000000', '12,345', 'abc', '-5', '1.200,50'])(
    'litros "%s" → mensagem de faixa e casas decimais',
    (texto) => {
      expect(errosLitros(combustivel({ litros: texto }))).toEqual([
        'Informe os litros com até 2 casas decimais, entre 0,01 e 999.999,99.',
      ]);
    },
  );

  // LITROS-02 e edge case "trocar de Combustível para outra categoria descarta os litros".
  it('fora de Combustível os litros digitados são descartados, mesmo inválidos', () => {
    const saida = movimentacaoSchema.parse({ ...valido, combustivel: false, viagemId: 'v-1', litros: 'abc' });

    expect(saida.litros).toBeNull();
  });
});
