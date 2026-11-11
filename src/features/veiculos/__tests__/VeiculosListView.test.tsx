import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, ScrollView } from 'react-native';

import { VeiculosListView } from '../VeiculosListView';
import { inativarVeiculo, listarVeiculos, reativarVeiculo } from '../repository';

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
  inativarVeiculo: jest.fn(),
  reativarVeiculo: jest.fn(),
}));

const veiculosMock = [
  { id: '1', placa: 'ABC1234', marca: 'Volvo', modelo: 'FH 540', capacidade_carga: 12.5, status: 'Disponivel' as const },
  { id: '2', placa: 'DEF1G23', marca: 'Scania', modelo: 'R 450', capacidade_carga: 30, status: 'EmManutencao' as const },
];

describe('VeiculosListView', () => {
  let alerta: jest.SpyInstance;
  beforeEach(() => {
    mockPush.mockReset();
    (listarVeiculos as jest.Mock).mockReset();
    (inativarVeiculo as jest.Mock).mockReset();
    (reativarVeiculo as jest.Mock).mockReset();
    alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => alerta.mockRestore());

  async function confirmar() {
    await act(async () => {
      const botoes = alerta.mock.calls[alerta.mock.calls.length - 1][2];
      botoes.find((botao: { text: string }) => botao.text === 'Inativar').onPress();
    });
  }

  it('confirma antes de inativar e cancelar não altera dados (INA-04/05)', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });
    render(<VeiculosListView />);
    await screen.findByText('ABC-1234');
    fireEvent.press(screen.getByRole('button', { name: 'Inativar' }));
    expect(alerta).toHaveBeenCalledWith('Inativar veículo?', expect.stringContaining('ABC-1234'), [
      expect.objectContaining({ text: 'Cancelar', style: 'cancel' }),
      expect.objectContaining({ text: 'Inativar', style: 'destructive', onPress: expect.any(Function) }),
    ]);
    // Cancelar fecha apenas o diálogo nativo; não há mutação antes de confirmar.
    expect(inativarVeiculo).not.toHaveBeenCalled();
    expect(screen.getByText('ABC-1234')).toBeOnTheScreen();
  });

  it('sucesso atualiza status e mostra Snackbar (INA-06)', async () => {
    const inativo = { ...veiculosMock[0], status: 'Inativo' };
    (listarVeiculos as jest.Mock)
      .mockResolvedValueOnce({ ok: true, data: veiculosMock })
      .mockResolvedValue({ ok: true, data: [inativo, veiculosMock[1]] });
    (inativarVeiculo as jest.Mock).mockResolvedValue({ ok: true, data: inativo });
    render(<VeiculosListView />);
    await screen.findByText('ABC-1234');
    fireEvent.press(screen.getByRole('button', { name: 'Inativar' }));
    await confirmar();
    expect(inativarVeiculo).toHaveBeenCalledWith('1');
    expect(screen.getByText('Veículo inativado.')).toBeOnTheScreen();
    expect(screen.getAllByText('Inativo')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Inativar' })).toBeNull();
  });

  it('respeita filtro Disponível ao atualizar após inativar (INA-06)', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [veiculosMock[0]] });
    (inativarVeiculo as jest.Mock).mockResolvedValue({ ok: true, data: { ...veiculosMock[0], status: 'Inativo' } });
    render(<VeiculosListView />);
    await screen.findByText('ABC-1234');
    fireEvent.press(screen.getByRole('tab', { name: 'Disponível' }));
    await waitFor(() => expect(listarVeiculos).toHaveBeenLastCalledWith({ busca: undefined, status: 'Disponivel' }));
    await screen.findByRole('button', { name: 'Inativar' });
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    fireEvent.press(screen.getByRole('button', { name: 'Inativar' }));
    await confirmar();
    expect(screen.queryByText('ABC-1234')).toBeNull();
    expect(screen.getByText('Nenhum veículo encontrado')).toBeOnTheScreen();
    expect(listarVeiculos).toHaveBeenLastCalledWith({ busca: undefined, status: 'Disponivel' });
  });

  it('pendente exibe loading e impede confirmação repetida (INA-03)', async () => {
    let concluir: (value: unknown) => void = () => {};
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });
    (inativarVeiculo as jest.Mock).mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
    render(<VeiculosListView />);
    await screen.findByText('ABC-1234');
    fireEvent.press(screen.getByRole('button', { name: 'Inativar' }));
    await confirmar();
    expect(screen.getByRole('button', { name: 'Inativar' })).toBeDisabled();
    expect(screen.getByTestId('button-loading')).toBeOnTheScreen();
    await confirmar();
    expect(inativarVeiculo).toHaveBeenCalledTimes(1);
    await act(async () => concluir({ ok: false, mensagem: 'Falha de rede.' }));
    expect(screen.getByText('Falha de rede.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Inativar' })).not.toBeDisabled();
  });

  it('falha ou concorrência preserva veículo e mostra erro (INA-02/07)', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });
    (inativarVeiculo as jest.Mock).mockResolvedValue({ ok: false, mensagem: 'Veículo não está mais disponível.' });
    render(<VeiculosListView />);
    await screen.findByText('ABC-1234');
    fireEvent.press(screen.getByRole('button', { name: 'Inativar' }));
    await confirmar();
    expect(screen.getByText('Veículo não está mais disponível.')).toBeOnTheScreen();
    expect(screen.getByText('ABC-1234')).toBeOnTheScreen();
    expect(screen.queryByText('Veículo inativado.')).toBeNull();
  });

  it('não oferece inativação para ocupado ou inativo (INA-08)', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [
      { ...veiculosMock[0], status: 'EmViagem' }, veiculosMock[1],
      { ...veiculosMock[0], id: '3', placa: 'GHI1234', status: 'Inativo' },
    ] });
    render(<VeiculosListView />);
    await screen.findByText('ABC-1234');
    expect(screen.queryByRole('button', { name: 'Inativar' })).toBeNull();
  });

  it('filtra Inativo e mantém filtros roláveis em telas pequenas (SEL-01)', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    render(<VeiculosListView />);
    await screen.findByText('Nenhum veículo cadastrado');
    expect(screen.UNSAFE_getByType(ScrollView).props.horizontal).toBe(true);
    fireEvent.press(screen.getByRole('tab', { name: 'Inativo' }));
    await waitFor(() => expect(listarVeiculos).toHaveBeenLastCalledWith({ busca: undefined, status: 'Inativo' }));
    expect(await screen.findByText('Nenhum veículo encontrado')).toBeOnTheScreen();
  });

  describe('reativação (EIX-81)', () => {
    const inativo = { ...veiculosMock[0], id: '3', placa: 'GHI1234', status: 'Inativo' as const };

    async function confirmarReativacao() {
      await act(async () => {
        const botoes = alerta.mock.calls[alerta.mock.calls.length - 1][2];
        botoes.find((botao: { text: string }) => botao.text === 'Reativar').onPress();
      });
    }

    it('oferece Reativar só para Inativo (REA-04)', async () => {
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [
        veiculosMock[0], veiculosMock[1], { ...veiculosMock[0], id: '4', placa: 'JKL1234', status: 'EmViagem' }, inativo,
      ] });
      render(<VeiculosListView />);
      await screen.findByText('GHI-1234');
      expect(screen.getAllByRole('button', { name: 'Reativar' })).toHaveLength(1);
    });

    it('confirma antes de reativar e cancelar não altera dados (REA-05)', async () => {
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [inativo] });
      render(<VeiculosListView />);
      await screen.findByText('GHI-1234');
      fireEvent.press(screen.getByRole('button', { name: 'Reativar' }));
      expect(alerta).toHaveBeenCalledWith('Reativar veículo?', expect.stringContaining('GHI-1234'), [
        expect.objectContaining({ text: 'Cancelar', style: 'cancel' }),
        expect.objectContaining({ text: 'Reativar', onPress: expect.any(Function) }),
      ]);
      expect(reativarVeiculo).not.toHaveBeenCalled();
      expect(screen.getByText('GHI-1234')).toBeOnTheScreen();
    });

    it('pendente exibe loading e impede confirmação repetida (REA-06)', async () => {
      let concluir: (value: unknown) => void = () => {};
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [inativo] });
      (reativarVeiculo as jest.Mock).mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
      render(<VeiculosListView />);
      await screen.findByText('GHI-1234');
      fireEvent.press(screen.getByRole('button', { name: 'Reativar' }));
      await confirmarReativacao();
      expect(screen.getByRole('button', { name: 'Reativar' })).toBeDisabled();
      expect(screen.getByTestId('button-loading')).toBeOnTheScreen();
      await confirmarReativacao();
      expect(reativarVeiculo).toHaveBeenCalledTimes(1);
      await act(async () => concluir({ ok: false, mensagem: 'Falha de rede.' }));
      expect(screen.getByRole('button', { name: 'Reativar' })).not.toBeDisabled();
    });

    it('sucesso mostra Snackbar e recarrega respeitando o filtro Inativo (REA-07)', async () => {
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [inativo] });
      (reativarVeiculo as jest.Mock).mockResolvedValue({ ok: true, data: { ...inativo, status: 'Disponivel' } });
      render(<VeiculosListView />);
      await screen.findByText('GHI-1234');
      fireEvent.press(screen.getByRole('tab', { name: 'Inativo' }));
      await waitFor(() => expect(listarVeiculos).toHaveBeenLastCalledWith({ busca: undefined, status: 'Inativo' }));
      await screen.findByRole('button', { name: 'Reativar' });
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [] });
      fireEvent.press(screen.getByRole('button', { name: 'Reativar' }));
      await confirmarReativacao();
      expect(reativarVeiculo).toHaveBeenCalledWith('3');
      expect(screen.getByText('Veículo reativado.')).toBeOnTheScreen();
      expect(screen.queryByText('GHI-1234')).toBeNull();
      expect(listarVeiculos).toHaveBeenLastCalledWith({ busca: undefined, status: 'Inativo' });
    });

    it('avisa quando o banco devolve o veículo com viagem em aberto', async () => {
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [inativo] });
      (reativarVeiculo as jest.Mock).mockResolvedValue({ ok: true, data: { ...inativo, status: 'EmViagem' } });
      render(<VeiculosListView />);
      await screen.findByText('GHI-1234');
      fireEvent.press(screen.getByRole('button', { name: 'Reativar' }));
      await confirmarReativacao();
      expect(screen.getByText('Veículo reativado como Em Viagem.')).toBeOnTheScreen();
    });

    it('erro imprevisto (exceção) mostra Snackbar de erro e libera o botão', async () => {
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [inativo] });
      (reativarVeiculo as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
      render(<VeiculosListView />);
      await screen.findByText('GHI-1234');
      fireEvent.press(screen.getByRole('button', { name: 'Reativar' }));
      await confirmarReativacao();
      expect(screen.getByText('Não foi possível concluir a operação. Atualize a lista e tente novamente.')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Reativar' })).not.toBeDisabled();
      expect(screen.getByText('GHI-1234')).toBeOnTheScreen();
    });

    it('falha preserva o veículo e mostra erro (REA-08)', async () => {
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [inativo] });
      (reativarVeiculo as jest.Mock).mockResolvedValue({ ok: false, mensagem: 'Não foi possível reativar o veículo. Tente novamente.' });
      render(<VeiculosListView />);
      await screen.findByText('GHI-1234');
      fireEvent.press(screen.getByRole('button', { name: 'Reativar' }));
      await confirmarReativacao();
      expect(screen.getByText('Não foi possível reativar o veículo. Tente novamente.')).toBeOnTheScreen();
      expect(screen.getByText('GHI-1234')).toBeOnTheScreen();
      expect(screen.queryByText('Veículo reativado.')).toBeNull();
      expect(listarVeiculos).toHaveBeenCalledTimes(1);
    });
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

  // Desde a EIX-77 a lista abre por cima do hub de Frota, com o header nativo "Veículos" (NAV5-14).
  it('não repete título no conteúdo: quem dá o título é o header nativo', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });

    render(<VeiculosListView />);

    expect(await screen.findByText('ABC-1234')).toBeOnTheScreen();
    expect(screen.queryByText('Frota')).not.toBeOnTheScreen();
    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
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
