import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions } from 'react-native';

import { segurarPrimeiraCarga } from '@/testing/eventos';
import { porTipo, todosPorTipo } from '@/testing/componentes';
import { FAB_ALTURA_RESERVADA, Skeleton, colors, spacing } from '@/ui';

import { RotasListView } from '../RotasListView';
import { listarRotas } from '../rotasRepository';
import type { RotaComViagens } from '../types';

// Largura da janela controlada pelo teste: 412 é celular, 800 é tablet (EIX-94).
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 900, scale: 1, fontScale: 1 })),
}));

function mockLargura(width: number) {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

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
}));

const mockListar = listarRotas as jest.MockedFunction<typeof listarRotas>;

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

const TITULO_CURITIBA = 'Curitiba → São Paulo';
const TITULO_LONDRINA = 'Londrina → Maringá';
const TITULO_JOINVILLE = 'Joinville → Florianópolis';

beforeEach(() => {
  mockPush.mockReset();
  mockListar.mockReset();
});

async function renderComLista() {
  mockListar.mockResolvedValue({ ok: true, data: rotas });
  await render(<RotasListView />);
  await screen.findByText(TITULO_CURITIBA);
}

describe('RotasListView — carga', () => {
  // ROTA-25
  it('primeira carga: três skeletons, depois a lista', async () => {
    mockListar.mockResolvedValue({ ok: true, data: rotas });
    // Segura a primeira carga: o render async esperaria a resposta e pularia o "carregando".
    const liberarCarga = segurarPrimeiraCarga(mockListar);
    await render(<RotasListView />);

    expect(screen.getByLabelText('Carregando rotas')).toBeOnTheScreen();
    expect(todosPorTipo(Skeleton)).toHaveLength(3);

    await liberarCarga();
    expect(await screen.findByText(TITULO_CURITIBA)).toBeOnTheScreen();
    expect(screen.getByText(TITULO_LONDRINA)).toBeOnTheScreen();
  });

  // ROTA-17, ROTA-30
  it('título só com as cidades; a UF vai no subtítulo, com km e viagens finalizadas (singular quando é 1)', async () => {
    await renderComLista();

    expect(screen.getByRole('button', { name: TITULO_CURITIBA })).toBeOnTheScreen();
    expect(screen.getByText('PR → SP · 408 km · 1 viagem finalizada')).toBeOnTheScreen();
    expect(screen.getByText('PR → PR · 98,5 km · 3 viagens finalizadas')).toBeOnTheScreen();
  });

  it('voltar o foco recarrega sem skeleton e mostra a rota nova', async () => {
    await renderComLista();
    const nova: RotaComViagens = { ...curitibaSp, id: 'r4', cidade_destino: 'Campinas', viagens_finalizadas: 0 };
    mockListar.mockResolvedValue({ ok: true, data: [...rotas, nova] });

    await act(async () => {
      mockAoFocar?.();
    });

    expect(screen.queryByLabelText('Carregando rotas')).not.toBeOnTheScreen();
    expect(screen.getByText('Curitiba → Campinas')).toBeOnTheScreen();
  });

  it('pull-to-refresh com o indicador em accentStrong busca de novo', async () => {
    await renderComLista();

    const refresh = porTipo(RefreshControl);
    expect(refresh.props.colors).toEqual([colors.accentStrong]);
    expect(refresh.props.tintColor).toBe(colors.accentStrong);

    await act(async () => refresh.props.onRefresh!());
    expect(mockListar).toHaveBeenCalledTimes(2);
  });

  it('a lista reserva o espaço do FAB no fim', async () => {
    await renderComLista();

    expect(StyleSheet.flatten(porTipo(FlatList).props.contentContainerStyle)).toMatchObject({
      paddingBottom: FAB_ALTURA_RESERVADA,
    });
  });

  it('sem a barra de rolagem vertical, que no Android ficava por cima das setas das linhas', async () => {
    await renderComLista();

    expect(porTipo(FlatList).props.showsVerticalScrollIndicator).toBe(false);
  });

  // ROTA-26
  it('estado de erro mostra a mensagem em português e "Tentar novamente" recarrega', async () => {
    mockListar
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as rotas. Tente novamente.' })
      .mockResolvedValueOnce({ ok: true, data: rotas });
    await render(<RotasListView />);

    expect(await screen.findByText('Não foi possível carregar')).toBeOnTheScreen();
    expect(screen.getByText('Não foi possível carregar as rotas. Tente novamente.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText(TITULO_CURITIBA)).toBeOnTheScreen();
  });

  // ROTA-27
  it('sem rota cadastrada mostra "Nenhuma rota cadastrada"', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [] });
    await render(<RotasListView />);

    expect(await screen.findByText('Nenhuma rota cadastrada')).toBeOnTheScreen();
  });
});

describe('RotasListView — linha', () => {
  // ROTA-23
  it('tocar na linha abre a edição da rota certa', async () => {
    await renderComLista();

    await fireEvent.press(screen.getByRole('button', { name: TITULO_LONDRINA }));

    expect(mockPush).toHaveBeenCalledWith('/rotas/r2/editar');
  });

  // ROTA-21/22: desativar e reativar moram no Editar (RotaFormView), igual em Categorias, Formas de
  // pagamento e Veículos. A linha não tem switch nem botão de ação.
  it('a linha não tem switch nem botão de ação: desativar fica no Editar', async () => {
    await renderComLista();

    expect(screen.queryByRole('switch')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^(Editar|Desativar|Reativar|Mais opções)/ })).not.toBeOnTheScreen();
  });
});

describe('RotasListView — desativadas, busca e FAB', () => {
  // ROTA-20
  it('as ativas vêm num grupo com a contagem e não há mais o "Mostrar inativas"', async () => {
    await renderComLista();

    expect(screen.getByText('Ativas · 2')).toBeOnTheScreen();
    expect(screen.queryByRole('switch', { name: 'Mostrar inativas' })).not.toBeOnTheScreen();
  });

  it('desativadas ficam recolhidas no fim, com o trecho ao lado; ao abrir, a linha leva ao Editar', async () => {
    await renderComLista();

    const cabecalho = screen.getByRole('button', { name: 'Desativadas, 1' });
    expect(cabecalho).toBeCollapsed();
    expect(screen.getByText(TITULO_JOINVILLE)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: TITULO_JOINVILLE })).not.toBeOnTheScreen();

    await fireEvent.press(cabecalho);

    // Aberta, a linha mostra o mesmo subtítulo das ativas, sem "Inativa" repetido: o grupo já diz.
    expect(screen.getByText('SC → SC · 1.200 km · 0 viagens finalizadas')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: TITULO_JOINVILLE }));
    expect(mockPush).toHaveBeenCalledWith('/rotas/r3/editar');
  });

  // ROTA-19
  it('busca pela cidade de destino ignorando acento e maiúscula', async () => {
    await renderComLista();

    await fireEvent.changeText(screen.getByLabelText('Buscar por cidade'), ' SAO ');

    expect(screen.getByText(TITULO_CURITIBA)).toBeOnTheScreen();
    expect(screen.queryByText(TITULO_LONDRINA)).not.toBeOnTheScreen();
  });

  it('busca também pela cidade de origem e acha nome digitado sem acento', async () => {
    await renderComLista();

    await fireEvent.changeText(screen.getByLabelText('Buscar por cidade'), 'londrina');
    expect(screen.getByText(TITULO_LONDRINA)).toBeOnTheScreen();
    expect(screen.queryByText(TITULO_CURITIBA)).not.toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Buscar por cidade'), 'maringa');
    expect(screen.getByText(TITULO_LONDRINA)).toBeOnTheScreen();
  });

  // ROTA-27
  it('busca sem resultado mostra "Nenhuma rota encontrada"', async () => {
    await renderComLista();

    await fireEvent.changeText(screen.getByLabelText('Buscar por cidade'), 'Manaus');

    expect(screen.getByText('Nenhuma rota encontrada')).toBeOnTheScreen();
    expect(screen.queryByText('Nenhuma rota cadastrada')).not.toBeOnTheScreen();
  });

  // ROTA-24
  it('o FAB "Nova rota" abre o cadastro', async () => {
    await renderComLista();

    await fireEvent.press(screen.getByRole('button', { name: 'Nova rota' }));

    expect(mockPush).toHaveBeenCalledWith('/rotas/nova');
  });
});

describe('RotasListView — tablet (EIX-94)', () => {
  afterEach(() => mockLargura(412));

  function estiloDoConteudo() {
    return StyleSheet.flatten(screen.getByTestId('screen-conteudo').props.style);
  }

  function estiloDaLista() {
    return StyleSheet.flatten(porTipo(FlatList).props.contentContainerStyle);
  }

  it('412: nada muda, o respiro lateral continua no Screen e a lista não ganha coluna', async () => {
    await renderComLista();

    expect(estiloDoConteudo()).toMatchObject({ paddingHorizontal: spacing.base });
    expect(estiloDaLista()?.maxWidth).toBeUndefined();
  });

  it('800: a lista rola na largura toda e o conteúdo fica na coluna de 720', async () => {
    mockLargura(800);
    await renderComLista();

    expect(estiloDoConteudo().maxWidth).toBeUndefined();
    expect(estiloDoConteudo().paddingHorizontal).toBeUndefined();
    expect(estiloDaLista()).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
    const coluna = screen.getByTestId('screen-coluna');
    expect(StyleSheet.flatten(coluna.props.style)).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
    expect(within(coluna).getByLabelText('Buscar por cidade')).toBeOnTheScreen();
  });
});
