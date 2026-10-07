import type { ResumoCaixa } from '../resumoCaixa';

// Fixtures de teste no formato do RPC `resumo_caixa` (EIX-35). Os números já vêm "calculados",
// como o banco devolve: a tela nunca soma nada.

// Cenário da demo: um financiamento pesa em novembro e o caixa projetado fica negativo nesse mês.
export const resumoCaixaComDados: ResumoCaixa = {
  quantidadeMovimentacoes: 14,
  saldoAtualCentavos: 1_250_000,
  mesReferencia: '2026-10',
  projecao: [
    { mes: '2026-10', entradasPendentesCentavos: 800_000, saidasPendentesCentavos: 950_000, saldoProjetadoCentavos: 1_100_000 },
    { mes: '2026-11', entradasPendentesCentavos: 300_000, saidasPendentesCentavos: 1_600_000, saldoProjetadoCentavos: -200_000 },
    { mes: '2026-12', entradasPendentesCentavos: 900_000, saidasPendentesCentavos: 450_000, saldoProjetadoCentavos: 250_000 },
    { mes: '2027-01', entradasPendentesCentavos: 600_000, saidasPendentesCentavos: 450_000, saldoProjetadoCentavos: 400_000 },
  ],
  // O que o banco soma para esses meses: em 2026 o caixa fica negativo em novembro e termina positivo.
  projecaoAnual: [
    { ano: 2026, entradasPendentesCentavos: 2_000_000, saidasPendentesCentavos: 3_000_000, saldoFimDoAnoCentavos: 250_000, menorSaldoCentavos: -200_000 },
    { ano: 2027, entradasPendentesCentavos: 600_000, saidasPendentesCentavos: 450_000, saldoFimDoAnoCentavos: 400_000, menorSaldoCentavos: 400_000 },
  ],
  semVencimento: { quantidade: 2, entradasCentavos: 0, saidasCentavos: 120_000 },
};

// Base vazia: nenhuma movimentação lançada ainda.
export const resumoCaixaVazio: ResumoCaixa = {
  quantidadeMovimentacoes: 0,
  saldoAtualCentavos: 0,
  mesReferencia: '2026-10',
  projecao: [],
  projecaoAnual: [],
  semVencimento: { quantidade: 0, entradasCentavos: 0, saidasCentavos: 0 },
};
