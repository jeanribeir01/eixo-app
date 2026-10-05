import type { ResumoCaixa } from '../components/resumoCaixa';

// Dados de mentira enquanto a EIX-35 (motor de saldo no banco) não mergeia. Os números já vêm
// "calculados", como a view vai devolver: a tela nunca soma nada.

// Cenário da demo: um financiamento pesa em novembro e o caixa projetado fica negativo nesse mês.
export const resumoCaixaComDados: ResumoCaixa = {
  quantidadeMovimentacoes: 14,
  saldoAtualCentavos: 1_250_000,
  projecao: [
    { mes: '2026-10', entradasPendentesCentavos: 800_000, saidasPendentesCentavos: 950_000, saldoProjetadoCentavos: 1_100_000 },
    { mes: '2026-11', entradasPendentesCentavos: 300_000, saidasPendentesCentavos: 1_600_000, saldoProjetadoCentavos: -200_000 },
    { mes: '2026-12', entradasPendentesCentavos: 900_000, saidasPendentesCentavos: 450_000, saldoProjetadoCentavos: 250_000 },
    { mes: '2027-01', entradasPendentesCentavos: 600_000, saidasPendentesCentavos: 450_000, saldoProjetadoCentavos: 400_000 },
  ],
  semVencimento: { quantidade: 2, entradasCentavos: 0, saidasCentavos: 120_000 },
};

// Base vazia: nenhuma movimentação lançada ainda.
export const resumoCaixaVazio: ResumoCaixa = {
  quantidadeMovimentacoes: 0,
  saldoAtualCentavos: 0,
  projecao: [],
  semVencimento: { quantidade: 0, entradasCentavos: 0, saidasCentavos: 0 },
};
