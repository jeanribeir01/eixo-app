import { z } from 'zod';

import { dataBRParaISO } from '@/lib/datas';

const DATA_INVALIDA = 'Data inválida. Use DD/MM/AAAA.';
// numeric(12,2): até R$ 9.999.999.999,99.
const VALOR_MAXIMO_CENTAVOS = 999_999_999_999;

// Litros (US09): numeric(8,2) com check > 0 em 20261111000100_ponte_viagem.sql. Mesmo limite aqui.
// Aceita vírgula ou ponto como separador decimal ("412,5" ou "412.5"), sem separador de milhar.
const LITROS_FORMATO = /^\d{1,6}([.,]\d{1,2})?$/;
const LITROS_MAXIMO = 999_999.99;
const LITROS_INVALIDOS = 'Informe os litros com até 2 casas decimais, entre 0,01 e 999.999,99.';

function litrosParaNumero(texto: string): number | null {
  const limpo = texto.trim();
  if (!LITROS_FORMATO.test(limpo)) return null;
  const numero = Number(limpo.replace(',', '.'));
  return numero > 0 && numero <= LITROS_MAXIMO ? numero : null;
}

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
    // US09: nulo = sem viagem (despesa de escritório). Opcional no objeto para quem não usa o vínculo.
    viagemId: z.string().nullable().default(null),
    // Texto digitado; vazio = não informado.
    litros: z.string().default(''),
    // A tela informa se a categoria escolhida é Combustível: a regra dos litros depende disso e o
    // schema não conhece a lista de categorias.
    combustivel: z.boolean().default(false),
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
  // Litros só contam em Combustível. Vinculado a uma viagem, são obrigatórios (o KM/L da US10
  // depende deles); sem viagem, são opcionais. O trigger `valida_litros_movimentacao` tem a mesma
  // regra no banco.
  .superRefine((valores, ctx) => {
    if (!valores.combustivel) return;
    if (valores.litros.trim() === '') {
      if (valores.viagemId !== null) {
        ctx.addIssue({ code: 'custom', path: ['litros'], message: 'Informe a quantidade em litros.' });
      }
    } else if (litrosParaNumero(valores.litros) === null) {
      ctx.addIssue({ code: 'custom', path: ['litros'], message: LITROS_INVALIDOS });
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
    viagemId: valores.viagemId,
    // Fora de Combustível, os litros digitados antes de trocar a categoria são descartados.
    litros: valores.combustivel ? litrosParaNumero(valores.litros) : null,
  }));

// O que a tela guarda enquanto o usuário digita (a seleção pode estar vazia). `combustivel` não
// é digitado: a tela calcula pela categoria na hora de validar.
export type MovimentacaoFormValues = Omit<
  z.input<typeof movimentacaoSchema>,
  'categoriaId' | 'formaPagamentoId' | 'viagemId' | 'litros' | 'combustivel'
> & {
  categoriaId: string | null;
  formaPagamentoId: string | null;
  viagemId: string | null;
  litros: string;
};

// O que vai para o repositório depois de validado.
export type MovimentacaoInput = z.output<typeof movimentacaoSchema>;
