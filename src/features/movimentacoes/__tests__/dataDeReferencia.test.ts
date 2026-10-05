import { dataDeReferencia } from '../movimentacoesRepository';

// dataDeReferencia é pura, mas o módulo importa o client real; no Node 20 do CI
// (sem WebSocket nativo) o createClient quebra ao montar o Realtime.
jest.mock('@/supabase/client', () => ({ supabase: {} }));

// Roda no fuso de Brasília em qualquer máquina (jest.global-setup.js), inclusive no CI em UTC.
describe('dataDeReferencia (MOV-08 AC1)', () => {
  it('usa o vencimento quando existe', () => {
    expect(dataDeReferencia({ data_vencimento: '2026-11-10', data_inclusao: '2026-10-01T12:00:00Z' })).toBe('2026-11-10');
  });

  it('sem vencimento, usa o dia local da inclusão (22h de 31/10 em Brasília já é 01/11 em UTC)', () => {
    expect(dataDeReferencia({ data_vencimento: null, data_inclusao: '2026-11-01T01:00:00Z' })).toBe('2026-10-31');
  });
});
