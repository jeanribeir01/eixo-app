import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormaPagamentoFormView } from '../FormaPagamentoFormView';
import { atualizarFormaPagamento, buscarFormaPagamentoPorId, criarFormaPagamento } from '../formasPagamentoRepository';

import { porTipo } from '@/testing/componentes';

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

  it('renderiza o formulário para criar nova forma; o título da tela fica no header (NAV-02)', async () => {
    await render(<FormaPagamentoFormView />);
    expect(screen.queryByText('Nova forma de pagamento')).not.toBeOnTheScreen();
    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
    // Tela interna: o header nativo protege o topo, o Screen não repete o inset (NAV-04, AC 11).
    expect(porTipo(SafeAreaView).props.edges).not.toContain('top');
    // Formulário rola e sobe com o teclado (NAV-04, AC 9 e 10).
    expect(porTipo(KeyboardAvoidingView).porTipo(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
    expect(screen.getByPlaceholderText('Ex.: Dinheiro')).toBeOnTheScreen();
  });

  it('mostra como a forma vai aparecer nos seletores, acompanhando o nome digitado', async () => {
    await render(<FormaPagamentoFormView />);

    expect(screen.getByText('Assim aparece nos seletores')).toBeOnTheScreen();
    expect(screen.getByText('Nome da forma')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByPlaceholderText('Ex.: Dinheiro'), 'Vale-pedágio');

    expect(screen.getByText('Vale-pedágio')).toBeOnTheScreen();
    expect(screen.queryByText('Nome da forma')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Criar forma de pagamento' })).toBeOnTheScreen();
  });

  it('cria a forma de pagamento e volta com feedback de sucesso', async () => {
    (criarFormaPagamento as jest.Mock).mockResolvedValue({ ok: true, data: dinheiro });

    await render(<FormaPagamentoFormView />);

    await fireEvent.changeText(screen.getByPlaceholderText('Ex.: Dinheiro'), 'Dinheiro');
    await fireEvent.press(screen.getByRole('button', { name: /^(Criar forma de pagamento|Salvar alterações)$/ }));

    await waitFor(() => {
      expect(criarFormaPagamento).toHaveBeenCalledWith({ nome: 'Dinheiro' });
    });
    expect(screen.getByText('Forma de pagamento criada.')).toBeOnTheScreen();

    // Simula o término do Snackbar
    await fireEvent(screen.getByText('Forma de pagamento criada.'), 'dismiss');
    expect(mockBack).toHaveBeenCalled();
  });

  it('valida duplicidade retornando erro de repository', async () => {
    (criarFormaPagamento as jest.Mock).mockResolvedValue({
      ok: false,
      mensagem: 'Já existe uma forma de pagamento com esse nome.',
    });

    await render(<FormaPagamentoFormView />);

    await fireEvent.changeText(screen.getByPlaceholderText('Ex.: Dinheiro'), 'Pix');
    await fireEvent.press(screen.getByRole('button', { name: /^(Criar forma de pagamento|Salvar alterações)$/ }));

    await waitFor(() => {
      expect(screen.getAllByText('Já existe uma forma de pagamento com esse nome.')).toHaveLength(2); // input error e snackbar
    });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('renderiza os dados de uma forma de pagamento existente e salva', async () => {
    (buscarFormaPagamentoPorId as jest.Mock).mockResolvedValue({ ok: true, data: dinheiro });
    (atualizarFormaPagamento as jest.Mock).mockResolvedValue({ ok: true, data: dinheiro });

    await render(<FormaPagamentoFormView formaPagamentoId="1" />);

    expect(await screen.findByDisplayValue('Dinheiro')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByDisplayValue('Dinheiro'), 'Dinheiro em espécie');
    await fireEvent.press(screen.getByRole('button', { name: /^(Criar forma de pagamento|Salvar alterações)$/ }));

    await waitFor(() => {
      expect(atualizarFormaPagamento).toHaveBeenCalledWith('1', { nome: 'Dinheiro em espécie' });
    });
    expect(screen.getByText('Forma de pagamento atualizada.')).toBeOnTheScreen();
  });

  it('bloqueia edição de formas de pagamento fixas', async () => {
    (buscarFormaPagamentoPorId as jest.Mock).mockResolvedValue({ ok: true, data: pix });

    await render(<FormaPagamentoFormView formaPagamentoId="2" />);

    expect(await screen.findByDisplayValue('Pix')).toBeOnTheScreen();
    expect(screen.getByText('Formas de pagamento padrão não podem ter o nome alterado.')).toBeOnTheScreen();

    expect(screen.queryByRole('button', { name: /^(Criar forma de pagamento|Salvar alterações)$/ })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen();

    const input = screen.getByDisplayValue('Pix');
    expect(input.props.editable).toBe(false);
  });

  it('exibe erro do Zod para campo vazio', async () => {
    await render(<FormaPagamentoFormView />);
    
    await fireEvent.press(screen.getByRole('button', { name: /^(Criar forma de pagamento|Salvar alterações)$/ }));

    await waitFor(() => {
      expect(screen.getByText('Informe o nome da forma de pagamento.')).toBeOnTheScreen();
    });
    expect(criarFormaPagamento).not.toHaveBeenCalled();
  });
});

// Carregando e erro de carga também abrem sob o header nativo: sem inset de topo duplicado (NAV-04, AC 11).
describe('FormaPagamentoFormView — estados de carga sob o header (NAV-04)', () => {
  it('carregando: sem o inset de topo', async () => {
    (buscarFormaPagamentoPorId as jest.Mock).mockReturnValue(new Promise(() => {}));
    await render(<FormaPagamentoFormView formaPagamentoId="2" />);

    expect(screen.getByLabelText('Carregando forma de pagamento')).toBeOnTheScreen();
    expect(porTipo(SafeAreaView).props.edges).not.toContain('top');
  });

  it('erro ao carregar: sem o inset de topo', async () => {
    (buscarFormaPagamentoPorId as jest.Mock).mockResolvedValue({ ok: false, mensagem: 'Forma de pagamento não encontrada.' });
    await render(<FormaPagamentoFormView formaPagamentoId="2" />);

    expect(await screen.findByText('Não foi possível carregar a forma de pagamento')).toBeOnTheScreen();
    expect(porTipo(SafeAreaView).props.edges).not.toContain('top');
  });
});
