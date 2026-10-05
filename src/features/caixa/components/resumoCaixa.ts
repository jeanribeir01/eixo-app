import { z } from 'zod';

// Contrato do JSON devolvido pelo RPC `resumo_caixa` (EIX-35). O cálculo é todo do banco; esta
// tela só exibe — nenhuma soma é feita no app (RNF06). O tipo gerado do RPC é só `Json`, então é
// este schema que acusa se o banco mudar o formato.
//
// Dinheiro chega em centavos inteiros: nunca ponto flutuante para valor financeiro (CLAUDE.md §5).
const centavos = z.number().int();

const mesProjetadoSchema = z.object({
  // Mês do vencimento no formato 'AAAA-MM'.
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  entradasPendentesCentavos: centavos,
  saidasPendentesCentavos: centavos,
  // Acumulado: saldo atual + todas as pendências até o fim deste mês (calculado no banco).
  saldoProjetadoCentavos: centavos,
});

export const resumoCaixaSchema = z.object({
  // Total de movimentações (pagas e pendentes). Zero = estado vazio: saldo 0 sozinho não basta,
  // porque entradas e saídas pagas podem se anular.
  quantidadeMovimentacoes: z.number().int().nonnegative(),
  // Só movimentações com status 'Pago' (o enum do banco não tem 'Recebido': Pago cobre os dois).
  saldoAtualCentavos: centavos,
  // Já em ordem cronológica, como a view devolver.
  projecao: z.array(mesProjetadoSchema),
  // Pendentes sem data de vencimento: ficam fora da projeção mensal (critério da EIX-35).
  semVencimento: z.object({
    quantidade: z.number().int().nonnegative(),
    entradasCentavos: centavos,
    saidasCentavos: centavos,
  }),
});

export type ResumoCaixa = z.infer<typeof resumoCaixaSchema>;
export type MesProjetado = z.infer<typeof mesProjetadoSchema>;
export type PendentesSemVencimento = ResumoCaixa['semVencimento'];
