import { buscarResumoCaixa } from '@/features/caixa/fonteResumoCaixa';
import { buscarFluxoMensal } from '@/features/dashboard/graficos/queries';
import { listarManutencoes } from '@/features/manutencao/manutencaoRepository';
import { listarMovimentacoesDoMes } from '@/features/movimentacoes/movimentacoesRepository';
import { listarUsuarios } from '@/features/usuarios/usuariosRepository';
import { hojeISO } from '@/lib/datas';
import { supabase } from '@/supabase/client';

import { manutencao, movimentacao, usuario } from '../__mocks__/fixtures';
import { buscarInicioFinanceiro, ultimasLancadas } from '../inicioFinanceiroRepository';

jest.mock('@/supabase/client', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('@/features/caixa/fonteResumoCaixa', () => ({ buscarResumoCaixa: jest.fn() }));
jest.mock('@/features/dashboard/graficos/queries', () => ({ buscarFluxoMensal: jest.fn() }));
jest.mock('@/features/manutencao/manutencaoRepository', () => ({ listarManutencoes: jest.fn() }));
jest.mock('@/features/movimentacoes/movimentacoesRepository', () => ({ listarMovimentacoesDoMes: jest.fn() }));
jest.mock('@/features/usuarios/usuariosRepository', () => ({ listarUsuarios: jest.fn() }));

const mesAtual = hojeISO().slice(0, 7);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(buscarResumoCaixa).mockResolvedValue({
    ok: true,
    data: {
      quantidadeMovimentacoes: 10,
      saldoAtualCentavos: 500000,
      mesReferencia: mesAtual,
      projecao: [],
      projecaoAnual: [],
      semVencimento: { quantidade: 0, entradasCentavos: 0, saidasCentavos: 0 },
    },
  });
  jest.mocked(buscarFluxoMensal).mockResolvedValue({
    ok: true,
    data: [
      { mes: '2000-01', entradas_centavos: 1, saidas_centavos: 1 },
      { mes: mesAtual, entradas_centavos: 300000, saidas_centavos: 200000 },
    ],
  });
  jest.mocked(supabase.rpc).mockResolvedValue({
    data: { totalReceberCentavos: 1000, totalPagarCentavos: 2000, saldoAtualCentavos: 0, quantidadeMovimentacoesPeriodo: 0 },
    error: null,
  } as never);
  jest.mocked(listarMovimentacoesDoMes).mockResolvedValue({ ok: true, data: [movimentacao()] });
  jest.mocked(listarUsuarios).mockResolvedValue({
    ok: true,
    data: [usuario(), usuario({ id: 'u2', status: 'Ativo' })],
  });
  jest.mocked(listarManutencoes).mockResolvedValue({
    ok: true,
    data: [manutencao(), manutencao({ id: 'm2', data_conclusao: '2026-11-20' })],
  });
});

describe('buscarInicioFinanceiro', () => {
  it('junta as somas prontas do banco e filtra só o que pede atenção', async () => {
    const resultado = await buscarInicioFinanceiro({ verUsuarios: true, verManutencoes: true });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.data).toMatchObject({
      saldoAtualCentavos: 500000,
      entradasDoMesCentavos: 300000,
      saidasDoMesCentavos: 200000,
      aPagarCentavos: 2000,
      aReceberCentavos: 1000,
    });
    expect(resultado.data.usuariosAguardando?.map((u) => u.id)).toEqual(['u1']);
    expect(resultado.data.manutencoesAbertas?.map((m) => m.id)).toEqual(['man']);
    // A janela é hoje + 6 dias, no RPC do banco.
    expect(supabase.rpc).toHaveBeenCalledWith('kpis_financeiros', {
      data_inicial: hojeISO(),
      data_final: resultado.data.ateData,
    });
  });

  it('o Financeiro não consulta usuários nem manutenções', async () => {
    const resultado = await buscarInicioFinanceiro({ verUsuarios: false, verManutencoes: false });

    expect(listarUsuarios).not.toHaveBeenCalled();
    expect(listarManutencoes).not.toHaveBeenCalled();
    expect(resultado.ok && resultado.data.usuariosAguardando).toBeNull();
  });

  it('qualquer parte que falha vira erro com a mensagem dela', async () => {
    jest.mocked(listarMovimentacoesDoMes).mockResolvedValue({ ok: false, mensagem: 'Falhou a lista.' });

    expect(await buscarInicioFinanceiro({ verUsuarios: false, verManutencoes: false })).toEqual({
      ok: false,
      mensagem: 'Falhou a lista.',
    });
  });

  it('resposta do RPC fora do formato é recusada', async () => {
    jest.mocked(supabase.rpc).mockResolvedValue({ data: { totalPagarCentavos: '10' }, error: null } as never);

    const resultado = await buscarInicioFinanceiro({ verUsuarios: false, verManutencoes: false });

    expect(resultado.ok).toBe(false);
  });
});

describe('ultimasLancadas', () => {
  it('as 3 lançadas por último, da mais recente para a mais antiga', () => {
    const lista = ['2026-11-01', '2026-11-05', '2026-11-03', '2026-11-04'].map((dia, indice) =>
      movimentacao({ id: `m${indice}`, data_inclusao: `${dia}T12:00:00+00:00` }),
    );

    expect(ultimasLancadas(lista).map((m) => m.id)).toEqual(['m1', 'm3', 'm2']);
  });
});
