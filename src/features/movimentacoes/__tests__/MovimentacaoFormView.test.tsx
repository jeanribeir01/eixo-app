import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert, KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('../movimentacoesRepository', () => ({
  atualizarMovimentacao: jest.fn(),
  buscarMovimentacaoPorId: jest.fn(),
  criarMovimentacao: jest.fn(),
  listarOpcoesMovimentacao: jest.fn(),
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
  mockCriar.mockReset();
  mockAtualizar.mockReset();
  mockBuscar.mockReset();
  mockOpcoes.mockReset();
  mockOpcoes.mockResolvedValue({ ok: true, data: opcoes });
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
