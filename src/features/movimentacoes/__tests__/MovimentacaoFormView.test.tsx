import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert, KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  buscarViagemVinculavel,
  listarViagensVinculaveis,
  type ViagemVinculavel,
} from '@/features/ponte-viagem/ponteRepository';
import { removerComprovante, uploadComprovante, urlDoComprovante } from '@/lib/storage';

import { MovimentacaoFormView } from '../MovimentacaoFormView';
import {
  atualizarMovimentacao,
  buscarMovimentacaoPorId,
  criarMovimentacao,
  listarOpcoesMovimentacao,
  type OpcoesMovimentacao,
} from '../movimentacoesRepository';
import type { Movimentacao } from '../types';

// O runner do GitHub Actions é mais lento que a máquina local.
jest.setTimeout(15000);

const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

jest.mock('../movimentacoesRepository', () => ({
  atualizarMovimentacao: jest.fn(),
  buscarMovimentacaoPorId: jest.fn(),
  criarMovimentacao: jest.fn(),
  listarOpcoesMovimentacao: jest.fn(),
}));

// US09: só as chamadas ao banco da ponte são falsas; rótulo e descrição da viagem são os reais.
jest.mock('@/supabase/client', () => ({ supabase: {} }));
jest.mock('@/features/ponte-viagem/ponteRepository', () => ({
  ...jest.requireActual('@/features/ponte-viagem/ponteRepository'),
  listarViagensVinculaveis: jest.fn(),
  buscarViagemVinculavel: jest.fn(),
}));

// Bordas do anexo (EIX-34): câmera/galeria, compressão e Storage. O componente em si é o real.
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('@/lib/storage', () => ({
  removerComprovante: jest.fn(),
  uploadComprovante: jest.fn(),
  urlDoComprovante: jest.fn(),
}));

const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
const mockPermissaoGaleria = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockGaleria = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockManipular = ImageManipulator.manipulate as jest.Mock;
const mockRemover = removerComprovante as jest.MockedFunction<typeof removerComprovante>;
const mockUpload = uploadComprovante as jest.MockedFunction<typeof uploadComprovante>;
const mockUrl = urlDoComprovante as jest.MockedFunction<typeof urlDoComprovante>;

const mockCriar = criarMovimentacao as jest.MockedFunction<typeof criarMovimentacao>;
const mockAtualizar = atualizarMovimentacao as jest.MockedFunction<typeof atualizarMovimentacao>;
const mockBuscar = buscarMovimentacaoPorId as jest.MockedFunction<typeof buscarMovimentacaoPorId>;
const mockOpcoes = listarOpcoesMovimentacao as jest.MockedFunction<typeof listarOpcoesMovimentacao>;
const mockListarViagens = listarViagensVinculaveis as jest.MockedFunction<typeof listarViagensVinculaveis>;
const mockBuscarViagem = buscarViagemVinculavel as jest.MockedFunction<typeof buscarViagemVinculavel>;

function viagem(sobrescrever: Partial<ViagemVinculavel>): ViagemVinculavel {
  return {
    id: 'v-1',
    placa: 'ABC1D23',
    cidade_origem: 'São Paulo',
    uf_origem: 'SP',
    cidade_destino: 'Curitiba',
    uf_destino: 'PR',
    status: 'EmAndamento',
    data_inicio: '2026-11-09T13:00:00+00:00',
    data_fim: null,
    ...sobrescrever,
  };
}

const VIAGEM_SP = viagem({});
const VIAGEM_BH = viagem({
  id: 'v-2',
  placa: 'XYZ9K88',
  cidade_origem: 'Campinas',
  cidade_destino: 'Belo Horizonte',
  uf_destino: 'MG',
  status: 'Finalizada',
});
const ROTULO_SP = 'ABC1D23 · São Paulo/SP → Curitiba/PR';
const ROTULO_BH = 'XYZ9K88 · Campinas/SP → Belo Horizonte/MG';

const opcoes: OpcoesMovimentacao = {
  categorias: [
    { id: 'cat-frete', titulo: 'Frete', tipo: 'Entrada', ativa: true },
    { id: 'cat-comb', titulo: 'Combustível', tipo: 'Saida', ativa: true },
  ],
  formasPagamento: [{ id: 'fp-pix', nome: 'Pix', ativa: true }],
};

const existente: Movimentacao = {
  id: 'mov-1',
  valorCentavos: 8000,
  descricao: 'Diesel',
  categoria_id: 'cat-antiga',
  forma_pagamento_id: 'fp-pix',
  divida_id: null,
  viagem_id: null,
  litros: null,
  data_vencimento: '2026-10-10',
  data_pagamento: null,
  data_inclusao: '2026-10-01T12:00:00+00:00',
  status_pagamento: 'Pendente',
  caminho_comprovante: null,
  categoria: { titulo: 'Categoria antiga', tipo: 'Saida', ativa: false },
  formaPagamento: { nome: 'Pix', ativa: true },
};

function salvar() {
  fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
}

function escolher(campo: string, opcao: string) {
  fireEvent.press(screen.getByRole('button', { name: campo }));
  fireEvent.press(screen.getByRole('button', { name: opcao }));
}

async function preencherValido() {
  fireEvent.changeText(screen.getByLabelText('Valor (R$)'), '150000');
  fireEvent.changeText(screen.getByLabelText('Descrição'), 'Frete Curitiba');
  escolher('Categoria', 'Frete');
  escolher('Forma de pagamento', 'Pix');
}

async function renderNova() {
  render(<MovimentacaoFormView />);
  await screen.findByLabelText('Descrição');
}

beforeEach(() => {
  mockBack.mockReset();
  mockPush.mockReset();
  mockCriar.mockReset();
  mockAtualizar.mockReset();
  mockBuscar.mockReset();
  mockOpcoes.mockReset();
  mockOpcoes.mockResolvedValue({ ok: true, data: opcoes });
  mockListarViagens.mockReset();
  mockListarViagens.mockResolvedValue({ ok: true, data: [VIAGEM_SP, VIAGEM_BH] });
  mockBuscarViagem.mockReset();
  mockAlert.mockClear();
  mockRemover.mockReset();
  mockRemover.mockResolvedValue({ ok: true, data: null });
  mockUpload.mockReset();
  mockUpload.mockResolvedValue({ ok: true, data: 'novo.jpg' });
  mockUrl.mockReset();
  mockUrl.mockResolvedValue({ ok: true, data: 'https://assinada.example/comprovante.jpg' });
  mockPermissaoGaleria.mockResolvedValue({ granted: true });
  mockGaleria.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://foto.jpg', width: 1000, height: 1000 }] });
  mockManipular.mockReturnValue({
    resize: jest.fn(),
    renderAsync: jest.fn().mockResolvedValue({ saveAsync: jest.fn().mockResolvedValue({ uri: 'file://comprimida.jpg' }) }),
  });
});

// Toca numa opção do último Alert aberto (o Alert nativo não aparece na árvore do teste).
async function escolherNoAlerta(opcao: string) {
  const botoes = mockAlert.mock.calls.at(-1)?.[2] ?? [];
  await act(async () => botoes.find((botao) => botao.text === opcao)?.onPress?.());
}

async function anexarDaGaleria() {
  fireEvent.press(screen.getByRole('button', { name: 'Anexar comprovante' }));
  await escolherNoAlerta('Galeria');
}

async function removerAnexo() {
  await waitFor(() => expect(screen.getByRole('imagebutton', { name: 'Ver comprovante em tela cheia' })).toBeEnabled());
  fireEvent.press(screen.getByRole('button', { name: 'Remover' }));
  await escolherNoAlerta('Remover');
}

describe('MovimentacaoFormView — nova (MOV-01)', () => {
  it('o título da tela fica no header nativo; o formulário rola e sobe com o teclado (NAV-02, NAV-04)', async () => {
    await renderNova();

    expect(screen.queryByText('Nova movimentação')).not.toBeOnTheScreen();
    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
    // Tela interna: o header nativo protege o topo, o Screen não repete o inset (NAV-04, AC 11).
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
    // Formulário rola e sobe com o teclado (NAV-04, AC 9 e 10).
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).findByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('mostra todos os campos e começa como Pendente, sem data de pagamento', async () => {
    await renderNova();

    expect(screen.getByLabelText('Valor (R$)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Descrição')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Categoria' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Forma de pagamento' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Data de vencimento')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Pendente' })).toBeSelected();
    expect(screen.queryByLabelText(/Data de (pagamento|recebimento)/)).not.toBeOnTheScreen();
  });

  it('a lista de categorias mostra o tipo de cada uma', async () => {
    await renderNova();

    fireEvent.press(screen.getByRole('button', { name: 'Categoria' }));

    expect(screen.getByText('Entrada')).toBeOnTheScreen();
    expect(screen.getByText('Saída')).toBeOnTheScreen();
  });

  it('status pago aparece como "Recebido" e pede "Data de recebimento" numa entrada', async () => {
    await renderNova();

    escolher('Categoria', 'Frete');
    fireEvent.press(screen.getByRole('tab', { name: 'Recebido' }));

    expect(screen.getByLabelText('Data de recebimento')).toBeOnTheScreen();
  });

  it('status pago aparece como "Pago" e pede "Data de pagamento" numa saída', async () => {
    await renderNova();

    escolher('Categoria', 'Combustível');
    fireEvent.press(screen.getByRole('tab', { name: 'Pago' }));

    expect(screen.getByLabelText('Data de pagamento')).toBeOnTheScreen();
  });
});

describe('MovimentacaoFormView — validação (MOV-04, MOV-05)', () => {
  it('form vazio mostra as mensagens de cada campo e não chama o repositório', async () => {
    await renderNova();

    salvar();

    expect(screen.getByText('Informe um valor maior que zero.')).toBeOnTheScreen();
    expect(screen.getByText('Informe a descrição.')).toBeOnTheScreen();
    expect(screen.getByText('Escolha a categoria.')).toBeOnTheScreen();
    expect(screen.getByText('Escolha a forma de pagamento.')).toBeOnTheScreen();
    expect(mockCriar).not.toHaveBeenCalled();
  });

  it('Pago sem data → "Informe a data de pagamento."', async () => {
    await renderNova();
    await preencherValido();

    fireEvent.press(screen.getByRole('tab', { name: 'Recebido' }));
    salvar();

    expect(screen.getByText('Informe a data de pagamento.')).toBeOnTheScreen();
    expect(mockCriar).not.toHaveBeenCalled();
  });

  it('data de vencimento inválida → "Data inválida. Use DD/MM/AAAA."', async () => {
    await renderNova();
    await preencherValido();

    fireEvent.changeText(screen.getByLabelText('Data de vencimento'), '31022026');
    salvar();

    expect(screen.getByText('Data inválida. Use DD/MM/AAAA.')).toBeOnTheScreen();
    expect(mockCriar).not.toHaveBeenCalled();
  });
});

describe('MovimentacaoFormView — salvar (MOV-02)', () => {
  it('cria com os dados validados, mostra "Movimentação registrada." e volta', async () => {
    mockCriar.mockResolvedValue({ ok: true, data: existente });
    await renderNova();
    await preencherValido();
    fireEvent.press(screen.getByRole('tab', { name: 'Recebido' }));
    fireEvent.changeText(screen.getByLabelText('Data de recebimento'), '05102026');

    await act(async () => salvar());

    expect(mockCriar).toHaveBeenCalledWith({
      valorCentavos: 150000,
      descricao: 'Frete Curitiba',
      categoriaId: 'cat-frete',
      formaPagamentoId: 'fp-pix',
      dataVencimento: null,
      status: 'Pago',
      dataPagamento: '2026-10-05',
      caminhoComprovante: null,
      // PONTE-06: sem viagem, o lançamento grava como antes, com o vínculo nulo.
      viagemId: null,
      litros: null,
    });
    expect(screen.getByText('Movimentação registrada.')).toBeOnTheScreen();
    await waitFor(() => expect(mockBack).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('erro do repositório mantém o form preenchido e mostra o Snackbar de erro', async () => {
    mockCriar.mockResolvedValue({ ok: false, mensagem: 'Você não tem permissão para registrar movimentações.' });
    await renderNova();
    await preencherValido();

    await act(async () => salvar());

    expect(screen.getByRole('alert')).toHaveTextContent('Você não tem permissão para registrar movimentações.');
    expect(screen.getByLabelText('Descrição')).toHaveDisplayValue('Frete Curitiba');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('enquanto salva, o botão fica em loading e ignora o segundo toque', async () => {
    let concluir: (valor: Awaited<ReturnType<typeof criarMovimentacao>>) => void = () => undefined;
    mockCriar.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    await renderNova();
    await preencherValido();

    salvar();

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeBusy();
    salvar();
    expect(mockCriar).toHaveBeenCalledTimes(1);

    await act(async () => concluir({ ok: true, data: existente }));
  });
});

describe('MovimentacaoFormView — editar (MOV-10)', () => {
  it('carrega os dados, mantém a categoria inativa e salva "Movimentação atualizada."', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: existente });
    mockAtualizar.mockResolvedValue({ ok: true, data: existente });
    render(<MovimentacaoFormView movimentacaoId="mov-1" />);

    await screen.findByLabelText('Descrição');
    expect(screen.queryByText('Editar movimentação')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Valor (R$)')).toHaveDisplayValue('R$ 80,00');
    expect(screen.getByLabelText('Descrição')).toHaveDisplayValue('Diesel');
    expect(screen.getByText('Categoria antiga')).toBeOnTheScreen();
    expect(screen.getByLabelText('Data de vencimento')).toHaveDisplayValue('10/10/2026');

    await act(async () => salvar());

    expect(mockAtualizar).toHaveBeenCalledWith('mov-1', {
      valorCentavos: 8000,
      descricao: 'Diesel',
      categoriaId: 'cat-antiga',
      formaPagamentoId: 'fp-pix',
      dataVencimento: '2026-10-10',
      status: 'Pendente',
      dataPagamento: null,
      caminhoComprovante: null,
      viagemId: null,
      litros: null,
    });
    expect(screen.getByText('Movimentação atualizada.')).toBeOnTheScreen();
  });

  it('id inexistente mostra "Movimentação não encontrada." com Voltar', async () => {
    mockBuscar.mockResolvedValue({ ok: false, mensagem: 'Movimentação não encontrada.' });
    render(<MovimentacaoFormView movimentacaoId="x" />);

    expect(await screen.findByText('Movimentação não encontrada.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('MovimentacaoFormView — opções (edge case)', () => {
  it('sem categoria ativa o seletor mostra "Nenhuma opção cadastrada."', async () => {
    mockOpcoes.mockResolvedValue({ ok: true, data: { categorias: [], formasPagamento: [] } });
    await renderNova();

    fireEvent.press(screen.getByRole('button', { name: 'Categoria' }));

    expect(screen.getByText('Nenhuma opção cadastrada.')).toBeOnTheScreen();
  });
});

// Carregando e erro de carga também abrem sob o header nativo: sem inset de topo duplicado (NAV-04, AC 11).
describe('MovimentacaoFormView — estados de carga sob o header (NAV-04)', () => {
  it('carregando: sem o inset de topo', () => {
    mockOpcoes.mockReturnValue(new Promise(() => {}));
    render(<MovimentacaoFormView movimentacaoId="x" />);

    expect(screen.getByLabelText('Carregando formulário')).toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
  });

  it('erro ao carregar: sem o inset de topo', async () => {
    mockOpcoes.mockResolvedValue({ ok: true, data: { categorias: [], formasPagamento: [] } });
    mockBuscar.mockResolvedValue({ ok: false, mensagem: 'Movimentação não encontrada.' });
    render(<MovimentacaoFormView movimentacaoId="x" />);

    expect(await screen.findByText('Movimentação não encontrada.')).toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
  });
});

describe('MovimentacaoFormView — comprovante (EIX-34)', () => {
  const comAnexo: Movimentacao = { ...existente, caminho_comprovante: 'antigo.jpg' };

  it('grava o caminho do comprovante anexado (AC 4)', async () => {
    mockCriar.mockResolvedValue({ ok: true, data: existente });
    await renderNova();
    await preencherValido();
    await anexarDaGaleria();

    await act(async () => salvar());

    expect(mockCriar).toHaveBeenCalledWith(expect.objectContaining({ caminhoComprovante: 'novo.jpg' }));
    expect(mockRemover).not.toHaveBeenCalled();
  });

  it('salvar sem o anexo que estava gravado apaga o arquivo, só depois do update (AC 6)', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: comAnexo });
    mockAtualizar.mockResolvedValue({ ok: true, data: existente });
    render(<MovimentacaoFormView movimentacaoId="mov-1" />);
    await screen.findByLabelText('Descrição');

    await removerAnexo();
    expect(mockRemover).not.toHaveBeenCalled();

    await act(async () => salvar());

    expect(mockAtualizar).toHaveBeenCalledWith('mov-1', expect.objectContaining({ caminhoComprovante: null }));
    expect(mockRemover).toHaveBeenCalledWith('antigo.jpg');
    expect(mockAtualizar.mock.invocationCallOrder[0]).toBeLessThan(mockRemover.mock.invocationCallOrder[0]);
    expect(screen.getByText('Movimentação atualizada.')).toBeOnTheScreen();
  });

  it('se o update falha, o arquivo gravado continua no bucket', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: comAnexo });
    mockAtualizar.mockResolvedValue({ ok: false, mensagem: 'Não foi possível atualizar a movimentação. Tente novamente.' });
    render(<MovimentacaoFormView movimentacaoId="mov-1" />);
    await screen.findByLabelText('Descrição');

    await removerAnexo();
    await act(async () => salvar());

    expect(mockRemover).not.toHaveBeenCalled();
  });

  it('anexo enviado nesta tela e removido antes de salvar é apagado na hora', async () => {
    await renderNova();
    await anexarDaGaleria();

    await removerAnexo();

    expect(mockRemover).toHaveBeenCalledWith('novo.jpg');
    expect(screen.getByRole('button', { name: 'Anexar comprovante' })).toBeOnTheScreen();
  });

  it('erro do anexo aparece no Snackbar do formulário (AC 2, 7)', async () => {
    mockPermissaoGaleria.mockResolvedValue({ granted: false });
    await renderNova();

    await anexarDaGaleria();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sem acesso à galeria. Libere a permissão nos ajustes do aparelho para escolher o comprovante.',
    );
  });
});

describe('MovimentacaoFormView — vincular à viagem (US09)', () => {
  beforeEach(() => {
    mockCriar.mockResolvedValue({ ok: true, data: existente });
  });

  const vinculado: Movimentacao = { ...existente, viagem_id: 'v-1' };

  // PONTE-01
  it('mostra o campo opcional "Vincular à viagem" com "Sem viagem"', async () => {
    await renderNova();

    expect(screen.getByRole('button', { name: 'Vincular à viagem' })).toHaveTextContent('Sem viagem');
  });

  // PONTE-02
  it('o seletor lista as viagens vinculáveis com placa e rota', async () => {
    await renderNova();

    fireEvent.press(screen.getByRole('button', { name: 'Vincular à viagem' }));

    expect(screen.getByRole('button', { name: ROTULO_SP })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: ROTULO_BH })).toBeOnTheScreen();
    expect(screen.getByText('Em andamento · início 09/11/2026')).toBeOnTheScreen();
  });

  // PONTE-03
  it('a busca filtra pela rota sem acento', async () => {
    await renderNova();

    fireEvent.press(screen.getByRole('button', { name: 'Vincular à viagem' }));
    fireEvent.changeText(screen.getByLabelText('Buscar'), 'belo horizonte');

    expect(screen.getByRole('button', { name: ROTULO_BH })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: ROTULO_SP })).not.toBeOnTheScreen();
  });

  // PONTE-04: Frete (Entrada) vinculado à viagem.
  it('salva o lançamento com o viagemId escolhido', async () => {
    await renderNova();
    await preencherValido();
    escolher('Vincular à viagem', ROTULO_SP);

    await act(async () => salvar());

    expect(mockCriar).toHaveBeenCalledWith(expect.objectContaining({ categoriaId: 'cat-frete', viagemId: 'v-1' }));
  });

  // Edge case: busca sem resultado.
  it('busca sem viagem correspondente mostra "Nenhuma viagem encontrada."', async () => {
    await renderNova();

    fireEvent.press(screen.getByRole('button', { name: 'Vincular à viagem' }));
    fireEvent.changeText(screen.getByLabelText('Buscar'), 'Manaus');

    expect(screen.getByText('Nenhuma viagem encontrada.')).toBeOnTheScreen();
  });

  // Edge case: nenhuma viagem vinculável.
  it('sem viagens vinculáveis o seletor mostra só "Sem viagem" e a mensagem da janela de 30 dias', async () => {
    mockListarViagens.mockResolvedValue({ ok: true, data: [] });
    await renderNova();

    fireEvent.press(screen.getByRole('button', { name: 'Vincular à viagem' }));

    expect(screen.getByLabelText('Sem viagem')).toBeOnTheScreen();
    expect(screen.getByText('Nenhuma viagem em andamento ou concluída nos últimos 30 dias.')).toBeOnTheScreen();
  });

  // PONTE-05
  it('"Sem viagem" num lançamento vinculado salva viagemId null', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: vinculado });
    mockAtualizar.mockResolvedValue({ ok: true, data: { ...vinculado, viagem_id: null } });
    render(<MovimentacaoFormView movimentacaoId="mov-1" />);
    await screen.findByLabelText('Descrição');
    expect(screen.getByRole('button', { name: 'Vincular à viagem' })).toHaveTextContent(ROTULO_SP);

    fireEvent.press(screen.getByRole('button', { name: 'Vincular à viagem' }));
    fireEvent.press(screen.getByLabelText('Sem viagem'));
    await act(async () => salvar());

    expect(mockAtualizar).toHaveBeenCalledWith('mov-1', expect.objectContaining({ viagemId: null }));
  });

  // PONTE-07
  it('vínculo com viagem fora da lista mostra o rótulo buscado pela RPC', async () => {
    const antiga = viagem({ id: 'v-velha', placa: 'OLD1A11', status: 'Finalizada' });
    mockBuscar.mockResolvedValue({ ok: true, data: { ...existente, viagem_id: 'v-velha' } });
    mockBuscarViagem.mockResolvedValue({ ok: true, data: antiga });

    render(<MovimentacaoFormView movimentacaoId="mov-1" />);
    await screen.findByLabelText('Descrição');

    expect(mockBuscarViagem).toHaveBeenCalledWith('v-velha');
    expect(screen.getByRole('button', { name: 'Vincular à viagem' })).toHaveTextContent(
      'OLD1A11 · São Paulo/SP → Curitiba/PR',
    );
  });

  // PONTE-08
  it('abre com a viagem do parâmetro já escolhida e salva com ela', async () => {
    mockCriar.mockResolvedValue({ ok: true, data: existente });
    render(<MovimentacaoFormView viagemIdInicial="v-2" />);
    await screen.findByLabelText('Descrição');

    expect(screen.getByRole('button', { name: 'Vincular à viagem' })).toHaveTextContent(ROTULO_BH);
    await preencherValido();
    await act(async () => salvar());

    expect(mockCriar).toHaveBeenCalledWith(expect.objectContaining({ viagemId: 'v-2' }));
  });

  // DETALHE-09
  it('lançamento salvo com viagem mostra "Ver viagem", que abre o detalhe dela', async () => {
    mockBuscar.mockResolvedValue({ ok: true, data: vinculado });
    render(<MovimentacaoFormView movimentacaoId="mov-1" />);
    await screen.findByLabelText('Descrição');

    fireEvent.press(screen.getByRole('button', { name: 'Ver viagem' }));

    expect(mockPush).toHaveBeenCalledWith('/viagens/v-1');
  });

  it('lançamento novo, mesmo com viagem escolhida, não mostra "Ver viagem"', async () => {
    await renderNova();
    escolher('Vincular à viagem', ROTULO_SP);

    expect(screen.queryByRole('button', { name: 'Ver viagem' })).not.toBeOnTheScreen();
  });

  // PONTE-09
  it('falha ao carregar as viagens mostra o erro de carga com Voltar', async () => {
    mockListarViagens.mockResolvedValue({ ok: false, mensagem: 'Não foi possível carregar as viagens. Tente novamente.' });

    render(<MovimentacaoFormView />);

    expect(await screen.findByText('Não foi possível carregar as viagens. Tente novamente.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen();
  });
});

describe('MovimentacaoFormView — litros (US09)', () => {
  beforeEach(() => {
    mockCriar.mockResolvedValue({ ok: true, data: existente });
  });

  // LITROS-01 e LITROS-02
  it('o campo de litros aparece só com a categoria Combustível', async () => {
    await renderNova();
    expect(screen.queryByLabelText('Quantidade em litros')).not.toBeOnTheScreen();

    escolher('Categoria', 'Combustível');
    expect(screen.getByLabelText('Quantidade em litros')).toBeOnTheScreen();

    escolher('Categoria', 'Frete');
    expect(screen.queryByLabelText('Quantidade em litros')).not.toBeOnTheScreen();
  });

  // LITROS-03
  it('Combustível vinculado sem litros mostra o erro e não salva', async () => {
    await renderNova();
    await preencherValido();
    escolher('Categoria', 'Combustível');
    escolher('Vincular à viagem', ROTULO_SP);

    await act(async () => salvar());

    expect(screen.getByText('Informe a quantidade em litros.')).toBeOnTheScreen();
    expect(mockCriar).not.toHaveBeenCalled();
  });

  // LITROS-04
  it('litros com três casas mostra a mensagem de formato e não salva', async () => {
    await renderNova();
    await preencherValido();
    escolher('Categoria', 'Combustível');
    fireEvent.changeText(screen.getByLabelText('Quantidade em litros'), '12,345');

    await act(async () => salvar());

    expect(screen.getByText('Informe os litros com até 2 casas decimais, entre 0,01 e 999.999,99.')).toBeOnTheScreen();
    expect(mockCriar).not.toHaveBeenCalled();
  });

  it('Combustível vinculado com litros salva o número', async () => {
    await renderNova();
    await preencherValido();
    escolher('Categoria', 'Combustível');
    escolher('Vincular à viagem', ROTULO_SP);
    fireEvent.changeText(screen.getByLabelText('Quantidade em litros'), '412,5');

    await act(async () => salvar());

    expect(mockCriar).toHaveBeenCalledWith(
      expect.objectContaining({ categoriaId: 'cat-comb', viagemId: 'v-1', litros: 412.5 }),
    );
  });

  // Edge case: trocar de Combustível para outra categoria descarta os litros.
  it('litros digitados e depois categoria trocada para Frete salvam litros null', async () => {
    await renderNova();
    await preencherValido();
    escolher('Categoria', 'Combustível');
    fireEvent.changeText(screen.getByLabelText('Quantidade em litros'), '80');
    escolher('Categoria', 'Frete');

    await act(async () => salvar());

    expect(mockCriar).toHaveBeenCalledWith(expect.objectContaining({ categoriaId: 'cat-frete', litros: null }));
  });

  it('editar um Combustível mostra os litros gravados com vírgula', async () => {
    mockBuscar.mockResolvedValue({
      ok: true,
      data: { ...existente, categoria_id: 'cat-comb', litros: 412.5, categoria: { titulo: 'Combustível', tipo: 'Saida', ativa: true } },
    });

    render(<MovimentacaoFormView movimentacaoId="mov-1" />);
    await screen.findByLabelText('Descrição');

    expect(screen.getByLabelText('Quantidade em litros')).toHaveDisplayValue('412,5');
  });
});
