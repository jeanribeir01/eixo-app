import { dataDeReferencia } from '../movimentacoesRepository';

// Fuso fixo de Brasília: o CI roda em UTC, onde "data local" e "data UTC" coincidem e um
// erro de fuso passaria despercebido.
const fusoOriginal = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'America/Sao_Paulo';
});

afterAll(() => {
  process.env.TZ = fusoOriginal;
});

describe('dataDeReferencia (MOV-08 AC1)', () => {
  it('usa o vencimento quando existe', () => {
    expect(dataDeReferencia({ data_vencimento: '2026-11-10', data_inclusao: '2026-10-01T12:00:00Z' })).toBe('2026-11-10');
  });

  it('sem vencimento, usa o dia local da inclusão (22h de 31/10 em Brasília já é 01/11 em UTC)', () => {
    expect(dataDeReferencia({ data_vencimento: null, data_inclusao: '2026-11-01T01:00:00Z' })).toBe('2026-10-31');
  });
});
