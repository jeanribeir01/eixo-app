import { z } from 'zod';

import { isPlacaValida, normalizarPlaca } from './placa';

export const ANO_FABRICACAO_MINIMO = 1950;

// Ano atual + 1 calculado em runtime — nunca hardcoded, senão o limite fica desatualizado.
export function anoFabricacaoMaximo(): number {
  return new Date().getFullYear() + 1;
}

export const veiculoInputSchema = z.object({
  placa: z
    .string('Informe a placa.')
    .trim()
    .min(1, 'Informe a placa.')
    .transform((valor) => normalizarPlaca(valor))
    .refine((valor) => isPlacaValida(valor), 'Placa inválida. Use o formato AAA-1234 ou o padrão Mercosul AAA1A23.'),
  marca: z.string('Informe a marca.').trim().min(1, 'Informe a marca.'),
  modelo: z.string('Informe o modelo.').trim().min(1, 'Informe o modelo.'),
  anoFabricacao: z
    .number('Informe o ano de fabricação.')
    .int('Ano de fabricação inválido.')
    .min(ANO_FABRICACAO_MINIMO, `Ano de fabricação não pode ser anterior a ${ANO_FABRICACAO_MINIMO}.`)
    .max(anoFabricacaoMaximo(), `Ano de fabricação não pode ser maior que ${anoFabricacaoMaximo()}.`),
  capacidadeCarga: z
    .number('Informe a capacidade de carga.')
    .positive('Capacidade de carga deve ser maior que zero.'),
});

export type VeiculoInputValidado = z.infer<typeof veiculoInputSchema>;
