import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VeiculoFormView } from '../VeiculoFormView';
import { atualizarVeiculo, buscarVeiculoPorId, criarVeiculo } from '../repository';

// O runner do GitHub Actions é mais lento que a máquina local: o padrão de 5s estourava no CI.
jest.setTimeout(15000);

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
}));

jest.mock('../repository', () => ({
  criarVeiculo: jest.fn(),
  atualizarVeiculo: jest.fn(),
  buscarVeiculoPorId: jest.fn(),
}));

const volvo = { id: '9', placa: 'ABC1234', marca: 'Volvo', modelo: 'FH 540', capacidade_carga: 12.5, status: 'EmManutencao' };

function preencher({ placa = 'abc1234', marca = 'Volvo', modelo = 'FH 540', capacidade = '12,5' } = {}) {
  fireEvent.changeText(screen.getByLabelText('Placa'), placa);
  fireEvent.changeText(screen.getByLabelText('Marca'), marca);
  fireEvent.changeText(screen.getByLabelText('Modelo'), modelo);
  fireEvent.changeText(screen.getByLabelText('Capacidade de carga (toneladas)'), capacidade);
}

async function salvar() {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  });
}

describe('VeiculoFormView', () => {
  beforeEach(() => {
    mockBack.mockReset();
    (criarVeiculo as jest.Mock).mockReset();
    (atualizarVeiculo as jest.Mock).mockReset();
    (buscarVeiculoPorId as jest.Mock).mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('modo criar: renderiza só os campos que existem no banco e os 3 status', () => {
    render(<VeiculoFormView />);

    expect(screen.queryByText('Novo veículo')).not.toBeOnTheScreen();
    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
    // Tela interna: o header nativo protege o topo, o Screen não repete o inset (NAV-04, AC 11).
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
    // Formulário rola e sobe com o teclado (NAV-04, AC 9 e 10).
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).findByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
    expect(screen.getByLabelText('Placa')).toBeOnTheScreen();
    expect(screen.getByLabelText('Marca')).toBeOnTheScreen();
    expect(screen.getByLabelText('Modelo')).toBeOnTheScreen();
    expect(screen.getByLabelText('Capacidade de carga (toneladas)')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Disponível' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Em Viagem' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Em Manutenção' })).toBeOnTheScreen();
    expect(screen.queryByLabelText(/Ano/)).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Inativo' })).toBeNull();
  });

  it('máscara: placa antiga ganha hífen só na tela', () => {
    render(<VeiculoFormView />);

    fireEvent.changeText(screen.getByLabelText('Placa'), 'abc1234');

    expect(screen.getByLabelText('Placa').props.value).toBe('ABC-1234');
  });

  it('máscara: placa Mercosul fica em maiúscula e sem hífen', () => {
    render(<VeiculoFormView />);

    fireEvent.changeText(screen.getByLabelText('Placa'), 'abc 1d23');

    expect(screen.getByLabelText('Placa').props.value).toBe('ABC1D23');
  });

  it('não envia com campos inválidos e mostra as mensagens nos campos', async () => {
    render(<VeiculoFormView />);

    preencher({ placa: 'AB12', marca: '', capacidade: '0' });
    await salvar();

    expect(screen.getByText('Placa inválida. Use o formato AAA-1234 ou o padrão Mercosul AAA1A23.')).toBeOnTheScreen();
    expect(screen.getByText('Informe a marca.')).toBeOnTheScreen();
    expect(screen.getByText('A capacidade de carga deve ser maior que zero.')).toBeOnTheScreen();
    expect(criarVeiculo).not.toHaveBeenCalled();
  });

  it('caminho feliz: envia a placa sem hífen, mostra sucesso e volta para a lista', async () => {
    (criarVeiculo as jest.Mock).mockResolvedValue({ ok: true, data: volvo });

    render(<VeiculoFormView />);
    preencher();
    fireEvent.press(screen.getByRole('tab', { name: 'Em Manutenção' }));
    await salvar();

    expect(criarVeiculo).toHaveBeenCalledWith({
      placa: 'ABC1234',
      marca: 'Volvo',
      modelo: 'FH 540',
      capacidade_carga: 12.5,
      status: 'EmManutencao',
    });
    expect(await screen.findByText('Veículo cadastrado.')).toBeOnTheScreen();

    act(() => {
      jest.advanceTimersByTime(1200);
    });

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('placa duplicada: mostra a mensagem junto do campo Placa e não navega', async () => {
    (criarVeiculo as jest.Mock).mockResolvedValue({
      ok: false,
      mensagem: 'Já existe um veículo cadastrado com essa placa.',
      campo: 'placa',
    });

    render(<VeiculoFormView />);
    preencher();
    await salvar();

    // Uma vez no campo (alert) e outra na Snackbar de erro.
    expect(screen.getAllByText('Já existe um veículo cadastrado com essa placa.')).toHaveLength(2);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('erro geral (sem campo) aparece só na Snackbar', async () => {
    (criarVeiculo as jest.Mock).mockResolvedValue({ ok: false, mensagem: 'Não foi possível cadastrar o veículo. Tente novamente.' });

    render(<VeiculoFormView />);
    preencher();
    await salvar();

    expect(screen.getAllByText('Não foi possível cadastrar o veículo. Tente novamente.')).toHaveLength(1);
  });

  it('modo editar: carrega o veículo com a placa mascarada e a capacidade com vírgula', async () => {
    (buscarVeiculoPorId as jest.Mock).mockResolvedValue({ ok: true, data: volvo });

    render(<VeiculoFormView veiculoId="9" />);

    expect(screen.getByLabelText('Carregando veículo')).toBeOnTheScreen();
    expect(await screen.findByLabelText('Placa')).toBeOnTheScreen();
    expect(screen.queryByText('Editar veículo')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Placa').props.value).toBe('ABC-1234');
    expect(screen.getByLabelText('Capacidade de carga (toneladas)').props.value).toBe('12,5');
    expect(screen.getByRole('tab', { name: 'Em Manutenção' })).toHaveProp('accessibilityState', { selected: true });
  });

  it('modo editar: envia a atualização para o id certo', async () => {
    (buscarVeiculoPorId as jest.Mock).mockResolvedValue({ ok: true, data: volvo });
    (atualizarVeiculo as jest.Mock).mockResolvedValue({ ok: true, data: { ...volvo, modelo: 'FH 460' } });

    render(<VeiculoFormView veiculoId="9" />);
    await screen.findByLabelText('Placa');

    fireEvent.changeText(screen.getByLabelText('Modelo'), 'FH 460');
    await salvar();

    expect(atualizarVeiculo).toHaveBeenCalledWith('9', expect.objectContaining({ placa: 'ABC1234', modelo: 'FH 460' }));
    expect(await screen.findByText('Veículo atualizado.')).toBeOnTheScreen();
  });

  it('erro ao carregar o veículo mostra estado de erro e "Voltar" navega para trás', async () => {
    (buscarVeiculoPorId as jest.Mock).mockResolvedValue({ ok: false, mensagem: 'Veículo não encontrado.' });

    render(<VeiculoFormView veiculoId="x" />);

    expect(await screen.findByText('Não foi possível carregar o veículo')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
