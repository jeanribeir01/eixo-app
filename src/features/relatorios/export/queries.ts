import { z } from 'zod';

import type { Periodo } from '@/features/dashboard/periodo';
import { dataLocalISO } from '@/lib/datas';
import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { reaisParaCentavos } from '@/lib/money';
import type { Resultado } from '@/lib/useDadosDaTela';
import { supabase } from '@/supabase/client';

import type { TransacaoRelatorio } from './linhas';

export const MENSAGEM_ERRO_RELATORIO = 'Não foi possível gerar o relatório. Tente novamente.';

// O PostgREST devolve no máximo 1000 linhas por chamada (max-rows do Supabase). Um ano de lançamentos
// pode passar disso, e cortar em silêncio daria um relatório errado: por isso a busca pagina.
export const TAMANHO_PAGINA = 1000;

const COLUNAS = 'id, valor, descricao, data_vencimento, data_inclusao, status_pagamento, categoria(titulo, tipo)';

const linhaSchema = z.object({
  id: z.string(),
  valor: z.number(),
  descricao: z.string(),
  data_vencimento: z.string().nullable(),
  data_inclusao: z.string(),
  status_pagamento: z.enum(['Pendente', 'Pago']),
  categoria: z.object({ titulo: z.string(), tipo: z.enum(['Entrada', 'Saida']) }),
});

// Início do dia local, em UTC, como o Supabase compara `timestamptz`. Lê os números do texto ISO:
// passar o texto direto para Date o trataria como meia-noite UTC e trocaria o dia no fuso de Brasília.
function inicioDoDiaLocal(iso: string, diasDepois = 0): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia + diasDepois).toISOString();
}

// Mesma regra da lista de Movimentações (`dataDeReferencia`): o lançamento entra no período pelo
// vencimento; sem vencimento, pelo dia local em que foi incluído.
function filtroDoPeriodo({ dataInicial, dataFinal }: Pick<Periodo, 'dataInicial' | 'dataFinal'>): string {
  // Instantes entre aspas: têm ":" e ".", que o filtro .or() do PostgREST trataria como sintaxe.
  return (
    `and(data_vencimento.gte.${dataInicial},data_vencimento.lte.${dataFinal}),` +
    `and(data_vencimento.is.null,data_inclusao.gte."${inicioDoDiaLocal(dataInicial)}",` +
    `data_inclusao.lt."${inicioDoDiaLocal(dataFinal, 1)}")`
  );
}

function paraTransacao(linha: z.infer<typeof linhaSchema>): TransacaoRelatorio {
  return {
    id: linha.id,
    dataReferencia: linha.data_vencimento ?? dataLocalISO(new Date(linha.data_inclusao)),
    descricao: linha.descricao,
    categoria: linha.categoria.titulo,
    tipo: linha.categoria.tipo,
    valorCentavos: reaisParaCentavos(linha.valor),
    status: linha.status_pagamento,
  };
}

// Ordem do arquivo: data crescente; no mesmo dia, descrição em ordem alfabética; por fim o id, para
// duas exportações do mesmo período saírem sempre iguais.
function compararTransacoes(a: TransacaoRelatorio, b: TransacaoRelatorio): number {
  return (
    a.dataReferencia.localeCompare(b.dataReferencia) ||
    a.descricao.localeCompare(b.descricao, 'pt-BR') ||
    a.id.localeCompare(b.id)
  );
}

// Todas as transações do período (pendentes e pagas), já na ordem do relatório. Quem pode ler
// `movimentacao` é o RLS que decide (Admin e Financeiro); 42501 vira a mensagem de acesso negado.
export async function buscarTransacoesDoPeriodo(
  periodo: Pick<Periodo, 'dataInicial' | 'dataFinal'>,
): Promise<Resultado<TransacaoRelatorio[]>> {
  const filtro = filtroDoPeriodo(periodo);
  const transacoes: TransacaoRelatorio[] = [];

  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    // Ordem fixa por id: sem ela, duas páginas podem repetir ou pular linhas.
    const { data, error } = await supabase
      .from('movimentacao')
      .select(COLUNAS)
      .or(filtro)
      .order('id')
      .range(inicio, inicio + TAMANHO_PAGINA - 1);

    if (error) {
      return { ok: false, mensagem: ehAcessoNegado(error) ? MENSAGEM_ACESSO_NEGADO : MENSAGEM_ERRO_RELATORIO };
    }

    const parsed = z.array(linhaSchema).safeParse(data);
    if (!parsed.success) return { ok: false, mensagem: MENSAGEM_ERRO_RELATORIO };

    transacoes.push(...parsed.data.map(paraTransacao));
    // Página incompleta = acabou. Página cheia pode ter mais depois.
    if (parsed.data.length < TAMANHO_PAGINA) break;
  }

  transacoes.sort(compararTransacoes);
  return { ok: true, data: transacoes };
}
