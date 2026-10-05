import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

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
  fireEvent.changeText(screen.getByLabelText('Valor'), '150000');
  fireEvent.changeText(screen.getByLabelText('Descrição'), 'Frete Curitiba');
  escolher('Categoria', 'Frete');
  escolher('Forma de pagamento', 'Pix');
}

async function renderNova() {
  render(<MovimentacaoFormView />);
  await screen.findByText('Nova movimentação');
}

beforeEach(() => {
  mockBack.mockReset();
  mockCriar.mockReset();
  mockAtualizar.mockReset();
  mockBuscar.mockReset();
  mockOpcoes.mockReset();
  mockOpcoes.mockResolvedValue({ ok: true, data: opcoes });
});

describe('MovimentacaoFormView — nova (MOV-01)', () => {
  it('mostra todos os campos e começa como Pendente, sem data de pagamento', async () => {
    await renderNova();

    expect(screen.getByLabelText('Valor')).toBeOnTheScreen();
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

    await screen.findByText('Editar movimentação');
    expect(screen.getByLabelText('Valor')).toHaveDisplayValue('R$ 80,00');
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
