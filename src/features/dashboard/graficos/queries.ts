import { z } from 'zod';

import { MENSAGEM_DADOS_INVALIDOS, MENSAGEM_PERIODO_INVALIDO, type Periodo, type Resultado } from '@/features/bi/queries';
import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { supabase } from '@/supabase/client';

// Dados dos gráficos de fluxo de caixa (US12, EIX-45). A soma e o percentual moram no banco (RNF06),
// nas RPCs da migration 20261122000100_graficos_caixa.sql: este arquivo só chama, confere o formato
// com Zod e traduz o erro. Regime de caixa: só o que foi pago, pela data de pagamento.
//
// Quem pode chamar: Admin e Financeiro. Os outros perfis recebem 42501.

export const MENSAGEM_ERRO_GRAFICO = 'Não foi possível carregar o gráfico. Tente novamente.';

/** Meses do gráfico de barras. `null` = "Máximo": desde o primeiro pagamento registrado. */
export type Horizonte = 3 | 6 | 12 | 24 | null;

const centavos = z.number().int();

const mesDoFluxoSchema = z.object({
  // 'AAAA-MM'
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  entradas_centavos: centavos,
  saidas_centavos: centavos,
});

// O tipo gerado diz que categoria_id nunca é nulo (o gerador não sabe a nulidade do retorno de uma
// função). Na linha "Outras" ele é nulo; o Zod confere o que de fato chega.
const fatiaDespesaSchema = z.object({
  categoria_id: z.string().nullable(),
  titulo: z.string(),
  total_centavos: centavos,
  percentual: z.number(),
});

/** Um mês do gráfico de barras: Entradas e Saídas pagas naquele mês, em centavos. */
export type MesDoFluxo = z.infer<typeof mesDoFluxoSchema>;

/**
 * Uma fatia da rosca: total pago na categoria e a parte dela no total de Saídas do período (1 casa).
 * `categoria_id` nulo = "Outras" (da 6ª categoria em diante, somadas). A ordem vem do banco.
 */
export type FatiaDespesa = z.infer<typeof fatiaDespesaSchema>;

function traduzirErro(error: { code: string }): string {
  if (ehAcessoNegado(error)) return MENSAGEM_ACESSO_NEGADO;
  // 22023: parâmetro que o banco recusa (período do filtro ou horizonte). O texto do banco não vai à tela.
  if (error.code === '22023') return MENSAGEM_PERIODO_INVALIDO;
  return MENSAGEM_ERRO_GRAFICO;
}

/**
 * Entradas e Saídas pagas por mês, do mais antigo ao mais recente, terminando no mês de `mesFinal`
 * (ISO, qualquer dia do mês). RPC `fluxo_caixa_mensal`. Mês sem movimento vem com zero.
 */
export async function buscarFluxoMensal(mesFinal: string, horizonte: Horizonte): Promise<Resultado<MesDoFluxo[]>> {
  const { data, error } = await supabase.rpc('fluxo_caixa_mensal', {
    mes_final: mesFinal,
    // O gerador de tipos não sabe que o parâmetro aceita nulo (o "Máximo" da RPC). O cast só cobre
    // essa lacuna do tipo gerado; o banco recusa com 22023 qualquer valor fora de 3, 6, 12, 24 e nulo.
    meses: horizonte as number,
  });

  if (error) return { ok: false, mensagem: traduzirErro(error) };

  const parsed = z.array(mesDoFluxoSchema).safeParse(data);
  if (!parsed.success) return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  return { ok: true, data: parsed.data };
}

/** Saídas pagas no período por categoria, da maior para a menor, "Outras" no fim. RPC `despesas_por_categoria`. */
export async function buscarDespesasPorCategoria(periodo: Periodo): Promise<Resultado<FatiaDespesa[]>> {
  const { data, error } = await supabase.rpc('despesas_por_categoria', {
    data_inicial: periodo.dataInicial,
    data_final: periodo.dataFinal,
  });

  if (error) return { ok: false, mensagem: traduzirErro(error) };

  const parsed = z.array(fatiaDespesaSchema).safeParse(data);
  if (!parsed.success) return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  return { ok: true, data: parsed.data };
}
