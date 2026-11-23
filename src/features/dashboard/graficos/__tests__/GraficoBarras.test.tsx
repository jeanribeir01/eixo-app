import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

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
  it('desenha uma coluna tocável por mês e abre no mês mais recente (GRAF-06)', () => {
    render(<GraficoBarras meses={MESES} />);

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText('Novembro de 2026')).toBeOnTheScreen();
    expect(screen.getByText('+ R$ 500,00')).toBeOnTheScreen();
    expect(screen.getByText('− R$ 1,13')).toBeOnTheScreen();
    expect(coluna(/^Novembro de 2026/)).toBeSelected();
  });

  it('tocar num mês mostra as Entradas com "+" e as Saídas com "−" daquele mês (GRAF-07)', () => {
    render(<GraficoBarras meses={MESES} />);

    fireEvent.press(coluna(/^Outubro de 2026/));

    expect(screen.getByText('Outubro de 2026')).toBeOnTheScreen();
    expect(screen.getByText('+ R$ 1.001,63')).toBeOnTheScreen();
    expect(screen.getByText('− R$ 200,25')).toBeOnTheScreen();
    expect(coluna(/^Outubro de 2026/)).toBeSelected();
    expect(coluna(/^Novembro de 2026/)).not.toBeSelected();
  });

  it('mês parado mostra zero sem sinal', () => {
    render(<GraficoBarras meses={MESES} />);

    fireEvent.press(coluna(/^Setembro de 2026/));

    expect(screen.getAllByText('R$ 0,00')).toHaveLength(2);
  });

  it('o leitor de tela anuncia mês e valores de cada coluna', () => {
    render(<GraficoBarras meses={MESES} />);

    expect(coluna(/^Outubro de 2026: entradas \+ R\$ 1\.001,63, saídas − R\$ 200,25$/)).toBeOnTheScreen();
  });

  it('cada coluna tem pelo menos 44pt de largura e as barras usam as cores dos tokens (GRAF-19)', () => {
    render(<GraficoBarras meses={MESES} />);

    const estilo = StyleSheet.flatten(coluna(/^Outubro de 2026/).props.style);
    expect(estilo.width).toBeGreaterThanOrEqual(44);

    const cores = screen
      .UNSAFE_root.findAll((no) => typeof no.props.style !== 'undefined')
      .map((no) => StyleSheet.flatten(no.props.style)?.backgroundColor)
      .filter((cor): cor is string => typeof cor === 'string');
    expect(cores).toContain(colors.accent);
    expect(cores).toContain(colors.inverted);
    expect(cores.every((cor) => (Object.values(colors) as string[]).includes(cor))).toBe(true);
  });

  it('a legenda dá nome às duas cores', () => {
    render(<GraficoBarras meses={MESES} />);

    expect(screen.getByText('Entradas')).toBeOnTheScreen();
    expect(screen.getByText('Saídas')).toBeOnTheScreen();
  });
});
