import { z } from 'zod';

import { dataBRParaISO, diasEntre } from '@/lib/datas';

function campoData(mensagemVazio: string) {
  return (
    z
      .string()
      .min(1, mensagemVazio)
      // Campo vazio já tem a mensagem acima: sem esta exceção, ele receberia dois erros.
      .refine((texto) => texto === '' || dataBRParaISO(texto) !== null, 'Data inválida. Use DD/MM/AAAA.')
  );
}

// Teto do período customizado: um ano, o mesmo tamanho da aba "Ano" (366 dias cobre o ano bissexto).
// Sem teto, 01/01/1900 a 31/12/9999 passaria, e agregar o histórico inteiro põe em risco o RNF06 (< 2s).
export const MAX_DIAS_PERIODO = 366;

// Período customizado do filtro dos dashboards. O texto entra como o usuário vê (DD/MM/AAAA) e sai em
// ISO, pronto para a consulta. Ainda não há RPC de KPI com período; quando existir, ela precisa recusar
// o mesmo intervalo invertido e o mesmo teto de MAX_DIAS_PERIODO que esta regra recusa.
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
    if (!inicial || !final) return;

    if (final < inicial) {
      ctx.addIssue({
        code: 'custom',
        path: ['dataFinal'],
        message: 'A data final não pode ser anterior à data inicial.',
      });
      return;
    }

    // +1 porque as duas pontas contam: de 01/10 a 01/10 é um período de 1 dia.
    if (diasEntre(inicial, final) + 1 > MAX_DIAS_PERIODO) {
      ctx.addIssue({
        code: 'custom',
        path: ['dataFinal'],
        message: `O período pode ter no máximo ${MAX_DIAS_PERIODO} dias.`,
      });
    }
  })
  .transform((valores) => ({
    dataInicial: dataBRParaISO(valores.dataInicial) ?? '',
    dataFinal: dataBRParaISO(valores.dataFinal) ?? '',
  }));
