import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { ListItem, Skeleton } from '@/ui';

import { ManutencoesListView } from '../ManutencoesListView';
import { concluirManutencao, listarManutencoes } from '../manutencaoRepository';
import type { ManutencaoComPlaca } from '../types';

// O runner do GitHub Actions é mais lento que a máquina local: o padrão de 5s estourava no CI.
jest.setTimeout(15000);

// Jest hoista jest.mock() acima dos imports: a fábrica só pode usar variáveis com prefixo "mock".
const mockPush = jest.fn();

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]),
  };
});

jest.mock('../manutencaoRepository', () => ({
  listarManutencoes: jest.fn(),
  concluirManutencao: jest.fn(),
}));

const mockListar = listarManutencoes as jest.MockedFunction<typeof listarManutencoes>;
const mockConcluir = concluirManutencao as jest.MockedFunction<typeof concluirManutencao>;

// O repositório já entrega as abertas primeiro (T5); a tela não pode mudar a ordem.
const pneus: ManutencaoComPlaca = {
  id: 'm1',
  veiculo_id: 'v1',
  descricao: 'Troca de pneus',
  data_manutencao: '2026-10-16',
  data_conclusao: null,
  valorCentavos: 113,
  placa: 'ABC1234',
};
const oleo: ManutencaoComPlaca = {
  id: 'm2',
  veiculo_id: 'v2',
  descricao: 'Troca de óleo',
  data_manutencao: '2026-10-05',
  data_conclusao: null,
  valorCentavos: 45000,
  placa: 'BRA2E19',
};
const freios: ManutencaoComPlaca = {
  id: 'm3',
  veiculo_id: 'v1',
  descricao: 'Revisão dos freios',
  data_manutencao: '2026-10-10',
  data_conclusao: '2026-10-12T10:00:00Z',
  valorCentavos: 250000,
  placa: 'ABC1234',
};
const manutencoes = [pneus, oleo, freios];

const TITULO_PNEUS = 'ABC-1234 · Troca de pneus';
const TITULO_OLEO = 'BRA2E19 · Troca de óleo';
const TITULO_FREIOS = 'ABC-1234 · Revisão dos freios';

function linha(titulo: string) {
  const encontrada = screen.UNSAFE_getAllByType(ListItem).find((item) => item.props.title === titulo);
  if (!encontrada) throw new Error(`linha "${titulo}" não encontrada`);
  return encontrada;
}

async function renderComLista() {
  mockListar.mockResolvedValue({ ok: true, data: manutencoes });
  render(<ManutencoesListView />);
  await screen.findByText(TITULO_PNEUS);
}

beforeEach(() => {
  mockPush.mockReset();
  mockListar.mockReset();
  mockConcluir.mockReset();
});

describe('ManutencoesListView — carga', () => {
  // MAN-25
  it('primeira carga: três skeletons, depois a lista', async () => {
    mockListar.mockResolvedValue({ ok: true, data: manutencoes });
    render(<ManutencoesListView />);

    expect(screen.getByLabelText('Carregando manutenções')).toBeOnTheScreen();
    expect(screen.UNSAFE_getAllByType(Skeleton)).toHaveLength(3);
    expect(await screen.findByText(TITULO_PNEUS)).toBeOnTheScreen();
  });

  // MAN-17
  it('título "PLACA · descrição" e subtítulo com data, valor e situação', async () => {
    await renderComLista();

    expect(linha(TITULO_PNEUS).props.subtitle).toBe('16/10/2026 · R$ 1,13 · Em aberto');
    expect(linha(TITULO_FREIOS).props.subtitle).toBe('10/10/2026 · R$ 2.500,00 · Concluída');
  });

  // MAN-18: a ordem do repositório (abertas primeiro) chega igual à tela.
  it('mantém a ordem recebida: abertas antes das concluídas', async () => {
    await renderComLista();

    expect(screen.UNSAFE_getAllByType(ListItem).map((item) => item.props.title)).toEqual([
      TITULO_PNEUS,
      TITULO_OLEO,
      TITULO_FREIOS,
    ]);
  });

  // MAN-26
  it('falha na carga mostra a mensagem em português e "Tentar novamente" recarrega', async () => {
    mockListar
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as manutenções. Tente novamente.' })
      .mockResolvedValueOnce({ ok: true, data: manutencoes });
    render(<ManutencoesListView />);

    expect(await screen.findByText('Não foi possível carregar as manutenções. Tente novamente.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText(TITULO_PNEUS)).toBeOnTheScreen();
  });

  // MAN-27
  it('sem manutenção mostra "Nenhuma manutenção registrada"', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [] });
    render(<ManutencoesListView />);

    expect(await screen.findByText('Nenhuma manutenção registrada')).toBeOnTheScreen();
  });
});

describe('ManutencoesListView — concluir', () => {
  // MAN-19
  it('só as manutenções em aberto têm "Concluir"', async () => {
    await renderComLista();

    expect(within(linha(TITULO_PNEUS)).getByRole('button', { name: 'Concluir' })).toBeOnTheScreen();
    expect(within(linha(TITULO_OLEO)).getByRole('button', { name: 'Concluir' })).toBeOnTheScreen();
    expect(within(linha(TITULO_FREIOS)).queryByRole('button', { name: 'Concluir' })).not.toBeOnTheScreen();
  });

  // MAN-20
  it('veículo volta a Disponível: marca a linha como concluída e mostra "Veículo disponível."', async () => {
    mockConcluir.mockResolvedValue({ ok: true, data: 'Disponivel' });
    await renderComLista();

    await act(async () => {
      fireEvent.press(within(linha(TITULO_OLEO)).getByRole('button', { name: 'Concluir' }));
    });

    expect(mockConcluir).toHaveBeenCalledWith('m2');
    expect(screen.getByRole('alert')).toHaveTextContent('Manutenção concluída. Veículo disponível.');
    expect(linha(TITULO_OLEO).props.subtitle).toBe('05/10/2026 · R$ 450,00 · Concluída');
    expect(within(linha(TITULO_OLEO)).queryByRole('button', { name: 'Concluir' })).not.toBeOnTheScreen();
  });

  // MAN-21
  it('veículo com outra ordem aberta: mostra "segue em manutenção por outra ordem aberta."', async () => {
    mockConcluir.mockResolvedValue({ ok: true, data: 'EmManutencao' });
    await renderComLista();

    await act(async () => {
      fireEvent.press(within(linha(TITULO_PNEUS)).getByRole('button', { name: 'Concluir' }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Manutenção concluída. O veículo segue em manutenção por outra ordem aberta.',
    );
    expect(linha(TITULO_PNEUS).props.subtitle).toBe('16/10/2026 · R$ 1,13 · Concluída');
  });

  // MAN-22
  it('enquanto conclui, o "Concluir" daquela linha fica em loading e ignora novos toques', async () => {
    let terminar: (valor: Awaited<ReturnType<typeof concluirManutencao>>) => void = () => undefined;
    mockConcluir.mockReturnValue(new Promise((resolve) => (terminar = resolve)));
    await renderComLista();

    const botao = () => within(linha(TITULO_PNEUS)).getByRole('button', { name: 'Concluir' });
    fireEvent.press(botao());
    expect(botao()).toBeDisabled();
    fireEvent.press(botao());
    expect(mockConcluir).toHaveBeenCalledTimes(1);
    // O "Concluir" da outra linha continua disponível.
    expect(within(linha(TITULO_OLEO)).getByRole('button', { name: 'Concluir' })).not.toBeDisabled();

    await act(async () => terminar({ ok: true, data: 'Disponivel' }));
  });

  // MAN-23
  it('falha ao concluir mostra o Snackbar de erro e mantém a linha em aberto', async () => {
    mockConcluir.mockResolvedValue({ ok: false, mensagem: 'Manutenção não encontrada ou já concluída.' });
    await renderComLista();

    await act(async () => {
      fireEvent.press(within(linha(TITULO_PNEUS)).getByRole('button', { name: 'Concluir' }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Manutenção não encontrada ou já concluída.');
    expect(linha(TITULO_PNEUS).props.subtitle).toBe('16/10/2026 · R$ 1,13 · Em aberto');
    expect(within(linha(TITULO_PNEUS)).getByRole('button', { name: 'Concluir' })).toBeOnTheScreen();
  });
});

describe('ManutencoesListView — navegação', () => {
  // MAN-33
  it('"Ver veículo" abre o detalhe do veículo daquela manutenção', async () => {
    await renderComLista();

    fireEvent.press(within(linha(TITULO_OLEO)).getByRole('button', { name: 'Ver veículo' }));

    expect(mockPush).toHaveBeenCalledWith('/frota/v2');
  });

  it('"Ver veículo" também aparece nas concluídas', async () => {
    await renderComLista();

    fireEvent.press(within(linha(TITULO_FREIOS)).getByRole('button', { name: 'Ver veículo' }));

    expect(mockPush).toHaveBeenCalledWith('/frota/v1');
  });

  // MAN-24
  it('o FAB "Nova manutenção" abre o cadastro', async () => {
    await renderComLista();

    fireEvent.press(screen.getByRole('button', { name: 'Nova manutenção' }));

    expect(mockPush).toHaveBeenCalledWith('/manutencoes/nova');
  });
});
