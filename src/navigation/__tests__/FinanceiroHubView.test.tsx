import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { buscarMesEmAndamento, type MesEmAndamento } from '@/features/caixa/mesEmAndamento';
import { movimentacao } from '@/features/inicio/__mocks__/fixtures';
import { colors, radius } from '@/ui';

import { FinanceiroHubView } from '../FinanceiroHubView';

jest.setTimeout(15000);

const mockPush = jest.fn();

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 900, scale: 1, fontScale: 1 })),
}));

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]),
  };
});

jest.mock('@/features/caixa/mesEmAndamento', () => ({ buscarMesEmAndamento: jest.fn() }));
jest.mock('@/lib/datas', () => ({ ...jest.requireActual('@/lib/datas'), hojeISO: () => '2026-11-27' }));

const mockBuscar = buscarMesEmAndamento as jest.MockedFunction<typeof buscarMesEmAndamento>;

// Entradas: 850,00 pagos de 1.000,00 previstos. Saídas: 500,00 pagos de 500,00. Resultado: + 500,00.
function mes(sobrescrever: Partial<MesEmAndamento> = {}): MesEmAndamento {
  return {
    mes: '2026-11',
    entradasPagasCentavos: 85000,
    entradasPendentesCentavos: 15000,
    saidasPagasCentavos: 50000,
    saidasPendentesCentavos: 0,
    proximosVencimentos: [
      movimentacao({
        id: 'frete',
        descricao: 'Frete Curitiba → Porto Alegre',
        valorCentavos: 645446,
        data_vencimento: '2026-11-27',
        categoria: { titulo: 'Frete', tipo: 'Entrada', ativa: true },
      }),
      movimentacao({ id: 'pneus', descricao: 'Pneus Rodovia 1/6', valorCentavos: 152000, data_vencimento: '2026-11-30' }),
    ],
    vencidos: 7,
    ...sobrescrever,
  };
}

// Estilo da parte preenchida de uma barra do cartão (o primeiro filho do trilho).
function preenchimento(testID: string) {
  const filho = screen.getByTestId(testID, { includeHiddenElements: true }).children[0];
  if (typeof filho === 'string') throw new Error('a barra não tem preenchimento');
  return StyleSheet.flatten(filho.props.style);
}

const NOME_DO_CARTAO = 'Novembro, resultado previsto + R$ 500,00. Ver movimentações';

beforeEach(() => {
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 412, height: 900, scale: 1, fontScale: 1 });
  mockPush.mockReset();
  mockBuscar.mockReset();
});

async function renderComMes(dados: MesEmAndamento = mes()) {
  mockBuscar.mockResolvedValue({ ok: true, data: dados });
  await render(<FinanceiroHubView />);
  await screen.findByText('Próximos vencimentos');
}

async function renderComErro() {
  mockBuscar.mockResolvedValue({ ok: false, mensagem: 'Não foi possível carregar o saldo. Tente novamente.' });
  await render(<FinanceiroHubView />);
  await screen.findByText('Não foi possível carregar o saldo. Tente novamente.');
}

describe('FinanceiroHubView — o mês em andamento', () => {
  it('título da aba no conteúdo e o resultado previsto do mês num cartão de destaque', async () => {
    await renderComMes();

    expect(screen.getByText('Caixa')).toBeOnTheScreen();
    expect(screen.getByText('Novembro · resultado previsto')).toBeOnTheScreen();
    expect(screen.getByText('+ R$ 500,00')).toHaveStyle({ color: colors.success });
    expect(screen.getByRole('button', { name: NOME_DO_CARTAO })).toHaveStyle({ borderRadius: radius.feature });
  });

  it('o saldo não se repete aqui: ele é o destaque do Início', async () => {
    await renderComMes();

    expect(screen.queryByText('Saldo atual')).not.toBeOnTheScreen();
  });

  it('entradas e saídas: quanto foi pago do previsto, a barra na mesma proporção e o que falta', async () => {
    await renderComMes();

    expect(screen.getByText('R$ 850,00 de R$ 1.000,00')).toBeOnTheScreen();
    expect(screen.getByText('Falta receber R$ 150,00')).toBeOnTheScreen();
    expect(preenchimento('barra-entradas')).toMatchObject({
      width: '85%',
      backgroundColor: colors.success,
    });

    expect(screen.getByText('R$ 500,00 de R$ 500,00')).toBeOnTheScreen();
    expect(screen.getByText('Tudo pago')).toBeOnTheScreen();
    expect(preenchimento('barra-saidas')).toMatchObject({
      width: '100%',
      backgroundColor: colors.danger,
    });
  });

  it('resultado negativo sai em vermelho, com o sinal de menos', async () => {
    await renderComMes(mes({ saidasPendentesCentavos: 100000 }));

    expect(screen.getByText('− R$ 500,00')).toHaveStyle({ color: colors.danger });
  });

  it('mês sem nada previsto: barras vazias, sem dividir por zero', async () => {
    await renderComMes(
      mes({ entradasPagasCentavos: 0, entradasPendentesCentavos: 0, saidasPagasCentavos: 0, saidasPendentesCentavos: 0 }),
    );

    expect(preenchimento('barra-entradas')).toMatchObject({
      width: '0%',
    });
    expect(screen.getByText('Tudo recebido')).toBeOnTheScreen();
  });

  it('tocar no cartão abre Movimentações', async () => {
    await renderComMes();

    await fireEvent.press(screen.getByRole('button', { name: NOME_DO_CARTAO }));

    expect(mockPush).toHaveBeenCalledWith('/movimentacoes');
  });

  it('carregando: skeleton no lugar do cartão', async () => {
    mockBuscar.mockReturnValue(new Promise(() => {}));
    await render(<FinanceiroHubView />);

    expect(screen.getByLabelText('Carregando o mês')).toBeOnTheScreen();
    expect(screen.queryByText(/resultado previsto/)).not.toBeOnTheScreen();
  });

  it('erro: mensagem e "Tentar novamente" no lugar do cartão, e o menu continua tocável', async () => {
    await renderComErro();

    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Movimentações' }));
    expect(mockPush).toHaveBeenCalledWith('/movimentacoes');
  });

  it('"Tentar novamente" busca de novo e mostra o mês quando chega', async () => {
    await renderComErro();
    mockBuscar.mockResolvedValue({ ok: true, data: mes() });

    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' })));

    expect(mockBuscar).toHaveBeenCalledTimes(2);
    expect(screen.getByText('+ R$ 500,00')).toBeOnTheScreen();
  });
});

describe('FinanceiroHubView — próximos vencimentos', () => {
  it('cada pendente diz quando vence, a categoria e se é a pagar ou a receber, com o sinal', async () => {
    await renderComMes();

    expect(screen.getByText('Vence hoje · Frete')).toBeOnTheScreen();
    expect(screen.getByText('+ R$ 6.454,46')).toHaveStyle({ color: colors.success });
    expect(screen.getByText('A receber')).toBeOnTheScreen();
    expect(screen.getByText('Vence 30/11 · Combustível')).toBeOnTheScreen();
    expect(screen.getByText('− R$ 1.520,00')).toHaveStyle({ color: colors.danger });
    expect(screen.getByText('A pagar')).toBeOnTheScreen();
  });

  it('tocar num pendente abre a edição dele', async () => {
    await renderComMes();

    await fireEvent.press(screen.getByRole('button', { name: 'Pneus Rodovia 1/6' }));

    expect(mockPush).toHaveBeenCalledWith('/movimentacoes/pneus/editar');
  });

  it('os vencidos viram uma linha só no topo, que leva a Movimentações', async () => {
    await renderComMes();

    await fireEvent.press(screen.getByRole('button', { name: '7 vencidos sem baixa' }));

    expect(mockPush).toHaveBeenCalledWith('/movimentacoes');
  });

  it('sem vencidos, a linha não aparece; sem pendentes, a lista diz isso', async () => {
    await renderComMes(mes({ vencidos: 0, proximosVencimentos: [] }));

    expect(screen.queryByText(/vencidos? sem baixa/)).not.toBeOnTheScreen();
    expect(screen.getByText('Nada para vencer daqui para frente')).toBeOnTheScreen();
  });

  it('um vencido só: singular', async () => {
    await renderComMes(mes({ vencidos: 1 }));

    expect(screen.getByText('1 vencido sem baixa')).toBeOnTheScreen();
  });
});

describe('FinanceiroHubView — menu do módulo (FIN-03)', () => {
  it.each([360, 412, 767, 768, 800])('largura %i: grupos em duas colunas somente no tablet (TAB-01)', async (width) => {
    jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
    await renderComMes();
    const atalhos = screen.getByTestId('atalhos-financeiro');
    if (width >= 768) {
      expect(atalhos).toHaveStyle({ flexDirection: 'row', alignItems: 'flex-start' });
      for (const coluna of atalhos.children) {
        if (typeof coluna !== 'string') expect(StyleSheet.flatten(coluna.props.style)).toMatchObject({ flex: 1 });
      }
    } else {
      expect(atalhos).not.toHaveStyle({ flexDirection: 'row' });
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Formas de pagamento' }));
    expect(mockPush).toHaveBeenCalledWith('/formas-pagamento');
  });

  it.each([
    ['Movimentações', 'Entradas e saídas do mês', '/movimentacoes'],
    ['Saldo e projeção', 'Saldo atual e previsão dos próximos meses', '/caixa'],
    ['Dívidas', 'Financiamentos e parcelas', '/dividas'],
    // DETALHE-01 (EIX-42)
    ['Lançamentos por viagem', 'Fretes e despesas de cada viagem', '/viagens/lancamentos'],
    ['Categorias', 'Tipos de entrada e de saída', '/categorias'],
    ['Formas de pagamento', 'Pix, boleto, cartão e TED', '/formas-pagamento'],
  ])('a linha %s tem descrição e abre %s', async (titulo, descricao, rota) => {
    await renderComMes();

    expect(screen.getByText(descricao)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: titulo }));

    expect(mockPush).toHaveBeenCalledWith(rota);
  });

  it('as linhas ficam agrupadas em "Dia a dia" e "Cadastros", com ícone', async () => {
    await renderComMes();

    expect(screen.getByText('Dia a dia')).toBeOnTheScreen();
    expect(screen.getByText('Cadastros')).toBeOnTheScreen();
    expect(screen.getByTestId('icone-movimentacoes', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('icone-dividas', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('o FAB "Nova movimentação" abre o formulário', async () => {
    await renderComMes();

    await fireEvent.press(screen.getByRole('button', { name: 'Nova movimentação' }));

    expect(mockPush).toHaveBeenCalledWith('/movimentacoes/nova');
  });

  it('não mostra "Em breve" nem "em construção"', async () => {
    await renderComMes();

    expect(screen.queryByText(/Em breve/i)).not.toBeOnTheScreen();
    expect(screen.queryByText(/em construção/i)).not.toBeOnTheScreen();
  });
});
