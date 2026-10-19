import { z } from 'zod';

import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { centavosParaReais, reaisParaCentavos } from '@/lib/money';
import { supabase } from '@/supabase/client';
import { Constants } from '@/types/database';

import type { ManutencaoInput } from './schema';
import type {
  FormaPagamentoOpcao,
  ManutencaoComPlaca,
  ManutencaoItem,
  VeiculoComHistorico,
  VeiculoResumo,
} from './types';

// Camada de acesso a dados isolada da tela (AGENTS.md §2.3, skill supabase-query).
// Escrita só pelas RPCs `registrar_manutencao` e `concluir_manutencao` (migration
// 20261014000300): o banco não aceita insert, update nem delete direto em `manutencao`, e a RPC
// grava a manutenção, a despesa e o status do veículo numa transação só (AD-008).
// A leitura continua direta via PostgREST; o RLS libera `manutencao` e `veiculo` para Admin e
// Gestor de Frota.

export type Resultado<T> = { ok: true; data: T } | { ok: false; mensagem: string };

type Falha = Extract<Resultado<never>, { ok: false }>;

const COLUNAS_MANUTENCAO = 'id, veiculo_id, descricao, data_manutencao, valor, data_conclusao';

// O limite só impede uma resposta sem teto (skill supabase-query).
const LIMITE_LISTA = 500;

const MENSAGEM_DADOS_INVALIDOS = 'Os dados recebidos são inválidos. Tente novamente.';

// Dado externo não é confiável só porque o TypeScript compilou: a resposta passa pelo Zod.
// Os enums vêm de `Constants` (gerado), então acompanham o banco sem lista escrita à mão.
const manutencaoSchema = z.object({
  id: z.string(),
  veiculo_id: z.string(),
  descricao: z.string(),
  data_manutencao: z.string(),
  valor: z.number(),
  data_conclusao: z.string().nullable(),
});

const manutencaoComPlacaSchema = manutencaoSchema.extend({ veiculo: z.object({ placa: z.string() }) });

const veiculoSchema = z.object({
  id: z.string(),
  placa: z.string(),
  marca: z.string(),
  modelo: z.string(),
  status: z.enum(Constants.public.Enums.status_veiculo),
});

const veiculoComHistoricoSchema = veiculoSchema.extend({ manutencao: z.array(manutencaoSchema) });

const formaPagamentoSchema = z.object({ id: z.string(), nome: z.string() });

type ErroSupabase = { code: string };

// Os códigos vêm das RPCs da migration 20261014000300 (os MN*** são nossos). O texto do banco
// nunca chega ao usuário. `P0002` muda de sentido conforme a RPC, por isso cada chamada passa a
// própria mensagem de "não encontrado".
function traduzirErro(
  error: ErroSupabase,
  mensagens: { padrao: string; naoEncontrado?: string },
): Falha {
  const traduzida = (() => {
    if (ehAcessoNegado(error)) return MENSAGEM_ACESSO_NEGADO;
    switch (error.code) {
      case 'MN001':
        return 'Veículo em viagem não pode entrar em manutenção. Feche a viagem antes.';
      case 'MN002':
        return 'Veículo inativo não pode receber manutenção.';
      case 'MN003':
        return 'A categoria Manutenção está inativa. Peça ao Financeiro para reativá-la.';
      case '22023':
        return 'Forma de pagamento inativa. Escolha outra.';
      // 23514 = check ou trigger do banco (valor > 0, data não futura). O form já barra; chegar
      // aqui é algo que passou pelo app.
      case '23514':
        return 'Confira o valor e a data da manutenção.';
      case 'P0002':
        return mensagens.naoEncontrado ?? mensagens.padrao;
      default:
        return mensagens.padrao;
    }
  })();
  return { ok: false, mensagem: traduzida };
}

// `numeric` em reais vira centavos inteiros na borda (CLAUDE.md §5).
function paraItem({ valor, ...resto }: z.infer<typeof manutencaoSchema>): ManutencaoItem {
  return { ...resto, valorCentavos: reaisParaCentavos(valor) };
}

// O banco já devolve da data mais recente para a mais antiga; aqui só as abertas sobem para o
// topo. O sort do JavaScript é estável, então a ordem de data se mantém dentro de cada grupo.
// Não dá para pedir isso ao banco com `order('data_conclusao')`: as concluídas sairiam pela data
// de conclusão, e a spec pede pela data da manutenção.
function abertasPrimeiro<T extends ManutencaoItem>(itens: T[]): T[] {
  return [...itens].sort((a, b) => Number(a.data_conclusao !== null) - Number(b.data_conclusao !== null));
}

export async function registrarManutencao(input: ManutencaoInput): Promise<Resultado<string>> {
  const { data, error } = await supabase.rpc('registrar_manutencao', {
    veiculo_id: input.veiculoId,
    descricao: input.descricao,
    data_manutencao: input.dataManutencao,
    // A RPC recebe `numeric` em reais; o app guarda centavos. A conversão é uma divisão só,
    // na borda: 113 centavos viram 1.13.
    valor: centavosParaReais(input.valorCentavos),
    forma_pagamento_id: input.formaPagamentoId,
    status_pagamento: input.statusPagamento,
  });

  if (error) {
    return traduzirErro(error, {
      padrao: 'Não foi possível registrar a manutenção. Tente novamente.',
      naoEncontrado: 'Veículo não encontrado.',
    });
  }

  // A RPC devolve o id da manutenção criada.
  const parsed = z.string().safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  }
  return { ok: true, data: parsed.data };
}

// Devolve o status final do veículo: `Disponivel` se esta era a última manutenção aberta,
// `EmManutencao` se ainda há outra. A tela escolhe o texto do Snackbar por ele.
export async function concluirManutencao(id: string): Promise<Resultado<VeiculoResumo['status']>> {
  const { data, error } = await supabase.rpc('concluir_manutencao', { id });

  if (error) {
    return traduzirErro(error, {
      padrao: 'Não foi possível concluir a manutenção. Tente novamente.',
      naoEncontrado: 'Manutenção não encontrada ou já concluída.',
    });
  }

  const parsed = z.enum(Constants.public.Enums.status_veiculo).safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  }
  return { ok: true, data: parsed.data };
}

export async function listarManutencoes(): Promise<Resultado<ManutencaoComPlaca[]>> {
  const { data, error } = await supabase
    .from('manutencao')
    .select(`${COLUNAS_MANUTENCAO}, veiculo(placa)`)
    .order('data_manutencao', { ascending: false })
    .limit(LIMITE_LISTA);

  if (error) {
    return traduzirErro(error, { padrao: 'Não foi possível carregar as manutenções. Tente novamente.' });
  }

  const parsed = z.array(manutencaoComPlacaSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  }

  const itens = parsed.data.map(({ veiculo, ...manutencao }) => ({ ...paraItem(manutencao), placa: veiculo.placa }));
  return { ok: true, data: abertasPrimeiro(itens) };
}

// Uma consulta só: o veículo com as manutenções dele (FK `manutencao.veiculo_id`).
export async function buscarVeiculoComHistorico(id: string): Promise<Resultado<VeiculoComHistorico>> {
  const { data, error } = await supabase
    .from('veiculo')
    .select(`id, placa, marca, modelo, status, manutencao(${COLUNAS_MANUTENCAO})`)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return traduzirErro(error, { padrao: 'Não foi possível carregar o veículo. Tente novamente.' });
  }
  // Sem linha também é o que o RLS devolve quando o perfil não pode ler: para a tela, "não encontrado".
  if (!data) {
    return { ok: false, mensagem: 'Veículo não encontrado.' };
  }

  const parsed = veiculoComHistoricoSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  }

  const { manutencao, ...veiculo } = parsed.data;
  // O histórico é só por data (mais recente primeiro): aqui abertas e concluídas ficam juntas.
  const manutencoes = manutencao
    .map(paraItem)
    .sort((a, b) => b.data_manutencao.localeCompare(a.data_manutencao));
  return { ok: true, data: { ...veiculo, manutencoes } };
}

// TODO(EIX-79): trocar pelo filtro de "selecionáveis" quando ele existir. Por enquanto, todo
// veículo que não está inativo aparece; o que está em viagem é recusado pela RPC com MN001, e a
// tela mostra o motivo.
export async function listarVeiculosSelecionaveis(): Promise<Resultado<VeiculoResumo[]>> {
  const { data, error } = await supabase
    .from('veiculo')
    .select('id, placa, marca, modelo, status')
    .neq('status', 'Inativo')
    .order('placa')
    .limit(LIMITE_LISTA);

  if (error) {
    return traduzirErro(error, { padrao: 'Não foi possível carregar os veículos. Tente novamente.' });
  }

  const parsed = z.array(veiculoSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  }
  return { ok: true, data: parsed.data };
}

// Pela RPC, não pela tabela: o Gestor de Frota não lê `forma_pagamento` direto (AD-013). A função
// (migration 20261018000200) devolve só id e nome das formas ativas, já ordenadas por nome.
export async function listarFormasPagamentoAtivas(): Promise<Resultado<FormaPagamentoOpcao[]>> {
  const { data, error } = await supabase.rpc('listar_formas_pagamento_ativas');

  if (error) {
    return traduzirErro(error, { padrao: 'Não foi possível carregar as formas de pagamento. Tente novamente.' });
  }

  const parsed = z.array(formaPagamentoSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  }
  return { ok: true, data: parsed.data };
}
