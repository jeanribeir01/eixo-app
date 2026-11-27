import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormaPagamentoFormView } from '../FormaPagamentoFormView';
import {
  atualizarFormaPagamento,
  buscarFormaPagamentoPorId,
  criarFormaPagamento,
  definirAtivaFormaPagamento,
} from '../formasPagamentoRepository';

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
  definirAtivaFormaPagamento: jest.fn(),
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

  it('não mostra mais a prévia "Assim aparece nos seletores": nenhum outro formulário tem', async () => {
    await render(<FormaPagamentoFormView />);

    expect(screen.queryByText('Assim aparece nos seletores')).not.toBeOnTheScreen();
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
    expect(screen.getByText('Formas de pagamento padrão não podem ter o nome alterado nem ser desativadas.')).toBeOnTheScreen();

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

// Desativar e reativar moram no fim do Editar, no mesmo molde em Categorias, Formas de pagamento, Rotas e
// Veículos (antes era um switch ou um "Mais opções" na lista).
describe('FormaPagamentoFormView — desativar e reativar no Editar', () => {
  beforeEach(() => {
    mockBack.mockReset();
    jest.mocked(buscarFormaPagamentoPorId).mockReset();
    jest.mocked(definirAtivaFormaPagamento).mockReset();
    jest.mocked(definirAtivaFormaPagamento).mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('no cadastro não existe ação de status', async () => {
    await render(<FormaPagamentoFormView />);

    expect(screen.queryByRole('button', { name: /^(Desativar|Reativar) / })).not.toBeOnTheScreen();
  });

  it('ativo: "Desativar forma de pagamento" no fim, com a consequência dita embaixo', async () => {
    jest.mocked(buscarFormaPagamentoPorId).mockResolvedValue({ ok: true, data: { id: '1', nome: 'Dinheiro', ativa: true } });
    await render(<FormaPagamentoFormView formaPagamentoId="1" />);

    expect(await screen.findByRole('button', { name: 'Desativar forma de pagamento' })).toBeOnTheScreen();
    expect(screen.getByText('Ela some dos novos lançamentos. Os lançamentos antigos continuam com ela.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Reativar forma de pagamento' })).not.toBeOnTheScreen();
  });

  it('desativar grava, mostra o Snackbar com "Desfazer" e volta para a lista quando ele some', async () => {
    jest.mocked(buscarFormaPagamentoPorId).mockResolvedValue({ ok: true, data: { id: '1', nome: 'Dinheiro', ativa: true } });
    jest.mocked(definirAtivaFormaPagamento).mockResolvedValue({ ok: true, data: { id: '1', nome: 'Dinheiro', ativa: false } });
    await render(<FormaPagamentoFormView formaPagamentoId="1" />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Desativar forma de pagamento' }));

    expect(definirAtivaFormaPagamento).toHaveBeenCalledWith('1', false);
    expect(await screen.findByText('Forma de pagamento desativada.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();

    // Com "Desfazer" o Snackbar fica mais tempo (6 s) antes de voltar.
    await act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('"Desfazer" reativa na hora e só volta depois do aviso de reativação', async () => {
    jest.mocked(buscarFormaPagamentoPorId).mockResolvedValue({ ok: true, data: { id: '1', nome: 'Dinheiro', ativa: true } });
    jest.mocked(definirAtivaFormaPagamento).mockResolvedValueOnce({ ok: true, data: { id: '1', nome: 'Dinheiro', ativa: false } });
    jest.mocked(definirAtivaFormaPagamento).mockResolvedValueOnce({ ok: true, data: { id: '1', nome: 'Dinheiro', ativa: true } });
    await render(<FormaPagamentoFormView formaPagamentoId="1" />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Desativar forma de pagamento' }));
    await screen.findByText('Forma de pagamento desativada.');

    await fireEvent.press(screen.getByRole('button', { name: 'Desfazer' }));

    expect(definirAtivaFormaPagamento).toHaveBeenCalledWith('1', true);
    expect(await screen.findByText('Forma de pagamento reativada.')).toBeOnTheScreen();
    // Fechar o Snackbar do "Desfazer" não pode levar de volta antes de a reativação terminar.
    expect(mockBack).not.toHaveBeenCalled();
    await act(() => {
      jest.advanceTimersByTime(1200);
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('desativado: aviso no topo e "Reativar forma de pagamento" como ação secundária; reativar grava e volta', async () => {
    jest.mocked(buscarFormaPagamentoPorId).mockResolvedValue({ ok: true, data: { id: '1', nome: 'Dinheiro', ativa: false } });
    jest.mocked(definirAtivaFormaPagamento).mockResolvedValue({ ok: true, data: { id: '1', nome: 'Dinheiro', ativa: true } });
    await render(<FormaPagamentoFormView formaPagamentoId="1" />);

    expect(await screen.findByText('Forma de pagamento desativada')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Desativar forma de pagamento' })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reativar forma de pagamento' }));

    expect(definirAtivaFormaPagamento).toHaveBeenCalledWith('1', true);
    expect(await screen.findByText('Forma de pagamento reativada.')).toBeOnTheScreen();
    // Reativar não oferece "Desfazer": não há nada perdido para recuperar.
    expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeOnTheScreen();
    await act(() => {
      jest.advanceTimersByTime(1200);
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('erro ao desativar: Snackbar de erro, fica na tela e o botão continua "Desativar forma de pagamento"', async () => {
    jest.mocked(buscarFormaPagamentoPorId).mockResolvedValue({ ok: true, data: { id: '1', nome: 'Dinheiro', ativa: true } });
    jest.mocked(definirAtivaFormaPagamento).mockResolvedValue({ ok: false, mensagem: 'Sem conexão com o servidor. Tente novamente.' });
    await render(<FormaPagamentoFormView formaPagamentoId="1" />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Desativar forma de pagamento' }));

    expect(await screen.findByText('Sem conexão com o servidor. Tente novamente.')).toBeOnTheScreen();
    await act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Desativar forma de pagamento' })).toBeOnTheScreen();
  });
});

describe('FormaPagamentoFormView — forma padrão do sistema', () => {
  it('não tem ação de desativar: o aviso do topo diz por quê', async () => {
    jest.mocked(buscarFormaPagamentoPorId).mockResolvedValue({ ok: true, data: { id: '2', nome: 'Pix', ativa: true } });
    await render(<FormaPagamentoFormView formaPagamentoId="2" />);

    expect(await screen.findByText('Forma de pagamento padrão')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^(Desativar|Reativar) / })).not.toBeOnTheScreen();
  });
});
