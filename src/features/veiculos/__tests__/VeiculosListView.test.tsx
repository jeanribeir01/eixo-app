import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { VeiculosListView } from '../VeiculosListView';
import { listarVeiculos } from '../repository';

// O runner do GitHub Actions é mais lento que a máquina local: o padrão de 5s estourava no CI.
jest.setTimeout(15000);

const mockPush = jest.fn();

// Jest hoista jest.mock() acima dos imports: a fábrica só pode usar variáveis com prefixo "mock".
// O useFocusEffect real roda de novo quando o callback muda (busca/filtro); o mock imita isso.
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]),
  };
});

jest.mock('../repository', () => ({
  listarVeiculos: jest.fn(),
}));

const veiculosMock = [
  { id: '1', placa: 'ABC1234', marca: 'Volvo', modelo: 'FH 540', capacidade_carga: 12.5, status: 'Disponivel' as const },
  { id: '2', placa: 'DEF1G23', marca: 'Scania', modelo: 'R 450', capacidade_carga: 30, status: 'EmManutencao' as const },
];

describe('VeiculosListView', () => {
  beforeEach(() => {
    mockPush.mockReset();
    (listarVeiculos as jest.Mock).mockReset();
  });

  it('mostra carregando e depois a lista com placa mascarada, capacidade e chip de status', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });

    render(<VeiculosListView />);

    expect(screen.getByLabelText('Carregando veículos')).toBeOnTheScreen();
    expect(await screen.findByText('ABC-1234')).toBeOnTheScreen();
    expect(screen.getByText('DEF1G23')).toBeOnTheScreen();
    expect(screen.getByText('Volvo FH 540 · 12,5 t')).toBeOnTheScreen();
    // O rótulo aparece na aba de filtro e no chip do veículo.
    expect(screen.getAllByText('Disponível')).toHaveLength(2);
    expect(screen.getAllByText('Em Manutenção')).toHaveLength(2);
    expect(screen.getAllByText('Em Viagem')).toHaveLength(1);
  });

  it('lista vazia sem filtro mostra estado vazio com ação de cadastrar', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [] });

    render(<VeiculosListView />);

    expect(await screen.findByText('Nenhum veículo cadastrado')).toBeOnTheScreen();
    fireEvent.press(screen.getAllByRole('button', { name: 'Novo veículo' })[1]);
    expect(mockPush).toHaveBeenCalledWith('/frota/novo');
  });

  it('erro mostra mensagem em português e "Tentar novamente" recarrega', async () => {
    (listarVeiculos as jest.Mock)
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar os veículos. Tente novamente.' })
      .mockResolvedValueOnce({ ok: true, data: veiculosMock });

    render(<VeiculosListView />);

    expect(await screen.findByText('Não foi possível carregar os veículos. Tente novamente.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('ABC-1234')).toBeOnTheScreen();
  });

  it('filtro por status consulta o repositório com o status escolhido', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });

    render(<VeiculosListView />);
    await screen.findByText('ABC-1234');

    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    fireEvent.press(screen.getByRole('tab', { name: 'Em Viagem' }));

    await waitFor(() => expect(listarVeiculos).toHaveBeenLastCalledWith({ busca: undefined, status: 'EmViagem' }));
    expect(await screen.findByText('Nenhum veículo encontrado')).toBeOnTheScreen();
  });

  it('busca por placa/modelo consulta o repositório depois que o usuário para de digitar', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });

    render(<VeiculosListView />);
    await screen.findByText('ABC-1234');

    fireEvent.changeText(screen.getByLabelText('Buscar'), 'fh');

    await waitFor(() => expect(listarVeiculos).toHaveBeenLastCalledWith({ busca: 'fh', status: undefined }));
  });

  it('"Editar" abre a edição do veículo', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });

    render(<VeiculosListView />);
    await screen.findByText('ABC-1234');

    fireEvent.press(screen.getAllByRole('button', { name: 'Editar' })[0]);
    expect(mockPush).toHaveBeenCalledWith('/frota/1/editar');
  });
});
