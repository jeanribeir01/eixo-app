import { periodoDoAno, periodoDoMes } from '@/features/dashboard/periodo';

import { nomeDoArquivo } from '../arquivo';
import { nomeDaEmpresa } from '../empresa';

describe('nomeDoArquivo (EXP-14)', () => {
  it('mês: eixo-certo-AAAA-MM', () => {
    expect(nomeDoArquivo(periodoDoMes(2026, 11), 'csv')).toBe('eixo-certo-2026-11.csv');
    expect(nomeDoArquivo(periodoDoMes(2026, 3), 'pdf')).toBe('eixo-certo-2026-03.pdf');
  });

  it('ano: eixo-certo-AAAA', () => {
    expect(nomeDoArquivo(periodoDoAno(2025), 'csv')).toBe('eixo-certo-2025.csv');
  });

  it('customizado: eixo-certo-início-a-fim', () => {
    const periodo = { modo: 'customizado' as const, dataInicial: '2026-11-01', dataFinal: '2026-11-15' };

    expect(nomeDoArquivo(periodo, 'pdf')).toBe('eixo-certo-2026-11-01-a-2026-11-15.pdf');
  });
});

describe('nomeDaEmpresa (EXP-10)', () => {
  it('usa o valor configurado, sem espaços nas pontas', () => {
    expect(nomeDaEmpresa('  Transportes Silva ')).toBe('Transportes Silva');
  });

  it.each([undefined, '', '   '])('vazio ou ausente (%j) vira "Eixo Certo"', (valor) => {
    expect(nomeDaEmpresa(valor)).toBe('Eixo Certo');
  });
});
