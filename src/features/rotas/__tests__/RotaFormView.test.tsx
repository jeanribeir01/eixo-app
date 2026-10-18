import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList, KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Select } from '@/ui';

import { RotaFormView } from '../RotaFormView';
import { atualizarRota, buscarRotaPorId, criarRota, definirAtivaRota } from '../rotasRepository';
import type { Rota } from '../types';

// O runner do GitHub Actions é mais lento que a máquina local: o padrão de 5s estourava no CI.
jest.setTimeout(15000);

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
}));

jest.mock('../rotasRepository', () => ({
  criarRota: jest.fn(),
  atualizarRota: jest.fn(),
  buscarRotaPorId: jest.fn(),
  definirAtivaRota: jest.fn(),
}));

const mockCriar = criarRota as jest.MockedFunction<typeof criarRota>;
const mockAtualizar = atualizarRota as jest.MockedFunction<typeof atualizarRota>;
const mockBuscar = buscarRotaPorId as jest.MockedFunction<typeof buscarRotaPorId>;
const mockDefinirAtiva = definirAtivaRota as jest.MockedFunction<typeof definirAtivaRota>;

const curitibaSp: Rota = {
  id: 'r1',
  cidade_origem: 'Curitiba',
  uf_origem: 'PR',
  cidade_destino: 'São Paulo',
  uf_destino: 'SP',
  distancia_estimada_km: 408.5,
  ativa: true,
};

const MENSAGEM_DUPLICADA = 'Já existe uma rota com esse trecho.';
const MENSAGEM_DUPLICADA_INATIVA = 'Já existe uma rota inativa com esse trecho. Reative-a para usar de novo.';

// A lista de UFs do Select é uma FlatList virtualizada: no Jest só os primeiros itens renderizam
// e PR/SP ficam fora (no aparelho, a lista rola). Chama o `onChange` do Select do campo, que é o
// mesmo que o toque na opção dispara.
function escolher(campo: string, opcao: string) {
  const select = screen.UNSAFE_getAllByType(Select).find((elemento) => elemento.props.label === campo);
  if (!select) throw new Error(`Select "${campo}" não encontrado`);
  act(() => select.props.onChange(opcao));
}

function preencher({ origem = ' Curitiba ', destino = 'São  Paulo', distancia = '408,5' } = {}) {
  fireEvent.changeText(screen.getByLabelText('Cidade de origem'), origem);
  escolher('UF de origem', 'PR');
  fireEvent.changeText(screen.getByLabelText('Cidade de destino'), destino);
  escolher('UF de destino', 'SP');
  fireEvent.changeText(screen.getByLabelText('Distância estimada (km)'), distancia);
}

async function salvar() {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  });
}

beforeEach(() => {
  mockBack.mockReset();
  mockCriar.mockReset();
  mockAtualizar.mockReset();
  mockBuscar.mockReset();
  mockDefinirAtiva.mockReset();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('RotaFormView — cadastro', () => {
  // ROTA-01
  it('mostra os cinco campos, sob o header nativo e com o formulário rolando com o teclado', () => {
    render(<RotaFormView />);

    expect(screen.getByLabelText('Cidade de origem')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'UF de origem' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Cidade de destino')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'UF de destino' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Distância estimada (km)')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Reativar rota existente' })).not.toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).findByType(ScrollView).props.keyboardShouldPersistTaps).toBe(
      'handled',
    );
  });

  // ROTA-02
  it('a UF é escolhida numa lista com as 27 UFs, sem texto livre', () => {
    render(<RotaFormView />);

    fireEvent.press(screen.getByRole('button', { name: 'UF de origem' }));

    const siglas = screen.UNSAFE_getByType(FlatList).props.data.map((opcao: { value: string }) => opcao.value);
    expect(siglas).toHaveLength(27);
    expect(siglas).toEqual(expect.arrayContaining(['AC', 'DF', 'PR', 'SP', 'TO']));
    // A primeira opção da lista aparece e escolhê-la preenche o campo.
    fireEvent.press(screen.getByRole('button', { name: 'AC' }));
    expect(screen.getByText('AC')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'AL' })).not.toBeOnTheScreen();
  });

  // ROTA-03
  it('caminho feliz: grava com as cidades limpas, mostra "Rota cadastrada." e volta à lista', async () => {
    mockCriar.mockResolvedValue({ ok: true, data: curitibaSp });
    render(<RotaFormView />);

    preencher();
    await salvar();

    expect(mockCriar).toHaveBeenCalledWith({
      cidade_origem: 'Curitiba',
      uf_origem: 'PR',
      cidade_destino: 'São Paulo',
      uf_destino: 'SP',
      distancia_estimada_km: 408.5,
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Rota cadastrada.');

    act(() => {
      jest.advanceTimersByTime(1200);
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  // ROTA-05
  it.each([
    ['vazia', '', 'Informe a distância estimada em km.'],
    ['não numérica', 'quatrocentos', 'Informe a distância estimada em km.'],
    ['zero', '0', 'A distância deve ser maior que zero.'],
    ['negativa', '-5', 'A distância deve ser maior que zero.'],
    // ROTA-06
    ['com 3 casas', '408,555', 'Use no máximo 2 casas decimais.'],
  ])('distância %s bloqueia o envio e mostra a mensagem no campo', async (_caso, distancia, mensagem) => {
    render(<RotaFormView />);

    preencher({ distancia });
    await salvar();

    expect(screen.getByText(mensagem)).toBeOnTheScreen();
    expect(mockCriar).not.toHaveBeenCalled();
  });

  // ROTA-07
  it('cidades vazias e UFs não escolhidas bloqueiam o envio com a mensagem de cada campo', async () => {
    render(<RotaFormView />);

    fireEvent.changeText(screen.getByLabelText('Cidade de origem'), '   ');
    fireEvent.changeText(screen.getByLabelText('Distância estimada (km)'), '408');
    await salvar();

    expect(screen.getByText('Informe a cidade de origem.')).toBeOnTheScreen();
    expect(screen.getByText('Escolha a UF de origem.')).toBeOnTheScreen();
    expect(screen.getByText('Informe a cidade de destino.')).toBeOnTheScreen();
    expect(screen.getByText('Escolha a UF de destino.')).toBeOnTheScreen();
    expect(mockCriar).not.toHaveBeenCalled();
  });

  // ROTA-08
  it('enquanto salva, o "Salvar" fica em loading e ignora novos toques', async () => {
    let concluir: (valor: Awaited<ReturnType<typeof criarRota>>) => void = () => undefined;
    mockCriar.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    render(<RotaFormView />);
    preencher();

    await salvar();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await salvar();
    expect(mockCriar).toHaveBeenCalledTimes(1);

    await act(async () => concluir({ ok: true, data: curitibaSp }));
    expect(screen.getByRole('button', { name: 'Salvar' })).not.toBeDisabled();
  });

  // ROTA-09
  it('recusa do banco mostra o Snackbar de erro em português e não volta', async () => {
    mockCriar.mockResolvedValue({ ok: false, mensagem: 'Acesso negado. Seu perfil não tem permissão para esta ação.' });
    render(<RotaFormView />);

    preencher();
    await salvar();

    expect(screen.getAllByText('Acesso negado. Seu perfil não tem permissão para esta ação.')).toHaveLength(1);
    act(() => {
      jest.advanceTimersByTime(1200);
    });
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe('RotaFormView — rota duplicada', () => {
  // ROTA-10, ROTA-16
  it('duplicada ativa: mostra a mensagem no formulário, sem botão de reativar', async () => {
    mockCriar.mockResolvedValue({ ok: false, mensagem: MENSAGEM_DUPLICADA, campo: 'trecho' });
    render(<RotaFormView />);

    preencher();
    await salvar();

    // Uma vez no formulário e outra no Snackbar de erro.
    expect(screen.getAllByText(MENSAGEM_DUPLICADA)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Reativar rota existente' })).not.toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();
  });

  // ROTA-13, ROTA-14
  it('duplicada inativa: "Reativar rota existente" reativa, mostra "Rota reativada." e volta à lista', async () => {
    mockCriar.mockResolvedValue({
      ok: false,
      mensagem: MENSAGEM_DUPLICADA_INATIVA,
      campo: 'trecho',
      rotaInativaId: 'r9',
    });
    mockDefinirAtiva.mockResolvedValue({ ok: true, data: { ...curitibaSp, id: 'r9' } });
    render(<RotaFormView />);

    preencher();
    await salvar();
    expect(screen.getAllByText(MENSAGEM_DUPLICADA_INATIVA)).toHaveLength(2);
    // Fecha o Snackbar de erro antes de reativar.
    act(() => {
      jest.advanceTimersByTime(1200);
    });

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Reativar rota existente' }));
    });

    // Só reativa: a distância digitada não é gravada (decisão da spec).
    expect(mockDefinirAtiva).toHaveBeenCalledWith('r9', true);
    expect(mockAtualizar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Rota reativada.');
    expect(screen.queryByRole('button', { name: 'Reativar rota existente' })).not.toBeOnTheScreen();

    act(() => {
      jest.advanceTimersByTime(1200);
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('erro ao reativar mostra o Snackbar de erro e mantém o botão', async () => {
    mockCriar.mockResolvedValue({ ok: false, mensagem: MENSAGEM_DUPLICADA_INATIVA, campo: 'trecho', rotaInativaId: 'r9' });
    mockDefinirAtiva.mockResolvedValue({ ok: false, mensagem: 'Não foi possível reativar a rota. Tente novamente.' });
    render(<RotaFormView />);
    preencher();
    await salvar();
    act(() => {
      jest.advanceTimersByTime(1200);
    });

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Reativar rota existente' }));
    });

    expect(screen.getByText('Não foi possível reativar a rota. Tente novamente.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reativar rota existente' })).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('mudar o trecho depois da recusa tira o aviso e o botão de reativar', async () => {
    mockCriar.mockResolvedValue({ ok: false, mensagem: MENSAGEM_DUPLICADA_INATIVA, campo: 'trecho', rotaInativaId: 'r9' });
    render(<RotaFormView />);
    preencher();
    await salvar();
    act(() => {
      jest.advanceTimersByTime(1200);
    });

    fireEvent.changeText(screen.getByLabelText('Cidade de destino'), 'Campinas');

    expect(screen.queryByText(MENSAGEM_DUPLICADA_INATIVA)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Reativar rota existente' })).not.toBeOnTheScreen();
  });
});

describe('RotaFormView — edição', () => {
  it('carrega a rota com a distância em vírgula e as UFs escolhidas', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: curitibaSp });
    render(<RotaFormView rotaId="r1" />);

    expect(screen.getByLabelText('Carregando rota')).toBeOnTheScreen();
    expect(await screen.findByLabelText('Cidade de origem')).toHaveProp('value', 'Curitiba');
    expect(mockBuscar).toHaveBeenCalledWith('r1');
    expect(screen.getByLabelText('Cidade de destino')).toHaveProp('value', 'São Paulo');
    expect(screen.getByLabelText('Distância estimada (km)')).toHaveProp('value', '408,5');
    expect(screen.getByText('PR')).toBeOnTheScreen();
    expect(screen.getByText('SP')).toBeOnTheScreen();
  });

  // ROTA-04
  it('salvar a edição grava no id certo, mostra "Rota atualizada." e volta à lista', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: curitibaSp });
    mockAtualizar.mockResolvedValue({ ok: true, data: { ...curitibaSp, distancia_estimada_km: 410 } });
    render(<RotaFormView rotaId="r1" />);
    await screen.findByLabelText('Cidade de origem');

    fireEvent.changeText(screen.getByLabelText('Distância estimada (km)'), '410');
    await salvar();

    expect(mockAtualizar).toHaveBeenCalledWith('r1', {
      cidade_origem: 'Curitiba',
      uf_origem: 'PR',
      cidade_destino: 'São Paulo',
      uf_destino: 'SP',
      distancia_estimada_km: 410,
    });
    expect(mockCriar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Rota atualizada.');

    act(() => {
      jest.advanceTimersByTime(1200);
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  // ROTA-28
  it('rota inexistente mostra "Rota não encontrada." e "Voltar" navega para trás', async () => {
    mockBuscar.mockResolvedValue({ ok: false, mensagem: 'Rota não encontrada.' });
    render(<RotaFormView rotaId="x" />);

    expect(await screen.findByText('Rota não encontrada.')).toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
    fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
