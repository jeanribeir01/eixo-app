import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { colors } from '@/ui';

import { MovimentacoesListView } from '../MovimentacoesListView';
import { excluirMovimentacao, listarMovimentacoesDoMes } from '../movimentacoesRepository';
import type { Movimentacao } from '../types';

jest.setTimeout(15000);

const mockPush = jest.fn();

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]),
  };
});

// O requireActual abaixo carrega o client real; no Node 20 do CI (sem WebSocket nativo)
// o createClient quebra ao montar o Realtime. Nenhum teste aqui fala com o banco.
jest.mock('@/supabase/client', () => ({ supabase: {} }));

jest.mock('../movimentacoesRepository', () => ({
  ...jest.requireActual('../movimentacoesRepository'),
  listarMovimentacoesDoMes: jest.fn(),
  excluirMovimentacao: jest.fn(),
}));

const mockListar = listarMovimentacoesDoMes as jest.MockedFunction<typeof listarMovimentacoesDoMes>;
const mockExcluir = excluirMovimentacao as jest.MockedFunction<typeof excluirMovimentacao>;

function mov(sobrescrever: Partial<Movimentacao>): Movimentacao {
  return {
    id: 'id',
    valorCentavos: 100,
    descricao: 'Descrição',
    categoria_id: 'cat',
    forma_pagamento_id: 'fp',
    divida_id: null,
    data_vencimento: '2026-10-10',
    data_pagamento: null,
    data_inclusao: '2026-10-01T12:00:00+00:00',
    status_pagamento: 'Pendente',
  comprovante_url: null,
    categoria: { titulo: 'Combustível', tipo: 'Saida', ativa: true },
    formaPagamento: { nome: 'Pix', ativa: true },
    ...sobrescrever,
  };
}

const frete = mov({
  id: 'frete',
  descricao: 'Frete Curitiba',
  valorCentavos: 150000,
  status_pagamento: 'Pago',
  comprovante_url: null,
  data_pagamento: '2026-10-05',
  data_vencimento: '2026-10-05',
  categoria: { titulo: 'Frete', tipo: 'Entrada', ativa: true },
});
const diesel = mov({ id: 'diesel', descricao: 'Diesel', valorCentavos: 8000, data_vencimento: '2026-10-12' });
const parcela = mov({ id: 'parcela', descricao: 'Financiamento (1/12)', divida_id: 'div-1', data_vencimento: '2026-10-20' });

async function renderLista() {
  render(<MovimentacoesListView />);
  await screen.findByText('Outubro 2026');
  await act(async () => {});
}

beforeEach(() => {
  // Só o relógio é falso: "hoje" = 15/10/2026. Timers continuam reais para o Snackbar.
  jest.useFakeTimers({
    now: new Date(2026, 9, 15, 10, 0),
    doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'nextTick', 'queueMicrotask'],
  });
  mockPush.mockReset();
  mockListar.mockReset();
  mockExcluir.mockReset();
  mockListar.mockResolvedValue({ ok: true, data: [frete, diesel, parcela] });
});

afterEach(() => {
  jest.useRealTimers();
  // O spy do Alert acumularia chamadas de um teste para o outro.
  jest.restoreAllMocks();
});

describe('MovimentacoesListView — mês (MOV-08)', () => {
  it('mostra carregando e depois as movimentações do mês atual', async () => {
    render(<MovimentacoesListView />);

    expect(screen.getByLabelText('Carregando movimentações')).toBeOnTheScreen();
    expect(await screen.findByText('Frete Curitiba')).toBeOnTheScreen();
    expect(screen.getByText('Outubro 2026')).toBeOnTheScreen();
    expect(mockListar).toHaveBeenCalledWith(2026, 10);
  });

  it('‹ e › carregam o mês anterior e o seguinte', async () => {
    await renderLista();

    await act(async () => fireEvent.press(screen.getByRole('button', { name: '‹' })));
    expect(screen.getByText('Setembro 2026')).toBeOnTheScreen();
    expect(mockListar).toHaveBeenLastCalledWith(2026, 9);

    await act(async () => fireEvent.press(screen.getByRole('button', { name: '›' })));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: '›' })));
    expect(screen.getByText('Novembro 2026')).toBeOnTheScreen();
    expect(mockListar).toHaveBeenLastCalledWith(2026, 11);
  });

  it('dezembro → › vira janeiro do ano seguinte', async () => {
    jest.setSystemTime(new Date(2026, 11, 20));
    render(<MovimentacoesListView />);
    await screen.findByText('Dezembro 2026');

    await act(async () => fireEvent.press(screen.getByRole('button', { name: '›' })));

    expect(screen.getByText('Janeiro 2027')).toBeOnTheScreen();
    expect(mockListar).toHaveBeenLastCalledWith(2027, 1);
  });

  it('resposta atrasada de um mês anterior não sobrescreve o mês atual', async () => {
    let responderOutubro: (valor: Awaited<ReturnType<typeof listarMovimentacoesDoMes>>) => void = () => undefined;
    mockListar.mockReturnValueOnce(new Promise((resolve) => (responderOutubro = resolve)));
    mockListar.mockResolvedValueOnce({ ok: true, data: [diesel] });
    render(<MovimentacoesListView />);

    await act(async () => fireEvent.press(screen.getByRole('button', { name: '›' })));
    expect(await screen.findByText('Diesel')).toBeOnTheScreen();

    await act(async () => responderOutubro({ ok: true, data: [frete] }));

    expect(screen.getByText('Novembro 2026')).toBeOnTheScreen();
    expect(screen.queryByText('Frete Curitiba')).not.toBeOnTheScreen();
    expect(screen.getByText('Diesel')).toBeOnTheScreen();
  });
});

describe('MovimentacoesListView — filtros (MOV-08)', () => {
  it('aba Entradas mostra só categoria de entrada; Saídas só de saída', async () => {
    await renderLista();

    fireEvent.press(screen.getByRole('tab', { name: 'Entradas' }));
    expect(screen.getByText('Frete Curitiba')).toBeOnTheScreen();
    expect(screen.queryByText('Diesel')).not.toBeOnTheScreen();

    fireEvent.press(screen.getByRole('tab', { name: 'Saídas' }));
    expect(screen.queryByText('Frete Curitiba')).not.toBeOnTheScreen();
    expect(screen.getByText('Diesel')).toBeOnTheScreen();
  });

  it('aba Pendentes e Pagos filtram pelo status', async () => {
    await renderLista();

    fireEvent.press(screen.getByRole('tab', { name: 'Pagos' }));
    expect(screen.getByText('Frete Curitiba')).toBeOnTheScreen();
    expect(screen.queryByText('Diesel')).not.toBeOnTheScreen();

    fireEvent.press(screen.getByRole('tab', { name: 'Pendentes' }));
    expect(screen.queryByText('Frete Curitiba')).not.toBeOnTheScreen();
    expect(screen.getByText('Diesel')).toBeOnTheScreen();
  });
});

describe('MovimentacoesListView — linhas e estados (MOV-09)', () => {
  it('entrada mostra "+ R$" com cor de sucesso; saída "− R$" com cor de perigo', async () => {
    await renderLista();

    expect(screen.getByText('+ R$ 1.500,00')).toHaveStyle({ color: colors.success });
    expect(screen.getByText('− R$ 80,00')).toHaveStyle({ color: colors.danger });
  });

  it('linha mostra categoria, data de referência e rótulo de status', async () => {
    await renderLista();

    expect(screen.getByText('Frete · 05/10 · Recebido')).toBeOnTheScreen();
    expect(screen.getByText('Combustível · 12/10 · Pendente')).toBeOnTheScreen();
  });

  it('mês vazio mostra estado vazio com "Nova movimentação"', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [] });
    await renderLista();

    expect(screen.getByText('Nenhuma movimentação neste mês')).toBeOnTheScreen();
    const acoes = screen.getAllByRole('button', { name: 'Nova movimentação' });
    fireEvent.press(acoes[acoes.length - 1]!);
    expect(mockPush).toHaveBeenCalledWith('/movimentacoes/nova');
  });

  it('erro mostra "Tentar novamente", que recarrega', async () => {
    mockListar.mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as movimentações. Tente novamente.' });
    await renderLista();

    expect(screen.getByText('Não foi possível carregar as movimentações. Tente novamente.')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' })));
    expect(await screen.findByText('Frete Curitiba')).toBeOnTheScreen();
  });
});

describe('MovimentacoesListView — editar e excluir (MOV-10, MOV-11)', () => {
  function linhaDe(descricao: string) {
    return screen.getByLabelText(`Movimentação ${descricao}`);
  }

  it('Editar abre o formulário da movimentação', async () => {
    await renderLista();

    fireEvent.press(within(linhaDe('Diesel')).getByRole('button', { name: 'Editar' }));

    expect(mockPush).toHaveBeenCalledWith('/movimentacoes/diesel/editar');
  });

  it('Excluir pede confirmação e só apaga ao confirmar', async () => {
    const alerta = jest.spyOn(Alert, 'alert');
    mockExcluir.mockResolvedValue({ ok: true, data: 'diesel' });
    await renderLista();

    fireEvent.press(within(linhaDe('Diesel')).getByRole('button', { name: 'Excluir' }));

    expect(alerta).toHaveBeenCalledWith('Excluir movimentação?', 'Diesel', expect.any(Array));
    expect(mockExcluir).not.toHaveBeenCalled();

    const botoes = alerta.mock.calls[0]![2]!;
    await act(async () => botoes.find((botao) => botao.text === 'Excluir')!.onPress!());

    expect(mockExcluir).toHaveBeenCalledWith('diesel');
    expect(screen.queryByText('Diesel')).not.toBeOnTheScreen();
    expect(screen.getByText('Movimentação excluída.')).toBeOnTheScreen();
  });

  it('Cancelar no diálogo mantém a linha', async () => {
    const alerta = jest.spyOn(Alert, 'alert');
    await renderLista();

    fireEvent.press(within(linhaDe('Diesel')).getByRole('button', { name: 'Excluir' }));
    const botoes = alerta.mock.calls[0]![2]!;
    const cancelar = botoes.find((botao) => botao.text === 'Cancelar')!;
    expect(cancelar.style).toBe('cancel');
    cancelar.onPress?.();

    expect(mockExcluir).not.toHaveBeenCalled();
    expect(screen.getByText('Diesel')).toBeOnTheScreen();
  });

  it('falha ao excluir mostra o erro e mantém a linha', async () => {
    const alerta = jest.spyOn(Alert, 'alert');
    mockExcluir.mockResolvedValue({ ok: false, mensagem: 'Movimentação não encontrada ou não pode ser excluída.' });
    await renderLista();

    fireEvent.press(within(linhaDe('Diesel')).getByRole('button', { name: 'Excluir' }));
    const botoes = alerta.mock.calls[0]![2]!;
    await act(async () => botoes.find((botao) => botao.text === 'Excluir')!.onPress!());

    expect(screen.getByRole('alert')).toHaveTextContent('Movimentação não encontrada ou não pode ser excluída.');
    expect(screen.getByText('Diesel')).toBeOnTheScreen();
  });

  it('parcela de dívida não tem Excluir e mostra "Parcela de dívida"', async () => {
    await renderLista();

    const linha = linhaDe('Financiamento (1/12)');
    expect(within(linha).queryByRole('button', { name: 'Excluir' })).not.toBeOnTheScreen();
    expect(within(linha).getByText('Parcela de dívida')).toBeOnTheScreen();
    expect(within(linha).getByRole('button', { name: 'Editar' })).toBeOnTheScreen();
  });
});
