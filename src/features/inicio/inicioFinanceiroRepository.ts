import { z } from 'zod';

import { buscarResumoCaixa } from '@/features/caixa/fonteResumoCaixa';
import { buscarFluxoMensal } from '@/features/dashboard/graficos/queries';
import { listarManutencoes } from '@/features/manutencao/manutencaoRepository';
import type { ManutencaoComPlaca } from '@/features/manutencao/types';
import { listarMovimentacoesDoMes } from '@/features/movimentacoes/movimentacoesRepository';
import type { Movimentacao } from '@/features/movimentacoes/types';
import type { Usuario } from '@/features/usuarios/types';
import { listarUsuarios } from '@/features/usuarios/usuariosRepository';
import { hojeISO, mesDeHoje, somarDias } from '@/lib/datas';
import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { supabase } from '@/supabase/client';

// Dados do Início de Admin e Financeiro. Este arquivo só junta o que os módulos já expõem; toda soma
// vem pronta do banco (RNF06): saldo de `resumo_caixa`, o mês de `fluxo_caixa_mensal` e os próximos
// 7 dias de `kpis_financeiros`. O app só escolhe e ordena.
//
// O Início é uma tela de composição, como os hubs de src/navigation: lê Caixa e Frota sem que um
// módulo importe o outro (RNF08).

export type Resultado<T> = { ok: true; data: T } | { ok: false; mensagem: string };

// Quantas linhas a seção "Últimas movimentações" mostra; o resto fica a um toque, na lista completa.
export const QUANTIDADE_ULTIMAS = 3;

// Janela do "a pagar / a receber": hoje e os 6 dias seguintes.
export const DIAS_DA_JANELA = 7;

export const MENSAGEM_ERRO_INICIO = 'Não foi possível carregar o início. Tente novamente.';

export type ResumoInicioFinanceiro = {
  saldoAtualCentavos: number;
  // Entradas e saídas pagas no mês corrente (regime de caixa, como os gráficos).
  entradasDoMesCentavos: number;
  saidasDoMesCentavos: number;
  // Pendentes com vencimento de hoje até `ateData`, inclusive.
  aPagarCentavos: number;
  aReceberCentavos: number;
  ateData: string;
  ultimasMovimentacoes: Movimentacao[];
  // `null` = o perfil não vê o assunto (só o Admin vê usuários; só quem vê a frota, manutenções).
  usuariosAguardando: Usuario[] | null;
  manutencoesAbertas: ManutencaoComPlaca[] | null;
};

type Opcoes = { verUsuarios: boolean; verManutencoes: boolean };

// O que o card "do período" de kpis_financeiros devolve e o Início usa.
const kpisSchema = z.object({
  totalReceberCentavos: z.number().int(),
  totalPagarCentavos: z.number().int(),
});

async function buscarProximosDias(hoje: string, ate: string): Promise<Resultado<z.infer<typeof kpisSchema>>> {
  const { data, error } = await supabase.rpc('kpis_financeiros', { data_inicial: hoje, data_final: ate });
  if (error) return { ok: false, mensagem: ehAcessoNegado(error) ? MENSAGEM_ACESSO_NEGADO : MENSAGEM_ERRO_INICIO };
  const parsed = kpisSchema.safeParse(data);
  if (!parsed.success) return { ok: false, mensagem: MENSAGEM_ERRO_INICIO };
  return { ok: true, data: parsed.data };
}

// Lançadas por último primeiro: é o que quem abre o app quer conferir ("o frete de hoje entrou?").
export function ultimasLancadas(movimentacoes: Movimentacao[], quantidade = QUANTIDADE_ULTIMAS): Movimentacao[] {
  return [...movimentacoes].sort((a, b) => b.data_inclusao.localeCompare(a.data_inclusao)).slice(0, quantidade);
}

const SEM_DADO = Promise.resolve({ ok: true as const, data: null });

// Uma falha em qualquer parte vira o estado de erro da tela inteira, com "Tentar novamente": um Início
// pela metade daria a impressão de que não há nada pedindo atenção.
export async function buscarInicioFinanceiro({ verUsuarios, verManutencoes }: Opcoes): Promise<Resultado<ResumoInicioFinanceiro>> {
  const hoje = hojeISO();
  const ateData = somarDias(hoje, DIAS_DA_JANELA - 1);
  const { ano, mes } = mesDeHoje();

  const [resumo, fluxo, proximos, movimentacoes, usuarios, manutencoes] = await Promise.all([
    buscarResumoCaixa(),
    // 3 é o menor horizonte que a RPC aceita; o Início usa só o último mês, que é o atual.
    buscarFluxoMensal(hoje, 3),
    buscarProximosDias(hoje, ateData),
    listarMovimentacoesDoMes(ano, mes),
    verUsuarios ? listarUsuarios() : SEM_DADO,
    verManutencoes ? listarManutencoes() : SEM_DADO,
  ]);

  // A primeira falha decide a mensagem. O acesso negado tem texto próprio, que vem do repositório.
  if (!resumo.ok) return { ok: false, mensagem: resumo.mensagem };
  if (!fluxo.ok) return { ok: false, mensagem: fluxo.mensagem };
  if (!proximos.ok) return { ok: false, mensagem: proximos.mensagem };
  if (!movimentacoes.ok) return { ok: false, mensagem: movimentacoes.mensagem };
  if (!usuarios.ok) return { ok: false, mensagem: usuarios.mensagem };
  if (!manutencoes.ok) return { ok: false, mensagem: manutencoes.mensagem };

  const mesAtual = hoje.slice(0, 7);
  const doMes = fluxo.data.find((item) => item.mes === mesAtual);

  return {
    ok: true,
    data: {
      saldoAtualCentavos: resumo.data.saldoAtualCentavos,
      entradasDoMesCentavos: doMes?.entradas_centavos ?? 0,
      saidasDoMesCentavos: doMes?.saidas_centavos ?? 0,
      aPagarCentavos: proximos.data.totalPagarCentavos,
      aReceberCentavos: proximos.data.totalReceberCentavos,
      ateData,
      ultimasMovimentacoes: ultimasLancadas(movimentacoes.data),
      usuariosAguardando: usuarios.data && usuarios.data.filter((usuario) => usuario.status === 'AguardandoAprovacao'),
      manutencoesAbertas: manutencoes.data && manutencoes.data.filter((manutencao) => manutencao.data_conclusao === null),
    },
  };
}
