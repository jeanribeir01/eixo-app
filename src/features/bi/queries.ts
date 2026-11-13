import { z } from 'zod';

import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { supabase } from '@/supabase/client';

// Estatísticas de viagem, rota e veículo (US10, EIX-43). As US11, US12 e US13 leem daqui.
//
// Todo cálculo mora no banco (RNF06), nas RPCs da migration 20261113000100_bi.sql: este arquivo só
// chama, confere o formato com Zod e traduz o erro. A tela não soma, não divide e não ordena.
// Para exibir um número, use `formatarIndicador` (./formatar.ts): ele mostra "—" quando o banco
// devolve nulo (divisão por zero).
//
// Quem pode chamar: Admin, Gestor de Frota e Financeiro. As RPCs devolvem só agregados, por isso
// o Gestor vê totais financeiros e o Financeiro vê KM sem abrir as tabelas um do outro (RNF08).
//
// Unidades: dinheiro em centavos inteiros; KM com 1 casa; litros com 2; KM/L com 2.

export type Resultado<T> = { ok: true; data: T } | { ok: false; mensagem: string };

/** Período em ISO (AAAA-MM-DD), inclusivo nas duas pontas. É o que o `periodoCustomizadoSchema` devolve. */
export type Periodo = { dataInicial: string; dataFinal: string };

export const MENSAGEM_PERIODO_INVALIDO = 'Período inválido. Confira as datas do filtro.';
export const MENSAGEM_ERRO_ESTATISTICAS = 'Não foi possível carregar as estatísticas. Tente novamente.';
export const MENSAGEM_DADOS_INVALIDOS = 'Os dados recebidos são inválidos. Tente novamente.';

const centavos = z.number().int();
// Nulo = divisão por zero evitada no banco (sem KM ou sem litros).
const centavosOuNulo = centavos.nullable();

// O tipo gerado diz que nenhum campo de retorno é nulo (o gerador não sabe a nulidade do retorno
// de uma função). O Zod confere o que de fato chega.
const estatisticaViagemSchema = z.object({
  viagem_id: z.string(),
  veiculo_id: z.string(),
  placa: z.string(),
  rota_id: z.string(),
  cidade_origem: z.string(),
  uf_origem: z.string(),
  cidade_destino: z.string(),
  uf_destino: z.string(),
  status: z.enum(['EmAndamento', 'Finalizada']),
  data_inicio: z.string().nullable(),
  data_fim: z.string().nullable(),
  km_rodado: z.number().nullable(),
  receita_centavos: centavos,
  despesa_centavos: centavos,
  rentabilidade_centavos: centavos,
  litros: z.number().nullable(),
  custo_por_km_centavos: centavosOuNulo,
  consumo_km_por_litro: z.number().nullable(),
});

const estatisticaRotaSchema = z.object({
  rota_id: z.string(),
  cidade_origem: z.string(),
  uf_origem: z.string(),
  cidade_destino: z.string(),
  uf_destino: z.string(),
  quantidade_viagens: z.number().int(),
  km_total: z.number(),
  receita_centavos: centavos,
  despesa_centavos: centavos,
  lucro_centavos: centavos,
  custo_por_km_centavos: centavosOuNulo,
  mais_lucrativa: z.boolean(),
  maior_custo: z.boolean(),
});

const estatisticaVeiculoSchema = z.object({
  veiculo_id: z.string(),
  placa: z.string(),
  marca: z.string(),
  modelo: z.string(),
  quantidade_viagens: z.number().int(),
  km_total: z.number(),
  despesa_centavos: centavos,
  custo_por_km_centavos: centavosOuNulo,
});

/**
 * Uma viagem `EmAndamento` ou `Finalizada` (nunca `Cancelada`) iniciada no período.
 * - `rentabilidade_centavos` = Entradas − Saídas vinculadas, pagas e pendentes.
 * - `custo_por_km_centavos` = Saídas ÷ `km_rodado`. Nulo sem hodômetro final.
 * - `consumo_km_por_litro` = `km_rodado` ÷ `litros`. Nulo sem KM ou sem litros.
 * - Viagem sem lançamento vinculado: receita, despesa e rentabilidade valem 0.
 */
export type EstatisticaViagem = z.infer<typeof estatisticaViagemSchema>;

/**
 * Uma rota com ao menos uma viagem `Finalizada` no período; só as finalizadas entram nas somas.
 * - `lucro_centavos` = soma das rentabilidades.
 * - `custo_por_km_centavos` = Saídas somadas ÷ KM somados.
 * - `mais_lucrativa`: true só na "Rota Mais Lucrativa" (maior lucro).
 * - `maior_custo`: true só na "Rota com Maior Custo de Operação" (maior R$/KM).
 */
export type EstatisticaRota = z.infer<typeof estatisticaRotaSchema>;

/**
 * Um veículo com ao menos uma viagem `Finalizada` no período.
 * - `custo_por_km_centavos` = Saídas das viagens somadas ÷ KM somados (manutenção não entra).
 */
export type EstatisticaVeiculo = z.infer<typeof estatisticaVeiculoSchema>;

type NomeDaRpc = 'estatisticas_viagens' | 'estatisticas_rotas' | 'estatisticas_veiculos';

// As três RPCs têm o mesmo contrato (período de entrada, lista de saída, mesmos erros); só muda o
// formato da linha.
async function consultar<T>(rpc: NomeDaRpc, linha: z.ZodType<T>, periodo: Periodo): Promise<Resultado<T[]>> {
  const { data, error } = await supabase.rpc(rpc, {
    data_inicial: periodo.dataInicial,
    data_final: periodo.dataFinal,
  });

  if (error) {
    if (ehAcessoNegado(error)) return { ok: false, mensagem: MENSAGEM_ACESSO_NEGADO };
    // 22023: o mesmo período que o periodoCustomizadoSchema recusa. O texto do banco não vai à tela.
    if (error.code === '22023') return { ok: false, mensagem: MENSAGEM_PERIODO_INVALIDO };
    return { ok: false, mensagem: MENSAGEM_ERRO_ESTATISTICAS };
  }

  const parsed = z.array(linha).safeParse(data);
  if (!parsed.success) return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  // A ordem vem da RPC (mais recente primeiro; maior lucro; maior R$/KM). Não reordene na tela.
  return { ok: true, data: parsed.data };
}

/** Viagens do período, da mais recente para a mais antiga. RPC `estatisticas_viagens`. */
export function listarEstatisticasViagens(periodo: Periodo): Promise<Resultado<EstatisticaViagem[]>> {
  return consultar('estatisticas_viagens', estatisticaViagemSchema, periodo);
}

/** Rotas do período, da mais lucrativa para a menos. RPC `estatisticas_rotas`. */
export function listarEstatisticasRotas(periodo: Periodo): Promise<Resultado<EstatisticaRota[]>> {
  return consultar('estatisticas_rotas', estatisticaRotaSchema, periodo);
}

/** Veículos do período, do maior R$/KM para o menor. RPC `estatisticas_veiculos`. */
export function listarEstatisticasVeiculos(periodo: Periodo): Promise<Resultado<EstatisticaVeiculo[]>> {
  return consultar('estatisticas_veiculos', estatisticaVeiculoSchema, periodo);
}
