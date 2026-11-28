import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { segurarPrimeiraCarga } from '@/testing/eventos';
import { porTipo, todosPorTipo } from '@/testing/componentes';
import { FAB_ALTURA_RESERVADA, ListItem, Skeleton, colors, spacing } from '@/ui';

import { FormasPagamentoListView } from '../FormasPagamentoListView';
import { listarFormasPagamento } from '../formasPagamentoRepository';
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

  it('pull-to-refresh em accentStrong e espaço para o FAB no fim da lista', async () => {
    await renderComLista();

    const refresh = porTipo(RefreshControl);
    expect(refresh.props.colors).toEqual([colors.accentStrong]);
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
    expect(screen.getByText(nome)).toBeOnTheScreen();
  });

  it('forma editável abre a edição ao tocar na linha', async () => {
    await renderComLista();

    await fireEvent.press(screen.getByRole('button', { name: 'Dinheiro' }));

    expect(mockPush).toHaveBeenCalledWith('/formas-pagamento/2/editar');
  });

  // Desativar e reativar moram no Editar, igual em Categorias, Rotas e Veículos.
  it('a linha não tem switch nem botão de ação: desativar fica no Editar', async () => {
    await renderComLista();

    expect(screen.queryByRole('switch')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^(Editar|Desativar|Reativar|Mais opções)/ })).not.toBeOnTheScreen();
  });

  it('digitar na busca não re-renderiza as linhas que continuam na lista: são memoizadas (EIX-71)', async () => {
    await renderComLista();
    const dinheiroAntes = rendersDaLinha('Dinheiro');

    await fireEvent.changeText(screen.getByLabelText('Buscar forma de pagamento'), 'dinh');

    expect(screen.queryByText('Pix')).not.toBeOnTheScreen();
    expect(rendersDaLinha('Dinheiro')).toBe(dinheiroAntes);
  });
});

describe('FormasPagamentoListView — desativadas, busca e FAB (LST-01)', () => {
  it('as ativas vêm em dois grupos com a contagem, as da empresa antes das fixas, sem o "Mostrar desativadas"', async () => {
    await renderComLista();

    expect(screen.getAllByRole('header').map((titulo) => titulo.props.children)).toEqual([
      'Cadastradas pela empresa · 1',
      'Padrão do sistema · 4',
    ]);
    // O grupo diz que as fixas são do sistema: nenhuma linha repete "Padrão do sistema" no subtítulo.
    expect(screen.getAllByText(/Padrão do sistema/)).toHaveLength(1);
    expect(screen.queryByRole('switch', { name: 'Mostrar desativadas' })).not.toBeOnTheScreen();
  });

  it('desativadas ficam recolhidas no fim; ao abrir, a linha leva ao Editar para reativar', async () => {
    await renderComLista();

    const cabecalho = screen.getByRole('button', { name: 'Desativadas, 1' });
    expect(cabecalho).toBeCollapsed();
    expect(screen.queryByRole('button', { name: 'Antiga' })).not.toBeOnTheScreen();

    await fireEvent.press(cabecalho);
    await fireEvent.press(screen.getByRole('button', { name: 'Antiga' }));

    expect(mockPush).toHaveBeenCalledWith('/formas-pagamento/6/editar');
  });

  it('sem desativadas, o grupo recolhido não aparece', async () => {
    mockListar.mockResolvedValue({ ok: true, data: formas.filter((forma) => forma.ativa) });
    await render(<FormasPagamentoListView />);
    await screen.findByText('Dinheiro');

    expect(screen.queryByRole('button', { name: /^Desativadas/ })).not.toBeOnTheScreen();
  });

  it('filtra pela busca e mostra o vazio quando nada bate', async () => {
    await renderComLista();

    await fireEvent.changeText(screen.getByLabelText('Buscar forma de pagamento'), 'dinh');
    expect(screen.getByText('Dinheiro')).toBeOnTheScreen();
    expect(screen.queryByText('Pix')).not.toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Buscar forma de pagamento'), 'zzz');
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
    expect(within(coluna).getByLabelText('Buscar forma de pagamento')).toBeOnTheScreen();
  });
});
