import { fireEvent, render, screen } from '@testing-library/react-native';

import { CategoriasListView } from '../CategoriasListView';
import { definirAtivaCategoria, listarCategorias } from '../categoriasRepository';

// Jest hoista jest.mock() acima dos imports/declarações do arquivo: a fábrica só pode
// referenciar variáveis de fora do escopo se o nome começar com "mock" (babel-plugin-jest-hoist).
const mockPush = jest.fn();

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, []),
  };
});

jest.mock('../categoriasRepository', () => ({
  listarCategorias: jest.fn(),
  definirAtivaCategoria: jest.fn(),
}));

const categoriasMock = [
  { id: '1', titulo: 'Frete', tipo: 'Entrada' as const, ativa: true },
  { id: '2', titulo: 'Combustível', tipo: 'Saida' as const, ativa: true },
  { id: '3', titulo: 'Categoria antiga', tipo: 'Saida' as const, ativa: false },
];

describe('CategoriasListView', () => {
  beforeEach(() => {
    mockPush.mockReset();
    (listarCategorias as jest.Mock).mockReset();
    (definirAtivaCategoria as jest.Mock).mockReset();
  });

  it('mostra carregando e depois a lista com título e chip de tipo', async () => {
    (listarCategorias as jest.Mock).mockResolvedValue({ ok: true, data: categoriasMock });

    render(<CategoriasListView />);

    expect(screen.getByLabelText('Carregando categorias')).toBeOnTheScreen();

    expect(await screen.findByText('Frete')).toBeOnTheScreen();
    expect(screen.getByText('Combustível')).toBeOnTheScreen();
    expect(screen.getByText('Entrada')).toBeOnTheScreen();
    expect(screen.getByText('Saída')).toBeOnTheScreen();
  });

  it('esconde categorias desativadas por padrão e mostra ao ligar o filtro (com opção de reativar)', async () => {
    (listarCategorias as jest.Mock).mockResolvedValue({ ok: true, data: categoriasMock });

    render(<CategoriasListView />);
    await screen.findByText('Frete');

    expect(screen.queryByText('Categoria antiga')).not.toBeOnTheScreen();

    fireEvent(screen.getByRole('switch', { name: 'Mostrar desativadas' }), 'valueChange', true);

    expect(await screen.findByText('Categoria antiga')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reativar' })).toBeOnTheScreen();
  });

  it('filtra a lista pela busca no título', async () => {
    (listarCategorias as jest.Mock).mockResolvedValue({ ok: true, data: categoriasMock });

    render(<CategoriasListView />);
    await screen.findByText('Frete');

    fireEvent.changeText(screen.getByLabelText('Buscar'), 'combust');

    expect(screen.queryByText('Frete')).not.toBeOnTheScreen();
    expect(screen.getByText('Combustível')).toBeOnTheScreen();
  });

  it('estado vazio quando a busca não encontra nenhuma categoria', async () => {
    (listarCategorias as jest.Mock).mockResolvedValue({ ok: true, data: categoriasMock });

    render(<CategoriasListView />);
    await screen.findByText('Frete');

    fireEvent.changeText(screen.getByLabelText('Buscar'), 'zzz');

    expect(await screen.findByText('Nenhuma categoria encontrada')).toBeOnTheScreen();
  });

  it('estado de erro mostra mensagem em português e "Tentar novamente" recarrega', async () => {
    (listarCategorias as jest.Mock)
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as categorias.' })
      .mockResolvedValueOnce({ ok: true, data: categoriasMock });

    render(<CategoriasListView />);

    expect(await screen.findByText('Não foi possível carregar')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Frete')).toBeOnTheScreen();
  });

  it('desativar: chama a mutação com a categoria certa e mostra Snackbar de sucesso', async () => {
    (listarCategorias as jest.Mock).mockResolvedValue({ ok: true, data: categoriasMock });
    (definirAtivaCategoria as jest.Mock).mockResolvedValue({
      ok: true,
      data: { ...categoriasMock[0], ativa: false },
    });

    render(<CategoriasListView />);
    await screen.findByText('Frete');

    fireEvent.press(screen.getAllByRole('button', { name: 'Desativar' })[0]);

    expect(definirAtivaCategoria).toHaveBeenCalledWith('1', false);
    expect(await screen.findByText('Categoria desativada.')).toBeOnTheScreen();
  });

  it('erro ao desativar mostra Snackbar de erro', async () => {
    (listarCategorias as jest.Mock).mockResolvedValue({ ok: true, data: categoriasMock });
    (definirAtivaCategoria as jest.Mock).mockResolvedValue({
      ok: false,
      mensagem: 'Não foi possível desativar a categoria.',
    });

    render(<CategoriasListView />);
    await screen.findByText('Frete');

    fireEvent.press(screen.getAllByRole('button', { name: 'Desativar' })[0]);

    expect(await screen.findByText('Não foi possível desativar a categoria.')).toBeOnTheScreen();
  });

  it('"Editar" navega para a tela de edição da categoria certa', async () => {
    (listarCategorias as jest.Mock).mockResolvedValue({ ok: true, data: categoriasMock });

    render(<CategoriasListView />);
    await screen.findByText('Frete');

    fireEvent.press(screen.getAllByRole('button', { name: 'Editar' })[0]);

    expect(mockPush).toHaveBeenCalledWith('/categorias/1/editar');
  });

  it('"Nova categoria" navega para a rota de criação', async () => {
    (listarCategorias as jest.Mock).mockResolvedValue({ ok: true, data: categoriasMock });

    render(<CategoriasListView />);
    await screen.findByText('Frete');

    fireEvent.press(screen.getByRole('button', { name: 'Nova categoria' }));

    expect(mockPush).toHaveBeenCalledWith('/categorias/nova');
  });
});
