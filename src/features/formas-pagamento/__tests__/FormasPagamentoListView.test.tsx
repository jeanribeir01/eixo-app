import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FAB_ALTURA_RESERVADA, Skeleton, colors } from '@/ui';

import { FormasPagamentoListView } from '../FormasPagamentoListView';
import { definirAtivaFormaPagamento, listarFormasPagamento } from '../formasPagamentoRepository';
import type { FormaPagamento } from '../types';

jest.setTimeout(15000);

const mockPush = jest.fn();
let mockAoFocar: (() => void) | null = null;

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => {
      mockAoFocar = callback;
      react.useEffect(callback, [callback]);
    },
  };
});

jest.mock('../formasPagamentoRepository', () => ({
  listarFormasPagamento: jest.fn(),
  definirAtivaFormaPagamento: jest.fn(),
}));

const mockListar = listarFormasPagamento as jest.MockedFunction<typeof listarFormasPagamento>;
const mockDefinirAtiva = definirAtivaFormaPagamento as jest.MockedFunction<typeof definirAtivaFormaPagamento>;

const formas: FormaPagamento[] = [
  { id: '1', nome: 'Pix', ativa: true },
  { id: '2', nome: 'Dinheiro', ativa: true },
  { id: '3', nome: 'Boleto', ativa: true },
  { id: '4', nome: 'TED', ativa: true },
  { id: '5', nome: 'Cartão Corporativo', ativa: true },
  { id: '6', nome: 'Antiga', ativa: false },
];

beforeEach(() => {
  mockPush.mockReset();
  mockListar.mockReset();
  mockDefinirAtiva.mockReset();
});

async function renderComLista() {
  mockListar.mockResolvedValue({ ok: true, data: formas });
  render(<FormasPagamentoListView />);
  await screen.findByText('Dinheiro');
}

describe('FormasPagamentoListView — carga (LST-03)', () => {
  it('primeira carga: três skeletons, depois a lista', async () => {
    mockListar.mockResolvedValue({ ok: true, data: formas });
    render(<FormasPagamentoListView />);

    expect(screen.getByLabelText('Carregando formas de pagamento')).toBeOnTheScreen();
    expect(screen.UNSAFE_getAllByType(Skeleton)).toHaveLength(3);
    expect(await screen.findByText('Pix')).toBeOnTheScreen();
  });

  it('o título da tela fica no header nativo, não no conteúdo (NAV-02)', async () => {
    await renderComLista();

    expect(screen.queryByText('Formas de pagamento')).not.toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
  });

  it('voltar o foco recarrega sem skeleton', async () => {
    await renderComLista();

    await act(async () => {
      mockAoFocar?.();
    });

    expect(mockListar).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText('Carregando formas de pagamento')).not.toBeOnTheScreen();
    expect(screen.getByText('Dinheiro')).toBeOnTheScreen();
  });

  it('pull-to-refresh em accent e espaço para o FAB no fim da lista', async () => {
    await renderComLista();

    const refresh = screen.UNSAFE_getByType(RefreshControl);
    expect(refresh.props.colors).toEqual([colors.accent]);
    await act(async () => refresh.props.onRefresh());
    expect(mockListar).toHaveBeenCalledTimes(2);

    expect(StyleSheet.flatten(screen.UNSAFE_getByType(FlatList).props.contentContainerStyle)).toMatchObject({
      paddingBottom: FAB_ALTURA_RESERVADA,
    });
  });

  it('estado de erro com "Tentar novamente"', async () => {
    mockListar
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as formas de pagamento.' })
      .mockResolvedValueOnce({ ok: true, data: formas });
    render(<FormasPagamentoListView />);

    expect(await screen.findByText('Não foi possível carregar')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Dinheiro')).toBeOnTheScreen();
  });
});

describe('FormasPagamentoListView — linha (LST-01)', () => {
  it.each(['Pix', 'Boleto', 'TED', 'Cartão Corporativo'])('forma fixa %s: sem switch e sem abrir edição', async (nome) => {
    await renderComLista();

    expect(screen.queryByRole('switch', { name: `Ativa: ${nome}` })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: nome })).not.toBeOnTheScreen();
    expect(screen.getAllByText('Padrão do sistema')).toHaveLength(4);
  });

  it('forma editável abre a edição ao tocar na linha', async () => {
    await renderComLista();

    fireEvent.press(screen.getByRole('button', { name: 'Dinheiro' }));

    expect(mockPush).toHaveBeenCalledWith('/formas-pagamento/2/editar');
  });

  it('forma editável alterna pelo switch, desabilitado enquanto salva, com Snackbar', async () => {
    let concluir: (valor: Awaited<ReturnType<typeof definirAtivaFormaPagamento>>) => void = () => undefined;
    mockDefinirAtiva.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    await renderComLista();

    fireEvent(screen.getByRole('switch', { name: 'Ativa: Dinheiro' }), 'valueChange', false);

    expect(mockDefinirAtiva).toHaveBeenCalledWith('2', false);
    expect(screen.getByRole('switch', { name: 'Ativa: Dinheiro' })).toBeDisabled();

    await act(async () => concluir({ ok: true, data: { id: '2', nome: 'Dinheiro', ativa: false } }));
    expect(screen.getByRole('alert')).toHaveTextContent('Forma de pagamento desativada.');
  });

  it('não existe botão "Editar" nem "Desativar" na linha', async () => {
    await renderComLista();

    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Desativar' })).not.toBeOnTheScreen();
  });
});

describe('FormasPagamentoListView — filtros e FAB (LST-01)', () => {
  it('esconde as desativadas por padrão e mostra ao ligar o filtro', async () => {
    await renderComLista();
    expect(screen.queryByText('Antiga')).not.toBeOnTheScreen();

    fireEvent(screen.getByRole('switch', { name: 'Mostrar desativadas' }), 'valueChange', true);

    expect(screen.getByText('Antiga')).toBeOnTheScreen();
    expect(screen.getByText('Desativada')).toBeOnTheScreen();
  });

  it('filtra pela busca e mostra o vazio quando nada bate', async () => {
    await renderComLista();

    fireEvent.changeText(screen.getByLabelText('Buscar'), 'dinh');
    expect(screen.getByText('Dinheiro')).toBeOnTheScreen();
    expect(screen.queryByText('Pix')).not.toBeOnTheScreen();

    fireEvent.changeText(screen.getByLabelText('Buscar'), 'zzz');
    expect(screen.getByText('Nenhuma forma de pagamento encontrada')).toBeOnTheScreen();
  });

  it('o FAB "Nova forma de pagamento" abre a criação', async () => {
    await renderComLista();

    fireEvent.press(screen.getByRole('button', { name: 'Nova forma de pagamento' }));

    expect(mockPush).toHaveBeenCalledWith('/formas-pagamento/nova');
  });
});
