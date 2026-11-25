import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Alert, FlatList, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';

import { porTipo } from '@/testing/componentes';
import { segurarPrimeiraCarga } from '@/testing/eventos';
import { spacing } from '@/ui';

import { VeiculosListView } from '../VeiculosListView';
import { inativarVeiculo, listarVeiculos, reativarVeiculo } from '../repository';

// Largura da janela controlada pelo teste: 412 é celular, 800 é tablet (EIX-94).
// O filtro de status é um chip: abre a folha e toca na opção.
async function escolherStatus(opcao: string) {
  await fireEvent.press(screen.getByRole('button', { name: /^Status: / }));
  await fireEvent.press(screen.getByRole('button', { name: opcao }));
}

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 900, scale: 1, fontScale: 1 })),
}));

function mockLargura(width: number) {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

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
    await render(<VeiculosListView />);
    await screen.findByText('ABC-1234');
    await fireEvent.press(screen.getByRole('button', { name: 'Inativar ABC-1234' }));
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
    await render(<VeiculosListView />);
    await screen.findByText('ABC-1234');
    await fireEvent.press(screen.getByRole('button', { name: 'Inativar ABC-1234' }));
    await confirmar();
    expect(inativarVeiculo).toHaveBeenCalledWith('1');
    expect(screen.getByText('Veículo inativado.')).toBeOnTheScreen();
    expect(screen.getAllByText('Inativo')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Inativar ABC-1234' })).toBeNull();
  });

  it('respeita filtro Disponível ao atualizar após inativar (INA-06)', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [veiculosMock[0]] });
    (inativarVeiculo as jest.Mock).mockResolvedValue({ ok: true, data: { ...veiculosMock[0], status: 'Inativo' } });
    await render(<VeiculosListView />);
    await screen.findByText('ABC-1234');
    await escolherStatus('Disponível');
    await waitFor(() => expect(listarVeiculos).toHaveBeenLastCalledWith({ busca: undefined, status: 'Disponivel' }));
    await screen.findByRole('button', { name: 'Inativar ABC-1234' });
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    await fireEvent.press(screen.getByRole('button', { name: 'Inativar ABC-1234' }));
    await confirmar();
    expect(screen.queryByText('ABC-1234')).toBeNull();
    expect(screen.getByText('Nenhum veículo encontrado')).toBeOnTheScreen();
    expect(listarVeiculos).toHaveBeenLastCalledWith({ busca: undefined, status: 'Disponivel' });
  });

  it('pendente exibe loading e impede confirmação repetida (INA-03)', async () => {
    let concluir: (value: unknown) => void = () => {};
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });
    (inativarVeiculo as jest.Mock).mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
    await render(<VeiculosListView />);
    await screen.findByText('ABC-1234');
    await fireEvent.press(screen.getByRole('button', { name: 'Inativar ABC-1234' }));
    await confirmar();
    expect(screen.getByRole('button', { name: 'Inativar ABC-1234' })).toBeDisabled();
    expect(screen.getByTestId('button-loading')).toBeOnTheScreen();
    await confirmar();
    expect(inativarVeiculo).toHaveBeenCalledTimes(1);
    await act(async () => concluir({ ok: false, mensagem: 'Falha de rede.' }));
    expect(screen.getByText('Falha de rede.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Inativar ABC-1234' })).not.toBeDisabled();
  });

  it('falha ou concorrência preserva veículo e mostra erro (INA-02/07)', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });
    (inativarVeiculo as jest.Mock).mockResolvedValue({ ok: false, mensagem: 'Veículo não está mais disponível.' });
    await render(<VeiculosListView />);
    await screen.findByText('ABC-1234');
    await fireEvent.press(screen.getByRole('button', { name: 'Inativar ABC-1234' }));
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
    await render(<VeiculosListView />);
    await screen.findByText('ABC-1234');
    expect(screen.queryByRole('button', { name: /^Inativar/ })).toBeNull();
  });

  it('filtra Inativo e mantém filtros roláveis em telas pequenas (SEL-01)', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    await render(<VeiculosListView />);
    await screen.findByText('Nenhum veículo cadastrado');
    // O filtro é um chip numa linha que rola na horizontal: nada quebra nem corta em 360 (EIX-82).
    const filtro = porTipo(ScrollView);
    expect(filtro.props.horizontal).toBe(true);
    expect(within(filtro.elementoNativo()).getByRole('button', { name: 'Status: Todos' })).toBeOnTheScreen();
    await escolherStatus('Inativo');
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
      await render(<VeiculosListView />);
      await screen.findByText('GHI-1234');
      expect(screen.getAllByRole('button', { name: /^Reativar/ })).toHaveLength(1);
    });

    it('confirma antes de reativar e cancelar não altera dados (REA-05)', async () => {
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [inativo] });
      await render(<VeiculosListView />);
      await screen.findByText('GHI-1234');
      await fireEvent.press(screen.getByRole('button', { name: 'Reativar GHI-1234' }));
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
      await render(<VeiculosListView />);
      await screen.findByText('GHI-1234');
      await fireEvent.press(screen.getByRole('button', { name: 'Reativar GHI-1234' }));
      await confirmarReativacao();
      expect(screen.getByRole('button', { name: 'Reativar GHI-1234' })).toBeDisabled();
      expect(screen.getByTestId('button-loading')).toBeOnTheScreen();
      await confirmarReativacao();
      expect(reativarVeiculo).toHaveBeenCalledTimes(1);
      await act(async () => concluir({ ok: false, mensagem: 'Falha de rede.' }));
      expect(screen.getByRole('button', { name: 'Reativar GHI-1234' })).not.toBeDisabled();
    });

    it('sucesso mostra Snackbar e recarrega respeitando o filtro Inativo (REA-07)', async () => {
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [inativo] });
      (reativarVeiculo as jest.Mock).mockResolvedValue({ ok: true, data: { ...inativo, status: 'Disponivel' } });
      await render(<VeiculosListView />);
      await screen.findByText('GHI-1234');
      await escolherStatus('Inativo');
      await waitFor(() => expect(listarVeiculos).toHaveBeenLastCalledWith({ busca: undefined, status: 'Inativo' }));
      await screen.findByRole('button', { name: 'Reativar GHI-1234' });
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [] });
      await fireEvent.press(screen.getByRole('button', { name: 'Reativar GHI-1234' }));
      await confirmarReativacao();
      expect(reativarVeiculo).toHaveBeenCalledWith('3');
      expect(screen.getByText('Veículo reativado.')).toBeOnTheScreen();
      expect(screen.queryByText('GHI-1234')).toBeNull();
      expect(listarVeiculos).toHaveBeenLastCalledWith({ busca: undefined, status: 'Inativo' });
    });

    it('avisa quando o banco devolve o veículo com viagem em aberto', async () => {
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [inativo] });
      (reativarVeiculo as jest.Mock).mockResolvedValue({ ok: true, data: { ...inativo, status: 'EmViagem' } });
      await render(<VeiculosListView />);
      await screen.findByText('GHI-1234');
      await fireEvent.press(screen.getByRole('button', { name: 'Reativar GHI-1234' }));
      await confirmarReativacao();
      expect(screen.getByText('Veículo reativado como Em Viagem.')).toBeOnTheScreen();
    });

    it('erro imprevisto (exceção) mostra Snackbar de erro e libera o botão', async () => {
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [inativo] });
      (reativarVeiculo as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
      await render(<VeiculosListView />);
      await screen.findByText('GHI-1234');
      await fireEvent.press(screen.getByRole('button', { name: 'Reativar GHI-1234' }));
      await confirmarReativacao();
      expect(screen.getByText('Não foi possível concluir a operação. Atualize a lista e tente novamente.')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Reativar GHI-1234' })).not.toBeDisabled();
      expect(screen.getByText('GHI-1234')).toBeOnTheScreen();
    });

    it('falha preserva o veículo e mostra erro (REA-08)', async () => {
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [inativo] });
      (reativarVeiculo as jest.Mock).mockResolvedValue({ ok: false, mensagem: 'Não foi possível reativar o veículo. Tente novamente.' });
      await render(<VeiculosListView />);
      await screen.findByText('GHI-1234');
      await fireEvent.press(screen.getByRole('button', { name: 'Reativar GHI-1234' }));
      await confirmarReativacao();
      expect(screen.getByText('Não foi possível reativar o veículo. Tente novamente.')).toBeOnTheScreen();
      expect(screen.getByText('GHI-1234')).toBeOnTheScreen();
      expect(screen.queryByText('Veículo reativado.')).toBeNull();
      expect(listarVeiculos).toHaveBeenCalledTimes(1);
    });
  });

  it('mostra carregando e depois a lista com placa mascarada, capacidade e chip de status', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });
    // Segura a primeira carga: o render async esperaria a resposta e pularia o "carregando".
    const liberarCarga = segurarPrimeiraCarga(jest.mocked(listarVeiculos));

    await render(<VeiculosListView />);

    expect(screen.getByLabelText('Carregando veículos')).toBeOnTheScreen();
    await liberarCarga();
    expect(await screen.findByText('ABC-1234')).toBeOnTheScreen();
    expect(screen.getByText('DEF1G23')).toBeOnTheScreen();
    expect(screen.getByText('Volvo FH 540 · 12,5 t')).toBeOnTheScreen();
    // O rótulo aparece só no selo do veículo: as opções do filtro ficam na folha, fechada.
    expect(screen.getAllByText('Disponível')).toHaveLength(1);
    expect(screen.getAllByText('Em Manutenção')).toHaveLength(1);
    expect(screen.queryAllByText('Em Viagem')).toHaveLength(0);
  });

  // Desde a EIX-77 a lista abre por cima do hub de Frota, com o header nativo "Veículos" (NAV5-14).
  it('não repete título no conteúdo: quem dá o título é o header nativo', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });

    await render(<VeiculosListView />);

    expect(await screen.findByText('ABC-1234')).toBeOnTheScreen();
    expect(screen.queryByText('Frota')).not.toBeOnTheScreen();
    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
  });

  it('lista vazia sem filtro mostra estado vazio com ação de cadastrar', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [] });

    await render(<VeiculosListView />);

    expect(await screen.findByText('Nenhum veículo cadastrado')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Novo veículo' })[1]);
    expect(mockPush).toHaveBeenCalledWith('/frota/novo');
  });

  it('erro mostra mensagem em português e "Tentar novamente" recarrega', async () => {
    (listarVeiculos as jest.Mock)
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar os veículos. Tente novamente.' })
      .mockResolvedValueOnce({ ok: true, data: veiculosMock });

    await render(<VeiculosListView />);

    expect(await screen.findByText('Não foi possível carregar os veículos. Tente novamente.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('ABC-1234')).toBeOnTheScreen();
  });

  it('filtro por status consulta o repositório com o status escolhido', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });

    await render(<VeiculosListView />);
    await screen.findByText('ABC-1234');

    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    await escolherStatus('Em Viagem');

    await waitFor(() => expect(listarVeiculos).toHaveBeenLastCalledWith({ busca: undefined, status: 'EmViagem' }));
    expect(await screen.findByText('Nenhum veículo encontrado')).toBeOnTheScreen();
  });

  it('busca por placa/modelo consulta o repositório depois que o usuário para de digitar', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });

    await render(<VeiculosListView />);
    await screen.findByText('ABC-1234');

    await fireEvent.changeText(screen.getByLabelText('Buscar'), 'fh');

    await waitFor(() => expect(listarVeiculos).toHaveBeenLastCalledWith({ busca: 'fh', status: undefined }));
  });

  it('"Editar" abre a edição do veículo', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });

    await render(<VeiculosListView />);
    await screen.findByText('ABC-1234');

    await fireEvent.press(screen.getAllByRole('button', { name: 'Editar' })[0]);
    expect(mockPush).toHaveBeenCalledWith('/frota/1/editar');
  });

  describe('VeiculosListView — tablet (EIX-94)', () => {
    afterEach(() => mockLargura(412));

    function estiloDoConteudo() {
      return StyleSheet.flatten(screen.getByTestId('screen-conteudo').props.style);
    }

    function estiloDaLista() {
      return StyleSheet.flatten(porTipo(FlatList).props.contentContainerStyle);
    }

    it('412: nada muda, o respiro lateral continua no Screen e a lista não ganha coluna', async () => {
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });
      await render(<VeiculosListView />);
      await screen.findByText('ABC-1234');

      expect(estiloDoConteudo()).toMatchObject({ paddingHorizontal: spacing.base });
      expect(estiloDaLista()?.maxWidth).toBeUndefined();
    });

    it('800: a lista rola na largura toda e o conteúdo fica na coluna de 720', async () => {
      mockLargura(800);
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });
      await render(<VeiculosListView />);
      await screen.findByText('ABC-1234');

      expect(estiloDoConteudo().maxWidth).toBeUndefined();
      expect(estiloDoConteudo().paddingHorizontal).toBeUndefined();
      expect(estiloDaLista()).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
      const coluna = screen.getByTestId('screen-coluna');
      expect(StyleSheet.flatten(coluna.props.style)).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
      expect(within(coluna).getByLabelText('Buscar')).toBeOnTheScreen();
      expect(within(coluna).getByRole('button', { name: 'Novo veículo' })).toBeOnTheScreen();
    });
  });
});
