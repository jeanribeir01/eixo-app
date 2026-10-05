import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { RefreshControl } from 'react-native';

import { colors } from '@/ui';

import { resumoCaixaComDados, resumoCaixaVazio } from '../../__mocks__/resumoCaixaMock';
import { buscarResumoCaixa } from '../fonteResumoCaixa';
import type { ResumoCaixa } from '../resumoCaixa';
import { SaldoProjecaoView } from '../SaldoProjecaoView';

jest.setTimeout(15000);

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useFocusEffect: (callback: () => void) => react.useEffect(callback, []),
  };
});

jest.mock('../fonteResumoCaixa', () => ({ buscarResumoCaixa: jest.fn() }));

const NBSP = ' ';

function responder(data: ResumoCaixa) {
  (buscarResumoCaixa as jest.Mock).mockResolvedValue({ ok: true, data });
}

describe('SaldoProjecaoView', () => {
  beforeEach(() => {
    (buscarResumoCaixa as jest.Mock).mockReset();
  });

  it('carregando: mostra o skeleton enquanto o resumo não chega', () => {
    (buscarResumoCaixa as jest.Mock).mockReturnValue(new Promise(() => undefined));

    render(<SaldoProjecaoView />);

    expect(screen.getByLabelText('Carregando saldo')).toBeOnTheScreen();
  });

  it('render com dados: saldo atual em R$, projeção por mês e bloco sem data', async () => {
    responder(resumoCaixaComDados);

    render(<SaldoProjecaoView />);

    const saldo = await screen.findByText(`+ R$${NBSP}12.500,00`);
    expect(saldo).toHaveStyle({ color: colors.success });

    for (const mes of ['Outubro de 2026', 'Novembro de 2026', 'Dezembro de 2026', 'Janeiro de 2027']) {
      expect(screen.getByText(mes)).toBeOnTheScreen();
    }
    expect(screen.getAllByText('Entradas pendentes:')).toHaveLength(4);
    expect(screen.getAllByText('Saídas pendentes:')).toHaveLength(4);
    expect(screen.getByText(`− R$${NBSP}16.000,00`)).toBeOnTheScreen();

    expect(screen.getByText('Pendentes sem data de vencimento')).toBeOnTheScreen();
    expect(screen.getByText('2 movimentações')).toBeOnTheScreen();
    expect(screen.getByText(`− R$${NBSP}1.200,00`)).toBeOnTheScreen();
  });

  it('mês com saldo projetado negativo: valor em vermelho com sinal e alerta', async () => {
    responder(resumoCaixaComDados);

    render(<SaldoProjecaoView />);

    // Só novembro fecha negativo no mock: exatamente um alerta.
    expect(await screen.findAllByText('⚠ Saldo negativo')).toHaveLength(1);
    expect(screen.getByText(`− R$${NBSP}2.000,00`)).toHaveStyle({ color: colors.danger });
  });

  it('sem mês negativo, nenhum alerta aparece', async () => {
    responder({
      ...resumoCaixaComDados,
      projecao: resumoCaixaComDados.projecao.filter((mes) => mes.saldoProjetadoCentavos >= 0),
    });

    render(<SaldoProjecaoView />);

    await screen.findByText('Outubro de 2026');
    expect(screen.queryByText('⚠ Saldo negativo')).not.toBeOnTheScreen();
  });

  it('saldo atual negativo fica vermelho e com sinal de menos', async () => {
    responder({ ...resumoCaixaComDados, saldoAtualCentavos: -30_000 });

    render(<SaldoProjecaoView />);

    expect(await screen.findByText(`− R$${NBSP}300,00`)).toHaveStyle({ color: colors.danger });
  });

  it('estado vazio: nenhuma movimentação ainda', async () => {
    responder(resumoCaixaVazio);

    render(<SaldoProjecaoView />);

    expect(await screen.findByText('Nenhuma movimentação ainda')).toBeOnTheScreen();
    expect(screen.queryByText('Saldo atual')).not.toBeOnTheScreen();
  });

  it('erro: mostra a mensagem e "Tentar novamente" busca de novo', async () => {
    (buscarResumoCaixa as jest.Mock)
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar o saldo. Tente novamente.' })
      .mockResolvedValueOnce({ ok: true, data: resumoCaixaComDados });

    render(<SaldoProjecaoView />);

    expect(await screen.findByText('Não foi possível carregar o saldo. Tente novamente.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Saldo atual')).toBeOnTheScreen();
    expect(buscarResumoCaixa).toHaveBeenCalledTimes(2);
  });

  it('pull-to-refresh busca de novo e mostra o saldo atualizado', async () => {
    (buscarResumoCaixa as jest.Mock)
      .mockResolvedValueOnce({ ok: true, data: resumoCaixaComDados })
      .mockResolvedValueOnce({ ok: true, data: { ...resumoCaixaComDados, saldoAtualCentavos: 1_500_000 } });

    render(<SaldoProjecaoView />);
    await screen.findByText(`+ R$${NBSP}12.500,00`);

    await act(async () => {
      screen.UNSAFE_getByType(RefreshControl).props.onRefresh();
    });

    expect(await screen.findByText(`+ R$${NBSP}15.000,00`)).toBeOnTheScreen();
    expect(screen.getByText('Saldo atualizado.')).toBeOnTheScreen();
  });

  it('pull-to-refresh com erro mantém o saldo anterior e avisa', async () => {
    (buscarResumoCaixa as jest.Mock)
      .mockResolvedValueOnce({ ok: true, data: resumoCaixaComDados })
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar o saldo. Tente novamente.' });

    render(<SaldoProjecaoView />);
    await screen.findByText(`+ R$${NBSP}12.500,00`);

    await act(async () => {
      screen.UNSAFE_getByType(RefreshControl).props.onRefresh();
    });

    expect(await screen.findByText('Não foi possível carregar o saldo. Tente novamente.')).toBeOnTheScreen();
    expect(screen.getByText(`+ R$${NBSP}12.500,00`)).toBeOnTheScreen();
  });
});
