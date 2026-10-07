import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DividaFormView } from '../components/DividaFormView';
import { criarDivida } from '../dividasRepository';
import { listarOpcoesMovimentacao } from '@/features/movimentacoes/movimentacoesRepository';

jest.setTimeout(15000);

const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => true }),
}));

jest.mock('../dividasRepository', () => ({
  criarDivida: jest.fn(),
}));

jest.mock('@/features/movimentacoes/movimentacoesRepository', () => ({
  listarOpcoesMovimentacao: jest.fn(),
}));

const mockCriar = criarDivida as jest.MockedFunction<typeof criarDivida>;
const mockOpcoes = listarOpcoesMovimentacao as jest.MockedFunction<typeof listarOpcoesMovimentacao>;

beforeEach(() => {
  mockBack.mockReset();
  mockReplace.mockReset();
  mockCriar.mockReset();
  mockOpcoes.mockReset();

  mockOpcoes.mockResolvedValue({
    ok: true,
    data: {
      categorias: [{ id: 'cat-fin', titulo: 'Financiamento', tipo: 'Saida', ativa: true }],
      formasPagamento: [{ id: 'fp-bol', nome: 'Boleto', ativa: true }],
    },
  });
});

function salvar() {
  fireEvent.press(screen.getByText('Salvar'));
}

async function renderForm() {
  render(<DividaFormView />);
  // Esperar o carregamento sair (tem o botão Salvar)
  await screen.findByText('Salvar');
}

describe('DividaFormView', () => {
  it('mostra mensagens de erro sob os campos quando os dados são inválidos', async () => {
    await renderForm();

    // Limpar valores pré-preenchidos ou forçar estado inválido
    fireEvent.changeText(screen.getByLabelText('Descrição'), '   ');
    fireEvent.changeText(screen.getByLabelText('Quantidade de Parcelas'), '0');
    fireEvent.changeText(screen.getByLabelText('Valor da Parcela'), ''); // Zera o valor (CampoMoeda)
    
    salvar();

    await waitFor(() => {
      expect(screen.getByText('Informe a descrição.')).toBeOnTheScreen();
      expect(screen.getByText('Informe ao menos 1 parcela.')).toBeOnTheScreen();
      expect(screen.getByText('Informe um valor maior que zero.')).toBeOnTheScreen();
      expect(screen.getByText('Data inválida. Use DD/MM/AAAA.')).toBeOnTheScreen();
    });
    
    expect(mockCriar).not.toHaveBeenCalled();
  });

  it('atualiza o campo Soma Total em tempo real conforme a quantidade e valor da parcela', async () => {
    await renderForm();

    fireEvent.changeText(screen.getByLabelText('Quantidade de Parcelas'), '12');
    fireEvent.changeText(screen.getByLabelText('Valor da Parcela'), '350000'); // CampoMoeda lida com string como dígitos
    
    // 12 * 3500.00 = 42000.00
    // O CampoMoeda transforma 350000 -> 3500.00 na tela e passa 350000 para o onChange (se usar digitosParaCentavos)
    await waitFor(() => {
      expect(screen.getByText('R$ 42.000,00')).toBeOnTheScreen();
    });
  });

  it('exibe Snackbar de erro quando a quitação antecipada é maior que a soma total', async () => {
    await renderForm();

    fireEvent.changeText(screen.getByLabelText('Descrição'), 'Financiamento do Caminhão');
    fireEvent.changeText(screen.getByLabelText('Quantidade de Parcelas'), '10');
    fireEvent.changeText(screen.getByLabelText('Valor da Parcela'), '10000'); // 100 reais
    fireEvent.changeText(screen.getByLabelText('Data de Vencimento da 1ª Parcela'), '15/01/2026');
    
    // Soma total é 1000 reais = 100000 centavos
    // Quitação = 1500 reais = 150000 centavos
    fireEvent.changeText(screen.getByLabelText('Valor de Quitação Antecipada (opcional)'), '150000');
    
    salvar();

    await waitFor(() => {
      expect(screen.getByText('A quitação não pode passar da soma total.')).toBeOnTheScreen();
    });
  });
});
