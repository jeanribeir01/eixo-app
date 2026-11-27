import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VeiculoFormView } from '../VeiculoFormView';
import { atualizarVeiculo, buscarVeiculoPorId, criarVeiculo, inativarVeiculo, reativarVeiculo } from '../repository';

import { dispararSemEsperar, segurarPrimeiraCarga } from '@/testing/eventos';
import { porTipo } from '@/testing/componentes';

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
  inativarVeiculo: jest.fn(),
  reativarVeiculo: jest.fn(),
}));

const volvo = { id: '9', placa: 'ABC1234', marca: 'Volvo', modelo: 'FH 540', ano_fabricacao: 2020, capacidade_carga: 12.5, status: 'EmManutencao' };

async function preencher({ placa = 'abc1234', marca = 'Volvo', modelo = 'FH 540', capacidade = '12,5', ano = '2020' } = {}) {
  await fireEvent.changeText(screen.getByLabelText('Placa'), placa);
  await fireEvent.changeText(screen.getByLabelText('Marca'), marca);
  await fireEvent.changeText(screen.getByLabelText('Modelo'), modelo);
  await fireEvent.changeText(screen.getByLabelText('Ano de fabricação'), ano);
  await fireEvent.changeText(screen.getByLabelText('Capacidade de carga (toneladas)'), capacidade);
}

// O fireEvent já roda dentro de act na Testing Library 14: um act a mais em volta dele quebra os testes
// que disparam o salvar sem esperar (dispararSemEsperar).
async function salvar() {
  await fireEvent.press(screen.getByRole('button', { name: /^(Cadastrar veículo|Salvar alterações)$/ }));
}

describe('VeiculoFormView', () => {
  beforeEach(() => {
    mockBack.mockReset();
    (criarVeiculo as jest.Mock).mockReset();
    (atualizarVeiculo as jest.Mock).mockReset();
    (buscarVeiculoPorId as jest.Mock).mockReset();
    jest.useFakeTimers().setSystemTime(new Date('2026-10-16T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('modo criar: renderiza ano e os 3 status ativos, sem opção Inativo', async () => {
    await render(<VeiculoFormView />);

    expect(screen.queryByText('Novo veículo')).not.toBeOnTheScreen();
    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
    // Tela interna: o header nativo protege o topo, o Screen não repete o inset (NAV-04, AC 11).
    expect(porTipo(SafeAreaView).props.edges).not.toContain('top');
    // Formulário rola e sobe com o teclado (NAV-04, AC 9 e 10).
    expect(porTipo(KeyboardAvoidingView).porTipo(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
    expect(screen.getByLabelText('Placa')).toBeOnTheScreen();
    expect(screen.getByLabelText('Marca')).toBeOnTheScreen();
    expect(screen.getByLabelText('Modelo')).toBeOnTheScreen();
    expect(screen.getByLabelText('Capacidade de carga (toneladas)')).toBeOnTheScreen();
    // Status num seletor: começa em Disponível e abre as três opções ativas.
    expect(screen.getByRole('button', { name: 'Status' })).toHaveTextContent('Disponível');
    await fireEvent.press(screen.getByRole('button', { name: 'Status' }));
    expect(screen.getByRole('button', { name: 'Em Viagem' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Em Manutenção' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Ano de fabricação')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Inativo' })).toBeNull();
  });

  it('cadastro: orientação no topo e o botão diz o que faz', async () => {
    await render(<VeiculoFormView />);

    expect(screen.getByText('Cadastre o caminhão com a placa e os dados do documento.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cadastrar veículo' })).toBeOnTheScreen();
    expect(screen.getByTestId('icone-frota', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('edição: sem a orientação do cadastro e com "Salvar alterações"', async () => {
    (buscarVeiculoPorId as jest.Mock).mockResolvedValue({ ok: true, data: volvo });
    await render(<VeiculoFormView veiculoId="9" />);

    expect(await screen.findByRole('button', { name: 'Salvar alterações' })).toBeOnTheScreen();
    expect(screen.queryByText('Cadastre o caminhão com a placa e os dados do documento.')).not.toBeOnTheScreen();
  });

  it('máscara: placa antiga ganha hífen só na tela', async () => {
    await render(<VeiculoFormView />);

    await fireEvent.changeText(screen.getByLabelText('Placa'), 'abc1234');

    expect(screen.getByLabelText('Placa').props.value).toBe('ABC-1234');
  });

  it('máscara: placa Mercosul fica em maiúscula e sem hífen', async () => {
    await render(<VeiculoFormView />);

    await fireEvent.changeText(screen.getByLabelText('Placa'), 'abc 1d23');

    expect(screen.getByLabelText('Placa').props.value).toBe('ABC1D23');
  });

  it('não envia com campos inválidos e mostra as mensagens nos campos', async () => {
    await render(<VeiculoFormView />);

    await preencher({ placa: 'AB12', marca: '', capacidade: '0' });
    await salvar();

    expect(screen.getByText('Placa inválida. Use o formato AAA-1234 ou o padrão Mercosul AAA1A23.')).toBeOnTheScreen();
    expect(screen.getByText('Informe a marca.')).toBeOnTheScreen();
    expect(screen.getByText('A capacidade de carga deve ser maior que zero.')).toBeOnTheScreen();
    expect(criarVeiculo).not.toHaveBeenCalled();
  });

  it('caminho feliz: envia a placa sem hífen, mostra sucesso e volta para a lista', async () => {
    (criarVeiculo as jest.Mock).mockResolvedValue({ ok: true, data: volvo });

    await render(<VeiculoFormView />);
    await preencher();
    await fireEvent.press(screen.getByRole('button', { name: 'Status' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Em Manutenção' }));
    await salvar();

    expect(criarVeiculo).toHaveBeenCalledWith({
      placa: 'ABC1234',
      marca: 'Volvo',
      modelo: 'FH 540',
      ano_fabricacao: 2020,
      capacidade_carga: 12.5,
      status: 'EmManutencao',
    });
    expect(await screen.findByText('Veículo cadastrado.')).toBeOnTheScreen();

    await act(() => {
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

    await render(<VeiculoFormView />);
    await preencher();
    await salvar();

    // Uma vez no campo (alert) e outra na Snackbar de erro.
    expect(screen.getAllByText('Já existe um veículo cadastrado com essa placa.')).toHaveLength(2);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('erro geral (sem campo) aparece só na Snackbar', async () => {
    (criarVeiculo as jest.Mock).mockResolvedValue({ ok: false, mensagem: 'Não foi possível cadastrar o veículo. Tente novamente.' });

    await render(<VeiculoFormView />);
    await preencher();
    await salvar();

    expect(screen.getAllByText('Não foi possível cadastrar o veículo. Tente novamente.')).toHaveLength(1);
  });

  it('modo editar: carrega o veículo com a placa mascarada e a capacidade com vírgula', async () => {
    (buscarVeiculoPorId as jest.Mock).mockResolvedValue({ ok: true, data: volvo });

    // Segura a primeira carga: o render async esperaria a resposta e pularia o "carregando".
    const liberarCarga = segurarPrimeiraCarga(jest.mocked(buscarVeiculoPorId));
    await render(<VeiculoFormView veiculoId="9" />);

    expect(screen.getByLabelText('Carregando veículo')).toBeOnTheScreen();
    await liberarCarga();
    expect(await screen.findByLabelText('Placa')).toBeOnTheScreen();
    expect(screen.queryByText('Editar veículo')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Placa').props.value).toBe('ABC-1234');
    expect(screen.getByLabelText('Capacidade de carga (toneladas)').props.value).toBe('12,5');
    expect(screen.getByLabelText('Ano de fabricação').props.value).toBe('2020');
    expect(screen.getByRole('button', { name: 'Status' })).toHaveTextContent('Em Manutenção');
  });

  it.each(['', '1949', '2028'])('ano inválido %s impede envio (ANO-01/02)', async (ano) => {
    await render(<VeiculoFormView />);
    await preencher({ ano });
    await salvar();
    expect(screen.getByText(ano === '' ? 'Informe o ano de fabricação.' : 'Informe um ano entre 1950 e 2027.')).toBeOnTheScreen();
    expect(criarVeiculo).not.toHaveBeenCalled();
  });

  it('edição de legado abre ano vazio e exige preenchimento (ANO-03/04)', async () => {
    (buscarVeiculoPorId as jest.Mock).mockResolvedValue({ ok: true, data: { ...volvo, ano_fabricacao: null } });
    (atualizarVeiculo as jest.Mock).mockResolvedValue({ ok: true, data: volvo });
    await render(<VeiculoFormView veiculoId="9" />);
    const ano = await screen.findByLabelText('Ano de fabricação');
    expect(ano.props.value).toBe('');
    await salvar();
    expect(atualizarVeiculo).not.toHaveBeenCalled();
    expect(screen.getByText('Informe o ano de fabricação.')).toBeOnTheScreen();
    await fireEvent.changeText(ano, '2020');
    await salvar();
    expect(atualizarVeiculo).toHaveBeenCalledWith('9', expect.objectContaining({ ano_fabricacao: 2020 }));
  });

  it('edição de desativado preserva o status: o aviso do topo diz a situação, sem seletor de Status (ANO-06)', async () => {
    const inativo = { ...volvo, status: 'Inativo' };
    (buscarVeiculoPorId as jest.Mock).mockResolvedValue({ ok: true, data: inativo });
    (atualizarVeiculo as jest.Mock).mockResolvedValue({ ok: true, data: inativo });
    await render(<VeiculoFormView veiculoId="9" />);
    await screen.findByLabelText('Placa');
    expect(screen.getByText('Veículo desativado')).toBeOnTheScreen();
    expect(screen.queryByText('Inativo')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Status/ })).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Modelo'), 'FH 460');
    await salvar();
    expect(atualizarVeiculo).toHaveBeenCalledWith('9', expect.objectContaining({ status: 'Inativo', modelo: 'FH 460' }));
  });

  it('erro de ano do banco aparece no campo e na Snackbar (ANO-05)', async () => {
    const mensagem = 'Ano de fabricação inválido. Informe um ano entre 1950 e o ano atual + 1.';
    (criarVeiculo as jest.Mock).mockResolvedValue({ ok: false, campo: 'ano_fabricacao', mensagem });
    await render(<VeiculoFormView />);
    await preencher();
    await salvar();
    expect(screen.getAllByText(mensagem)).toHaveLength(2);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('salvar pendente exibe loading e impede envio duplicado (ANO-04)', async () => {
    let concluir: (value: unknown) => void = () => {};
    (criarVeiculo as jest.Mock).mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
    await render(<VeiculoFormView />);
    await preencher();
    const toque1 = await dispararSemEsperar(() => salvar());
    expect(screen.getByRole('button', { name: /^(Cadastrar veículo|Salvar alterações)$/ })).toBeDisabled();
    expect(screen.getByTestId('button-loading')).toBeOnTheScreen();
    const toque2 = await dispararSemEsperar(() => salvar());
    expect(criarVeiculo).toHaveBeenCalledTimes(1);
    await act(async () => {
      concluir({ ok: true, data: volvo });
      await Promise.all([toque1.terminou, toque2.terminou]);
    });
    expect(screen.getByText('Veículo cadastrado.')).toBeOnTheScreen();
  });

  it('permite tentar novamente após falha na carga', async () => {
    (buscarVeiculoPorId as jest.Mock)
      .mockResolvedValueOnce({ ok: false, mensagem: 'Falha de rede.' })
      .mockResolvedValueOnce({ ok: true, data: volvo });
    await render(<VeiculoFormView veiculoId="9" />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByLabelText('Ano de fabricação')).toHaveProp('value', '2020');
  });

  it('modo editar: envia a atualização para o id certo', async () => {
    (buscarVeiculoPorId as jest.Mock).mockResolvedValue({ ok: true, data: volvo });
    (atualizarVeiculo as jest.Mock).mockResolvedValue({ ok: true, data: { ...volvo, modelo: 'FH 460' } });

    await render(<VeiculoFormView veiculoId="9" />);
    await screen.findByLabelText('Placa');

    await fireEvent.changeText(screen.getByLabelText('Modelo'), 'FH 460');
    await salvar();

    expect(atualizarVeiculo).toHaveBeenCalledWith('9', expect.objectContaining({ placa: 'ABC1234', modelo: 'FH 460' }));
    expect(await screen.findByText('Veículo atualizado.')).toBeOnTheScreen();
  });

  it('erro ao carregar o veículo mostra estado de erro e "Voltar" navega para trás', async () => {
    (buscarVeiculoPorId as jest.Mock).mockResolvedValue({ ok: false, mensagem: 'Veículo não encontrado.' });

    await render(<VeiculoFormView veiculoId="x" />);

    expect(await screen.findByText('Não foi possível carregar o veículo')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

// Carregando e erro de carga também abrem sob o header nativo: sem inset de topo duplicado (NAV-04, AC 11).
describe('VeiculoFormView — estados de carga sob o header (NAV-04)', () => {
  it('carregando: sem o inset de topo', async () => {
    (buscarVeiculoPorId as jest.Mock).mockReturnValue(new Promise(() => {}));
    await render(<VeiculoFormView veiculoId="9" />);

    expect(screen.getByLabelText('Carregando veículo')).toBeOnTheScreen();
    expect(porTipo(SafeAreaView).props.edges).not.toContain('top');
  });

  it('erro ao carregar: sem o inset de topo', async () => {
    (buscarVeiculoPorId as jest.Mock).mockResolvedValue({ ok: false, mensagem: 'Veículo não encontrado.' });
    await render(<VeiculoFormView veiculoId="9" />);

    expect(await screen.findByText('Não foi possível carregar o veículo')).toBeOnTheScreen();
    expect(porTipo(SafeAreaView).props.edges).not.toContain('top');
  });
});

// Desativar e reativar moram no fim do Editar, no mesmo molde em Categorias, Formas de pagamento, Rotas e
// Veículos (antes era um switch ou um "Mais opções" na lista).
describe('VeiculoFormView — desativar e reativar no Editar', () => {
  beforeEach(() => {
    mockBack.mockReset();
    jest.mocked(buscarVeiculoPorId).mockReset();
    jest.mocked(inativarVeiculo).mockReset();
    jest.mocked(reativarVeiculo).mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('no cadastro não existe ação de status', async () => {
    await render(<VeiculoFormView />);

    expect(screen.queryByRole('button', { name: /^(Desativar|Reativar) / })).not.toBeOnTheScreen();
  });

  it('ativo: "Desativar veículo" no fim, com a consequência dita embaixo', async () => {
    jest.mocked(buscarVeiculoPorId).mockResolvedValue({ ok: true, data: { ...volvo, status: 'Disponivel' as const } });
    await render(<VeiculoFormView veiculoId="9" />);

    expect(await screen.findByRole('button', { name: 'Desativar veículo' })).toBeOnTheScreen();
    expect(screen.getByText('Ele some da abertura de viagens e das manutenções. O histórico continua com ele.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Reativar veículo' })).not.toBeOnTheScreen();
  });

  it('desativar grava, mostra o Snackbar com "Desfazer" e volta para a lista quando ele some', async () => {
    jest.mocked(buscarVeiculoPorId).mockResolvedValue({ ok: true, data: { ...volvo, status: 'Disponivel' as const } });
    jest.mocked(inativarVeiculo).mockResolvedValue({ ok: true, data: { ...volvo, status: 'Inativo' as const } });
    await render(<VeiculoFormView veiculoId="9" />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Desativar veículo' }));

    expect(inativarVeiculo).toHaveBeenCalledWith('9');
    expect(await screen.findByText('Veículo desativado.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();

    // Com "Desfazer" o Snackbar fica mais tempo (6 s) antes de voltar.
    await act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('"Desfazer" reativa na hora e só volta depois do aviso de reativação', async () => {
    jest.mocked(buscarVeiculoPorId).mockResolvedValue({ ok: true, data: { ...volvo, status: 'Disponivel' as const } });
    jest.mocked(inativarVeiculo).mockResolvedValueOnce({ ok: true, data: { ...volvo, status: 'Inativo' as const } });
    jest.mocked(reativarVeiculo).mockResolvedValueOnce({ ok: true, data: { ...volvo, status: 'Disponivel' as const } });
    await render(<VeiculoFormView veiculoId="9" />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Desativar veículo' }));
    await screen.findByText('Veículo desativado.');

    await fireEvent.press(screen.getByRole('button', { name: 'Desfazer' }));

    expect(reativarVeiculo).toHaveBeenCalledWith('9');
    expect(await screen.findByText('Veículo reativado.')).toBeOnTheScreen();
    // Fechar o Snackbar do "Desfazer" não pode levar de volta antes de a reativação terminar.
    expect(mockBack).not.toHaveBeenCalled();
    await act(() => {
      jest.advanceTimersByTime(1200);
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('desativado: aviso no topo e "Reativar veículo" como ação secundária; reativar grava e volta', async () => {
    jest.mocked(buscarVeiculoPorId).mockResolvedValue({ ok: true, data: { ...volvo, status: 'Inativo' as const } });
    jest.mocked(reativarVeiculo).mockResolvedValue({ ok: true, data: { ...volvo, status: 'Disponivel' as const } });
    await render(<VeiculoFormView veiculoId="9" />);

    expect(await screen.findByText('Veículo desativado')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Desativar veículo' })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reativar veículo' }));

    expect(reativarVeiculo).toHaveBeenCalledWith('9');
    expect(await screen.findByText('Veículo reativado.')).toBeOnTheScreen();
    // Reativar não oferece "Desfazer": não há nada perdido para recuperar.
    expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeOnTheScreen();
    await act(() => {
      jest.advanceTimersByTime(1200);
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('erro ao desativar: Snackbar de erro, fica na tela e o botão continua "Desativar veículo"', async () => {
    jest.mocked(buscarVeiculoPorId).mockResolvedValue({ ok: true, data: { ...volvo, status: 'Disponivel' as const } });
    jest.mocked(inativarVeiculo).mockResolvedValue({ ok: false, mensagem: 'Sem conexão com o servidor. Tente novamente.' });
    await render(<VeiculoFormView veiculoId="9" />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Desativar veículo' }));

    expect(await screen.findByText('Sem conexão com o servidor. Tente novamente.')).toBeOnTheScreen();
    await act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Desativar veículo' })).toBeOnTheScreen();
  });
});

describe('VeiculoFormView — quando o veículo não pode ser desativado (INA-08, REA)', () => {
  beforeEach(() => {
    jest.mocked(buscarVeiculoPorId).mockReset();
    jest.mocked(reativarVeiculo).mockReset();
  });

  it.each([
    ['Em viagem', 'EmViagem'],
    ['Em manutenção', 'EmManutencao'],
  ] as const)('%s: sem botão, e a tela diz o que falta para desativar', async (_rotulo, status) => {
    jest.mocked(buscarVeiculoPorId).mockResolvedValue({ ok: true, data: { ...volvo, status } });
    await render(<VeiculoFormView veiculoId="9" />);
    await screen.findByLabelText('Placa');

    expect(screen.queryByRole('button', { name: /^(Desativar|Reativar) / })).toBeNull();
    expect(
      screen.getByText('Para desativar, o veículo precisa estar disponível: sem viagem nem manutenção em aberto.'),
    ).toBeOnTheScreen();
  });

  it('o botão segue o status gravado, não o escolhido no seletor e ainda não salvo', async () => {
    jest.mocked(buscarVeiculoPorId).mockResolvedValue({ ok: true, data: { ...volvo, status: 'EmManutencao' } });
    await render(<VeiculoFormView veiculoId="9" />);
    await screen.findByLabelText('Placa');

    await fireEvent.press(screen.getByRole('button', { name: /^Status/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Disponível' }));

    expect(screen.queryByRole('button', { name: 'Desativar veículo' })).toBeNull();
  });

  it('reativado com viagem em aberto: o Snackbar diz com que status ele voltou', async () => {
    jest.mocked(buscarVeiculoPorId).mockResolvedValue({ ok: true, data: { ...volvo, status: 'Inativo' } });
    jest.mocked(reativarVeiculo).mockResolvedValue({ ok: true, data: { ...volvo, status: 'EmViagem' } });
    await render(<VeiculoFormView veiculoId="9" />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Reativar veículo' }));

    expect(await screen.findByText('Veículo reativado como Em Viagem.')).toBeOnTheScreen();
  });
});
