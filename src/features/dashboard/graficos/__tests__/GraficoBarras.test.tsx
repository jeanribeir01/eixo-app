import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';

import { porTipo } from '@/testing/componentes';
import { colors } from '@/ui/tokens';

import { GraficoBarras } from '../GraficoBarras';
import type { MesDoFluxo } from '../queries';

const MESES: MesDoFluxo[] = [
  { mes: '2026-09', entradas_centavos: 0, saidas_centavos: 0 },
  { mes: '2026-10', entradas_centavos: 100163, saidas_centavos: 20025 },
  { mes: '2026-11', entradas_centavos: 50000, saidas_centavos: 113 },
];

function coluna(nome: RegExp) {
  return screen.getByRole('button', { name: nome });
}

describe('GraficoBarras', () => {
  it('desenha uma coluna tocável por mês e abre no mês mais recente (GRAF-06)', async () => {
    await render(<GraficoBarras meses={MESES} />);

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText('Novembro de 2026')).toBeOnTheScreen();
    expect(screen.getByText('+ R$ 500,00')).toBeOnTheScreen();
    expect(screen.getByText('− R$ 1,13')).toBeOnTheScreen();
    expect(coluna(/^Novembro de 2026/)).toBeSelected();
  });

  it('tocar num mês mostra as Entradas com "+" e as Saídas com "−" daquele mês (GRAF-07)', async () => {
    await render(<GraficoBarras meses={MESES} />);

    await fireEvent.press(coluna(/^Outubro de 2026/));

    expect(screen.getByText('Outubro de 2026')).toBeOnTheScreen();
    expect(screen.getByText('+ R$ 1.001,63')).toBeOnTheScreen();
    expect(screen.getByText('− R$ 200,25')).toBeOnTheScreen();
    expect(coluna(/^Outubro de 2026/)).toBeSelected();
    expect(coluna(/^Novembro de 2026/)).not.toBeSelected();
  });

  it('mês parado mostra zero sem sinal', async () => {
    await render(<GraficoBarras meses={MESES} />);

    await fireEvent.press(coluna(/^Setembro de 2026/));

    expect(screen.getAllByText('R$ 0,00')).toHaveLength(2);
  });

  it('o leitor de tela anuncia mês e valores de cada coluna', async () => {
    await render(<GraficoBarras meses={MESES} />);

    expect(coluna(/^Outubro de 2026: entradas \+ R\$ 1\.001,63, saídas − R\$ 200,25$/)).toBeOnTheScreen();
  });

  it('cada coluna tem pelo menos 44pt de largura e as barras usam as cores dos tokens (GRAF-19)', async () => {
    await render(<GraficoBarras meses={MESES} />);

    const estilo = StyleSheet.flatten(coluna(/^Outubro de 2026/).props.style);
    expect(estilo.width).toBeGreaterThanOrEqual(44);

    const cores = screen.container
      .queryAll((no) => typeof no.props.style !== 'undefined')
      .map((no) => StyleSheet.flatten(no.props.style)?.backgroundColor)
      .filter((cor): cor is string => typeof cor === 'string');
    // Entrada verde e saída vermelha, como no resto do app; nunca a saída em preto.
    expect(cores).toContain(colors.success);
    expect(cores).toContain(colors.danger);
    expect(cores).not.toContain(colors.inverted);
    expect(cores.every((cor) => (Object.values(colors) as string[]).includes(cor))).toBe(true);
  });

  it('com 24 meses numa tela estreita, as colunas mantêm 44pt e o gráfico rola na horizontal (GRAF-19)', async () => {
    const vinteQuatroMeses: MesDoFluxo[] = Array.from({ length: 24 }, (_, indice) => ({
      mes: `${2025 + Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}`,
      entradas_centavos: 1000,
      saidas_centavos: 500,
    }));
    await render(<GraficoBarras meses={vinteQuatroMeses} />);

    // Largura de um celular pequeno: 24 × 44pt não cabe em 320pt.
    await fireEvent(porTipo(ScrollView).elementoNativo().parent!, 'layout', { nativeEvent: { layout: { width: 320 } } });

    expect(porTipo(ScrollView).props.horizontal).toBe(true);
    const larguras = screen.getAllByRole('button').map((botao) => StyleSheet.flatten(botao.props.style).width);
    expect(larguras).toHaveLength(24);
    expect(larguras.every((largura) => largura >= 44)).toBe(true);
  });

  it('a legenda dá nome às duas cores', async () => {
    await render(<GraficoBarras meses={MESES} />);

    expect(screen.getByText('Entradas')).toBeOnTheScreen();
    expect(screen.getByText('Saídas')).toBeOnTheScreen();
  });
});
