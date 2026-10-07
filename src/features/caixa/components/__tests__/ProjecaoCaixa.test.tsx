import { fireEvent, render, screen } from '@testing-library/react-native';

import { colors } from '@/ui';

import { somarMeses } from '../../projecao';
import type { AnoProjetado, MesProjetado } from '../../resumoCaixa';
import { ProjecaoCaixa } from '../ProjecaoCaixa';

// Financiamento de 80 parcelas de R$ 1.500 a partir de novembro de 2026, com R$ 30.000 em caixa:
// o saldo cai R$ 1.500 por mês e fica negativo na 21ª parcela (julho de 2028).
const SALDO_INICIAL = 3_000_000;
const PARCELA = 150_000;
const oitentaMeses: MesProjetado[] = Array.from({ length: 80 }, (_, i) => ({
  mes: somarMeses('2026-11', i),
  entradasPendentesCentavos: 0,
  saidasPendentesCentavos: PARCELA,
  saldoProjetadoCentavos: SALDO_INICIAL - PARCELA * (i + 1),
}));

// Como o banco soma esses meses (os valores vêm prontos; a tela não soma nada).
const anosDoFinanciamento: AnoProjetado[] = [
  { ano: 2026, entradasPendentesCentavos: 0, saidasPendentesCentavos: 300_000, saldoFimDoAnoCentavos: 2_700_000, menorSaldoCentavos: 2_700_000 },
  { ano: 2027, entradasPendentesCentavos: 0, saidasPendentesCentavos: 1_800_000, saldoFimDoAnoCentavos: 900_000, menorSaldoCentavos: 900_000 },
  { ano: 2028, entradasPendentesCentavos: 0, saidasPendentesCentavos: 1_800_000, saldoFimDoAnoCentavos: -900_000, menorSaldoCentavos: -900_000 },
];

function renderFinanciamento() {
  render(<ProjecaoCaixa mesReferencia="2026-10" meses={oitentaMeses} anos={anosDoFinanciamento} />);
}

describe('ProjecaoCaixa — 12 meses (EIX-74)', () => {
  it('abre na aba "12 meses" e mostra só os meses da janela, não os 80', () => {
    renderFinanciamento();

    expect(screen.getByRole('tab', { name: '12 meses' })).toBeSelected();
    expect(screen.getByText('Novembro de 2026')).toBeOnTheScreen();
    expect(screen.getByText('Setembro de 2027')).toBeOnTheScreen();
    expect(screen.queryByText('Outubro de 2027')).not.toBeOnTheScreen();
    expect(screen.queryByText('Junho de 2033')).not.toBeOnTheScreen();
    expect(screen.getAllByText('Saídas')).toHaveLength(11);
  });

  it('avisa quantos meses ficam de fora e até quando', () => {
    renderFinanciamento();

    expect(screen.getByText('Mais 69 meses com pendências até junho de 2033.')).toBeOnTheScreen();
  });

  it('o alerta do topo aponta o primeiro mês negativo, mesmo fora da janela', () => {
    renderFinanciamento();

    expect(screen.getByText('⚠ O saldo fica negativo em julho de 2028')).toBeOnTheScreen();
    // Dentro da janela nenhum mês é negativo: nenhum alerta por linha.
    expect(screen.queryByText('⚠ Saldo negativo')).not.toBeOnTheScreen();
  });

  it('linha compacta: saldo projetado com sinal e cor; valor zero não aparece', () => {
    renderFinanciamento();

    expect(screen.getAllByText('− R$ 1.500,00')).toHaveLength(11);
    expect(screen.getByText('+ R$ 28.500,00')).toHaveStyle({ color: colors.success });
    expect(screen.queryByText('Entradas')).not.toBeOnTheScreen();
  });

  it('mês negativo dentro da janela ganha "⚠ Saldo negativo" e valor vermelho', () => {
    const meses: MesProjetado[] = [
      { mes: '2026-10', entradasPendentesCentavos: 50_000, saidasPendentesCentavos: 200_000, saldoProjetadoCentavos: -30_000 },
    ];
    render(<ProjecaoCaixa mesReferencia="2026-10" meses={meses} anos={[]} />);

    expect(screen.getByText('⚠ Saldo negativo')).toBeOnTheScreen();
    expect(screen.getByText('− R$ 300,00')).toHaveStyle({ color: colors.danger });
    expect(screen.getByText('Entradas')).toBeOnTheScreen();
    expect(screen.getByText('+ R$ 500,00')).toBeOnTheScreen();
  });

  it('tudo cabe nos 12 meses: sem aviso de meses de fora', () => {
    render(<ProjecaoCaixa mesReferencia="2026-10" meses={oitentaMeses.slice(0, 3)} anos={anosDoFinanciamento.slice(0, 2)} />);

    expect(screen.queryByText(/^Mais \d+/)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ver por ano' })).not.toBeOnTheScreen();
  });

  it('nenhuma pendência na janela, mas há depois: diz isso e oferece "Ver por ano"', () => {
    const depois = oitentaMeses.slice(20);
    render(<ProjecaoCaixa mesReferencia="2026-10" meses={depois} anos={anosDoFinanciamento} />);

    expect(screen.getByText('Nenhuma pendência nos próximos 12 meses.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ver por ano' })).toBeOnTheScreen();
  });
});

describe('ProjecaoCaixa — por ano (EIX-74)', () => {
  it('"Ver por ano" troca para a aba anual', () => {
    renderFinanciamento();

    fireEvent.press(screen.getByRole('button', { name: 'Ver por ano' }));

    expect(screen.getByRole('tab', { name: 'Por ano' })).toBeSelected();
    expect(screen.getByText('Saldo projetado no fim de cada ano.')).toBeOnTheScreen();
  });

  it('uma linha por ano com as saídas somadas pelo banco e o saldo no fim do ano', () => {
    renderFinanciamento();

    fireEvent.press(screen.getByRole('tab', { name: 'Por ano' }));

    expect(screen.getByText('2026')).toBeOnTheScreen();
    expect(screen.getByText('2027')).toBeOnTheScreen();
    expect(screen.getByText('2028')).toBeOnTheScreen();
    expect(screen.getAllByText('− R$ 18.000,00')).toHaveLength(2);
    expect(screen.getByText('+ R$ 9.000,00')).toBeOnTheScreen();
    expect(screen.getByText('− R$ 9.000,00')).toHaveStyle({ color: colors.danger });
    expect(screen.queryByText('Novembro de 2026')).not.toBeOnTheScreen();
  });

  it('ano que fica negativo no meio e termina positivo também ganha o alerta', () => {
    const anos: AnoProjetado[] = [
      { ano: 2027, entradasPendentesCentavos: 800_000, saidasPendentesCentavos: 500_000, saldoFimDoAnoCentavos: 30_000, menorSaldoCentavos: -50_000 },
    ];
    const meses: MesProjetado[] = [
      { mes: '2027-03', entradasPendentesCentavos: 0, saidasPendentesCentavos: 500_000, saldoProjetadoCentavos: -50_000 },
      { mes: '2027-09', entradasPendentesCentavos: 800_000, saidasPendentesCentavos: 0, saldoProjetadoCentavos: 30_000 },
    ];
    render(<ProjecaoCaixa mesReferencia="2026-10" meses={meses} anos={anos} />);

    fireEvent.press(screen.getByRole('tab', { name: 'Por ano' }));

    expect(screen.getByText('+ R$ 300,00')).toHaveStyle({ color: colors.success });
    expect(screen.getByText('⚠ Saldo negativo')).toBeOnTheScreen();
  });
});

describe('ProjecaoCaixa — sem pendências (EIX-74)', () => {
  it('sem nenhum mês com pendência: só a mensagem, sem abas', () => {
    render(<ProjecaoCaixa mesReferencia="2026-10" meses={[]} anos={[]} />);

    expect(screen.getByText('Nenhuma pendência com data de vencimento.')).toBeOnTheScreen();
    expect(screen.queryByRole('tab')).not.toBeOnTheScreen();
  });
});
