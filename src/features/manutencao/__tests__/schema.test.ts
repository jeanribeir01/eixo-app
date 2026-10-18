import { manutencaoSchema, valoresIniciais, type ManutencaoFormValues } from '../schema';

// O Jest roda com TZ=America/Sao_Paulo (jest.global-setup.js). 18/10/2026 às 23h30 em São Paulo
// já é 19/10 em UTC: uma regra de "hoje" calculada em UTC aceitaria o dia 19 e falharia aqui (L-001).
const HOJE_23H30 = new Date(2026, 9, 18, 23, 30);

const valido: ManutencaoFormValues = {
  veiculoId: 'v1',
  dataManutencao: '18/10/2026',
  descricao: 'Troca de pneus',
  valorCentavos: 113,
  formaPagamentoId: 'f1',
  statusPagamento: 'Pago',
};

function mensagens(input: ManutencaoFormValues): string[] {
  const resultado = manutencaoSchema.safeParse(input);
  return resultado.success ? [] : resultado.error.issues.map((issue) => issue.message);
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(HOJE_23H30);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('valoresIniciais', () => {
  // MAN-04, MAN-42: data de hoje no fuso do aparelho, mesmo às 23h30.
  it('começa com a data de hoje no fuso do aparelho e o status Pendente', () => {
    expect(valoresIniciais()).toEqual({
      veiculoId: null,
      dataManutencao: '18/10/2026',
      descricao: '',
      valorCentavos: 0,
      formaPagamentoId: null,
      statusPagamento: 'Pendente',
    });
  });
});

describe('manutencaoSchema', () => {
  // MAN-41: o valor continua em centavos inteiros; a conversão para reais é do repositório.
  it('caminho feliz: devolve a data em ISO, a descrição limpa e o valor em centavos inteiros', () => {
    expect(manutencaoSchema.parse({ ...valido, descricao: '  Troca de pneus  ' })).toEqual({
      veiculoId: 'v1',
      dataManutencao: '2026-10-18',
      descricao: 'Troca de pneus',
      valorCentavos: 113,
      formaPagamentoId: 'f1',
      statusPagamento: 'Pago',
    });
  });

  // MAN-06
  it('rejeita valor zero', () => {
    expect(mensagens({ ...valido, valorCentavos: 0 })).toEqual(['Informe um valor maior que zero.']);
  });

  // MAN-07
  it.each([
    ['vazia', ''],
    ['incompleta', '18/10'],
    ['inexistente no calendário', '31/02/2026'],
  ])('rejeita data %s', (_caso, dataManutencao) => {
    expect(mensagens({ ...valido, dataManutencao })).toEqual(['Informe a data da manutenção.']);
  });

  // MAN-08, MAN-42: às 23h30 de 18/10 em São Paulo, o dia 18 é hoje e o dia 19 ainda é futuro.
  it('aceita a data de hoje às 23h30 e recusa a de amanhã', () => {
    expect(manutencaoSchema.safeParse({ ...valido, dataManutencao: '18/10/2026' }).success).toBe(true);
    expect(mensagens({ ...valido, dataManutencao: '19/10/2026' })).toEqual([
      'A data da manutenção não pode ser futura.',
    ]);
  });

  it('aceita data passada', () => {
    expect(manutencaoSchema.parse({ ...valido, dataManutencao: '01/01/2026' }).dataManutencao).toBe('2026-01-01');
  });

  // MAN-09
  it('exige o veículo', () => {
    expect(mensagens({ ...valido, veiculoId: null })).toEqual(['Escolha o veículo.']);
  });

  // MAN-10
  it('exige a forma de pagamento', () => {
    expect(mensagens({ ...valido, formaPagamentoId: null })).toEqual(['Escolha a forma de pagamento.']);
  });

  // MAN-11
  it('exige a descrição, inclusive quando só há espaços', () => {
    expect(mensagens({ ...valido, descricao: '' })).toEqual(['Descreva o serviço.']);
    expect(mensagens({ ...valido, descricao: '   ' })).toEqual(['Descreva o serviço.']);
  });

  // MAN-12
  it('aceita até 200 caracteres depois do trim e recusa 201', () => {
    expect(manutencaoSchema.safeParse({ ...valido, descricao: ` ${'a'.repeat(200)} ` }).success).toBe(true);
    expect(mensagens({ ...valido, descricao: 'a'.repeat(201) })).toEqual([
      'A descrição pode ter no máximo 200 caracteres.',
    ]);
  });
});
