import { z } from 'zod';

import { Constants } from '@/types/database';

import { isPlacaValida, normalizarPlaca } from './placa';

// TODO(EIX-37): o critério de aceite pede Ano de Fabricação (entre 1950 e ano atual + 1), mas a
// coluna `ano_fabricacao` não existe na tabela `veiculo`. Depende de uma migration que ainda não
// existe — o campo e a validação entram aqui quando ela for aplicada e os tipos regerados.

// O campo de capacidade é texto na tela: aceita vírgula decimal ("12,5"), que é como o usuário
// brasileiro digita. Vazio vira NaN para cair na mensagem "Informe...".
function textoParaNumero(valor: string): number {
  const limpo = valor.trim().replace(',', '.');
  return limpo === '' ? Number.NaN : Number(limpo);
}

// Mensagens escritas à mão em português: a mensagem padrão do Zod nunca chega ao usuário
// (AGENTS.md §2.2, skill formulario-validado).
export const veiculoSchema = z.object({
  placa: z
    .string('Informe a placa.')
    .trim()
    .min(1, 'Informe a placa.')
    // O valor que segue para o banco é sempre o normalizado (maiúscula, sem hífen/espaço): a
    // constraint `veiculo_placa_normalizada` exige isso e a unique só funciona se ninguém gravar
    // "ABC-1234" e "ABC1234" como placas diferentes.
    .transform((valor) => normalizarPlaca(valor))
    .refine((valor) => isPlacaValida(valor), 'Placa inválida. Use o formato AAA-1234 ou o padrão Mercosul AAA1A23.'),
  marca: z.string('Informe a marca.').trim().min(1, 'Informe a marca.').max(60, 'A marca pode ter no máximo 60 caracteres.'),
  modelo: z.string('Informe o modelo.').trim().min(1, 'Informe o modelo.').max(60, 'O modelo pode ter no máximo 60 caracteres.'),
  capacidade_carga: z
    .string('Informe a capacidade de carga.')
    .transform(textoParaNumero)
    .pipe(
      z
        .number('Informe a capacidade de carga em toneladas.')
        .positive('A capacidade de carga deve ser maior que zero.')
        // numeric(10, 2) no banco: até 99.999.999,99 t, com no máximo 2 casas decimais.
        .max(99_999_999.99, 'Capacidade de carga muito alta.')
        // Tolerância para o erro de ponto flutuante (12.3 * 100 = 1230.0000000000002).
        .refine((valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6, 'Use no máximo 2 casas decimais.'),
    ),
  // O enum vem de `Constants` (gerado), então acompanha o banco sem lista escrita à mão.
  status: z.enum(Constants.public.Enums.status_veiculo, { error: 'Escolha o status do veículo.' }),
});

export type VeiculoFormValues = z.input<typeof veiculoSchema>;
export type VeiculoValidado = z.output<typeof veiculoSchema>;
