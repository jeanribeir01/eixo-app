import { MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';

import {
  listarEstatisticasRotas,
  listarEstatisticasVeiculos,
  listarEstatisticasViagens,
  MENSAGEM_DADOS_INVALIDOS,
  MENSAGEM_ERRO_ESTATISTICAS,
  MENSAGEM_PERIODO_INVALIDO,
  type EstatisticaRota,
  type EstatisticaVeiculo,
  type EstatisticaViagem,
} from '../queries';

type Resposta = { data: unknown; error: { code: string; message: string } | null };

const mockRpc = jest.fn();

jest.mock('@/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

const ok = (data: unknown): Resposta => ({ data, error: null });
const erro = (code: string): Resposta => ({ data: null, error: { code, message: `detalhe técnico ${code}` } });

const PERIODO = { dataInicial: '2026-11-01', dataFinal: '2026-11-30' };

// Linha como o PostgREST entrega: numeric e bigint chegam como number, e os nulos da divisão por
// zero chegam como null.
function viagem(sobrescrever: Partial<EstatisticaViagem> = {}): EstatisticaViagem {
  return {
    viagem_id: 'v-1',
    veiculo_id: 've-1',
    placa: 'ABC1D23',
    rota_id: 'r-1',
    cidade_origem: 'São Paulo',
    uf_origem: 'SP',
    cidade_destino: 'Curitiba',
    uf_destino: 'PR',
    status: 'Finalizada',
    data_inicio: '2026-11-09T13:00:00+00:00',
    data_fim: '2026-11-10T13:00:00+00:00',
    km_rodado: 1000,
    receita_centavos: 500000,
    despesa_centavos: 133457,
    rentabilidade_centavos: 366543,
    litros: 300,
    custo_por_km_centavos: 133,
    consumo_km_por_litro: 3.33,
    ...sobrescrever,
  };
}

function rota(sobrescrever: Partial<EstatisticaRota> = {}): EstatisticaRota {
  return {
    rota_id: 'r-1',
    cidade_origem: 'São Paulo',
    uf_origem: 'SP',
    cidade_destino: 'Curitiba',
    uf_destino: 'PR',
    quantidade_viagens: 2,
    km_total: 2000,
    receita_centavos: 500000,
    despesa_centavos: 150000,
    lucro_centavos: 350000,
    custo_por_km_centavos: 75,
    mais_lucrativa: true,
    maior_custo: false,
    ...sobrescrever,
  };
}

function veiculo(sobrescrever: Partial<EstatisticaVeiculo> = {}): EstatisticaVeiculo {
  return {
    veiculo_id: 've-1',
    placa: 'ABC1D23',
    marca: 'Volvo',
    modelo: 'FH',
    quantidade_viagens: 2,
    km_total: 400,
    despesa_centavos: 80000,
    custo_por_km_centavos: 200,
    ...sobrescrever,
  };
}

beforeEach(() => {
  mockRpc.mockReset();
});

// As três consultas têm o mesmo contrato: mesma assinatura, mesmo tratamento de erro.
const CONSULTAS = [
  { nome: 'listarEstatisticasViagens', rpc: 'estatisticas_viagens', chamar: listarEstatisticasViagens, linha: viagem },
  { nome: 'listarEstatisticasRotas', rpc: 'estatisticas_rotas', chamar: listarEstatisticasRotas, linha: rota },
  { nome: 'listarEstatisticasVeiculos', rpc: 'estatisticas_veiculos', chamar: listarEstatisticasVeiculos, linha: veiculo },
] as const;

describe.each(CONSULTAS)('$nome', ({ rpc, chamar, linha }) => {
  it('BI-19: chama a RPC com o período e devolve as linhas na ordem do banco', async () => {
    const linhas = [linha(), linha()];
    mockRpc.mockResolvedValueOnce(ok(linhas));

    const resultado = await chamar(PERIODO);

    expect(mockRpc).toHaveBeenCalledWith(rpc, { data_inicial: '2026-11-01', data_final: '2026-11-30' });
    expect(resultado).toEqual({ ok: true, data: linhas });
  });

  it('BI-19: período sem dados devolve lista vazia', async () => {
    mockRpc.mockResolvedValueOnce(ok([]));

    expect(await chamar(PERIODO)).toEqual({ ok: true, data: [] });
  });

  it('BI-20: 42501 vira a mensagem de acesso negado', async () => {
    mockRpc.mockResolvedValueOnce(erro('42501'));

    expect(await chamar(PERIODO)).toEqual({ ok: false, mensagem: MENSAGEM_ACESSO_NEGADO });
  });

  it('BI-21: 22023 vira a mensagem de período inválido, sem o texto do banco', async () => {
    mockRpc.mockResolvedValueOnce(erro('22023'));

    expect(await chamar(PERIODO)).toEqual({ ok: false, mensagem: 'Período inválido. Confira as datas do filtro.' });
    expect(MENSAGEM_PERIODO_INVALIDO).toBe('Período inválido. Confira as datas do filtro.');
  });

  it('BI-22: outro erro vira a mensagem genérica', async () => {
    mockRpc.mockResolvedValueOnce(erro('PGRST301'));

    expect(await chamar(PERIODO)).toEqual({ ok: false, mensagem: MENSAGEM_ERRO_ESTATISTICAS });
    expect(MENSAGEM_ERRO_ESTATISTICAS).toBe('Não foi possível carregar as estatísticas. Tente novamente.');
  });

  it('BI-22: dado fora do schema vira a mensagem de dados inválidos', async () => {
    mockRpc.mockResolvedValueOnce(ok([{ ...linha(), custo_por_km_centavos: '133' }]));

    expect(await chamar(PERIODO)).toEqual({ ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS });
    expect(MENSAGEM_DADOS_INVALIDOS).toBe('Os dados recebidos são inválidos. Tente novamente.');
  });
});

describe('nulos da divisão por zero', () => {
  it('BI-19: viagem sem KM nem litros passa com R$/KM, KM/L, KM e litros nulos', async () => {
    const semKm = viagem({
      status: 'EmAndamento',
      data_fim: null,
      km_rodado: null,
      litros: null,
      custo_por_km_centavos: null,
      consumo_km_por_litro: null,
    });
    mockRpc.mockResolvedValueOnce(ok([semKm]));

    expect(await listarEstatisticasViagens(PERIODO)).toEqual({ ok: true, data: [semKm] });
  });

  it('BI-19: centavos que não são inteiros são recusados', async () => {
    mockRpc.mockResolvedValueOnce(ok([viagem({ receita_centavos: 1.5 })]));

    expect(await listarEstatisticasViagens(PERIODO)).toEqual({ ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS });
  });
});
