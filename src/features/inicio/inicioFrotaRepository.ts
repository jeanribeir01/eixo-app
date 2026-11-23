import { listarManutencoes } from '@/features/manutencao/manutencaoRepository';
import type { ManutencaoComPlaca } from '@/features/manutencao/types';
import type { StatusVeiculo } from '@/features/veiculos/types';
import { contarRevisoesPendentes } from '@/features/viagens/revisoesRepository';
import type { ViagemDetalhada } from '@/features/viagens/types';
import { listarViagens } from '@/features/viagens/viagensRepository';
import { ehAcessoNegado, MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { supabase } from '@/supabase/client';

import { MENSAGEM_ERRO_INICIO, type Resultado } from './inicioFinanceiroRepository';

// Dados do Início do Gestor de Frota. As viagens vêm do banco local (offline-first, RNF01): o card
// "na estrada" abre mesmo sem sinal. As contagens são feitas pelo Postgres (`count` com `head`), não
// somadas no app (RNF06).

export type ContagemFrota = Record<'Disponivel' | 'EmViagem' | 'EmManutencao', number>;

export type ResumoInicioFrota = {
  viagensEmAndamento: ViagemDetalhada[];
  veiculos: ContagemFrota;
  revisoesPendentes: number;
  manutencoesAbertas: ManutencaoComPlaca[];
};

async function contarVeiculos(status: StatusVeiculo): Promise<Resultado<number>> {
  const { count, error } = await supabase.from('veiculo').select('id', { count: 'exact', head: true }).eq('status', status);
  if (error) return { ok: false, mensagem: ehAcessoNegado(error) ? MENSAGEM_ACESSO_NEGADO : MENSAGEM_ERRO_INICIO };
  return { ok: true, data: count ?? 0 };
}

// Mesma regra do Início financeiro: qualquer parte que falhar vira o estado de erro da tela inteira.
export async function buscarInicioFrota(): Promise<Resultado<ResumoInicioFrota>> {
  const [viagens, disponiveis, emViagem, emManutencao, revisoes, manutencoes] = await Promise.all([
    listarViagens({ status: 'EmAndamento' }),
    contarVeiculos('Disponivel'),
    contarVeiculos('EmViagem'),
    contarVeiculos('EmManutencao'),
    contarRevisoesPendentes(),
    listarManutencoes(),
  ]);

  if (!viagens.ok) return { ok: false, mensagem: viagens.mensagem };
  if (!disponiveis.ok) return { ok: false, mensagem: disponiveis.mensagem };
  if (!emViagem.ok) return { ok: false, mensagem: emViagem.mensagem };
  if (!emManutencao.ok) return { ok: false, mensagem: emManutencao.mensagem };
  if (!revisoes.ok) return { ok: false, mensagem: revisoes.mensagem };
  if (!manutencoes.ok) return { ok: false, mensagem: manutencoes.mensagem };

  return {
    ok: true,
    data: {
      viagensEmAndamento: viagens.data,
      veiculos: { Disponivel: disponiveis.data, EmViagem: emViagem.data, EmManutencao: emManutencao.data },
      revisoesPendentes: revisoes.data,
      manutencoesAbertas: manutencoes.data.filter((manutencao) => manutencao.data_conclusao === null),
    },
  };
}
