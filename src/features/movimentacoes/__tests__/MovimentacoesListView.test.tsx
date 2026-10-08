import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Alert, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FAB_ALTURA_RESERVADA, Skeleton, colors } from '@/ui';

import { MovimentacoesListView } from '../MovimentacoesListView';
import { excluirMovimentacao, listarMovimentacoesDoMes } from '../movimentacoesRepository';
import type { Movimentacao } from '../types';

jest.setTimeout(15000);

const mockPush = jest.fn();
// Guarda o callback do foco para o teste simular "voltei para esta tela".
let mockAoFocar: (() => void) | null = null;

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => {
      mockAoFocar = callback;
      react.useEffect(callback, [callback]);
    },
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
    caminho_comprovante: null,
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
  data_pagamento: '2026-10-05',
  data_vencimento: '2026-10-05',
  categoria: { titulo: 'Frete', tipo: 'Entrada', ativa: true },
});
const diesel = mov({ id: 'diesel', descricao: 'Diesel', valorCentavos: 8000, data_vencimento: '2026-10-12' });
const parcela = mov({ id: 'parcela', descricao: 'Financiamento (1/12)', divida_id: 'div-1', data_vencimento: '2026-10-20' });

async function renderLista() {
  render(<MovimentacoesListView />);
  await screen.findByText('Frete Curitiba');
}

// Abre o diálogo de exclusão da linha e devolve os botões dele (o Alert nativo não aparece na árvore).
function abrirMaisOpcoes(descricao: string) {
  const alerta = jest.spyOn(Alert, 'alert');
  fireEvent.press(screen.getByRole('button', { name: `Mais opções: ${descricao}` }));
  return { alerta, botoes: alerta.mock.calls.at(-1)?.[2] ?? [] };
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

describe('MovimentacoesListView — mês (MOV-08, LST-02)', () => {
  it('primeira carga: três skeletons, depois as movimentações do mês atual', async () => {
    render(<MovimentacoesListView />);

    expect(screen.getByLabelText('Carregando movimentações')).toBeOnTheScreen();
    expect(screen.UNSAFE_getAllByType(Skeleton)).toHaveLength(3);
    expect(await screen.findByText('Frete Curitiba')).toBeOnTheScreen();
    expect(screen.getByText('Outubro 2026')).toBeOnTheScreen();
    expect(mockListar).toHaveBeenCalledWith(2026, 10);
  });

  it('o título da tela fica no header nativo, não no conteúdo (NAV-02)', async () => {
    await renderLista();

    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
    expect(screen.queryByText('Movimentações')).not.toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
  });

  it('"Mês anterior" e "Próximo mês" são ícones e trocam o mês (LST-02, AC 12)', async () => {
    await renderLista();

    expect(screen.queryByRole('button', { name: '‹' })).not.toBeOnTheScreen();
    expect(screen.getByTestId('simbolo-chevron_left', { includeHiddenElements: true })).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Mês anterior' })));
    expect(screen.getByText('Setembro 2026')).toBeOnTheScreen();
    expect(mockListar).toHaveBeenLastCalledWith(2026, 9);

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Próximo mês' })));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Próximo mês' })));
    expect(screen.getByText('Novembro 2026')).toBeOnTheScreen();
    expect(mockListar).toHaveBeenLastCalledWith(2026, 11);
  });

  it('dezembro → "Próximo mês" vira janeiro do ano seguinte', async () => {
    jest.setSystemTime(new Date(2026, 11, 20));
    render(<MovimentacoesListView />);
    await screen.findByText('Dezembro 2026');

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Próximo mês' })));

    expect(screen.getByText('Janeiro 2027')).toBeOnTheScreen();
    expect(mockListar).toHaveBeenLastCalledWith(2027, 1);
  });

  it('trocar de mês mostra o skeleton, não as movimentações do mês anterior', async () => {
    await renderLista();
    mockListar.mockReturnValueOnce(new Promise(() => {}));

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Próximo mês' })));

    expect(screen.getByLabelText('Carregando movimentações')).toBeOnTheScreen();
    expect(screen.queryByText('Frete Curitiba')).not.toBeOnTheScreen();
  });

  it('resposta atrasada de um mês anterior não sobrescreve o mês atual', async () => {
    let responderOutubro: (valor: Awaited<ReturnType<typeof listarMovimentacoesDoMes>>) => void = () => undefined;
    mockListar.mockReturnValueOnce(new Promise((resolve) => (responderOutubro = resolve)));
    mockListar.mockResolvedValueOnce({ ok: true, data: [diesel] });
    render(<MovimentacoesListView />);

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Próximo mês' })));
    expect(await screen.findByText('Diesel')).toBeOnTheScreen();

    await act(async () => responderOutubro({ ok: true, data: [frete] }));

    expect(screen.getByText('Novembro 2026')).toBeOnTheScreen();
    expect(screen.queryByText('Frete Curitiba')).not.toBeOnTheScreen();
    expect(screen.getByText('Diesel')).toBeOnTheScreen();
  });

  it('voltar o foco recarrega o mesmo mês sem skeleton', async () => {
    await renderLista();

    await act(async () => {
      mockAoFocar?.();
    });

    expect(mockListar).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText('Carregando movimentações')).not.toBeOnTheScreen();
    expect(screen.getByText('Frete Curitiba')).toBeOnTheScreen();
  });

  it('pull-to-refresh em accent e espaço para o FAB no fim da lista', async () => {
    await renderLista();

    const refresh = screen.UNSAFE_getByType(RefreshControl);
    expect(refresh.props.colors).toEqual([colors.accent]);
    await act(async () => refresh.props.onRefresh());
    expect(mockListar).toHaveBeenCalledTimes(2);

    expect(StyleSheet.flatten(screen.UNSAFE_getByType(FlatList).props.contentContainerStyle)).toMatchObject({
      paddingBottom: FAB_ALTURA_RESERVADA,
    });
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

describe('MovimentacoesListView — linhas e estados (LST-02)', () => {
  it('valor com sinal e cor: "+ R$" em sucesso na entrada, "− R$" em perigo na saída', async () => {
    await renderLista();

    expect(screen.getByText('+ R$ 1.500,00')).toHaveStyle({ color: colors.success });
    expect(screen.getByText('− R$ 80,00')).toHaveStyle({ color: colors.danger });
  });

  it('subtítulo com categoria, data de referência e status; a parcela avisa que é parcela', async () => {
    await renderLista();

    expect(screen.getByText('Frete · 05/10 · Recebido')).toBeOnTheScreen();
    expect(screen.getByText('Combustível · 12/10 · Pendente')).toBeOnTheScreen();
    expect(screen.getByText('Combustível · 20/10 · Pendente · Parcela')).toBeOnTheScreen();
  });

  it('mês vazio mostra o estado vazio, e o FAB continua na tela', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [] });
    render(<MovimentacoesListView />);

    expect(await screen.findByText('Nenhuma movimentação neste mês')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Nova movimentação' }));
    expect(mockPush).toHaveBeenCalledWith('/movimentacoes/nova');
  });

  it('erro mostra "Tentar novamente", que recarrega', async () => {
    mockListar.mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as movimentações. Tente novamente.' });
    render(<MovimentacoesListView />);

    expect(await screen.findByText('Não foi possível carregar as movimentações. Tente novamente.')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' })));
    expect(await screen.findByText('Frete Curitiba')).toBeOnTheScreen();
  });

  it('não existe botão "Editar" nem "Excluir" na linha', async () => {
    await renderLista();

    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeOnTheScreen();
  });
});

describe('MovimentacoesListView — editar e excluir (LST-02)', () => {
  it('tocar na linha abre o formulário da movimentação (inclusive parcela)', async () => {
    await renderLista();

    fireEvent.press(screen.getByRole('button', { name: 'Diesel' }));
    expect(mockPush).toHaveBeenCalledWith('/movimentacoes/diesel/editar');

    fireEvent.press(screen.getByRole('button', { name: 'Financiamento (1/12)' }));
    expect(mockPush).toHaveBeenCalledWith('/movimentacoes/parcela/editar');
  });

  it('"Mais opções" fica fora do botão da linha e abre "Excluir movimentação?"; só apaga ao confirmar', async () => {
    mockExcluir.mockResolvedValue({ ok: true, data: 'diesel' });
    await renderLista();
    const linha = screen.getByRole('button', { name: 'Diesel' });
    expect(within(linha).queryByRole('button', { name: 'Mais opções: Diesel' })).not.toBeOnTheScreen();

    const { alerta, botoes } = abrirMaisOpcoes('Diesel');

    expect(alerta).toHaveBeenCalledWith('Excluir movimentação?', 'Diesel', expect.any(Array));
    expect(botoes.map((botao) => botao.text)).toEqual(['Cancelar', 'Excluir']);
    expect(mockExcluir).not.toHaveBeenCalled();

    await act(async () => botoes.find((botao) => botao.text === 'Excluir')?.onPress?.());

    expect(mockExcluir).toHaveBeenCalledWith('diesel');
    expect(screen.queryByText('Diesel')).not.toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent('Movimentação excluída.');
  });

  it('Cancelar no diálogo mantém a linha', async () => {
    await renderLista();

    const { botoes } = abrirMaisOpcoes('Diesel');
    const cancelar = botoes.find((botao) => botao.text === 'Cancelar');
    expect(cancelar?.style).toBe('cancel');
    cancelar?.onPress?.();

    expect(mockExcluir).not.toHaveBeenCalled();
    expect(screen.getByText('Diesel')).toBeOnTheScreen();
  });

  it('falha ao excluir mostra o erro e mantém a linha', async () => {
    mockExcluir.mockResolvedValue({ ok: false, mensagem: 'Movimentação não encontrada ou não pode ser excluída.' });
    await renderLista();

    const { botoes } = abrirMaisOpcoes('Diesel');
    await act(async () => botoes.find((botao) => botao.text === 'Excluir')?.onPress?.());

    expect(screen.getByRole('alert')).toHaveTextContent('Movimentação não encontrada ou não pode ser excluída.');
    expect(screen.getByText('Diesel')).toBeOnTheScreen();
  });

  it('parcela de dívida não tem "Mais opções"', async () => {
    await renderLista();

    expect(screen.queryByRole('button', { name: 'Mais opções: Financiamento (1/12)' })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mais opções: Diesel' })).toBeOnTheScreen();
  });
});
