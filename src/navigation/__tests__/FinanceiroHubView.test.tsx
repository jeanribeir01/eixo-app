import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { resumoCaixaComDados } from '@/features/caixa/__mocks__/resumoCaixaMock';
import { buscarResumoCaixa } from '@/features/caixa/fonteResumoCaixa';
import { colors, radius } from '@/ui';

import { FinanceiroHubView } from '../FinanceiroHubView';

jest.setTimeout(15000);

const mockPush = jest.fn();

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]),
  };
});

jest.mock('@/features/caixa/fonteResumoCaixa', () => ({ buscarResumoCaixa: jest.fn() }));

const mockBuscar = buscarResumoCaixa as jest.MockedFunction<typeof buscarResumoCaixa>;
const NOME_DO_CARTAO = 'Saldo atual + R$ 12.500,00. Ver saldo e projeção';

beforeEach(() => {
  mockPush.mockReset();
  mockBuscar.mockReset();
});

async function renderComSaldo() {
  mockBuscar.mockResolvedValue({ ok: true, data: resumoCaixaComDados });
  render(<FinanceiroHubView />);
  await screen.findByRole('button', { name: NOME_DO_CARTAO });
}

async function renderComErro() {
  mockBuscar.mockResolvedValue({ ok: false, mensagem: 'Não foi possível carregar o saldo. Tente novamente.' });
  render(<FinanceiroHubView />);
  await screen.findByText('Não foi possível carregar o saldo.');
}

describe('FinanceiroHubView — saldo (FIN-02)', () => {
  it('título da aba no conteúdo e saldo atual num cartão de destaque, formatado como em Saldo e projeção', async () => {
    await renderComSaldo();

    expect(screen.getByText('Financeiro')).toBeOnTheScreen();
    expect(screen.getByText('Saldo atual')).toBeOnTheScreen();
    expect(screen.getByText('+ R$ 12.500,00')).toHaveStyle({ color: colors.success });
    expect(screen.getByRole('button', { name: NOME_DO_CARTAO })).toHaveStyle({ borderRadius: radius.feature });
  });

  it('tocar no cartão abre Saldo e projeção', async () => {
    await renderComSaldo();

    fireEvent.press(screen.getByRole('button', { name: NOME_DO_CARTAO }));

    expect(mockPush).toHaveBeenCalledWith('/caixa');
  });

  it('carregando: skeleton no lugar do cartão', () => {
    mockBuscar.mockReturnValue(new Promise(() => {}));
    render(<FinanceiroHubView />);

    expect(screen.getByLabelText('Carregando saldo')).toBeOnTheScreen();
    expect(screen.queryByText('Saldo atual')).not.toBeOnTheScreen();
  });

  it('erro: mensagem e "Tentar novamente" dentro do cartão, e o menu continua tocável', async () => {
    await renderComErro();

    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Movimentações' }));
    expect(mockPush).toHaveBeenCalledWith('/movimentacoes');
  });

  it('"Tentar novamente" busca o saldo de novo e mostra quando chega', async () => {
    await renderComErro();
    mockBuscar.mockResolvedValue({ ok: true, data: resumoCaixaComDados });

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' })));

    expect(mockBuscar).toHaveBeenCalledTimes(2);
    expect(screen.getByText('+ R$ 12.500,00')).toBeOnTheScreen();
    expect(screen.queryByText('Não foi possível carregar o saldo.')).not.toBeOnTheScreen();
  });
});

describe('FinanceiroHubView — menu do módulo (FIN-03)', () => {
  it.each([
    ['Movimentações', 'Entradas e saídas do mês', '/movimentacoes'],
    ['Saldo e projeção', 'Saldo atual e previsão dos próximos meses', '/caixa'],
    ['Dívidas', 'Financiamentos e parcelas', '/dividas'],
    ['Categorias', 'Tipos de entrada e de saída', '/categorias'],
    ['Formas de pagamento', 'Pix, boleto, cartão e TED', '/formas-pagamento'],
  ])('a linha %s tem descrição e abre %s', async (titulo, descricao, rota) => {
    await renderComSaldo();

    expect(screen.getByText(descricao)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: titulo }));

    expect(mockPush).toHaveBeenCalledWith(rota);
  });

  it('as linhas ficam agrupadas em "Caixa" e "Cadastros", com ícone e chevron', async () => {
    await renderComSaldo();

    expect(screen.getByText('Caixa')).toBeOnTheScreen();
    expect(screen.getByText('Cadastros')).toBeOnTheScreen();
    expect(screen.getByTestId('simbolo-swap_vert', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('simbolo-receipt_long', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getAllByTestId('simbolo-chevron_right', { includeHiddenElements: true })).toHaveLength(5);
  });

  it('o FAB "Nova movimentação" abre o formulário', async () => {
    await renderComSaldo();

    fireEvent.press(screen.getByRole('button', { name: 'Nova movimentação' }));

    expect(mockPush).toHaveBeenCalledWith('/movimentacoes/nova');
  });

  it('não mostra "Em breve" nem "em construção"', async () => {
    await renderComSaldo();

    expect(screen.queryByText(/Em breve/i)).not.toBeOnTheScreen();
    expect(screen.queryByText(/em construção/i)).not.toBeOnTheScreen();
  });
});
