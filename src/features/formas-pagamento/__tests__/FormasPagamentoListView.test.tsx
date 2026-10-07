import { fireEvent, render, screen } from '@testing-library/react-native';

import { FormasPagamentoListView } from '../FormasPagamentoListView';
import { definirAtivaFormaPagamento, listarFormasPagamento } from '../formasPagamentoRepository';

jest.setTimeout(15000);

const mockPush = jest.fn();

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, []),
  };
});

jest.mock('../formasPagamentoRepository', () => ({
  listarFormasPagamento: jest.fn(),
  definirAtivaFormaPagamento: jest.fn(),
}));

const formasMock = [
  { id: '1', nome: 'Pix', ativa: true },
  { id: '2', nome: 'Dinheiro', ativa: true },
  { id: '3', nome: 'Boleto', ativa: true },
  { id: '4', nome: 'TED', ativa: true },
  { id: '5', nome: 'Cartão Corporativo', ativa: true },
  { id: '6', nome: 'Antiga', ativa: false },
];

describe('FormasPagamentoListView', () => {
  beforeEach(() => {
    mockPush.mockReset();
    (listarFormasPagamento as jest.Mock).mockReset();
    (definirAtivaFormaPagamento as jest.Mock).mockReset();
  });

  it('mostra carregando e depois a lista', async () => {
    (listarFormasPagamento as jest.Mock).mockResolvedValue({ ok: true, data: formasMock });

    render(<FormasPagamentoListView />);

    expect(screen.getByLabelText('Carregando formas de pagamento')).toBeOnTheScreen();

    expect(await screen.findByText('Pix')).toBeOnTheScreen();
    expect(screen.getByText('Dinheiro')).toBeOnTheScreen();
  });

  it('o título da tela fica no header nativo, não no conteúdo (NAV-02)', async () => {
    (listarFormasPagamento as jest.Mock).mockResolvedValue({ ok: true, data: formasMock });

    render(<FormasPagamentoListView />);
    await screen.findByText('Pix');

    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
    expect(screen.queryByText('Formas de Pagamento')).not.toBeOnTheScreen();
  });

  it('bloqueia edição e desativação das formas fixas (Pix, Boleto, TED, Cartão Corporativo)', async () => {
    (listarFormasPagamento as jest.Mock).mockResolvedValue({ ok: true, data: formasMock });

    render(<FormasPagamentoListView />);
    await screen.findByText('Pix');

    // Dinheiro é a única ativa não fixa
    const botoesEditar = screen.getAllByRole('button', { name: 'Editar' });
    expect(botoesEditar).toHaveLength(1); // Só a de "Dinheiro"

    const botoesDesativar = screen.getAllByRole('button', { name: 'Desativar' });
    expect(botoesDesativar).toHaveLength(1); // Só a de "Dinheiro"
  });

  it('esconde desativadas por padrão e mostra ao ligar o switch', async () => {
    (listarFormasPagamento as jest.Mock).mockResolvedValue({ ok: true, data: formasMock });

    render(<FormasPagamentoListView />);
    await screen.findByText('Pix');

    expect(screen.queryByText('Antiga')).not.toBeOnTheScreen();

    fireEvent(screen.getByRole('switch', { name: 'Mostrar desativadas' }), 'valueChange', true);

    expect(await screen.findByText('Antiga')).toBeOnTheScreen();
  });

  it('filtra a lista pela busca', async () => {
    (listarFormasPagamento as jest.Mock).mockResolvedValue({ ok: true, data: formasMock });

    render(<FormasPagamentoListView />);
    await screen.findByText('Pix');

    fireEvent.changeText(screen.getByLabelText('Buscar'), 'dinhei');

    expect(screen.queryByText('Pix')).not.toBeOnTheScreen();
    expect(screen.getByText('Dinheiro')).toBeOnTheScreen();
  });

  it('estado vazio quando a busca não encontra nada', async () => {
    (listarFormasPagamento as jest.Mock).mockResolvedValue({ ok: true, data: formasMock });

    render(<FormasPagamentoListView />);
    await screen.findByText('Pix');

    fireEvent.changeText(screen.getByLabelText('Buscar'), 'zzz');

    expect(await screen.findByText('Nenhuma forma de pagamento encontrada')).toBeOnTheScreen();
  });

  it('estado de erro com botão de recarregar', async () => {
    (listarFormasPagamento as jest.Mock)
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as formas de pagamento.' })
      .mockResolvedValueOnce({ ok: true, data: formasMock });

    render(<FormasPagamentoListView />);

    expect(await screen.findByText('Não foi possível carregar')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Pix')).toBeOnTheScreen();
  });

  it('desativar chama mutação e mostra Snackbar', async () => {
    (listarFormasPagamento as jest.Mock).mockResolvedValue({ ok: true, data: formasMock });
    (definirAtivaFormaPagamento as jest.Mock).mockResolvedValue({
      ok: true,
      data: { ...formasMock[1], ativa: false }, // Dinheiro
    });

    render(<FormasPagamentoListView />);
    await screen.findByText('Dinheiro');

    fireEvent.press(screen.getAllByRole('button', { name: 'Desativar' })[0]);

    expect(definirAtivaFormaPagamento).toHaveBeenCalledWith('2', false);
    expect(await screen.findByText('Forma de pagamento desativada.')).toBeOnTheScreen();
  });

  it('Editar navega para tela de edição', async () => {
    (listarFormasPagamento as jest.Mock).mockResolvedValue({ ok: true, data: formasMock });

    render(<FormasPagamentoListView />);
    await screen.findByText('Dinheiro');

    fireEvent.press(screen.getAllByRole('button', { name: 'Editar' })[0]);

    expect(mockPush).toHaveBeenCalledWith('/formas-pagamento/2/editar');
  });
});
