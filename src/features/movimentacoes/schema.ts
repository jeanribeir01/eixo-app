import { z } from 'zod';

import { dataBRParaISO } from '@/lib/datas';

const DATA_INVALIDA = 'Data inválida. Use DD/MM/AAAA.';
// numeric(12,2): até R$ 9.999.999.999,99.
const VALOR_MAXIMO_CENTAVOS = 999_999_999_999;

// Mensagens escritas à mão em português: a mensagem padrão do Zod nunca chega ao usuário.
// Entrada = o que a tela guarda (datas como texto DD/MM/AAAA, seleção nula); saída = o que
// o repositório grava (datas ISO ou null).
export const movimentacaoSchema = z
  .object({
    valorCentavos: z
      .number()
      .int()
      .min(1, 'Informe um valor maior que zero.')
      .max(VALOR_MAXIMO_CENTAVOS, 'O valor pode ser no máximo R$ 9.999.999.999,99.'),
    descricao: z
      .string()
      .trim()
      .min(1, 'Informe a descrição.')
      .max(120, 'A descrição pode ter no máximo 120 caracteres.'),
    categoriaId: z.string({ error: 'Escolha a categoria.' }),
    formaPagamentoId: z.string({ error: 'Escolha a forma de pagamento.' }),
    // Vazio = sem vencimento (é opcional).
    dataVencimento: z.string().refine((texto) => texto === '' || dataBRParaISO(texto) !== null, DATA_INVALIDA),
    status: z.enum(['Pendente', 'Pago'], { error: 'Escolha o status.' }),
    dataPagamento: z.string(),
    // Caminho no bucket `comprovantes` (opcional). O arquivo já subiu quando o form é salvo.
    caminhoComprovante: z.string().nullable(),
  })
  // A data de pagamento só é obrigatória quando o status é Pago — regra que depende de dois
  // campos, por isso fica no objeto. O banco tem a mesma regra (check da EIX-27).
  .superRefine((valores, ctx) => {
    if (valores.status !== 'Pago') return;
    if (valores.dataPagamento === '') {
      ctx.addIssue({ code: 'custom', path: ['dataPagamento'], message: 'Informe a data de pagamento.' });
    } else if (dataBRParaISO(valores.dataPagamento) === null) {
      ctx.addIssue({ code: 'custom', path: ['dataPagamento'], message: DATA_INVALIDA });
    }
  })
  .transform((valores) => ({
    valorCentavos: valores.valorCentavos,
    descricao: valores.descricao,
    categoriaId: valores.categoriaId,
    formaPagamentoId: valores.formaPagamentoId,
    dataVencimento: valores.dataVencimento === '' ? null : dataBRParaISO(valores.dataVencimento),
    status: valores.status,
    // Pendente nunca grava data de pagamento, mesmo que algo tenha sido digitado antes.
    dataPagamento: valores.status === 'Pago' ? dataBRParaISO(valores.dataPagamento) : null,
    caminhoComprovante: valores.caminhoComprovante,
  }));

// O que a tela guarda enquanto o usuário digita (a seleção pode estar vazia).
export type MovimentacaoFormValues = Omit<z.input<typeof movimentacaoSchema>, 'categoriaId' | 'formaPagamentoId'> & {
  categoriaId: string | null;
  formaPagamentoId: string | null;
};

// O que vai para o repositório depois de validado.
export type MovimentacaoInput = z.output<typeof movimentacaoSchema>;
