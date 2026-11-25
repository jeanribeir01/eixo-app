import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoriaFormView } from '../CategoriaFormView';
import { atualizarCategoria, buscarCategoriaPorId, criarCategoria } from '../categoriasRepository';

import { porTipo } from '@/testing/componentes';

// O runner do GitHub Actions é mais lento que a máquina local: o padrão de 5s estourava no CI.
jest.setTimeout(15000);

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

  it('modo criar: renderiza o campo Título e as opções de tipo; o título da tela fica no header (NAV-02)', async () => {
    await render(<CategoriaFormView />);

    expect(screen.queryByText('Nova categoria')).not.toBeOnTheScreen();
    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Título')).toBeOnTheScreen();
    // Tela interna: o header nativo protege o topo, o Screen não repete o inset (NAV-04, AC 11).
    expect(porTipo(SafeAreaView).props.edges).not.toContain('top');
    // Formulário rola e sobe com o teclado (NAV-04, AC 9 e 10).
    expect(porTipo(KeyboardAvoidingView).porTipo(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
    // Tipo como duas opções que dizem para que lado vai o dinheiro; sem tipo da aba, nenhuma vem marcada.
    expect(screen.getByRole('radio', { name: 'Entrada. Dinheiro que entra no caixa' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Saída. Dinheiro que sai do caixa' })).not.toBeChecked();
  });

  it('aberta pela aba Saídas: o tipo já vem marcado', async () => {
    await render(<CategoriaFormView tipoInicial="Saida" />);

    expect(screen.getByRole('radio', { name: /^Saída\. / })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^Entrada\. / })).not.toBeChecked();
  });

  it('sem tipo escolhido, não salva e pede a escolha', async () => {
    await render(<CategoriaFormView />);

    await fireEvent.changeText(screen.getByLabelText('Título'), 'Pneus');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar categoria' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Escolha Entrada ou Saída.');
    expect(criarCategoria).not.toHaveBeenCalled();
  });

  it('não permite salvar com título vazio e mostra a mensagem no campo', async () => {
    await render(<CategoriaFormView tipoInicial="Saida" />);

    await fireEvent.press(screen.getByRole('button', { name: 'Criar categoria' }));

    expect(screen.getByText('Informe o título da categoria.')).toBeOnTheScreen();
    expect(criarCategoria).not.toHaveBeenCalled();
  });

  it('caminho feliz: cria a categoria, mostra Snackbar de sucesso e volta para a lista', async () => {
    (criarCategoria as jest.Mock).mockResolvedValue({
      ok: true,
      data: { id: '1', titulo: 'Pneus', tipo: 'Saida' },
    });

    await render(<CategoriaFormView />);

    await fireEvent.changeText(screen.getByLabelText('Título'), 'Pneus');
    await fireEvent.press(screen.getByRole('radio', { name: /^Saída\. / }));

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Criar categoria' }));
    });

    expect(criarCategoria).toHaveBeenCalledWith({ titulo: 'Pneus', tipo: 'Saida' });
    expect(await screen.findByText('Categoria criada.')).toBeOnTheScreen();

    await act(() => {
      jest.advanceTimersByTime(1200);
    });

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('título duplicado: mostra a mensagem do repositório junto do campo e não navega', async () => {
    (criarCategoria as jest.Mock).mockResolvedValue({
      ok: false,
      mensagem: 'Já existe uma categoria com esse título.',
    });

    await render(<CategoriaFormView tipoInicial="Saida" />);

    await fireEvent.changeText(screen.getByLabelText('Título'), 'Combustível');

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Criar categoria' }));
    });

    expect(screen.getAllByText('Já existe uma categoria com esse título.').length).toBeGreaterThan(0);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('modo editar: carrega a categoria existente e preenche o formulário', async () => {
    (buscarCategoriaPorId as jest.Mock).mockResolvedValue({
      ok: true,
      data: { id: '9', titulo: 'Manutenção', tipo: 'Saida' },
    });

    await render(<CategoriaFormView categoriaId="9" />);

    expect(await screen.findByLabelText('Título')).toBeOnTheScreen();
    expect(screen.queryByText('Editar categoria')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Título').props.value).toBe('Manutenção');
    // Pelo estado de seleção, não pela cor: o visual da opção marcada é do primitivo OpcaoSelecionavel.
    expect(screen.getByRole('radio', { name: /^Saída\. / })).toBeChecked();
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

    await render(<CategoriaFormView categoriaId="9" />);
    await screen.findByLabelText('Título');

    await fireEvent.changeText(screen.getByLabelText('Título'), 'Manutenção preventiva');

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Salvar alterações' }));
    });

    expect(atualizarCategoria).toHaveBeenCalledWith('9', { titulo: 'Manutenção preventiva', tipo: 'Saida' });
    expect(await screen.findByText('Categoria atualizada.')).toBeOnTheScreen();
  });

  it('erro ao carregar a categoria mostra estado de erro e "Voltar" navega para trás', async () => {
    (buscarCategoriaPorId as jest.Mock).mockResolvedValue({ ok: false, mensagem: 'Categoria não encontrada.' });

    await render(<CategoriaFormView categoriaId="inexistente" />);

    expect(await screen.findByText('Não foi possível carregar a categoria')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('um botão só, a ação da tela: sem "Cancelar", porque o voltar do header já desiste', async () => {
    await render(<CategoriaFormView />);

    expect(screen.getAllByRole('button').map((botao) => botao.props.accessibilityLabel)).toEqual(['Criar categoria']);
  });
});

// Carregando e erro de carga também abrem sob o header nativo: sem inset de topo duplicado (NAV-04, AC 11).
describe('CategoriaFormView — estados de carga sob o header (NAV-04)', () => {
  it('carregando: sem o inset de topo', async () => {
    (buscarCategoriaPorId as jest.Mock).mockReturnValue(new Promise(() => {}));
    await render(<CategoriaFormView categoriaId="9" />);

    expect(screen.getByLabelText('Carregando categoria')).toBeOnTheScreen();
    expect(porTipo(SafeAreaView).props.edges).not.toContain('top');
  });

  it('erro ao carregar: sem o inset de topo', async () => {
    (buscarCategoriaPorId as jest.Mock).mockResolvedValue({ ok: false, mensagem: 'Categoria não encontrada.' });
    await render(<CategoriaFormView categoriaId="9" />);

    expect(await screen.findByText('Não foi possível carregar a categoria')).toBeOnTheScreen();
    expect(porTipo(SafeAreaView).props.edges).not.toContain('top');
  });
});
