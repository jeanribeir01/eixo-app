import { z } from 'zod';

import { dataBRParaISO } from '@/lib/datas';

// Mesmos limites do banco (checks da migration 20261005000200_divida.sql). O form avisa
// cedo; o banco é quem garante, porque o app fala direto com o PostgREST.
export const MAXIMO_PARCELAS = 120;
// numeric(12,2): até R$ 9.999.999.999,99.
const VALOR_MAXIMO_CENTAVOS = 999_999_999_999;
const VALOR_MAIOR_QUE_ZERO = 'Informe um valor maior que zero.';

// Campo "Soma Total" da tela: somente leitura, recalculado enquanto o usuário digita.
// Inteiros em centavos (CLAUDE.md §5): 120 × 999.999.999.999 ainda cabe sem perder precisão.
export function somaTotalCentavos(quantidadeParcelas: number, valorParcelaCentavos: number): number {
  return quantidadeParcelas * valorParcelaCentavos;
}

// Entrada = o que a tela guarda (data DD/MM/AAAA, seleção nula, quitação nula quando vazia);
// saída = o que o repositório envia para a RPC criar_divida.
export const dividaSchema = z
  .object({
    descricao: z
      .string()
      .trim()
      .min(1, 'Informe a descrição.')
      .max(120, 'A descrição pode ter no máximo 120 caracteres.'),
    categoriaId: z.string({ error: 'Escolha a categoria.' }),
    formaPagamentoId: z.string({ error: 'Escolha a forma de pagamento.' }),
    quantidadeParcelas: z
      .number({ error: 'Informe a quantidade de parcelas.' })
      .int('Informe um número inteiro de parcelas.')
      .min(1, 'Informe ao menos 1 parcela.')
      .max(MAXIMO_PARCELAS, `O máximo é ${MAXIMO_PARCELAS} parcelas.`),
    valorParcelaCentavos: z
      .number()
      .int()
      .min(1, VALOR_MAIOR_QUE_ZERO)
      .max(VALOR_MAXIMO_CENTAVOS, 'O valor pode ser no máximo R$ 9.999.999.999,99.'),
    dataVencimentoPrimeira: z.string().refine((texto) => dataBRParaISO(texto) !== null, 'Data inválida. Use DD/MM/AAAA.'),
    // Opcional: null = o usuário não informou.
    valorQuitacaoCentavos: z.number().int().min(1, VALOR_MAIOR_QUE_ZERO).nullable(),
  })
  // Depende de três campos, por isso fica no objeto. O banco tem a mesma regra.
  .superRefine((valores, ctx) => {
    if (valores.valorQuitacaoCentavos === null) return;
    const soma = somaTotalCentavos(valores.quantidadeParcelas, valores.valorParcelaCentavos);
    if (valores.valorQuitacaoCentavos > soma) {
      ctx.addIssue({
        code: 'custom',
        path: ['valorQuitacaoCentavos'],
        message: 'A quitação não pode passar da soma total.',
      });
    }
  })
  .transform((valores) => ({
    ...valores,
    // O refine acima já garantiu que a data existe.
    dataVencimentoPrimeira: dataBRParaISO(valores.dataVencimentoPrimeira) ?? '',
  }));

// O que a tela guarda enquanto o usuário preenche (as seleções podem estar vazias).
export type DividaFormValues = Omit<z.input<typeof dividaSchema>, 'categoriaId' | 'formaPagamentoId'> & {
  categoriaId: string | null;
  formaPagamentoId: string | null;
};

// O que vai para o repositório depois de validado.
export type DividaInput = z.output<typeof dividaSchema>;
