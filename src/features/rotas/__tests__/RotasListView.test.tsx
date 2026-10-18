import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import { FAB_ALTURA_RESERVADA, Skeleton, colors } from '@/ui';

import { RotasListView } from '../RotasListView';
import { definirAtivaRota, listarRotas } from '../rotasRepository';
import type { RotaComViagens } from '../types';

// O runner do GitHub Actions é mais lento que a máquina local: o padrão de 5s estourava no CI.
jest.setTimeout(15000);

// Jest hoista jest.mock() acima dos imports/declarações do arquivo: a fábrica só pode
// referenciar variáveis de fora do escopo se o nome começar com "mock" (babel-plugin-jest-hoist).
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

jest.mock('../rotasRepository', () => ({
  listarRotas: jest.fn(),
  definirAtivaRota: jest.fn(),
}));

const mockListar = listarRotas as jest.MockedFunction<typeof listarRotas>;
const mockDefinirAtiva = definirAtivaRota as jest.MockedFunction<typeof definirAtivaRota>;

const curitibaSp: RotaComViagens = {
  id: 'r1',
  cidade_origem: 'Curitiba',
  uf_origem: 'PR',
  cidade_destino: 'São Paulo',
  uf_destino: 'SP',
  distancia_estimada_km: 408,
  ativa: true,
  viagens_finalizadas: 1,
};
const londrinaMaringa: RotaComViagens = {
  id: 'r2',
  cidade_origem: 'Londrina',
  uf_origem: 'PR',
  cidade_destino: 'Maringá',
  uf_destino: 'PR',
  distancia_estimada_km: 98.5,
  ativa: true,
  viagens_finalizadas: 3,
};
const joinvilleFloripa: RotaComViagens = {
  id: 'r3',
  cidade_origem: 'Joinville',
  uf_origem: 'SC',
  cidade_destino: 'Florianópolis',
  uf_destino: 'SC',
  distancia_estimada_km: 1200,
  ativa: false,
  viagens_finalizadas: 0,
};
const rotas = [curitibaSp, londrinaMaringa, joinvilleFloripa];

const TITULO_CURITIBA = 'Curitiba/PR → São Paulo/SP';
const TITULO_LONDRINA = 'Londrina/PR → Maringá/PR';
const TITULO_JOINVILLE = 'Joinville/SC → Florianópolis/SC';

beforeEach(() => {
  mockPush.mockReset();
  mockListar.mockReset();
  mockDefinirAtiva.mockReset();
});

async function renderComLista() {
  mockListar.mockResolvedValue({ ok: true, data: rotas });
  render(<RotasListView />);
  await screen.findByText(TITULO_CURITIBA);
}

describe('RotasListView — carga', () => {
  // ROTA-25
  it('primeira carga: três skeletons, depois a lista', async () => {
    mockListar.mockResolvedValue({ ok: true, data: rotas });
    render(<RotasListView />);

    expect(screen.getByLabelText('Carregando rotas')).toBeOnTheScreen();
    expect(screen.UNSAFE_getAllByType(Skeleton)).toHaveLength(3);

    expect(await screen.findByText(TITULO_CURITIBA)).toBeOnTheScreen();
    expect(screen.getByText(TITULO_LONDRINA)).toBeOnTheScreen();
  });

  // ROTA-17, ROTA-30
  it('título com cidade/UF e subtítulo com km e viagens finalizadas, no singular quando é 1', async () => {
    await renderComLista();

    expect(screen.getByText('408 km · 1 viagem finalizada')).toBeOnTheScreen();
    expect(screen.getByText('98,5 km · 3 viagens finalizadas')).toBeOnTheScreen();
  });

  it('voltar o foco recarrega sem skeleton e mostra a rota nova', async () => {
    await renderComLista();
    const nova: RotaComViagens = { ...curitibaSp, id: 'r4', cidade_destino: 'Campinas', viagens_finalizadas: 0 };
    mockListar.mockResolvedValue({ ok: true, data: [...rotas, nova] });

    await act(async () => {
      mockAoFocar?.();
    });

    expect(screen.queryByLabelText('Carregando rotas')).not.toBeOnTheScreen();
    expect(screen.getByText('Curitiba/PR → Campinas/SP')).toBeOnTheScreen();
  });

  it('pull-to-refresh com o indicador em accent busca de novo', async () => {
    await renderComLista();

    const refresh = screen.UNSAFE_getByType(RefreshControl);
    expect(refresh.props.colors).toEqual([colors.accent]);
    expect(refresh.props.tintColor).toBe(colors.accent);

    await act(async () => refresh.props.onRefresh());
    expect(mockListar).toHaveBeenCalledTimes(2);
  });

  it('a lista reserva o espaço do FAB no fim', async () => {
    await renderComLista();

    expect(StyleSheet.flatten(screen.UNSAFE_getByType(FlatList).props.contentContainerStyle)).toMatchObject({
      paddingBottom: FAB_ALTURA_RESERVADA,
    });
  });

  // ROTA-26
  it('estado de erro mostra a mensagem em português e "Tentar novamente" recarrega', async () => {
    mockListar
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as rotas. Tente novamente.' })
      .mockResolvedValueOnce({ ok: true, data: rotas });
    render(<RotasListView />);

    expect(await screen.findByText('Não foi possível carregar')).toBeOnTheScreen();
    expect(screen.getByText('Não foi possível carregar as rotas. Tente novamente.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText(TITULO_CURITIBA)).toBeOnTheScreen();
  });

  // ROTA-27
  it('sem rota cadastrada mostra "Nenhuma rota cadastrada"', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [] });
    render(<RotasListView />);

    expect(await screen.findByText('Nenhuma rota cadastrada')).toBeOnTheScreen();
  });
});

describe('RotasListView — linha', () => {
  // ROTA-23
  it('tocar na linha abre a edição da rota certa', async () => {
    await renderComLista();

    fireEvent.press(screen.getByRole('button', { name: TITULO_LONDRINA }));

    expect(mockPush).toHaveBeenCalledWith('/rotas/r2/editar');
  });

  // ROTA-21
  it('switch "Ativa" inativa, fica desabilitado enquanto salva e mostra "Rota inativada."', async () => {
    let concluir: (valor: Awaited<ReturnType<typeof definirAtivaRota>>) => void = () => undefined;
    mockDefinirAtiva.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    await renderComLista();

    fireEvent(screen.getByRole('switch', { name: `Ativa: ${TITULO_LONDRINA}` }), 'valueChange', false);

    expect(mockDefinirAtiva).toHaveBeenCalledWith('r2', false);
    expect(screen.getByRole('switch', { name: `Ativa: ${TITULO_LONDRINA}` })).toBeDisabled();

    const { viagens_finalizadas: _contagem, ...rota } = londrinaMaringa;
    await act(async () => concluir({ ok: true, data: { ...rota, ativa: false } }));

    expect(screen.getByRole('alert')).toHaveTextContent('Rota inativada.');
    // Com "Mostrar inativas" desligado, a rota sai da lista.
    expect(screen.queryByText(TITULO_LONDRINA)).not.toBeOnTheScreen();
  });

  // ROTA-22
  it('switch "Ativa" reativa uma rota inativa, mostra "Rota reativada." e mantém a contagem', async () => {
    const { viagens_finalizadas: _contagem, ...rota } = joinvilleFloripa;
    mockDefinirAtiva.mockResolvedValue({ ok: true, data: { ...rota, ativa: true } });
    await renderComLista();
    fireEvent(screen.getByRole('switch', { name: 'Mostrar inativas' }), 'valueChange', true);

    await act(async () =>
      fireEvent(screen.getByRole('switch', { name: `Ativa: ${TITULO_JOINVILLE}` }), 'valueChange', true),
    );

    expect(mockDefinirAtiva).toHaveBeenCalledWith('r3', true);
    expect(screen.getByRole('alert')).toHaveTextContent('Rota reativada.');
    expect(screen.getByRole('switch', { name: `Ativa: ${TITULO_JOINVILLE}` })).toBeChecked();
    expect(screen.getByText('1.200 km · 0 viagens finalizadas')).toBeOnTheScreen();
  });

  it('erro ao inativar mostra o Snackbar de erro e mantém a rota ativa', async () => {
    mockDefinirAtiva.mockResolvedValue({ ok: false, mensagem: 'Acesso negado. Seu perfil não tem permissão para esta ação.' });
    await renderComLista();

    await act(async () =>
      fireEvent(screen.getByRole('switch', { name: `Ativa: ${TITULO_CURITIBA}` }), 'valueChange', false),
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Acesso negado. Seu perfil não tem permissão para esta ação.');
    expect(screen.getByRole('switch', { name: `Ativa: ${TITULO_CURITIBA}` })).toBeChecked();
  });

  it('o switch fica fora do botão da linha: o leitor de tela alcança os dois', async () => {
    await renderComLista();

    expect(within(screen.getByRole('button', { name: TITULO_CURITIBA })).queryByRole('switch')).not.toBeOnTheScreen();
  });
});

describe('RotasListView — filtros e FAB', () => {
  // ROTA-20
  it('esconde as inativas por padrão; com o filtro, aparecem marcadas como inativas', async () => {
    await renderComLista();
    expect(screen.queryByText(TITULO_JOINVILLE)).not.toBeOnTheScreen();

    fireEvent(screen.getByRole('switch', { name: 'Mostrar inativas' }), 'valueChange', true);

    expect(screen.getByText(TITULO_JOINVILLE)).toBeOnTheScreen();
    expect(screen.getByText('1.200 km · 0 viagens finalizadas · Inativa')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: `Ativa: ${TITULO_JOINVILLE}` })).not.toBeChecked();
  });

  // ROTA-19
  it('busca pela cidade de destino ignorando acento e maiúscula', async () => {
    await renderComLista();

    fireEvent.changeText(screen.getByLabelText('Buscar'), ' SAO ');

    expect(screen.getByText(TITULO_CURITIBA)).toBeOnTheScreen();
    expect(screen.queryByText(TITULO_LONDRINA)).not.toBeOnTheScreen();
  });

  it('busca também pela cidade de origem e acha nome digitado sem acento', async () => {
    await renderComLista();

    fireEvent.changeText(screen.getByLabelText('Buscar'), 'londrina');
    expect(screen.getByText(TITULO_LONDRINA)).toBeOnTheScreen();
    expect(screen.queryByText(TITULO_CURITIBA)).not.toBeOnTheScreen();

    fireEvent.changeText(screen.getByLabelText('Buscar'), 'maringa');
    expect(screen.getByText(TITULO_LONDRINA)).toBeOnTheScreen();
  });

  // ROTA-27
  it('busca sem resultado mostra "Nenhuma rota encontrada"', async () => {
    await renderComLista();

    fireEvent.changeText(screen.getByLabelText('Buscar'), 'Manaus');

    expect(screen.getByText('Nenhuma rota encontrada')).toBeOnTheScreen();
    expect(screen.queryByText('Nenhuma rota cadastrada')).not.toBeOnTheScreen();
  });

  // ROTA-24
  it('o FAB "Nova rota" abre o cadastro', async () => {
    await renderComLista();

    fireEvent.press(screen.getByRole('button', { name: 'Nova rota' }));

    expect(mockPush).toHaveBeenCalledWith('/rotas/nova');
  });
});
