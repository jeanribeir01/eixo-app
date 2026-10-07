import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormaPagamentoFormView } from '../FormaPagamentoFormView';
import { atualizarFormaPagamento, buscarFormaPagamentoPorId, criarFormaPagamento } from '../formasPagamentoRepository';

const mockBack = jest.fn();
const mockSetParams = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, setParams: mockSetParams }),
}));

jest.mock('../formasPagamentoRepository', () => ({
  atualizarFormaPagamento: jest.fn(),
  buscarFormaPagamentoPorId: jest.fn(),
  criarFormaPagamento: jest.fn(),
}));

const dinheiro = { id: '1', nome: 'Dinheiro', ativa: true };
const pix = { id: '2', nome: 'Pix', ativa: true };

describe('FormaPagamentoFormView', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockSetParams.mockReset();
    (atualizarFormaPagamento as jest.Mock).mockReset();
    (buscarFormaPagamentoPorId as jest.Mock).mockReset();
    (criarFormaPagamento as jest.Mock).mockReset();
  });

  it('renderiza o formulário para criar nova forma; o título da tela fica no header (NAV-02)', () => {
    render(<FormaPagamentoFormView />);
    expect(screen.queryByText('Nova forma de pagamento')).not.toBeOnTheScreen();
    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
    // Tela interna: o header nativo protege o topo, o Screen não repete o inset (NAV-04, AC 11).
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
    // Formulário rola e sobe com o teclado (NAV-04, AC 9 e 10).
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).findByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
    expect(screen.getByPlaceholderText('Ex.: Dinheiro')).toBeOnTheScreen();
  });

  it('cria a forma de pagamento e volta com feedback de sucesso', async () => {
    (criarFormaPagamento as jest.Mock).mockResolvedValue({ ok: true, data: dinheiro });

    render(<FormaPagamentoFormView />);

    fireEvent.changeText(screen.getByPlaceholderText('Ex.: Dinheiro'), 'Dinheiro');
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(criarFormaPagamento).toHaveBeenCalledWith({ nome: 'Dinheiro' });
    });
    expect(screen.getByText('Forma de pagamento criada.')).toBeOnTheScreen();

    // Simula o término do Snackbar
    fireEvent(screen.getByText('Forma de pagamento criada.'), 'dismiss');
    expect(mockBack).toHaveBeenCalled();
  });

  it('valida duplicidade retornando erro de repository', async () => {
    (criarFormaPagamento as jest.Mock).mockResolvedValue({
      ok: false,
      mensagem: 'Já existe uma forma de pagamento com esse nome.',
    });

    render(<FormaPagamentoFormView />);

    fireEvent.changeText(screen.getByPlaceholderText('Ex.: Dinheiro'), 'Pix');
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(screen.getAllByText('Já existe uma forma de pagamento com esse nome.')).toHaveLength(2); // input error e snackbar
    });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('renderiza os dados de uma forma de pagamento existente e salva', async () => {
    (buscarFormaPagamentoPorId as jest.Mock).mockResolvedValue({ ok: true, data: dinheiro });
    (atualizarFormaPagamento as jest.Mock).mockResolvedValue({ ok: true, data: dinheiro });

    render(<FormaPagamentoFormView formaPagamentoId="1" />);

    expect(await screen.findByDisplayValue('Dinheiro')).toBeOnTheScreen();

    fireEvent.changeText(screen.getByDisplayValue('Dinheiro'), 'Dinheiro em espécie');
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(atualizarFormaPagamento).toHaveBeenCalledWith('1', { nome: 'Dinheiro em espécie' });
    });
    expect(screen.getByText('Forma de pagamento atualizada.')).toBeOnTheScreen();
  });

  it('bloqueia edição de formas de pagamento fixas', async () => {
    (buscarFormaPagamentoPorId as jest.Mock).mockResolvedValue({ ok: true, data: pix });

    render(<FormaPagamentoFormView formaPagamentoId="2" />);

    expect(await screen.findByDisplayValue('Pix')).toBeOnTheScreen();
    expect(screen.getByText('Formas de pagamento padrão não podem ter o nome alterado.')).toBeOnTheScreen();

    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen();

    const input = screen.getByDisplayValue('Pix');
    expect(input.props.editable).toBe(false);
  });

  it('exibe erro do Zod para campo vazio', async () => {
    render(<FormaPagamentoFormView />);
    
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(screen.getByText('Informe o nome da forma de pagamento.')).toBeOnTheScreen();
    });
    expect(criarFormaPagamento).not.toHaveBeenCalled();
  });
});
