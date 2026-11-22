import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import type { EstatisticaRota, EstatisticaVeiculo } from '@/features/bi/queries';
import { useMenu } from '@/navigation/menu';

import { mesAtual } from '../../periodo';
import { buscarRanking, ranquear, type Ranking } from '../ranking';
import { RankingView } from '../RankingView';

// O runner do GitHub Actions é mais lento que a máquina local: o padrão de 5s estourava no CI.
jest.setTimeout(15000);

const mockPush = jest.fn();

// Jest hoista jest.mock() acima dos imports: a fábrica só pode usar variáveis com prefixo "mock".
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]),
  };
});

jest.mock('@/navigation/menu', () => ({ useMenu: jest.fn() }));

// `ranquear` real: os testes de empate e de menos de 3 itens passam pela regra de verdade.
jest.mock('../ranking', () => ({
  ...jest.requireActual('../ranking'),
  buscarRanking: jest.fn(),
}));

const mockBuscar = buscarRanking as jest.MockedFunction<typeof buscarRanking>;

function rota(id: string, origem: string, lucro: number, quantidade = 2): EstatisticaRota {
  return {
    rota_id: id,
    cidade_origem: origem,
    uf_origem: 'PR',
    cidade_destino: 'São Paulo',
    uf_destino: 'SP',
    quantidade_viagens: quantidade,
    km_total: 816.5,
    receita_centavos: lucro,
    despesa_centavos: 0,
    lucro_centavos: lucro,
    custo_por_km_centavos: 0,
    mais_lucrativa: false,
    maior_custo: false,
  };
}

function veiculo(id: string, placa: string, custoPorKm: number): EstatisticaVeiculo {
  return {
    veiculo_id: id,
    placa,
    marca: 'Volvo',
    modelo: 'FH 540',
    quantidade_viagens: 1,
    km_total: 400,
    despesa_centavos: 0,
    custo_por_km_centavos: custoPorKm,
  };
}

function montarRanking(
  rotas: EstatisticaRota[],
  veiculos: EstatisticaVeiculo[],
  motivos: Pick<Ranking, 'rotasSemLucro' | 'veiculosSemKm'> = { rotasSemLucro: false, veiculosSemKm: false },
): Ranking {
  return {
    rotasMaisLucrativas: ranquear(rotas, (r) => r.lucro_centavos),
    veiculosMaiorCustoPorKm: ranquear(veiculos, (v) => v.custo_por_km_centavos ?? 0),
    ...motivos,
  };
}

function responder(ranking: Ranking) {
  mockBuscar.mockResolvedValue({ ok: true, data: ranking });
}

const RANKING_COMPLETO = montarRanking(
  [rota('r1', 'Curitiba', 133457), rota('r2', 'Londrina', 90000), rota('r3', 'Maringá', 50000, 1)],
  [veiculo('v1', 'ABC1D23', 250), veiculo('v2', 'XYZ9K87', 133), veiculo('v3', 'QWE4R56', 98)],
);

function usarPerfil(podeVerFrota: boolean) {
  jest.mocked(useMenu).mockReturnValue({
    abas: [],
    abaInicial: 'dashboards',
    podeVerCategorias: true,
    podeVerFrota,
    podeVerViagens: podeVerFrota,
    podeVerUsuarios: false,
  });
}

async function abrirVeiculos() {
  fireEvent.press(screen.getByRole('tab', { name: 'Veículos' }));
  await screen.findByText('Top 3 veículos com maior custo por KM');
}

describe('RankingView', () => {
  beforeEach(() => {
    mockBuscar.mockReset();
    mockPush.mockReset();
    usarPerfil(true);
  });

  it('carregando: mostra o skeleton enquanto o ranking não chega', () => {
    mockBuscar.mockReturnValue(new Promise(() => undefined));

    render(<RankingView />);

    expect(screen.getByLabelText('Carregando ranking')).toBeOnTheScreen();
  });

  it('reutiliza o FiltroPeriodo e consulta o mês atual ao abrir', async () => {
    responder(RANKING_COMPLETO);

    render(<RankingView />);
    await screen.findByText('Top 3 rotas mais lucrativas');

    expect(screen.getByRole('tab', { name: 'Mês' })).toBeSelected();
    const { dataInicial, dataFinal } = mesAtual();
    expect(mockBuscar).toHaveBeenCalledWith({ dataInicial, dataFinal });
  });

  it('rotas: lista o Top 3 com posição, trecho e lucro em R$', async () => {
    responder(RANKING_COMPLETO);

    render(<RankingView />);
    const secao = await screen.findByText('Top 3 rotas mais lucrativas');

    expect(secao).toBeOnTheScreen();
    expect(screen.getByText('1º')).toBeOnTheScreen();
    expect(screen.getByText('2º')).toBeOnTheScreen();
    expect(screen.getByText('3º')).toBeOnTheScreen();
    expect(screen.getByText('Curitiba/PR → São Paulo/SP')).toBeOnTheScreen();
    expect(screen.getByText('R$ 1.334,57')).toBeOnTheScreen();
    expect(screen.getAllByText('2 viagens · 816,5 km')).toHaveLength(2);
    expect(screen.getByText('1 viagem · 816,5 km')).toBeOnTheScreen();
    expect(screen.getAllByText('Lucro')).toHaveLength(3);
  });

  it('alterna para veículos: Top 3 com placa e custo em R$/km, sem consultar de novo', async () => {
    responder(RANKING_COMPLETO);

    render(<RankingView />);
    await screen.findByText('Top 3 rotas mais lucrativas');
    await abrirVeiculos();

    expect(screen.getByRole('tab', { name: 'Veículos' })).toBeSelected();
    expect(screen.getByText('ABC1D23')).toBeOnTheScreen();
    expect(screen.getByText('R$ 2,50/km')).toBeOnTheScreen();
    expect(screen.getByText('R$ 0,98/km')).toBeOnTheScreen();
    expect(screen.getAllByText('Custo por KM')).toHaveLength(3);
    expect(screen.queryByText('Curitiba/PR → São Paulo/SP')).not.toBeOnTheScreen();
    expect(mockBuscar).toHaveBeenCalledTimes(1);
  });

  it('menos de 3 itens: mostra só as posições que existem', async () => {
    responder(montarRanking([rota('r1', 'Curitiba', 133457), rota('r2', 'Londrina', 90000)], [veiculo('v1', 'ABC1D23', 250)]));

    render(<RankingView />);
    await screen.findByText('Top 3 rotas mais lucrativas');

    expect(screen.getByText('2º')).toBeOnTheScreen();
    expect(screen.queryByText('3º')).not.toBeOnTheScreen();

    await abrirVeiculos();
    expect(screen.getByText('1º')).toBeOnTheScreen();
    expect(screen.queryByText('2º')).not.toBeOnTheScreen();
  });

  it('empate: os dois dividem a posição e a linha avisa "Empate"', async () => {
    responder(
      montarRanking([rota('r1', 'Curitiba', 90000), rota('r2', 'Londrina', 90000), rota('r3', 'Maringá', 50000, 1)], []),
    );

    render(<RankingView />);
    await screen.findByText('Top 3 rotas mais lucrativas');

    expect(screen.getAllByText('1º')).toHaveLength(2);
    expect(screen.queryByText('2º')).not.toBeOnTheScreen();
    expect(screen.getByText('3º')).toBeOnTheScreen();
    expect(screen.getAllByText('Empate · 2 viagens · 816,5 km')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /^1º lugar, empatado, Curitiba\/PR → São Paulo\/SP/ })).toBeOnTheScreen();
  });

  it('estado vazio: "ainda sem dados para ranquear" nas duas visões', async () => {
    responder(montarRanking([], []));

    render(<RankingView />);

    expect(await screen.findByText('Ainda sem dados para ranquear')).toBeOnTheScreen();
    expect(screen.queryByText('Top 3 rotas mais lucrativas')).not.toBeOnTheScreen();

    fireEvent.press(screen.getByRole('tab', { name: 'Veículos' }));
    expect(await screen.findByText('Ainda sem dados para ranquear')).toBeOnTheScreen();
  });

  it('vazio sem viagem: pede para finalizar uma viagem', async () => {
    responder(montarRanking([], []));

    render(<RankingView />);

    expect(await screen.findByText(/finalize uma viagem/)).toBeOnTheScreen();
  });

  it('vazio porque nenhuma rota deu lucro: explica o motivo, sem pedir para finalizar viagem', async () => {
    responder(montarRanking([], [], { rotasSemLucro: true, veiculosSemKm: false }));

    render(<RankingView />);

    expect(await screen.findByText(/Nenhuma rota deu lucro/)).toBeOnTheScreen();
    expect(screen.queryByText(/finalize uma viagem/)).not.toBeOnTheScreen();
  });

  it('vazio porque nenhum veículo rodou KM: explica o motivo, sem pedir para finalizar viagem', async () => {
    responder(montarRanking([rota('r1', 'Curitiba', 133457)], [], { rotasSemLucro: false, veiculosSemKm: true }));

    render(<RankingView />);
    await screen.findByText('Top 3 rotas mais lucrativas');

    fireEvent.press(screen.getByRole('tab', { name: 'Veículos' }));
    expect(await screen.findByText(/não rodaram KM/)).toBeOnTheScreen();
    expect(screen.queryByText(/finalize uma viagem/)).not.toBeOnTheScreen();
  });

  it('vazio só numa visão: a outra continua com o ranking', async () => {
    responder(montarRanking([rota('r1', 'Curitiba', 133457)], []));

    render(<RankingView />);
    await screen.findByText('Top 3 rotas mais lucrativas');

    fireEvent.press(screen.getByRole('tab', { name: 'Veículos' }));
    expect(await screen.findByText('Ainda sem dados para ranquear')).toBeOnTheScreen();
  });

  it('erro: mensagem em português e "Tentar novamente" consulta de novo', async () => {
    mockBuscar.mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as estatísticas. Tente novamente.' });
    responder(RANKING_COMPLETO);

    render(<RankingView />);

    expect(await screen.findByText('Não foi possível carregar as estatísticas. Tente novamente.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Top 3 rotas mais lucrativas')).toBeOnTheScreen();
    expect(mockBuscar).toHaveBeenCalledTimes(2);
  });

  it('troca de período: consulta o novo intervalo', async () => {
    responder(RANKING_COMPLETO);

    render(<RankingView />);
    await screen.findByText('Top 3 rotas mais lucrativas');

    await act(async () => {
      fireEvent.press(screen.getByRole('tab', { name: 'Ano' }));
    });
    await screen.findByText('Top 3 rotas mais lucrativas');

    const ano = mesAtual().dataInicial.slice(0, 4);
    expect(mockBuscar).toHaveBeenLastCalledWith({ dataInicial: `${ano}-01-01`, dataFinal: `${ano}-12-31` });
  });

  it('tocar na rota abre a rota; tocar no veículo abre o detalhe do veículo', async () => {
    responder(RANKING_COMPLETO);

    render(<RankingView />);
    await screen.findByText('Top 3 rotas mais lucrativas');

    fireEvent.press(screen.getByRole('button', { name: /^1º lugar, Curitiba\/PR → São Paulo\/SP/ }));
    expect(mockPush).toHaveBeenLastCalledWith('/rotas/r1/editar');

    await abrirVeiculos();
    fireEvent.press(screen.getByRole('button', { name: /^2º lugar, XYZ9K87/ }));
    expect(mockPush).toHaveBeenLastCalledWith('/frota/v2');
  });

  it('perfil sem acesso à Frota (Financeiro): as linhas não são tocáveis', async () => {
    usarPerfil(false);
    responder(RANKING_COMPLETO);

    render(<RankingView />);
    await screen.findByText('Top 3 rotas mais lucrativas');

    expect(screen.queryByRole('button', { name: /lugar/ })).not.toBeOnTheScreen();
    expect(screen.getByLabelText('1º lugar, Curitiba/PR → São Paulo/SP, Lucro R$ 1.334,57')).toBeOnTheScreen();
  });

  it('a linha anuncia posição, item e métrica ao leitor de tela', async () => {
    responder(RANKING_COMPLETO);

    render(<RankingView />);
    await screen.findByText('Top 3 rotas mais lucrativas');

    const linha = screen.getByRole('button', {
      name: '1º lugar, Curitiba/PR → São Paulo/SP, Lucro R$ 1.334,57, Toque para abrir o detalhe',
    });
    expect(within(linha).getByText('1º')).toBeOnTheScreen();
  });
});
