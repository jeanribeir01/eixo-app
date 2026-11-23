import { fireEvent, render, screen } from '@testing-library/react-native';

import { useProfileStore, type UsuarioLogado } from '@/features/auth/profileStore';
import { colors, radius } from '@/ui';

import { resumoFinanceiro, usuario } from '../__mocks__/fixtures';
import { buscarInicioFinanceiro } from '../inicioFinanceiroRepository';
import { InicioFinanceiroView } from '../InicioFinanceiroView';

// O runner do GitHub Actions é mais lento que a máquina local.
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

jest.mock('@/supabase/client', () => ({ supabase: {} }));

jest.mock('../inicioFinanceiroRepository', () => ({
  ...jest.requireActual('../inicioFinanceiroRepository'),
  buscarInicioFinanceiro: jest.fn(),
}));

const mockBuscar = jest.mocked(buscarInicioFinanceiro);

function logarComo(perfil: UsuarioLogado['perfil']) {
  useProfileStore.setState({
    usuario: { id: 'u', nome: 'Jean Ribeiro', email: 'jean@empresa.com', perfil, status: 'Ativo' },
    estado: 'pronto',
  });
}

beforeEach(() => {
  mockPush.mockReset();
  mockBuscar.mockReset();
  logarComo('Financeiro');
});

async function renderPronto(resumo = resumoFinanceiro()) {
  mockBuscar.mockResolvedValue({ ok: true, data: resumo });
  render(<InicioFinanceiroView />);
  await screen.findByText('Saldo atual');
}

describe('InicioFinanceiroView', () => {
  it('saudação com o primeiro nome como título da tela', async () => {
    await renderPronto();

    expect(screen.getByRole('header')).toHaveTextContent(/, Jean$/);
  });

  it('carregando: skeleton com rótulo, sem cartão de saldo', () => {
    mockBuscar.mockReturnValue(new Promise(() => {}));
    render(<InicioFinanceiroView />);

    expect(screen.getByLabelText('Carregando o início')).toBeOnTheScreen();
    expect(screen.queryByText('Saldo atual')).not.toBeOnTheScreen();
  });

  it('erro: mensagem do repositório e "Tentar novamente" refaz a busca', async () => {
    mockBuscar.mockResolvedValue({ ok: false, mensagem: 'Não foi possível carregar o início. Tente novamente.' });
    render(<InicioFinanceiroView />);

    expect(await screen.findByText('Não foi possível carregar o início. Tente novamente.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(mockBuscar).toHaveBeenCalledTimes(2);
  });

  it('cartão de destaque: saldo com sinal e cor, entradas e saídas pagas no mês; o toque abre Saldo e projeção', async () => {
    await renderPronto();

    const cartao = screen.getByRole('button', { name: 'Saldo atual + R$ 76.390,64. Ver saldo e projeção' });
    expect(cartao).toHaveStyle({ borderRadius: radius.feature });
    expect(screen.getByText('+ R$ 76.390,64')).toHaveStyle({ color: colors.success });
    expect(screen.getByText('+ R$ 85.100,00')).toBeOnTheScreen();
    expect(screen.getByText('− R$ 91.000,00')).toBeOnTheScreen();

    fireEvent.press(cartao);
    expect(mockPush).toHaveBeenCalledWith('/caixa');
  });

  it.each([
    ['Lançar', '/movimentacoes/nova'],
    ['Dívidas', '/dividas'],
    ['Categorias', '/categorias'],
    ['Pagamentos', '/formas-pagamento'],
  ])('atalho "%s" abre %s', async (rotulo, rota) => {
    await renderPronto();

    fireEvent.press(screen.getByRole('button', { name: rotulo }));

    expect(mockPush).toHaveBeenCalledWith(rota);
  });

  it('pede atenção: a linha de contas a pagar leva para Movimentações', async () => {
    await renderPronto();

    fireEvent.press(screen.getByRole('button', { name: 'Contas a pagar nos próximos 7 dias' }));

    expect(screen.getByText('R$ 9.340,00 até 29/11')).toBeOnTheScreen();
    expect(mockPush).toHaveBeenCalledWith('/movimentacoes');
  });

  it('nada pendente: "Tudo em dia" no lugar da lista, sem toque', async () => {
    await renderPronto(resumoFinanceiro({ aPagarCentavos: 0 }));

    expect(screen.getByText('Tudo em dia')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Tudo em dia' })).not.toBeOnTheScreen();
  });

  it('Admin vê usuários aguardando aprovação; a busca pede usuários e manutenções', async () => {
    logarComo('Admin');
    await renderPronto(resumoFinanceiro({ usuariosAguardando: [usuario()], manutencoesAbertas: [] }));

    expect(mockBuscar).toHaveBeenCalledWith({ verUsuarios: true, verManutencoes: true });
    fireEvent.press(screen.getByRole('button', { name: '1 usuário aguardando aprovação' }));
    expect(mockPush).toHaveBeenCalledWith('/usuarios');
  });

  it('Financeiro não pede usuários nem manutenções', async () => {
    await renderPronto();

    expect(mockBuscar).toHaveBeenCalledWith({ verUsuarios: false, verManutencoes: false });
  });

  it('últimas movimentações: valor com sinal e status; o toque abre a edição', async () => {
    await renderPronto();

    expect(screen.getByText('+ R$ 5.081,67')).toHaveStyle({ color: colors.success });
    expect(screen.getByText('Recebido')).toBeOnTheScreen();
    expect(screen.getByText('− R$ 1.095,98')).toHaveStyle({ color: colors.danger });

    fireEvent.press(screen.getByRole('button', { name: 'Frete para BH' }));
    expect(mockPush).toHaveBeenCalledWith('/movimentacoes/frete/editar');

    fireEvent.press(screen.getByRole('button', { name: 'Ver todas as movimentações' }));
    expect(mockPush).toHaveBeenCalledWith('/movimentacoes');
  });

  it('mês sem movimentação: a seção explica e aponta para o Lançar', async () => {
    await renderPronto(resumoFinanceiro({ ultimasMovimentacoes: [] }));

    expect(screen.getByText('Nenhuma movimentação neste mês')).toBeOnTheScreen();
  });
});
