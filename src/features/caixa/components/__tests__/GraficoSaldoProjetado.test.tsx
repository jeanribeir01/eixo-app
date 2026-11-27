import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { colors } from '@/ui';

import { GraficoSaldoProjetado, type PontoDoGrafico } from '../GraficoSaldoProjetado';
import { PendentesSemDataCard } from '../PendentesSemDataCard';

const pontos: PontoDoGrafico[] = [
  { chave: '2026-11', rotulo: 'nov', titulo: 'Novembro de 2026', centavos: 500_000 },
  { chave: '2026-12', rotulo: 'dez', titulo: 'Dezembro de 2026', centavos: -200_000 },
  { chave: '2027-01', rotulo: 'jan', titulo: 'Janeiro de 2027', centavos: 1_000_000 },
];

// Estilo final da barra de um período (cor e altura).
function barra(chave: string) {
  return StyleSheet.flatten(screen.getByTestId(`barra-${chave}`, { includeHiddenElements: true }).props.style);
}

describe('GraficoSaldoProjetado', () => {
  it('resume o período numa frase só para o leitor de tela', async () => {
    await render(<GraficoSaldoProjetado pontos={pontos} />);

    expect(
      screen.getByLabelText('Saldo projetado de novembro de 2026 a janeiro de 2027: de + R$ 5.000,00 a + R$ 10.000,00.'),
    ).toBeOnTheScreen();
  });

  it('uma barra por período: positivo no azul, negativo no vermelho', async () => {
    await render(<GraficoSaldoProjetado pontos={pontos} />);

    expect(barra('2026-11').backgroundColor).toBe(colors.accentStrong);
    expect(barra('2026-12').backgroundColor).toBe(colors.danger);
    expect(barra('2027-01').backgroundColor).toBe(colors.accentStrong);
    expect(screen.getByText('nov')).toBeOnTheScreen();
    expect(screen.getByText('dez')).toBeOnTheScreen();
  });

  it('a maior barra ocupa a altura toda do lado dela', async () => {
    await render(<GraficoSaldoProjetado pontos={pontos} />);

    // Janeiro (R$ 10 mil) é o dobro de novembro (R$ 5 mil).
    expect(Number(barra('2027-01').height)).toBeCloseTo(Number(barra('2026-11').height) * 2);
  });
});

describe('PendentesSemDataCard', () => {
  it('some quando não há pendência sem data', async () => {
    await render(<PendentesSemDataCard semVencimento={{ quantidade: 0, entradasCentavos: 0, saidasCentavos: 0 }} />);

    expect(screen.queryByText('Pendentes sem data')).not.toBeOnTheScreen();
  });

  it('diz quanto fica de fora da projeção, a receber e a pagar', async () => {
    await render(
      <PendentesSemDataCard semVencimento={{ quantidade: 1, entradasCentavos: 50_000, saidasCentavos: 120_000 }} />,
    );

    expect(screen.getByText('Pendentes sem data')).toBeOnTheScreen();
    expect(
      screen.getByText(
        '1 movimentação pendente não tem data de vencimento e fica fora da projeção: + R$ 500,00 a receber e − R$ 1.200,00 a pagar. Defina o vencimento para incluí-la.',
      ),
    ).toBeOnTheScreen();
  });
});
