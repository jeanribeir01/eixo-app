import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FAB_ALTURA_RESERVADA, ListItem, Skeleton, colors, spacing } from '@/ui';

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

jest.mock('../categoriasRepository', () => ({
  listarCategorias: jest.fn(),
  definirAtivaCategoria: jest.fn(),
}));


// O ListItem real, só embrulhado num jest.fn: o teste de memo (EIX-71) conta quantas vezes cada linha renderiza.
jest.mock('@/ui', () => {
  const real = jest.requireActual('@/ui');
  return { ...real, ListItem: jest.fn(real.ListItem) };
});

function rendersDaLinha(titulo: string): number {
  return jest.mocked(ListItem).mock.calls.filter(([props]) => props.title === titulo).length;
}

// Largura da janela controlada pelo teste: 412 é celular, 800 é tablet (EIX-94).
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 900, scale: 1, fontScale: 1 })),
}));

function mockLargura(width: number) {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

const mockListar = listarCategorias as jest.MockedFunction<typeof listarCategorias>;
const mockDefinirAtiva = definirAtivaCategoria as jest.MockedFunction<typeof definirAtivaCategoria>;

// A tela abre na aba Saídas: duas saídas ativas, uma desativada e uma entrada (só aparece na outra aba).
const categorias: Categoria[] = [
  { id: '1', titulo: 'Frete', tipo: 'Entrada', ativa: true },
  { id: '2', titulo: 'Combustível', tipo: 'Saida', ativa: true },
  { id: '3', titulo: 'Categoria antiga', tipo: 'Saida', ativa: false },
  { id: '4', titulo: 'Pedágio', tipo: 'Saida', ativa: true },
];

beforeEach(() => {
  mockPush.mockReset();
  mockListar.mockReset();
  mockDefinirAtiva.mockReset();
});

async function renderComLista() {
  mockListar.mockResolvedValue({ ok: true, data: categorias });
  render(<CategoriasListView />);
  await screen.findByText('Combustível');
}

describe('CategoriasListView — carga (LST-03)', () => {
  it('primeira carga: três skeletons, depois as saídas ativas', async () => {
    mockListar.mockResolvedValue({ ok: true, data: categorias });
    render(<CategoriasListView />);

    expect(screen.getByLabelText('Carregando categorias')).toBeOnTheScreen();
    expect(screen.UNSAFE_getAllByType(Skeleton)).toHaveLength(3);

    expect(await screen.findByText('Combustível')).toBeOnTheScreen();
    expect(screen.getByText('Pedágio')).toBeOnTheScreen();
    expect(screen.queryByText('Frete')).not.toBeOnTheScreen();
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
    mockListar.mockResolvedValue({
      ok: true,
      data: [...categorias, { id: '5', titulo: 'Manutenção', tipo: 'Saida', ativa: true }],
    });

    await act(async () => {
      mockAoFocar?.();
    });

    expect(screen.queryByLabelText('Carregando categorias')).not.toBeOnTheScreen();
    expect(screen.getByText('Combustível')).toBeOnTheScreen();
    expect(screen.getByText('Manutenção')).toBeOnTheScreen();
  });

  it('pull-to-refresh com o indicador em accentStrong busca de novo', async () => {
    await renderComLista();

    const refresh = screen.UNSAFE_getByType(RefreshControl);
    expect(refresh.props.colors).toEqual([colors.accentStrong]);
    expect(refresh.props.tintColor).toBe(colors.accentStrong);

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

    expect(await screen.findByText('Combustível')).toBeOnTheScreen();
  });
});

// Abas Saídas/Entradas no lugar do tipo no subtítulo (US01; auditoria de UI, item 6).
describe('CategoriasListView — abas por tipo', () => {
  it('as abas mostram quantas categorias ativas cada tipo tem; Saídas vem selecionada', async () => {
    await renderComLista();

    expect(screen.getByRole('tab', { name: 'Saídas · 2', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Entradas · 1', selected: false })).toBeOnTheScreen();
  });

  it('trocar para Entradas mostra só as entradas', async () => {
    await renderComLista();

    fireEvent.press(screen.getByRole('tab', { name: 'Entradas · 1' }));

    expect(screen.getByText('Frete')).toBeOnTheScreen();
    expect(screen.queryByText('Combustível')).not.toBeOnTheScreen();
  });

  it('o FAB cria a categoria já com o tipo da aba aberta', async () => {
    await renderComLista();

    fireEvent.press(screen.getByRole('button', { name: 'Nova categoria' }));
    expect(mockPush).toHaveBeenLastCalledWith('/categorias/nova?tipo=Saida');

    fireEvent.press(screen.getByRole('tab', { name: 'Entradas · 1' }));
    fireEvent.press(screen.getByRole('button', { name: 'Nova categoria' }));
    expect(mockPush).toHaveBeenLastCalledWith('/categorias/nova?tipo=Entrada');
  });

  it('aba sem categoria: estado vazio que aponta o botão de criar', async () => {
    mockListar.mockResolvedValue({ ok: true, data: categorias.filter((categoria) => categoria.tipo === 'Saida') });
    render(<CategoriasListView />);
    await screen.findByText('Combustível');

    fireEvent.press(screen.getByRole('tab', { name: 'Entradas · 0' }));

    expect(screen.getByText('Nenhuma categoria de entrada')).toBeOnTheScreen();
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

  it('switch "Ativa" desativa, fica desabilitado enquanto salva e a categoria vai para Desativadas', async () => {
    let concluir: (valor: Awaited<ReturnType<typeof definirAtivaCategoria>>) => void = () => undefined;
    mockDefinirAtiva.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    await renderComLista();

    fireEvent(screen.getByRole('switch', { name: 'Ativa: Combustível' }), 'valueChange', false);

    expect(mockDefinirAtiva).toHaveBeenCalledWith('2', false);
    expect(screen.getByRole('switch', { name: 'Ativa: Combustível' })).toBeDisabled();

    await act(async () => concluir({ ok: true, data: { ...categorias[1]!, ativa: false } }));

    expect(screen.getByText('"Combustível" desativada.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Combustível' })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Desativadas, 2' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Saídas · 1' })).toBeOnTheScreen();
  });

  it('"Desfazer" no Snackbar reativa a categoria que acabou de ser desativada', async () => {
    mockDefinirAtiva
      .mockResolvedValueOnce({ ok: true, data: { ...categorias[1]!, ativa: false } })
      .mockResolvedValueOnce({ ok: true, data: { ...categorias[1]!, ativa: true } });
    await renderComLista();

    await act(async () => fireEvent(screen.getByRole('switch', { name: 'Ativa: Combustível' }), 'valueChange', false));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Desfazer' })));

    expect(mockDefinirAtiva).toHaveBeenLastCalledWith('2', true);
    expect(screen.getByText('"Combustível" reativada.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Combustível' })).toBeOnTheScreen();
    // Reativar não oferece "Desfazer": não há nada perdido para recuperar.
    expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeOnTheScreen();
  });

  it('erro ao desativar mostra o Snackbar de erro e mantém a categoria ativa', async () => {
    mockDefinirAtiva.mockResolvedValue({ ok: false, mensagem: 'Não foi possível atualizar a categoria.' });
    await renderComLista();

    await act(async () => fireEvent(screen.getByRole('switch', { name: 'Ativa: Combustível' }), 'valueChange', false));

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível atualizar a categoria.');
    expect(screen.getByRole('switch', { name: 'Ativa: Combustível' })).toBeChecked();
  });

  it('o switch de uma linha re-renderiza só ela: as outras são memoizadas (EIX-71)', async () => {
    let concluir: (valor: Awaited<ReturnType<typeof definirAtivaCategoria>>) => void = () => undefined;
    mockDefinirAtiva.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    await renderComLista();
    const pedagioAntes = rendersDaLinha('Pedágio');
    const combustivelAntes = rendersDaLinha('Combustível');

    fireEvent(screen.getByRole('switch', { name: 'Ativa: Combustível' }), 'valueChange', false);

    // A linha do switch renderiza para ficar desabilitada enquanto salva.
    expect(screen.getByRole('switch', { name: 'Ativa: Combustível' })).toBeDisabled();
    expect(rendersDaLinha('Combustível')).toBeGreaterThan(combustivelAntes);

    await act(async () => concluir({ ok: true, data: { ...categorias[1]!, ativa: false } }));

    // Salvou, a tela mostrou o Snackbar e a lista mudou; a vizinha, que não mudou, não renderizou nenhuma vez.
    expect(screen.getByText('"Combustível" desativada.')).toBeOnTheScreen();
    expect(rendersDaLinha('Pedágio')).toBe(pedagioAntes);
  });

  it('o switch fica fora do botão da linha: o leitor de tela alcança os dois', async () => {
    await renderComLista();

    expect(within(screen.getByRole('button', { name: 'Combustível' })).queryByRole('switch')).not.toBeOnTheScreen();
  });
});

describe('CategoriasListView — desativadas e busca (LST-01)', () => {
  it('desativadas ficam recolhidas no fim, com os nomes; ao abrir, aparecem para reativar pelo switch', async () => {
    await renderComLista();

    const cabecalho = screen.getByRole('button', { name: 'Desativadas, 1' });
    expect(cabecalho).toBeCollapsed();
    expect(screen.getByText('Categoria antiga')).toBeOnTheScreen();
    expect(screen.queryByRole('switch', { name: 'Ativa: Categoria antiga' })).not.toBeOnTheScreen();

    fireEvent.press(cabecalho);

    expect(screen.getByRole('button', { name: 'Desativadas, 1' })).toBeExpanded();
    expect(screen.getByText('Desativada · some dos novos lançamentos')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Ativa: Categoria antiga' })).not.toBeChecked();
  });

  it('sem desativadas, a seção não aparece', async () => {
    mockListar.mockResolvedValue({ ok: true, data: categorias.filter((categoria) => categoria.ativa) });
    render(<CategoriasListView />);
    await screen.findByText('Combustível');

    expect(screen.queryByText(/^Desativadas/)).not.toBeOnTheScreen();
  });

  it('filtra a aba pela busca no nome', async () => {
    await renderComLista();

    fireEvent.changeText(screen.getByLabelText('Buscar'), 'combust');

    expect(screen.queryByText('Pedágio')).not.toBeOnTheScreen();
    expect(screen.getByText('Combustível')).toBeOnTheScreen();
  });

  it('estado vazio quando a busca não encontra nenhuma categoria', async () => {
    await renderComLista();

    fireEvent.changeText(screen.getByLabelText('Buscar'), 'zzz');

    expect(screen.getByText('Nenhuma categoria encontrada')).toBeOnTheScreen();
  });
});

describe('CategoriasListView — tablet (EIX-94)', () => {
  afterEach(() => mockLargura(412));

  function estiloDoConteudo() {
    return StyleSheet.flatten(screen.getByTestId('screen-conteudo').props.style);
  }

  function estiloDaLista() {
    return StyleSheet.flatten(screen.UNSAFE_getByType(FlatList).props.contentContainerStyle);
  }

  it('412: nada muda, o respiro lateral continua no Screen e a lista não ganha coluna', async () => {
    await renderComLista();

    expect(estiloDoConteudo()).toMatchObject({ paddingHorizontal: spacing.base });
    expect(estiloDaLista().maxWidth).toBeUndefined();
  });

  it('800: a lista rola na largura toda; abas, busca e linhas ficam na mesma coluna de 720', async () => {
    mockLargura(800);
    await renderComLista();

    expect(estiloDoConteudo().maxWidth).toBeUndefined();
    expect(estiloDoConteudo().paddingHorizontal).toBeUndefined();
    expect(estiloDaLista()).toMatchObject({ maxWidth: 720, alignSelf: 'center', paddingBottom: FAB_ALTURA_RESERVADA });

    const coluna = screen.getByTestId('screen-coluna');
    expect(StyleSheet.flatten(coluna.props.style)).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
    expect(within(coluna).getByLabelText('Buscar')).toBeOnTheScreen();
    expect(within(coluna).getByRole('tab', { name: 'Saídas · 2' })).toBeOnTheScreen();
  });

  it('celular → tablet com a tela aberta: a busca digitada continua valendo e a lista ganha a coluna', async () => {
    mockListar.mockResolvedValue({ ok: true, data: categorias });
    const { rerender } = render(<CategoriasListView />);
    await screen.findByText('Combustível');
    fireEvent.changeText(screen.getByLabelText('Buscar'), 'combust');

    mockLargura(800);
    rerender(<CategoriasListView />);

    expect(estiloDaLista()).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
    expect(screen.getByLabelText('Buscar').props.value).toBe('combust');
    expect(screen.queryByText('Pedágio')).not.toBeOnTheScreen();
    expect(screen.getByText('Combustível')).toBeOnTheScreen();
  });
});
