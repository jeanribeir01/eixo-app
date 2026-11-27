import { buscarFluxoMensal } from '@/features/dashboard/graficos/queries';
import { contarVencidos, listarProximosVencimentos } from '@/features/movimentacoes/movimentacoesRepository';
import type { Movimentacao } from '@/features/movimentacoes/types';
import { hojeISO } from '@/lib/datas';

import { buscarResumoCaixa, type Resultado } from './fonteResumoCaixa';

// Quantos pendentes a aba Caixa lista em "Próximos vencimentos"; o resto fica em Movimentações.
export const QUANTIDADE_PROXIMOS = 5;

// O mês em andamento da aba Caixa: quanto já entrou e saiu (pago) e quanto ainda falta (pendente).
// Os quatro números vêm somados do banco (RNF06): o pago pela RPC `fluxo_caixa_mensal`, o pendente
// pela `resumo_caixa`, que já põe no mês atual o que venceu antes e não foi pago.
export type MesEmAndamento = {
  // 'AAAA-MM'
  mes: string;
  entradasPagasCentavos: number;
  entradasPendentesCentavos: number;
  saidasPagasCentavos: number;
  saidasPendentesCentavos: number;
  // Pendentes de hoje em diante, o mais próximo primeiro.
  proximosVencimentos: Movimentacao[];
  // Pendentes que já venceram sem baixa: uma linha só, para não esconder o que vence de verdade.
  vencidos: number;
};

// Uma falha em qualquer parte vira o erro do cartão inteiro: meio mês daria um resultado errado.
export async function buscarMesEmAndamento(): Promise<Resultado<MesEmAndamento>> {
  const hoje = hojeISO();
  const [resumo, fluxo, proximos, vencidos] = await Promise.all([
    buscarResumoCaixa(),
    // 3 é o menor horizonte que a RPC aceita; só o último mês, o atual, interessa aqui.
    buscarFluxoMensal(hoje, 3),
    listarProximosVencimentos(hoje, QUANTIDADE_PROXIMOS),
    contarVencidos(hoje),
  ]);

  if (!resumo.ok) return resumo;
  if (!fluxo.ok) return fluxo;
  if (!proximos.ok) return proximos;
  if (!vencidos.ok) return vencidos;

  const mes = resumo.data.mesReferencia;
  const pago = fluxo.data.find((item) => item.mes === mes);
  // Sem pendência no mês, a projeção não traz a linha dele: é zero.
  const pendente = resumo.data.projecao.find((item) => item.mes === mes);

  return {
    ok: true,
    data: {
      mes,
      entradasPagasCentavos: pago?.entradas_centavos ?? 0,
      entradasPendentesCentavos: pendente?.entradasPendentesCentavos ?? 0,
      saidasPagasCentavos: pago?.saidas_centavos ?? 0,
      saidasPendentesCentavos: pendente?.saidasPendentesCentavos ?? 0,
      proximosVencimentos: proximos.data,
      vencidos: vencidos.data,
    },
  };
}
