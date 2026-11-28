import { colors } from '@/ui/tokens';

import {
  ALTURA_MIN_BARRA,
  alturaDaBarra,
  caminhoDoSetor,
  corDaFatia,
  HORIZONTE_PADRAO,
  horizonteDaOpcao,
  LARGURA_MIN_COLUNA,
  mesFinalDoGrafico,
  OPCOES_HORIZONTE,
  setoresDaRosca,
} from '../geometria';

describe('horizonte das barras (GRAF-06)', () => {
  it('oferece 3 meses, 6 meses, 1 ano, 2 anos e Máximo, com 6 meses como padrão', () => {
    expect(OPCOES_HORIZONTE.map((opcao) => opcao.label)).toEqual(['3 meses', '6 meses', '1 ano', '2 anos', 'Máximo']);
    expect(OPCOES_HORIZONTE.find((opcao) => opcao.value === HORIZONTE_PADRAO)?.label).toBe('6 meses');
  });

  it('cada aba vira o número de meses da RPC; Máximo vira nulo', () => {
    expect(OPCOES_HORIZONTE.map((opcao) => horizonteDaOpcao(opcao.value))).toEqual([3, 6, 12, 24, null]);
  });

  it('valor desconhecido não vira horizonte', () => {
    expect(horizonteDaOpcao('36')).toBeUndefined();
  });
});

describe('mesFinalDoGrafico (GRAF-14)', () => {
  it('usa a data final do filtro quando ela já passou', () => {
    expect(mesFinalDoGrafico('2026-09-30', '2026-11-22')).toBe('2026-09-30');
  });

  it('para no dia de hoje quando o filtro termina no futuro', () => {
    expect(mesFinalDoGrafico('2026-12-31', '2026-11-22')).toBe('2026-11-22');
  });
});

describe('alturaDaBarra', () => {
  it('é proporcional ao maior valor do gráfico', () => {
    expect(alturaDaBarra(50, 200, 192)).toBe(48);
    expect(alturaDaBarra(200, 200, 192)).toBe(192);
  });

  it('zero não desenha barra; valor pequeno acima de zero ainda aparece', () => {
    expect(alturaDaBarra(0, 200, 192)).toBe(0);
    expect(alturaDaBarra(1, 1000000, 192)).toBe(ALTURA_MIN_BARRA);
  });

  it('gráfico todo zerado não divide por zero', () => {
    expect(alturaDaBarra(0, 0, 192)).toBe(0);
  });
});

describe('setoresDaRosca', () => {
  it('divide os 360° na proporção dos totais, começando no topo', () => {
    expect(setoresDaRosca([300, 100])).toEqual([
      { inicio: 0, fim: 270 },
      { inicio: 270, fim: 360 },
    ]);
  });

  it('fecha o anel mesmo quando os percentuais arredondados não somam 100', () => {
    // 1/3 de cada: os percentuais seriam 33,3 + 33,3 + 33,3 = 99,9.
    const setores = setoresDaRosca([1, 1, 1]);

    expect(setores[2]!.fim).toBeCloseTo(360, 10);
  });

  it('sem total não há fatia', () => {
    expect(setoresDaRosca([])).toEqual([]);
  });
});

describe('caminhoDoSetor (GRAF-13)', () => {
  it('desenha a fatia como pedaço de anel entre os dois raios', () => {
    // Quarto de anel do topo (12h) às 3h, centro 100, raios 100 e 76.
    expect(caminhoDoSetor(100, 100, 76, { inicio: 0, fim: 90 })).toBe(
      'M 100.000 0.000 A 100 100 0 0 1 200.000 100.000 L 176.000 100.000 A 76 76 0 0 0 100.000 24.000 Z',
    );
  });

  it('marca o arco grande quando a fatia passa de 180°', () => {
    expect(caminhoDoSetor(100, 100, 76, { inicio: 0, fim: 270 })).toContain('A 100 100 0 1 1');
  });

  it('uma categoria só (100%) vira anel inteiro: dois círculos', () => {
    const caminho = caminhoDoSetor(100, 100, 76, { inicio: 0, fim: 360 });

    expect(caminho).toBe(
      'M 100.000 0.000 A 100 100 0 1 1 100.000 200.000 A 100 100 0 1 1 100.000 0.000 Z ' +
        'M 100.000 24.000 A 76 76 0 1 1 100.000 176.000 A 76 76 0 1 1 100.000 24.000 Z',
    );
  });
});

describe('cores (GRAF-19)', () => {
  it('as fatias usam só os tokens, sem o preto, e "Outras" é a mais apagada', () => {
    expect([0, 1, 2, 3, 4].map((indice) => corDaFatia(indice, false))).toEqual([
      colors.accentStrong,
      colors.accent,
      colors.textBody,
      colors.accentWash,
      colors.borderMuted,
    ]);
    expect(corDaFatia(5, true)).toBe(colors.textMuted);
  });

  it('a coluna de mês tem o alvo de toque mínimo de 44pt', () => {
    expect(LARGURA_MIN_COLUNA).toBe(44);
  });
});
