import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Alert, FlatList, RefreshControl, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { buscarFluxoMensal } from '@/features/dashboard/graficos/queries';
import { FAB_ALTURA_RESERVADA, ListItem, Skeleton, colors, spacing } from '@/ui';

import { MovimentacoesListView } from '../MovimentacoesListView';
import { excluirMovimentacao, listarMovimentacoesDoMes } from '../movimentacoesRepository';
import type { Movimentacao } from '../types';

jest.setTimeout(15000);

const mockPush = jest.fn();
// Guarda os callbacks de foco (lista e resumo) para o teste simular "voltei para esta tela".
let mockFocos: (() => void)[] = [];
let mockAoFocar: (() => void) | null = null;

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  // Mesmo objeto em todo render, como o useRouter real (devolve o router global do expo-router).
  // Um objeto novo por render mudaria os callbacks das linhas e desfaria o memo (EIX-71).
  const roteador = { push: (...args: unknown[]) => mockPush(...args) };
  return {
    useRouter: () => roteador,
    useFocusEffect: (callback: () => void) => {
      mockFocos.push(callback);
      mockAoFocar = () => new Set(mockFocos).forEach((aoFocar) => aoFocar());
      react.useEffect(callback, [callback]);
    },
  };
});

// O requireActual abaixo carrega o client real; no Node 20 do CI (sem WebSocket nativo)
// o createClient quebra ao montar o Realtime. Nenhum teste aqui fala com o banco.
jest.mock('@/supabase/client', () => ({ supabase: {} }));

// O resumo do mês vem do RPC fluxo_caixa_mensal; aqui, um valor pronto.
jest.mock('@/features/dashboard/graficos/queries', () => ({ buscarFluxoMensal: jest.fn() }));

jest.mock('../movimentacoesRepository', () => ({
  ...jest.requireActual('../movimentacoesRepository'),
  listarMovimentacoesDoMes: jest.fn(),
  excluirMovimentacao: jest.fn(),
}));

// O ListItem real, só embrulhado num jest.fn: o teste de memo (EIX-71) conta quantas vezes ele renderiza.
jest.mock('@/ui', () => {
  const real = jest.requireActual('@/ui');
  return { ...real, ListItem: jest.fn(real.ListItem) };
});

// Largura da janela controlada pelo teste: 412 é celular, 800 é tablet (EIX-94).
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 900, scale: 1, fontScale: 1 })),
}));

function mockLargura(width: number) {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

const mockListar = listarMovimentacoesDoMes as jest.MockedFunction<typeof listarMovimentacoesDoMes>;
const mockExcluir = excluirMovimentacao as jest.MockedFunction<typeof excluirMovimentacao>;
const mockFluxo = jest.mocked(buscarFluxoMensal);

// Abre o chip ("Mês", "Tipo", "Status") e toca na opção da folha.
async function escolher(filtro: string, opcao: string) {
  await act(async () => fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${filtro}: `) })));
  await act(async () => fireEvent.press(screen.getByRole('button', { name: opcao })));
}

function mov(sobrescrever: Partial<Movimentacao>): Movimentacao {
  return {
    id: 'id',
    valorCentavos: 100,
    descricao: 'Descrição',
    categoria_id: 'cat',
    forma_pagamento_id: 'fp',
    divida_id: null,
    viagem_id: null,
    litros: null,
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
  mockFocos = [];
  mockPush.mockReset();
  mockListar.mockReset();
  mockExcluir.mockReset();
  mockListar.mockResolvedValue({ ok: true, data: [frete, diesel, parcela] });
  mockFluxo.mockReset().mockResolvedValue({
    ok: true,
    data: [
      { mes: '2026-08', entradas_centavos: 0, saidas_centavos: 0 },
      { mes: '2026-09', entradas_centavos: 0, saidas_centavos: 0 },
      { mes: '2026-10', entradas_centavos: 150000, saidas_centavos: 8000 },
    ],
  });
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

  it('o mês é um chip: abre os meses e troca a consulta (LST-02, AC 12)', async () => {
    await renderLista();

    expect(screen.getByRole('button', { name: 'Mês: Outubro 2026' })).toBeOnTheScreen();

    await escolher('Mês', 'Setembro 2026');
    expect(screen.getByText('Setembro 2026')).toBeOnTheScreen();
    expect(mockListar).toHaveBeenLastCalledWith(2026, 9);
  });

  it('o seletor vai de um ano atrás até três meses à frente, virando o ano', async () => {
    jest.setSystemTime(new Date(2026, 11, 20));
    render(<MovimentacoesListView />);
    await screen.findByText('Dezembro 2026');

    await escolher('Mês', 'Janeiro 2027');

    expect(mockListar).toHaveBeenLastCalledWith(2027, 1);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: /^Mês: / })));
    // A folha é uma FlatList virtualizada: as opções são conferidas pelos dados, não pelo que já renderizou.
    const folha = screen.UNSAFE_getAllByType(FlatList).find((lista) => lista.props.data[0]?.label === 'Março 2027');
    const meses = folha?.props.data.map((opcao: { label: string }) => opcao.label);
    expect(meses).toHaveLength(16);
    expect(meses.at(-1)).toBe('Dezembro 2025');
    expect(meses).not.toContain('Abril 2027');
  });

  it('trocar de mês mostra o skeleton, não as movimentações do mês anterior', async () => {
    await renderLista();
    mockListar.mockReturnValueOnce(new Promise(() => {}));

    await escolher('Mês', 'Novembro 2026');

    expect(screen.getByLabelText('Carregando movimentações')).toBeOnTheScreen();
    expect(screen.queryByText('Frete Curitiba')).not.toBeOnTheScreen();
  });

  it('resposta atrasada de um mês anterior não sobrescreve o mês atual', async () => {
    let responderOutubro: (valor: Awaited<ReturnType<typeof listarMovimentacoesDoMes>>) => void = () => undefined;
    mockListar.mockReturnValueOnce(new Promise((resolve) => (responderOutubro = resolve)));
    mockListar.mockResolvedValueOnce({ ok: true, data: [diesel] });
    render(<MovimentacoesListView />);

    await escolher('Mês', 'Novembro 2026');
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

  it('pull-to-refresh em accentStrong e espaço para o FAB no fim da lista', async () => {
    await renderLista();

    const refresh = screen.UNSAFE_getByType(RefreshControl);
    expect(refresh.props.colors).toEqual([colors.accentStrong]);
    await act(async () => refresh.props.onRefresh());
    expect(mockListar).toHaveBeenCalledTimes(2);

    expect(StyleSheet.flatten(screen.UNSAFE_getByType(FlatList).props.contentContainerStyle)).toMatchObject({
      paddingBottom: FAB_ALTURA_RESERVADA,
    });
  });
});

describe('MovimentacoesListView — filtros (MOV-08)', () => {
  it('chip Tipo: Entradas mostra só categoria de entrada; Saídas só de saída', async () => {
    await renderLista();

    expect(screen.getByRole('button', { name: 'Tipo: Todas' })).toBeOnTheScreen();
    await escolher('Tipo', 'Entradas');
    expect(screen.getByRole('button', { name: 'Tipo: Entradas' })).toBeOnTheScreen();
    expect(screen.getByText('Frete Curitiba')).toBeOnTheScreen();
    expect(screen.queryByText('Diesel')).not.toBeOnTheScreen();

    await escolher('Tipo', 'Saídas');
    expect(screen.queryByText('Frete Curitiba')).not.toBeOnTheScreen();
    expect(screen.getByText('Diesel')).toBeOnTheScreen();
  });

  it('chip Status: Pendentes e Pagos filtram pelo status', async () => {
    await renderLista();

    await escolher('Status', 'Pagos');
    expect(screen.getByText('Frete Curitiba')).toBeOnTheScreen();
    expect(screen.queryByText('Diesel')).not.toBeOnTheScreen();

    await escolher('Status', 'Pendentes');
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

  it('subtítulo com categoria e status (a data está no cabeçalho do dia); a parcela avisa que é parcela', async () => {
    await renderLista();

    expect(screen.getByText('Frete · Recebido')).toBeOnTheScreen();
    expect(screen.getByText('Combustível · Pendente')).toBeOnTheScreen();
    expect(screen.getByText('Combustível · Pendente · Parcela')).toBeOnTheScreen();
  });

  it('agrupa por dia, do mais recente ao mais antigo, com o cabeçalho do dia (hoje = 15/10)', async () => {
    await renderLista();

    const cabecalhos = screen.getAllByRole('header').map((cabecalho) => cabecalho.props.children);
    expect(cabecalhos).toEqual(['Terça, 20 de outubro', 'Segunda, 12 de outubro', 'Segunda, 5 de outubro']);
  });

  it('resumo do mês: pago em entradas menos saídas, com os dois totais vindos do banco', async () => {
    await renderLista();

    expect(mockFluxo).toHaveBeenCalledWith('2026-10-01', 3);
    expect(screen.getByText('Pago em outubro')).toBeOnTheScreen();
    expect(screen.getByText('+ R$ 1.420,00')).toBeOnTheScreen();
    expect(screen.getByText('+ R$ 1.500,00 em entradas · − R$ 80,00 em saídas')).toBeOnTheScreen();
  });

  it('resumo acompanha o Tipo: Entradas mostra o recebido; Saídas, o pago', async () => {
    await renderLista();

    await escolher('Tipo', 'Entradas');
    expect(screen.getByText('Recebido em outubro')).toBeOnTheScreen();
    // O mesmo valor aparece no cartão e na linha do frete, a única entrada do mês.
    expect(screen.getAllByText('+ R$ 1.500,00')).toHaveLength(2);
    expect(screen.queryByText(/em entradas ·/)).not.toBeOnTheScreen();

    await escolher('Tipo', 'Saídas');
    expect(screen.getByText('Pago em outubro')).toBeOnTheScreen();
    // No cartão (só as saídas pagas do mês) e na linha do Diesel.
    expect(screen.getAllByText('− R$ 80,00')).toHaveLength(2);
  });

  it('com Status "Pendentes" o cartão some: ele falaria de "pago" ao lado do que não foi pago', async () => {
    await renderLista();

    await escolher('Status', 'Pendentes');
    expect(screen.queryByText('Pago em outubro')).not.toBeOnTheScreen();

    await escolher('Status', 'Pagos');
    expect(screen.getByText('Pago em outubro')).toBeOnTheScreen();
  });

  it('o cartão diz que conta pelo dia do pagamento (a lista agrupa pelo vencimento)', async () => {
    await renderLista();

    expect(screen.getByText('Pelo dia do pagamento.')).toBeOnTheScreen();
  });

  it('se o resumo falhar, a lista continua na tela, só sem o cartão', async () => {
    mockFluxo.mockResolvedValue({ ok: false, mensagem: 'Sem conexão.' });
    await renderLista();

    expect(screen.queryByText('Pago em outubro')).not.toBeOnTheScreen();
    expect(screen.getByText('Diesel')).toBeOnTheScreen();
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

  it('a tela re-renderizar (Snackbar de erro) não re-renderiza as linhas: elas são memoizadas (EIX-71)', async () => {
    mockExcluir.mockResolvedValue({ ok: false, mensagem: 'Sem conexão.' });
    await renderLista();
    const { botoes } = abrirMaisOpcoes('Diesel');
    const rendersAntes = jest.mocked(ListItem).mock.calls.length;

    await act(async () => botoes.find((botao) => botao.text === 'Excluir')?.onPress?.());

    // A tela mudou (o Snackbar apareceu), mas nenhuma movimentação mudou: nenhuma linha renderiza de novo.
    expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão.');
    expect(jest.mocked(ListItem).mock.calls.length).toBe(rendersAntes);
  });

  it('parcela de dívida não tem "Mais opções"', async () => {
    await renderLista();

    expect(screen.queryByRole('button', { name: 'Mais opções: Financiamento (1/12)' })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mais opções: Diesel' })).toBeOnTheScreen();
  });
});

describe('MovimentacoesListView — tablet (EIX-94)', () => {
  afterEach(() => mockLargura(412));

  function estiloDoConteudo() {
    return StyleSheet.flatten(screen.getByTestId('screen-conteudo').props.style);
  }

  function estiloDaLista() {
    return StyleSheet.flatten(screen.UNSAFE_getByType(FlatList).props.contentContainerStyle);
  }

  it('412: nada muda, o respiro lateral continua no Screen e a lista não ganha coluna', async () => {
    await renderLista();

    expect(estiloDoConteudo()).toMatchObject({ paddingHorizontal: spacing.base });
    expect(estiloDaLista().maxWidth).toBeUndefined();
  });

  it('800: a lista rola na largura toda; filtros e linhas ficam na mesma coluna de 720', async () => {
    mockLargura(800);
    await renderLista();

    expect(estiloDoConteudo().maxWidth).toBeUndefined();
    expect(estiloDoConteudo().paddingHorizontal).toBeUndefined();
    expect(estiloDaLista()).toMatchObject({ maxWidth: 720, alignSelf: 'center', paddingBottom: FAB_ALTURA_RESERVADA });

    const coluna = screen.getByTestId('screen-coluna');
    expect(StyleSheet.flatten(coluna.props.style)).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
    expect(within(coluna).getByRole('button', { name: 'Mês: Outubro 2026' })).toBeOnTheScreen();
    expect(within(coluna).getByRole('button', { name: 'Tipo: Todas' })).toBeOnTheScreen();
  });

  it('celular → tablet com a tela aberta: o filtro escolhido continua valendo e a lista ganha a coluna', async () => {
    const { rerender } = render(<MovimentacoesListView />);
    await screen.findByText('Frete Curitiba');
    await escolher('Tipo', 'Saídas');

    mockLargura(800);
    rerender(<MovimentacoesListView />);

    expect(estiloDaLista()).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
    expect(screen.queryByText('Frete Curitiba')).not.toBeOnTheScreen();
    expect(screen.getByText('Diesel')).toBeOnTheScreen();
  });
});
