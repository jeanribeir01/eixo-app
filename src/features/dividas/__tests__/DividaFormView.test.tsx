import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listarOpcoesMovimentacao, type OpcoesMovimentacao } from '@/features/movimentacoes/movimentacoesRepository';

import { DividaFormView } from '../components/DividaFormView';
import { criarDivida } from '../dividasRepository';

// O runner do GitHub Actions é mais lento que a máquina local.
jest.setTimeout(15000);

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('../dividasRepository', () => ({ criarDivida: jest.fn() }));
jest.mock('@/features/movimentacoes/movimentacoesRepository', () => ({ listarOpcoesMovimentacao: jest.fn() }));

const mockCriar = criarDivida as jest.MockedFunction<typeof criarDivida>;
const mockOpcoes = listarOpcoesMovimentacao as jest.MockedFunction<typeof listarOpcoesMovimentacao>;

// Já vêm só as ativas (listarOpcoesMovimentacao filtra); a tela ainda filtra as de Saída.
const opcoes: OpcoesMovimentacao = {
  categorias: [
    { id: 'cat-fin', titulo: 'Financiamento', tipo: 'Saida', ativa: true },
    { id: 'cat-comb', titulo: 'Combustível', tipo: 'Saida', ativa: true },
    { id: 'cat-frete', titulo: 'Frete', tipo: 'Entrada', ativa: true },
  ],
  formasPagamento: [
    { id: 'fp-pix', nome: 'Pix', ativa: true },
    { id: 'fp-bol', nome: 'Boleto', ativa: true },
  ],
};

beforeEach(() => {
  mockBack.mockReset();
  mockCriar.mockReset();
  mockOpcoes.mockReset();
  mockOpcoes.mockResolvedValue({ ok: true, data: opcoes });
});

async function renderForm() {
  render(<DividaFormView />);
  await screen.findByLabelText('Descrição');
}

function salvar() {
  fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
}

function preencherValido() {
  fireEvent.changeText(screen.getByLabelText('Descrição'), 'Financiamento do caminhão');
  fireEvent.changeText(screen.getByLabelText('Quantidade de parcelas'), '12');
  fireEvent.changeText(screen.getByLabelText('Valor da parcela (R$)'), '350000');
  fireEvent.changeText(screen.getByLabelText('Vencimento da 1ª parcela'), '15012027');
}

describe('DividaFormView — campos (EIX-50)', () => {
  it('título no header nativo; o formulário rola e sobe com o teclado (NAV-02, NAV-04)', async () => {
    await renderForm();

    expect(screen.queryByText('Nova dívida')).not.toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).findByType(ScrollView)).toBeDefined();
  });

  it('pré-seleciona a categoria "Financiamento" e a forma "Boleto"', async () => {
    await renderForm();

    expect(screen.getByText('Financiamento')).toBeOnTheScreen();
    expect(screen.getByText('Boleto')).toBeOnTheScreen();
  });

  it('o seletor de categoria oferece só as de Saída', async () => {
    await renderForm();

    fireEvent.press(screen.getByRole('button', { name: 'Categoria' }));

    expect(screen.getByRole('button', { name: 'Combustível' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Frete' })).not.toBeOnTheScreen();
  });

  it('Soma total é somente leitura e acompanha quantidade × valor da parcela', async () => {
    await renderForm();
    const soma = screen.getByLabelText('Soma total');
    expect(soma).toHaveProp('editable', false);

    fireEvent.changeText(screen.getByLabelText('Quantidade de parcelas'), '12');
    fireEvent.changeText(screen.getByLabelText('Valor da parcela (R$)'), '350000');

    expect(screen.getByLabelText('Soma total')).toHaveDisplayValue('R$ 42.000,00');

    fireEvent.changeText(screen.getByLabelText('Quantidade de parcelas'), '24');
    expect(screen.getByLabelText('Soma total')).toHaveDisplayValue('R$ 84.000,00');
  });
});

describe('DividaFormView — validação (EIX-50)', () => {
  it('campos vazios mostram as mensagens embaixo de cada um e não chamam a RPC', async () => {
    await renderForm();
    fireEvent.changeText(screen.getByLabelText('Quantidade de parcelas'), '');

    salvar();

    expect(screen.getByText('Informe a descrição.')).toBeOnTheScreen();
    expect(screen.getByText('Informe ao menos 1 parcela.')).toBeOnTheScreen();
    expect(screen.getByText('Informe um valor maior que zero.')).toBeOnTheScreen();
    expect(screen.getByText('Data inválida. Use DD/MM/AAAA.')).toBeOnTheScreen();
    expect(mockCriar).not.toHaveBeenCalled();
  });

  it('mais de 120 parcelas → "O máximo é 120 parcelas."', async () => {
    await renderForm();
    preencherValido();
    fireEvent.changeText(screen.getByLabelText('Quantidade de parcelas'), '121');

    salvar();

    expect(screen.getByText('O máximo é 120 parcelas.')).toBeOnTheScreen();
    expect(mockCriar).not.toHaveBeenCalled();
  });

  it('quitação maior que a soma total → "A quitação não pode passar da soma total."', async () => {
    await renderForm();
    preencherValido();
    // Soma: 12 × R$ 3.500,00 = R$ 42.000,00. Quitação: R$ 50.000,00.
    fireEvent.changeText(screen.getByLabelText('Valor de quitação antecipada (opcional)'), '5000000');

    salvar();

    expect(screen.getByText('A quitação não pode passar da soma total.')).toBeOnTheScreen();
    expect(mockCriar).not.toHaveBeenCalled();
  });

  it('sem forma de pagamento → "Escolha a forma de pagamento."', async () => {
    mockOpcoes.mockResolvedValue({ ok: true, data: { ...opcoes, formasPagamento: [{ id: 'fp-pix', nome: 'Pix', ativa: true }] } });
    await renderForm();
    preencherValido();

    salvar();

    expect(screen.getByText('Escolha a forma de pagamento.')).toBeOnTheScreen();
    expect(mockCriar).not.toHaveBeenCalled();
  });
});

describe('DividaFormView — salvar (EIX-50)', () => {
  it('chama a RPC com centavos e data ISO, mostra "12 parcelas geradas." e volta para a lista', async () => {
    mockCriar.mockResolvedValue({ ok: true, data: { id: 'div-1', quantidadeParcelas: 12 } });
    await renderForm();
    preencherValido();

    await act(async () => salvar());

    expect(mockCriar).toHaveBeenCalledWith({
      descricao: 'Financiamento do caminhão',
      categoriaId: 'cat-fin',
      formaPagamentoId: 'fp-bol',
      quantidadeParcelas: 12,
      valorParcelaCentavos: 350000,
      dataVencimentoPrimeira: '2027-01-15',
      valorQuitacaoCentavos: null,
    });
    expect(screen.getByRole('alert')).toHaveTextContent('12 parcelas geradas.');
    await waitFor(() => expect(mockBack).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('uma parcela só: "1 parcela gerada."', async () => {
    mockCriar.mockResolvedValue({ ok: true, data: { id: 'div-1', quantidadeParcelas: 1 } });
    await renderForm();
    preencherValido();
    fireEvent.changeText(screen.getByLabelText('Quantidade de parcelas'), '1');

    await act(async () => salvar());

    expect(screen.getByRole('alert')).toHaveTextContent('1 parcela gerada.');
  });

  it('depois do sucesso o botão continua em loading: um segundo toque não cria a dívida de novo', async () => {
    mockCriar.mockResolvedValue({ ok: true, data: { id: 'div-1', quantidadeParcelas: 12 } });
    await renderForm();
    preencherValido();

    await act(async () => salvar());
    salvar();

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeBusy();
    expect(mockCriar).toHaveBeenCalledTimes(1);
  });

  it('erro da RPC: Snackbar com a mensagem em português, form preenchido e botão livre', async () => {
    mockCriar.mockResolvedValue({ ok: false, mensagem: 'Categoria ou forma de pagamento inválida. Escolha outra.' });
    await renderForm();
    preencherValido();

    await act(async () => salvar());

    expect(screen.getByRole('alert')).toHaveTextContent('Categoria ou forma de pagamento inválida. Escolha outra.');
    expect(screen.getByLabelText('Descrição')).toHaveDisplayValue('Financiamento do caminhão');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe('DividaFormView — carga das opções (EIX-50)', () => {
  it('carregando: indicador sob o header', () => {
    mockOpcoes.mockReturnValue(new Promise(() => {}));
    render(<DividaFormView />);

    expect(screen.getByLabelText('Carregando formulário')).toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
  });

  it('erro: mostra a mensagem e o botão Voltar', async () => {
    mockOpcoes.mockResolvedValue({ ok: false, mensagem: 'Não foi possível carregar as categorias. Tente novamente.' });
    render(<DividaFormView />);

    expect(await screen.findByText('Não foi possível carregar as categorias. Tente novamente.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(mockBack).toHaveBeenCalled();
  });
});
