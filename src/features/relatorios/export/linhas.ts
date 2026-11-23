import type { TipoCategoria } from '@/features/categorias/types';
import { rotuloStatus, type StatusPagamento } from '@/features/movimentacoes/types';
import { formatarMoeda } from '@/lib/money';

// Uma transação do relatório (US14), já com a data que a posiciona no período: vencimento ou, sem ele,
// o dia local da inclusão (a mesma regra da lista de Movimentações). Dinheiro sempre em centavos.
export type TransacaoRelatorio = {
  id: string;
  dataReferencia: string; // ISO AAAA-MM-DD
  descricao: string;
  categoria: string;
  tipo: TipoCategoria;
  valorCentavos: number; // sempre positivo; o tipo diz se entra ou sai
  status: StatusPagamento;
};

export type FormatoRelatorio = 'csv' | 'pdf';

export type TotaisRelatorio = {
  entradasCentavos: number;
  saidasCentavos: number;
  saldoCentavos: number;
};

// Somar o rodapé do arquivo é montar o documento, não agregação de dashboard (o RNF06 fala do BI na
// tela). Os totais batem com as linhas que o arquivo mostra, pendentes e pagas.
export function totaisDoRelatorio(transacoes: TransacaoRelatorio[]): TotaisRelatorio {
  let entradasCentavos = 0;
  let saidasCentavos = 0;
  for (const transacao of transacoes) {
    if (transacao.tipo === 'Entrada') entradasCentavos += transacao.valorCentavos;
    else saidasCentavos += transacao.valorCentavos;
  }
  return { entradasCentavos, saidasCentavos, saldoCentavos: entradasCentavos - saidasCentavos };
}

export function statusDoRelatorio(transacao: TransacaoRelatorio): string {
  return rotuloStatus(transacao.status, transacao.tipo);
}

// "R$ 1.234,56" com sinal na frente quando negativo. O `formatarMoeda` só sabe formatar centavos
// positivos, por isso o sinal é tratado aqui. "−" é o sinal de menos tipográfico, o mesmo do app.
export function moedaComSinal(centavos: number, sinalPositivo = ''): string {
  if (centavos < 0) return `− ${formatarMoeda(-centavos)}`;
  return `${sinalPositivo}${formatarMoeda(centavos)}`;
}
