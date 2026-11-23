import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { dispararSemEsperar, segurarPrimeiraCarga } from '@/testing/eventos';
import { porTipo, todosPorTipo } from '@/testing/componentes';
import { FAB_ALTURA_RESERVADA, ListItem, Skeleton, colors, spacing } from '@/ui';

import { FormasPagamentoListView } from '../FormasPagamentoListView';
import { definirAtivaFormaPagamento, listarFormasPagamento } from '../formasPagamentoRepository';
import type { FormaPagamento } from '../types';

// Largura da janela controlada pelo teste: 412 é celular, 800 é tablet (EIX-94).
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 900, scale: 1, fontScale: 1 })),
}));

function mockLargura(width: number) {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

jest.setTimeout(15000);

const mockPush = jest.fn();
let mockAoFocar: (() => void) | null = null;

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  // Mesmo objeto em todo render, como o useRouter real (devolve o router global do expo-router).
  // Um objeto novo por render mudaria os callbacks das linhas e desfaria o memo (EIX-71).
  const roteador = { push: (...args: unknown[]) => mockPush(...args) };
  return {
    useRouter: () => roteador,
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

// O ListItem real, só embrulhado num jest.fn: o teste de memo (EIX-71) conta quantas vezes cada linha renderiza.
jest.mock('@/ui', () => {
  const real = jest.requireActual('@/ui');
  return { ...real, ListItem: jest.fn(real.ListItem) };
});

function rendersDaLinha(nome: string): number {
  return jest.mocked(ListItem).mock.calls.filter(([props]) => props.title === nome).length;
}

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
  await render(<FormasPagamentoListView />);
  await screen.findByText('Dinheiro');
}

describe('FormasPagamentoListView — carga (LST-03)', () => {
  it('primeira carga: três skeletons, depois a lista', async () => {
    mockListar.mockResolvedValue({ ok: true, data: formas });
    // Segura a primeira carga: o render async esperaria a resposta e pularia o "carregando".
    const liberarCarga = segurarPrimeiraCarga(mockListar);
    await render(<FormasPagamentoListView />);

    expect(screen.getByLabelText('Carregando formas de pagamento')).toBeOnTheScreen();
    expect(todosPorTipo(Skeleton)).toHaveLength(3);
    await liberarCarga();
    expect(await screen.findByText('Pix')).toBeOnTheScreen();
  });

  it('o título da tela fica no header nativo, não no conteúdo (NAV-02)', async () => {
    await renderComLista();

    expect(screen.queryByText('Formas de pagamento')).not.toBeOnTheScreen();
    expect(porTipo(SafeAreaView).props.edges).not.toContain('top');
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

    const refresh = porTipo(RefreshControl);
    expect(refresh.props.colors).toEqual([colors.accent]);
    await act(async () => refresh.props.onRefresh!());
    expect(mockListar).toHaveBeenCalledTimes(2);

    expect(StyleSheet.flatten(porTipo(FlatList).props.contentContainerStyle)).toMatchObject({
      paddingBottom: FAB_ALTURA_RESERVADA,
    });
  });

  it('estado de erro com "Tentar novamente"', async () => {
    mockListar
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as formas de pagamento.' })
      .mockResolvedValueOnce({ ok: true, data: formas });
    await render(<FormasPagamentoListView />);

    expect(await screen.findByText('Não foi possível carregar')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

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

    await fireEvent.press(screen.getByRole('button', { name: 'Dinheiro' }));

    expect(mockPush).toHaveBeenCalledWith('/formas-pagamento/2/editar');
  });

  it('forma editável alterna pelo switch, desabilitado enquanto salva, com Snackbar', async () => {
    let concluir: (valor: Awaited<ReturnType<typeof definirAtivaFormaPagamento>>) => void = () => undefined;
    mockDefinirAtiva.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    await renderComLista();

    const toque1 = await dispararSemEsperar(() => fireEvent(screen.getByRole('switch', { name: 'Ativa: Dinheiro' }), 'valueChange', false));

    expect(mockDefinirAtiva).toHaveBeenCalledWith('2', false);
    expect(screen.getByRole('switch', { name: 'Ativa: Dinheiro' })).toBeDisabled();

    await act(async () => {
      concluir({ ok: true, data: { id: '2', nome: 'Dinheiro', ativa: false } });
      await toque1.terminou;
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Forma de pagamento desativada.');
  });

  it('o switch de uma linha re-renderiza só ela: as outras são memoizadas (EIX-71)', async () => {
    let concluir: (valor: Awaited<ReturnType<typeof definirAtivaFormaPagamento>>) => void = () => undefined;
    mockDefinirAtiva.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    await renderComLista();
    const pixAntes = rendersDaLinha('Pix');
    const dinheiroAntes = rendersDaLinha('Dinheiro');

    const toque1 = await dispararSemEsperar(() => fireEvent(screen.getByRole('switch', { name: 'Ativa: Dinheiro' }), 'valueChange', false));

    // A linha do switch renderiza para ficar desabilitada enquanto salva.
    expect(screen.getByRole('switch', { name: 'Ativa: Dinheiro' })).toBeDisabled();
    expect(rendersDaLinha('Dinheiro')).toBeGreaterThan(dinheiroAntes);

    await act(async () => {
      concluir({ ok: true, data: { id: '2', nome: 'Dinheiro', ativa: false } });
      await toque1.terminou;
    });

    // Salvou, a tela mostrou o Snackbar e a lista mudou; a vizinha, que não mudou, não renderizou nenhuma vez.
    expect(screen.getByRole('alert')).toHaveTextContent('Forma de pagamento desativada.');
    expect(rendersDaLinha('Pix')).toBe(pixAntes);
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

    await fireEvent(screen.getByRole('switch', { name: 'Mostrar desativadas' }), 'valueChange', true);

    expect(screen.getByText('Antiga')).toBeOnTheScreen();
    expect(screen.getByText('Desativada')).toBeOnTheScreen();
  });

  it('filtra pela busca e mostra o vazio quando nada bate', async () => {
    await renderComLista();

    await fireEvent.changeText(screen.getByLabelText('Buscar'), 'dinh');
    expect(screen.getByText('Dinheiro')).toBeOnTheScreen();
    expect(screen.queryByText('Pix')).not.toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Buscar'), 'zzz');
    expect(screen.getByText('Nenhuma forma de pagamento encontrada')).toBeOnTheScreen();
  });

  it('o FAB "Nova forma de pagamento" abre a criação', async () => {
    await renderComLista();

    await fireEvent.press(screen.getByRole('button', { name: 'Nova forma de pagamento' }));

    expect(mockPush).toHaveBeenCalledWith('/formas-pagamento/nova');
  });
});

describe('FormasPagamentoListView — tablet (EIX-94)', () => {
  afterEach(() => mockLargura(412));

  function estiloDoConteudo() {
    return StyleSheet.flatten(screen.getByTestId('screen-conteudo').props.style);
  }

  function estiloDaLista() {
    return StyleSheet.flatten(porTipo(FlatList).props.contentContainerStyle);
  }

  it('412: nada muda, o respiro lateral continua no Screen e a lista não ganha coluna', async () => {
    await renderComLista();

    expect(estiloDoConteudo()).toMatchObject({ paddingHorizontal: spacing.base });
    expect(estiloDaLista()?.maxWidth).toBeUndefined();
  });

  it('800: a lista rola na largura toda e o conteúdo fica na coluna de 720', async () => {
    mockLargura(800);
    await renderComLista();

    expect(estiloDoConteudo().maxWidth).toBeUndefined();
    expect(estiloDoConteudo().paddingHorizontal).toBeUndefined();
    expect(estiloDaLista()).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
    const coluna = screen.getByTestId('screen-coluna');
    expect(StyleSheet.flatten(coluna.props.style)).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
    expect(within(coluna).getByLabelText('Buscar')).toBeOnTheScreen();
  });
});
