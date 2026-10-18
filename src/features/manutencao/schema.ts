import { z } from 'zod';

import { dataBRParaISO, hojeISO, isoParaDataBR } from '@/lib/datas';
import { Constants } from '@/types/database';

// Mensagens escritas à mão em português: a mensagem padrão do Zod nunca chega ao usuário
// (AGENTS.md §2.2, skill formulario-validado). Entrada = o que a tela guarda (data como texto
// DD/MM/AAAA, seleção nula, valor em centavos); saída = o que o repositório envia à RPC.
//
// Os limites repetem os do banco (AD-008): `manutencao_valor_positivo` (valor > 0) e o trigger
// `valida_data_manutencao` (data não futura), da migration 20261014000300_manutencao_rpc.sql.
// O banco não limita a descrição; o teto de 200 é do app.
export const manutencaoSchema = z.object({
  veiculoId: z.string({ error: 'Escolha o veículo.' }),
  dataManutencao: z
    .string()
    // Vazia, incompleta ou inexistente (31/02) dão a mesma mensagem: não há data para gravar.
    .refine((texto) => dataBRParaISO(texto) !== null, 'Informe a data da manutenção.')
    .transform((texto) => dataBRParaISO(texto) ?? '')
    // ISO (AAAA-MM-DD) compara certo como texto. `hojeISO` usa o fuso do aparelho: às 23h30 em
    // Brasília já é amanhã em UTC, e a manutenção de hoje não pode ser recusada. O banco faz o
    // mesmo com o "hoje" de São Paulo.
    .refine((iso) => iso <= hojeISO(), 'A data da manutenção não pode ser futura.'),
  descricao: z
    .string()
    .trim()
    .min(1, 'Descreva o serviço.')
    .max(200, 'A descrição pode ter no máximo 200 caracteres.'),
  // Centavos inteiros (CLAUDE.md §5: dinheiro nunca em float). O teto de numeric(12,2) não
  // precisa de regra aqui: o CampoMoeda já para em 12 dígitos.
  valorCentavos: z.number().int().min(1, 'Informe um valor maior que zero.'),
  formaPagamentoId: z.string({ error: 'Escolha a forma de pagamento.' }),
  // O enum vem de `Constants` (gerado), então acompanha o banco sem lista escrita à mão.
  statusPagamento: z.enum(Constants.public.Enums.status_pagamento, { error: 'Escolha o status do pagamento.' }),
});

// O que a tela guarda enquanto o usuário preenche (as seleções começam vazias).
export type ManutencaoFormValues = Omit<z.input<typeof manutencaoSchema>, 'veiculoId' | 'formaPagamentoId'> & {
  veiculoId: string | null;
  formaPagamentoId: string | null;
};

// O que vai para o repositório depois de validado.
export type ManutencaoInput = z.output<typeof manutencaoSchema>;

// O caso comum é registrar no dia do serviço, e Pendente é o mesmo padrão de Movimentações.
// É função, não constante: "hoje" é calculado na hora em que o formulário abre.
export function valoresIniciais(): ManutencaoFormValues {
  return {
    veiculoId: null,
    dataManutencao: isoParaDataBR(hojeISO()),
    descricao: '',
    valorCentavos: 0,
    formaPagamentoId: null,
    statusPagamento: 'Pendente',
  };
}
