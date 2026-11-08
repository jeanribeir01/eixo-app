import { z } from 'zod';

import { dataBRParaISO } from '@/lib/datas';

function campoData(mensagemVazio: string) {
  return (
    z
      .string()
      .min(1, mensagemVazio)
      // Campo vazio já tem a mensagem acima: sem esta exceção, ele receberia dois erros.
      .refine((texto) => texto === '' || dataBRParaISO(texto) !== null, 'Data inválida. Use DD/MM/AAAA.')
  );
}

// Período customizado do filtro dos dashboards. O texto entra como o usuário vê (DD/MM/AAAA) e sai em
// ISO, pronto para a consulta. Ainda não há RPC de KPI com período; quando existir, ela precisa recusar
// o mesmo intervalo invertido que esta regra recusa.
export const periodoCustomizadoSchema = z
  .object({
    dataInicial: campoData('Informe a data inicial.'),
    dataFinal: campoData('Informe a data final.'),
  })
  // Depende dos dois campos, por isso fica no objeto.
  .superRefine((valores, ctx) => {
    const inicial = dataBRParaISO(valores.dataInicial);
    const final = dataBRParaISO(valores.dataFinal);
    // Data inválida já tem erro no próprio campo. ISO compara certo como texto.
    if (inicial && final && final < inicial) {
      ctx.addIssue({
        code: 'custom',
        path: ['dataFinal'],
        message: 'A data final não pode ser anterior à data inicial.',
      });
    }
  })
  .transform((valores) => ({
    dataInicial: dataBRParaISO(valores.dataInicial) ?? '',
    dataFinal: dataBRParaISO(valores.dataFinal) ?? '',
  }));
