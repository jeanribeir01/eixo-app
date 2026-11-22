import {
  listarEstatisticasRotas,
  listarEstatisticasVeiculos,
  type EstatisticaRota,
  type EstatisticaVeiculo,
} from '@/features/bi/queries';

import { buscarRanking, ranquear } from '../ranking';

jest.mock('@/features/bi/queries', () => ({
  listarEstatisticasRotas: jest.fn(),
  listarEstatisticasVeiculos: jest.fn(),
}));

const mockRotas = listarEstatisticasRotas as jest.MockedFunction<typeof listarEstatisticasRotas>;
const mockVeiculos = listarEstatisticasVeiculos as jest.MockedFunction<typeof listarEstatisticasVeiculos>;

const PERIODO = { dataInicial: '2026-11-01', dataFinal: '2026-11-30' };

function rota(id: string, lucro: number): EstatisticaRota {
  return {
    rota_id: id,
    cidade_origem: 'Curitiba',
    uf_origem: 'PR',
    cidade_destino: 'São Paulo',
    uf_destino: 'SP',
    quantidade_viagens: 1,
    km_total: 400,
    receita_centavos: lucro,
    despesa_centavos: 0,
    lucro_centavos: lucro,
    custo_por_km_centavos: 0,
    mais_lucrativa: false,
    maior_custo: false,
  };
}

function veiculo(id: string, custoPorKm: number | null): EstatisticaVeiculo {
  return {
    veiculo_id: id,
    placa: `ABC${id}`,
    marca: 'Volvo',
    modelo: 'FH 540',
    quantidade_viagens: 1,
    km_total: custoPorKm === null ? 0 : 100,
    despesa_centavos: 0,
    custo_por_km_centavos: custoPorKm,
  };
}

const lucro = (item: EstatisticaRota) => item.lucro_centavos;

describe('ranquear', () => {
  it('corta o Top 3 na ordem recebida e numera 1º, 2º e 3º', () => {
    const resultado = ranquear([rota('a', 900), rota('b', 500), rota('c', 300), rota('d', 100)], lucro);

    expect(resultado.map((r) => [r.item.rota_id, r.posicao, r.empatado])).toEqual([
      ['a', 1, false],
      ['b', 2, false],
      ['c', 3, false],
    ]);
  });

  it('menos de 3 itens: devolve só os que existem', () => {
    expect(ranquear([rota('a', 900), rota('b', 500)], lucro).map((r) => r.posicao)).toEqual([1, 2]);
    expect(ranquear([rota('a', 900)], lucro).map((r) => r.posicao)).toEqual([1]);
  });

  it('lista vazia: ranking vazio', () => {
    expect(ranquear([], lucro)).toEqual([]);
  });

  it('empate no topo: os dois dividem o 1º e o próximo é o 3º', () => {
    const resultado = ranquear([rota('a', 500), rota('b', 500), rota('c', 100)], lucro);

    expect(resultado.map((r) => [r.posicao, r.empatado])).toEqual([
      [1, true],
      [1, true],
      [3, false],
    ]);
  });

  it('empate no meio: 1º, 2º, 2º', () => {
    const resultado = ranquear([rota('a', 900), rota('b', 500), rota('c', 500), rota('d', 500)], lucro);

    expect(resultado.map((r) => [r.posicao, r.empatado])).toEqual([
      [1, false],
      [2, true],
      [2, true],
    ]);
  });

  it('empate de todos: todos em 1º', () => {
    const resultado = ranquear([rota('a', 0), rota('b', 0), rota('c', 0)], lucro);

    expect(resultado.map((r) => r.posicao)).toEqual([1, 1, 1]);
  });

  it('lucro negativo também ranqueia, na ordem da RPC', () => {
    const resultado = ranquear([rota('a', -100), rota('b', -500)], lucro);

    expect(resultado.map((r) => [r.item.rota_id, r.posicao])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });
});

describe('buscarRanking', () => {
  beforeEach(() => {
    mockRotas.mockReset();
    mockVeiculos.mockReset();
  });

  it('consulta as duas RPCs com o mesmo período e monta as duas visões', async () => {
    mockRotas.mockResolvedValue({ ok: true, data: [rota('a', 900), rota('b', 500)] });
    mockVeiculos.mockResolvedValue({ ok: true, data: [veiculo('1', 250), veiculo('2', 120)] });

    const resultado = await buscarRanking(PERIODO);

    expect(mockRotas).toHaveBeenCalledWith(PERIODO);
    expect(mockVeiculos).toHaveBeenCalledWith(PERIODO);
    if (!resultado.ok) throw new Error('esperava sucesso');
    expect(resultado.data.rotasMaisLucrativas.map((r) => r.item.rota_id)).toEqual(['a', 'b']);
    expect(resultado.data.veiculosMaiorCustoPorKm.map((r) => r.item.veiculo_id)).toEqual(['1', '2']);
  });

  it('veículo sem custo por KM (nulo) fica fora do ranking', async () => {
    mockRotas.mockResolvedValue({ ok: true, data: [] });
    mockVeiculos.mockResolvedValue({ ok: true, data: [veiculo('1', 250), veiculo('2', null)] });

    const resultado = await buscarRanking(PERIODO);

    if (!resultado.ok) throw new Error('esperava sucesso');
    expect(resultado.data.veiculosMaiorCustoPorKm.map((r) => r.item.veiculo_id)).toEqual(['1']);
  });

  it('erro nas rotas: devolve a mensagem da US10', async () => {
    mockRotas.mockResolvedValue({ ok: false, mensagem: 'Período inválido. Confira as datas do filtro.' });
    mockVeiculos.mockResolvedValue({ ok: true, data: [] });

    expect(await buscarRanking(PERIODO)).toEqual({
      ok: false,
      mensagem: 'Período inválido. Confira as datas do filtro.',
    });
  });

  it('erro nos veículos: devolve a mensagem da US10', async () => {
    mockRotas.mockResolvedValue({ ok: true, data: [] });
    mockVeiculos.mockResolvedValue({ ok: false, mensagem: 'Não foi possível carregar as estatísticas. Tente novamente.' });

    expect(await buscarRanking(PERIODO)).toEqual({
      ok: false,
      mensagem: 'Não foi possível carregar as estatísticas. Tente novamente.',
    });
  });
});
