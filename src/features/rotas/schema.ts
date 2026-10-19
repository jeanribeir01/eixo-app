import { z } from 'zod';

import { Constants } from '@/types/database';

import { limparCidade } from './cidade';

// O campo de distância é texto na tela: aceita vírgula decimal ("408,5"), que é como o usuário
// brasileiro digita. Vazio vira NaN para cair na mensagem "Informe...". Mesmo conversor de
// `veiculos/schema.ts`, repetido aqui porque cada feature é autocontida.
function textoParaNumero(valor: string): number {
  const limpo = valor.trim().replace(',', '.');
  return limpo === '' ? Number.NaN : Number(limpo);
}

// O banco só exige cidade não vazia e sem espaço sobrando (checks `rota_cidade_*_normalizada`,
// migration 20261014000200). O teto de 80 é do app: cobre o maior nome de município com folga.
// A cidade sai limpa (`limparCidade`) porque é esse valor que vai para o banco.
function cidade(lado: 'origem' | 'destino') {
  return z
    .string(`Informe a cidade de ${lado}.`)
    .transform(limparCidade)
    .pipe(
      z
        .string()
        .min(1, `Informe a cidade de ${lado}.`)
        .max(80, `A cidade de ${lado} pode ter no máximo 80 caracteres.`),
    );
}

// O enum vem de `Constants` (gerado), então as 27 UFs acompanham o banco sem lista escrita à mão.
function uf(lado: 'origem' | 'destino') {
  return z.enum(Constants.public.Enums.uf, { error: `Escolha a UF de ${lado}.` });
}

// Mensagens escritas à mão em português: a mensagem padrão do Zod nunca chega ao usuário
// (AGENTS.md §2.2, skill formulario-validado).
export const rotaSchema = z.object({
  cidade_origem: cidade('origem'),
  uf_origem: uf('origem'),
  cidade_destino: cidade('destino'),
  uf_destino: uf('destino'),
  distancia_estimada_km: z
    .string('Informe a distância estimada em km.')
    .transform(textoParaNumero)
    .pipe(
      z
        .number('Informe a distância estimada em km.')
        // `rota_distancia_positiva` (migration 20260924000300): distância > 0.
        .positive('A distância deve ser maior que zero.')
        // numeric(10, 2) no banco: até 99.999.999,99 km, com no máximo 2 casas decimais.
        .max(99_999_999.99, 'Distância muito alta.')
        // Tolerância para o erro de ponto flutuante (408.3 * 100 = 40830.00000000001).
        .refine((valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6, 'Use no máximo 2 casas decimais.'),
    ),
});

export type RotaFormValues = z.input<typeof rotaSchema>;
export type RotaValidada = z.output<typeof rotaSchema>;
