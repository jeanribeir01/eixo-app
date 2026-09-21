import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { CategoriaFormView } from '../CategoriaFormView';
import { atualizarCategoria, buscarCategoriaPorId, criarCategoria } from '../categoriasRepository';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock('../categoriasRepository', () => ({
  criarCategoria: jest.fn(),
  atualizarCategoria: jest.fn(),
  buscarCategoriaPorId: jest.fn(),
}));

describe('CategoriaFormView', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    (criarCategoria as jest.Mock).mockReset();
    (atualizarCategoria as jest.Mock).mockReset();
    (buscarCategoriaPorId as jest.Mock).mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('modo criar: renderiza título da tela, campo Título e as opções de tipo', () => {
    render(<CategoriaFormView />);

    expect(screen.getByText('Nova categoria')).toBeOnTheScreen();
    expect(screen.getByLabelText('Título')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Entrada' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Saída' })).toBeOnTheScreen();
  });

  it('não permite salvar com título vazio e mostra a mensagem no campo', () => {
    render(<CategoriaFormView />);

    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('Informe o título da categoria.')).toBeOnTheScreen();
    expect(criarCategoria).not.toHaveBeenCalled();
  });

  it('caminho feliz: cria a categoria, mostra Snackbar de sucesso e volta para a lista', async () => {
    (criarCategoria as jest.Mock).mockResolvedValue({
      ok: true,
      data: { id: '1', titulo: 'Pneus', tipo: 'Saida' },
    });

    render(<CategoriaFormView />);

    fireEvent.changeText(screen.getByLabelText('Título'), 'Pneus');
    fireEvent.press(screen.getByRole('tab', { name: 'Saída' }));

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    });

    expect(criarCategoria).toHaveBeenCalledWith({ titulo: 'Pneus', tipo: 'Saida' });
    expect(await screen.findByText('Categoria criada.')).toBeOnTheScreen();

    act(() => {
      jest.advanceTimersByTime(1200);
    });

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('título duplicado: mostra a mensagem do repositório junto do campo e não navega', async () => {
    (criarCategoria as jest.Mock).mockResolvedValue({
      ok: false,
      mensagem: 'Já existe uma categoria com esse título.',
    });

    render(<CategoriaFormView />);

    fireEvent.changeText(screen.getByLabelText('Título'), 'Combustível');

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    });

    expect(screen.getAllByText('Já existe uma categoria com esse título.').length).toBeGreaterThan(0);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('modo editar: carrega a categoria existente e preenche o formulário', async () => {
    (buscarCategoriaPorId as jest.Mock).mockResolvedValue({
      ok: true,
      data: { id: '9', titulo: 'Manutenção', tipo: 'Saida' },
    });

    render(<CategoriaFormView categoriaId="9" />);

    expect(await screen.findByText('Editar categoria')).toBeOnTheScreen();
    expect(screen.getByLabelText('Título').props.value).toBe('Manutenção');
    expect(screen.getByRole('tab', { name: 'Saída' })).toHaveStyle({ backgroundColor: '#1c1917' });
  });

  it('modo editar: envia a atualização para o id certo', async () => {
    (buscarCategoriaPorId as jest.Mock).mockResolvedValue({
      ok: true,
      data: { id: '9', titulo: 'Manutenção', tipo: 'Saida' },
    });
    (atualizarCategoria as jest.Mock).mockResolvedValue({
      ok: true,
      data: { id: '9', titulo: 'Manutenção preventiva', tipo: 'Saida' },
    });

    render(<CategoriaFormView categoriaId="9" />);
    await screen.findByText('Editar categoria');

    fireEvent.changeText(screen.getByLabelText('Título'), 'Manutenção preventiva');

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    });

    expect(atualizarCategoria).toHaveBeenCalledWith('9', { titulo: 'Manutenção preventiva', tipo: 'Saida' });
    expect(await screen.findByText('Categoria atualizada.')).toBeOnTheScreen();
  });

  it('erro ao carregar a categoria mostra estado de erro e "Voltar" navega para trás', async () => {
    (buscarCategoriaPorId as jest.Mock).mockResolvedValue({ ok: false, mensagem: 'Categoria não encontrada.' });

    render(<CategoriaFormView categoriaId="inexistente" />);

    expect(await screen.findByText('Não foi possível carregar a categoria')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('"Cancelar" volta sem salvar', () => {
    render(<CategoriaFormView />);

    fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(criarCategoria).not.toHaveBeenCalled();
  });
});
