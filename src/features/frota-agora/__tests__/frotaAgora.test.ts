import { manutencao, viagem } from '@/features/inicio/__mocks__/fixtures';
import { listarManutencoes } from '@/features/manutencao/manutencaoRepository';
import { listarVeiculos } from '@/features/veiculos/repository';
import type { Veiculo } from '@/features/veiculos/types';
import { listarViagens } from '@/features/viagens/viagensRepository';

import { buscarFrotaAgora, montarFrotaAgora } from '../frotaAgora';

jest.mock('@/features/veiculos/repository', () => ({ listarVeiculos: jest.fn() }));
jest.mock('@/features/viagens/viagensRepository', () => ({ listarViagens: jest.fn() }));
jest.mock('@/features/manutencao/manutencaoRepository', () => ({ listarManutencoes: jest.fn() }));
jest.mock('@/lib/datas', () => ({ ...jest.requireActual('@/lib/datas'), hojeISO: () => '2026-11-27' }));

function veiculo(sobrescrever: Partial<Veiculo>): Veiculo {
  return { id: 'v', placa: 'AAA1A11', marca: 'Volvo', modelo: 'FH 540', ano_fabricacao: 2020, capacidade_carga: 30, status: 'Disponivel', ...sobrescrever };
}

const HOJE = '2026-11-27';

// Meio-dia em UTC: a data local é a mesma em qualquer fuso do Brasil.
const fimEm = (dia: string) => `${dia}T15:00:00.000Z`;

describe('montarFrotaAgora', () => {
  const naEstrada = veiculo({ id: 'v1', placa: 'RTA4B21', status: 'EmViagem' });
  const naOficina = veiculo({ id: 'v2', placa: 'PWX9J13', status: 'EmManutencao' });
  const paradoHaMuito = veiculo({ id: 'v3', placa: 'QKP7E58', status: 'Disponivel' });
  const paradoHaPouco = veiculo({ id: 'v4', placa: 'TBC6K47', status: 'Disponivel' });
  const desativado = veiculo({ id: 'v5', placa: 'NHM3L82', status: 'Inativo' });

  function montar() {
    return montarFrotaAgora({
      veiculos: [paradoHaPouco, desativado, naOficina, paradoHaMuito, naEstrada],
      viagensEmAndamento: [viagem({ veiculo_id: 'v1' })],
      viagensFinalizadas: [
        viagem({ id: 'f1', veiculo_id: 'v3', status: 'Finalizada', data_fim: fimEm('2026-11-10') }),
        viagem({ id: 'f2', veiculo_id: 'v3', status: 'Finalizada', data_fim: fimEm('2026-11-17') }),
        viagem({ id: 'f3', veiculo_id: 'v4', status: 'Finalizada', data_fim: fimEm('2026-11-20') }),
      ],
      manutencoes: [
        manutencao({ id: 'm1', veiculo_id: 'v2', data_manutencao: '2026-11-19', data_conclusao: null }),
        // A manutenção do v4 acabou depois da última viagem: é dali que ele está parado.
        manutencao({ id: 'm2', veiculo_id: 'v4', data_manutencao: '2026-11-21', data_conclusao: fimEm('2026-11-24') }),
      ],
      hoje: HOJE,
    });
  }

  it('ordem de ação: na estrada, na oficina, parados do mais antigo ao mais novo; desativado fica de fora', () => {
    expect(montar().veiculos.map((item) => item.veiculo.placa)).toEqual(['RTA4B21', 'PWX9J13', 'QKP7E58', 'TBC6K47']);
  });

  it('cada situação traz o que a linha precisa', () => {
    const [estrada, oficina, parado1, parado2] = montar().veiculos;

    expect(estrada.situacao).toMatchObject({ tipo: 'estrada', viagem: { veiculo_id: 'v1' } });
    expect(oficina.situacao).toMatchObject({ tipo: 'oficina', manutencao: { id: 'm1' }, dias: 8 });
    // Parado desde a viagem mais recente (17/11), não a primeira.
    expect(parado1.situacao).toEqual({ tipo: 'parado', dias: 10 });
    // Parado desde a conclusão da manutenção (24/11), que veio depois da viagem (20/11).
    expect(parado2.situacao).toEqual({ tipo: 'parado', dias: 3 });
  });

  it('a contagem do resumo é a das linhas', () => {
    expect(montar().contagem).toEqual({ estrada: 1, oficina: 1, parado: 2 });
  });

  it('sem viagem nem manutenção registrada, o parado vem sem dias; sem a viagem local, a estrada vem sem trecho', () => {
    const frota = montarFrotaAgora({
      veiculos: [veiculo({ id: 'n1', status: 'Disponivel' }), veiculo({ id: 'n2', status: 'EmViagem' })],
      viagensEmAndamento: [],
      viagensFinalizadas: [],
      manutencoes: [],
      hoje: HOJE,
    });

    expect(frota.veiculos.map((item) => item.situacao)).toEqual([
      { tipo: 'estrada', viagem: null },
      { tipo: 'parado', dias: null },
    ]);
  });
});

describe('buscarFrotaAgora', () => {
  beforeEach(() => {
    jest.mocked(listarVeiculos).mockResolvedValue({ ok: true, data: [veiculo({ id: 'v1', status: 'EmViagem' })] });
    jest.mocked(listarViagens).mockResolvedValue({ ok: true, data: [viagem({ veiculo_id: 'v1' })] });
    jest.mocked(listarManutencoes).mockResolvedValue({ ok: true, data: [] });
  });

  it('busca veículos, viagens em andamento e finalizadas (banco local) e manutenções', async () => {
    const resultado = await buscarFrotaAgora();

    expect(listarViagens).toHaveBeenCalledWith({ status: 'EmAndamento' });
    expect(listarViagens).toHaveBeenCalledWith({ status: 'Finalizada', limite: 500 });
    expect(resultado).toMatchObject({ ok: true, data: { contagem: { estrada: 1, oficina: 0, parado: 0 } } });
  });

  it('uma parte que falha vira o erro do bloco, com a mensagem dela', async () => {
    jest.mocked(listarManutencoes).mockResolvedValue({ ok: false, mensagem: 'Não foi possível carregar as manutenções.' });

    expect(await buscarFrotaAgora()).toEqual({ ok: false, mensagem: 'Não foi possível carregar as manutenções.' });
  });
});
