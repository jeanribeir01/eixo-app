import type { MesProjetado } from './resumoCaixa';

// Só separa e procura o que o banco já calculou: nenhum valor é somado aqui (RNF06). A soma por
// ano vem pronta do `resumo_caixa` (EIX-74).

// Quantos meses a aba "12 meses" mostra, contando o mês de referência.
export const MESES_NA_JANELA = 12;

// '2026-10' + 11 → '2027-09'. Conta com inteiros, sem Date: sem fuso no meio, o mês nunca "volta um".
export function somarMeses(mes: string, quantidade: number): string {
  const [ano, numero] = mes.split('-').map(Number);
  const total = ano * 12 + (numero - 1) + quantidade;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export type JanelaDaProjecao = {
  // Meses com pendência do mês de referência até 11 meses depois.
  proximos: MesProjetado[];
  // Meses com pendência depois da janela: quantos são e qual é o último.
  mesesDepois: number;
  ultimoMes: string | null;
};

export function separarJanela(meses: MesProjetado[], mesReferencia: string): JanelaDaProjecao {
  const limite = somarMeses(mesReferencia, MESES_NA_JANELA - 1);
  // 'AAAA-MM' em ordem alfabética é a mesma ordem cronológica.
  const proximos = meses.filter((item) => item.mes <= limite);
  const depois = meses.filter((item) => item.mes > limite);
  return { proximos, mesesDepois: depois.length, ultimoMes: depois.at(-1)?.mes ?? null };
}

// Primeiro mês com saldo projetado negativo em toda a projeção, não só na janela: o alerta tem que
// aparecer mesmo quando o problema está daqui a três anos.
export function primeiroMesNegativo(meses: MesProjetado[]): string | null {
  return meses.find((item) => item.saldoProjetadoCentavos < 0)?.mes ?? null;
}
