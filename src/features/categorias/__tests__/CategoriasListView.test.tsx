import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FAB_ALTURA_RESERVADA, Skeleton, colors } from '@/ui';

import { CategoriasListView } from '../CategoriasListView';
import { definirAtivaCategoria, listarCategorias } from '../categoriasRepository';
import type { Categoria } from '../types';

// O runner do GitHub Actions é mais lento que a máquina local: o padrão de 5s estourava no CI.
jest.setTimeout(15000);

// Jest hoista jest.mock() acima dos imports/declarações do arquivo: a fábrica só pode
// referenciar variáveis de fora do escopo se o nome começar com "mock" (babel-plugin-jest-hoist).
const mockPush = jest.fn();
// Guarda o callback do foco para o teste simular "voltei para esta tela".
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

jest.mock('../categoriasRepository', () => ({
  listarCategorias: jest.fn(),
  definirAtivaCategoria: jest.fn(),
}));

const mockListar = listarCategorias as jest.MockedFunction<typeof listarCategorias>;
const mockDefinirAtiva = definirAtivaCategoria as jest.MockedFunction<typeof definirAtivaCategoria>;

const categorias: Categoria[] = [
  { id: '1', titulo: 'Frete', tipo: 'Entrada', ativa: true },
  { id: '2', titulo: 'Combustível', tipo: 'Saida', ativa: true },
  { id: '3', titulo: 'Categoria antiga', tipo: 'Saida', ativa: false },
];

beforeEach(() => {
  mockPush.mockReset();
  mockListar.mockReset();
  mockDefinirAtiva.mockReset();
});

async function renderComLista() {
  mockListar.mockResolvedValue({ ok: true, data: categorias });
  render(<CategoriasListView />);
  await screen.findByText('Frete');
}

describe('CategoriasListView — carga (LST-03)', () => {
  it('primeira carga: três skeletons, depois a lista com o tipo no subtítulo', async () => {
    mockListar.mockResolvedValue({ ok: true, data: categorias });
    render(<CategoriasListView />);

    expect(screen.getByLabelText('Carregando categorias')).toBeOnTheScreen();
    expect(screen.UNSAFE_getAllByType(Skeleton)).toHaveLength(3);

    expect(await screen.findByText('Frete')).toBeOnTheScreen();
    expect(screen.getByText('Combustível')).toBeOnTheScreen();
    expect(screen.getByText('Entrada')).toBeOnTheScreen();
    expect(screen.getByText('Saída')).toBeOnTheScreen();
  });

  it('o título da tela fica no header nativo, não no conteúdo (NAV-02)', async () => {
    await renderComLista();

    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
    expect(screen.queryByText('Categorias')).not.toBeOnTheScreen();
    // Tela interna: o header nativo protege o topo, o Screen não repete o inset (NAV-04, AC 11).
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
  });

  it('voltar o foco com a lista na tela recarrega sem skeleton, e a lista nova substitui a antiga', async () => {
    await renderComLista();
    mockListar.mockResolvedValue({ ok: true, data: [...categorias, { id: '4', titulo: 'Pedágio', tipo: 'Saida', ativa: true }] });

    await act(async () => {
      mockAoFocar?.();
    });

    expect(screen.queryByLabelText('Carregando categorias')).not.toBeOnTheScreen();
    expect(screen.getByText('Frete')).toBeOnTheScreen();
    expect(screen.getByText('Pedágio')).toBeOnTheScreen();
  });

  it('pull-to-refresh com o indicador em accent busca de novo', async () => {
    await renderComLista();

    const refresh = screen.UNSAFE_getByType(RefreshControl);
    expect(refresh.props.colors).toEqual([colors.accent]);
    expect(refresh.props.tintColor).toBe(colors.accent);

    await act(async () => refresh.props.onRefresh());
    expect(mockListar).toHaveBeenCalledTimes(2);
  });

  it('a lista reserva o espaço do FAB no fim (LST-03, AC 13)', async () => {
    await renderComLista();

    expect(StyleSheet.flatten(screen.UNSAFE_getByType(FlatList).props.contentContainerStyle)).toMatchObject({
      paddingBottom: FAB_ALTURA_RESERVADA,
    });
  });

  it('estado de erro mostra mensagem em português e "Tentar novamente" recarrega', async () => {
    mockListar
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as categorias.' })
      .mockResolvedValueOnce({ ok: true, data: categorias });
    render(<CategoriasListView />);

    expect(await screen.findByText('Não foi possível carregar')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Frete')).toBeOnTheScreen();
  });
});

describe('CategoriasListView — linha (LST-01)', () => {
  it('tocar na linha abre a edição da categoria certa', async () => {
    await renderComLista();

    fireEvent.press(screen.getByRole('button', { name: 'Combustível' }));

    expect(mockPush).toHaveBeenCalledWith('/categorias/2/editar');
  });

  it('não existe botão "Editar" nem "Desativar" na linha', async () => {
    await renderComLista();

    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Desativar' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Reativar' })).not.toBeOnTheScreen();
  });

  it('switch "Ativa" desativa, fica desabilitado enquanto salva e mostra "Categoria desativada."', async () => {
    let concluir: (valor: Awaited<ReturnType<typeof definirAtivaCategoria>>) => void = () => undefined;
    mockDefinirAtiva.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    await renderComLista();

    fireEvent(screen.getByRole('switch', { name: 'Ativa: Combustível' }), 'valueChange', false);

    expect(mockDefinirAtiva).toHaveBeenCalledWith('2', false);
    expect(screen.getByRole('switch', { name: 'Ativa: Combustível' })).toBeDisabled();

    await act(async () => concluir({ ok: true, data: { ...categorias[1]!, ativa: false } }));

    expect(screen.getByRole('alert')).toHaveTextContent('Categoria desativada.');
    // Com o filtro de desativadas desligado, a categoria sai da lista.
    expect(screen.queryByText('Combustível')).not.toBeOnTheScreen();
  });

  it('erro ao desativar mostra o Snackbar de erro e mantém a categoria ativa', async () => {
    mockDefinirAtiva.mockResolvedValue({ ok: false, mensagem: 'Não foi possível atualizar a categoria.' });
    await renderComLista();

    await act(async () => fireEvent(screen.getByRole('switch', { name: 'Ativa: Combustível' }), 'valueChange', false));

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível atualizar a categoria.');
    expect(screen.getByRole('switch', { name: 'Ativa: Combustível' })).toBeChecked();
  });

  it('o switch fica fora do botão da linha: o leitor de tela alcança os dois', async () => {
    await renderComLista();

    expect(within(screen.getByRole('button', { name: 'Frete' })).queryByRole('switch')).not.toBeOnTheScreen();
  });
});

describe('CategoriasListView — filtros e FAB (LST-01)', () => {
  it('esconde as desativadas por padrão; com o filtro, aparecem para reativar pelo switch', async () => {
    await renderComLista();
    expect(screen.queryByText('Categoria antiga')).not.toBeOnTheScreen();

    fireEvent(screen.getByRole('switch', { name: 'Mostrar desativadas' }), 'valueChange', true);

    expect(screen.getByText('Categoria antiga')).toBeOnTheScreen();
    expect(screen.getByText('Saída · Desativada')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Ativa: Categoria antiga' })).not.toBeChecked();
  });

  it('filtra a lista pela busca no título', async () => {
    await renderComLista();

    fireEvent.changeText(screen.getByLabelText('Buscar'), 'combust');

    expect(screen.queryByText('Frete')).not.toBeOnTheScreen();
    expect(screen.getByText('Combustível')).toBeOnTheScreen();
  });

  it('estado vazio quando a busca não encontra nenhuma categoria', async () => {
    await renderComLista();

    fireEvent.changeText(screen.getByLabelText('Buscar'), 'zzz');

    expect(screen.getByText('Nenhuma categoria encontrada')).toBeOnTheScreen();
  });

  it('o FAB "Nova categoria" abre a criação', async () => {
    await renderComLista();

    fireEvent.press(screen.getByRole('button', { name: 'Nova categoria' }));

    expect(mockPush).toHaveBeenCalledWith('/categorias/nova');
  });
});
