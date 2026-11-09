import { z } from 'zod';

import { Constants } from '@/types/database';

import { formatarHodometro } from './calculo';

// Schemas de validação da viagem. Os limites de forma repetem a tabela `viagem` e as
// constraints `viagem_hodometro_inicial_nao_negativo`, `viagem_hodometro_final_maior` e
// `viagem_finalizada_tem_hodometro_final` de
// supabase/migrations/20260924000300_frota.sql. A regra "um veículo, uma viagem em andamento"
// e os erros VGxxx vêm de supabase/migrations/20261015000100_viagem_regras.sql.
//
// Mensagens escritas à mão em português: a mensagem padrão do Zod nunca chega ao usuário
// (AGENTS.md §2.2, skill formulario-validado).
export const abrirViagemSchema = z.object({
  id: z
    .string('Identificador da viagem inválido.')
    .min(1, 'Identificador da viagem inválido.')
    .optional(),
  veiculo_id: z.string().min(1, 'Selecione um veículo.'),
  rota_id: z.string().min(1, 'Selecione uma rota.'),
  motorista_id: z.string().min(1, 'Motorista obrigatório.'),
  hodometro_inicial: z
    .number('Informe um número para o hodômetro inicial.')
    .nonnegative('O hodômetro inicial não pode ser negativo.'),
  data_inicio: z
    .string('Data de início inválida.')
    .min(1, 'Data de início inválida.')
    .optional()
    .nullable(),
});

// O schema estático do repositório não conhece o último hodômetro do veículo (que depende de
// consulta). A tela combina a validação de forma com esta regra contextual para manter a
// mensagem no schema, sem expor o valor de viagem de outro motorista.
export function abrirViagemComUltimoHodometroSchema(ultimoHodometro: number | null) {
  return abrirViagemSchema.superRefine((dados, ctx) => {
    if (ultimoHodometro !== null && dados.hodometro_inicial < ultimoHodometro) {
      ctx.addIssue({
        code: 'custom',
        path: ['hodometro_inicial'],
        message: `O hodômetro inicial não pode ser menor que o último final (${formatarHodometro(ultimoHodometro)} km).`,
      });
    }
  });
}

export const fecharViagemSchema = z.object({
  hodometro_final: z
    .number('Informe um número para o hodômetro final.')
    .positive('O hodômetro final deve ser maior que zero.'),
  data_fim: z
    .string('Data de fim inválida.')
    .min(1, 'Data de fim inválida.')
    .optional()
    .nullable(),
});

// A tela de fechamento conhece o hodômetro inicial da viagem e valida a regra crítica antes de
// chamar o banco. O repositório continua usando `fecharViagemSchema`, que recebe só o final.
export const fecharViagemFormSchema = fecharViagemSchema
  .extend({
    hodometro_inicial: z.number('Informe um número para o hodômetro inicial.'),
  })
  .superRefine((dados, ctx) => {
    if (dados.hodometro_final <= dados.hodometro_inicial) {
      ctx.addIssue({
        code: 'custom',
        path: ['hodometro_final'],
        message: `O hodômetro final deve ser maior que o inicial (${formatarHodometro(dados.hodometro_inicial)} km).`,
      });
    }
  });

export const corrigirHodometroFinalSchema = z.object({
  hodometro_final: z
    .number('Informe um número para o hodômetro final.')
    .positive('O hodômetro final deve ser maior que zero.'),
});

// Schemas de leitura: validam o que volta do PostgREST, inclusive as relações que podem vir
// como objeto ou array (dependendo da cardinalidade que o PostgREST infere).
export const veiculoResumoSchema = z.object({
  id: z.string(),
  placa: z.string(),
  marca: z.string(),
  modelo: z.string(),
  status: z.enum(Constants.public.Enums.status_veiculo),
});

export const rotaResumoSchema = z.object({
  id: z.string(),
  cidade_origem: z.string(),
  uf_origem: z.enum(Constants.public.Enums.uf),
  cidade_destino: z.string(),
  uf_destino: z.enum(Constants.public.Enums.uf),
  distancia_estimada_km: z.number(),
});

export const motoristaResumoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string().optional().nullable(),
});

export const viagemSchema = z.object({
  id: z.string(),
  veiculo_id: z.string(),
  rota_id: z.string(),
  motorista_id: z.string(),
  hodometro_inicial: z.number(),
  hodometro_final: z.number().nullable(),
  data_inicio: z.string().nullable(),
  data_fim: z.string().nullable(),
  status: z.enum(Constants.public.Enums.status_viagem),
  km_rodado: z.number().nullable(),
  // Só existe no SQLite; o PostgREST não devolve esta coluna. O default cobre as duas origens.
  em_revisao: z.boolean().optional().default(false),
  data_inclusao: z.string(),
  data_atualizacao: z.string(),
});

function normalizarRelacao<T>(valor: unknown): T | null | undefined {
  if (Array.isArray(valor)) {
    return (valor[0] as T) ?? null;
  }
  return (valor as T) ?? null;
}

export const viagemDetalhadaSchema = viagemSchema.extend({
  veiculo: z.preprocess(normalizarRelacao, veiculoResumoSchema.optional().nullable()),
  rota: z.preprocess(normalizarRelacao, rotaResumoSchema.optional().nullable()),
  motorista: z.preprocess(normalizarRelacao, motoristaResumoSchema.optional().nullable()),
});

export const revisaoViagemSchema = z.object({
  id: z.string(),
  viagem_id: z.string(),
  solicitante_id: z.string(),
  motorista_id: z.string().nullable(),
  motorista_nome: z.string().nullable(),
  veiculo_id: z.string().nullable(),
  veiculo_placa: z.string().nullable(),
  rota_id: z.string().nullable(),
  rota_trecho: z.string().nullable(),
  codigo: z.string(),
  mensagem: z.string(),
  payload: z.record(z.string(), z.unknown()),
  status: z.enum(Constants.public.Enums.status_revisao),
  observacao: z.string().nullable(),
  resolvido_por: z.string().nullable(),
  resolvido_em: z.string().nullable(),
  data_inclusao: z.string(),
  data_atualizacao: z.string(),
});

export const resolverRevisaoSchema = z.object({
  status: z.enum(['Resolvida', 'Descartada'], 'Selecione uma decisão para a revisão.'),
  observacao: z
    .string()
    .trim()
    .max(1000, 'A observação deve ter no máximo 1000 caracteres.')
    .optional()
    .or(z.literal('')),
});
