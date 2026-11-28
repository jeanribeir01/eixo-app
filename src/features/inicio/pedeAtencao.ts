import type { Href } from 'expo-router';

import type { ManutencaoComPlaca } from '@/features/manutencao/types';
import type { Usuario } from '@/features/usuarios/types';
import { diasEntre, isoParaDataBR } from '@/lib/datas';
import { formatarMoeda } from '@/lib/money';
import type { IconName, TextTone } from '@/ui';

// "Pede atenção" do Início: o que alguém precisa resolver, já na ordem de urgência. Função pura, sem
// tela e sem banco, para o teste cobrir cada regra. No Admin/Financeiro: dinheiro saindo primeiro,
// depois pessoas esperando, depois veículo parado.

export type ItemAtencao = {
  id: 'pagar' | 'receber' | 'usuarios' | 'manutencoes' | 'revisoes';
  titulo: string;
  detalhe: string;
  icone: IconName;
  // O tom só reforça: o título sempre diz o mesmo em palavras.
  tom: TextTone;
  href: Href;
};

type Entrada = {
  hoje: string;
  ateData: string;
  aPagarCentavos: number;
  aReceberCentavos: number;
  usuariosAguardando: Usuario[] | null;
  manutencoesAbertas: ManutencaoComPlaca[] | null;
};

function plural(quantidade: number, singular: string, pluralTexto: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : pluralTexto}`;
}

export function pedeAtencao(entrada: Entrada): ItemAtencao[] {
  const itens: ItemAtencao[] = [];
  const ate = isoParaDataBR(entrada.ateData).slice(0, 5);

  if (entrada.aPagarCentavos > 0) {
    itens.push({
      id: 'pagar',
      titulo: 'Contas a pagar nos próximos 7 dias',
      detalhe: `${formatarMoeda(entrada.aPagarCentavos)} até ${ate}`,
      icone: 'calendario',
      tom: 'warning',
      href: '/movimentacoes',
    });
  }

  if (entrada.aReceberCentavos > 0) {
    itens.push({
      id: 'receber',
      titulo: 'A receber nos próximos 7 dias',
      detalhe: `${formatarMoeda(entrada.aReceberCentavos)} até ${ate}`,
      icone: 'saldo',
      tom: 'accent',
      href: '/movimentacoes',
    });
  }

  const usuarios = entrada.usuariosAguardando ?? [];
  if (usuarios.length > 0) {
    const [primeiro] = usuarios;
    itens.push({
      id: 'usuarios',
      titulo: `${plural(usuarios.length, 'usuário aguardando', 'usuários aguardando')} aprovação`,
      detalhe:
        usuarios.length === 1 ? `${primeiro.nome} pediu acesso` : `${primeiro.nome} e mais ${usuarios.length - 1}`,
      icone: 'usuarios',
      tom: 'accent',
      href: '/usuarios',
    });
  }

  const manutencoes = itemManutencoes(entrada.manutencoesAbertas ?? [], entrada.hoje);
  if (manutencoes) itens.push(manutencoes);

  return itens;
}

// Manutenção aberta = veículo parado. Aparece no Início do Admin e no do Gestor de Frota.
export function itemManutencoes(manutencoes: ManutencaoComPlaca[], hoje: string): ItemAtencao | null {
  if (manutencoes.length === 0) return null;
  // A mais antiga é a que mais pesa: veículo parado há mais tempo.
  const maisAntiga = [...manutencoes].sort((a, b) => a.data_manutencao.localeCompare(b.data_manutencao))[0];
  const dias = Math.max(diasEntre(maisAntiga.data_manutencao.slice(0, 10), hoje), 0);
  return {
    id: 'manutencoes',
    titulo:
      manutencoes.length === 1
        ? `Manutenção aberta há ${plural(dias, 'dia', 'dias')}`
        : `${manutencoes.length} manutenções abertas`,
    detalhe: `${maisAntiga.placa} · ${maisAntiga.descricao}`,
    icone: 'manutencoes',
    tom: 'body',
    href: '/manutencoes',
  };
}

type EntradaFrota = {
  hoje: string;
  revisoesPendentes: number;
  manutencoesAbertas: ManutencaoComPlaca[];
};

// Gestor de Frota: primeiro a viagem que o servidor recusou (o dado do motorista está preso no
// aparelho até alguém decidir), depois o veículo parado.
export function pedeAtencaoFrota(entrada: EntradaFrota): ItemAtencao[] {
  const itens: ItemAtencao[] = [];

  if (entrada.revisoesPendentes > 0) {
    itens.push({
      id: 'revisoes',
      titulo: `${plural(entrada.revisoesPendentes, 'viagem', 'viagens')} para revisar`,
      detalhe: 'Registrada sem internet e não gravada: confira com o motorista',
      icone: 'alerta',
      tom: 'warning',
      href: '/viagens/revisoes',
    });
  }

  const manutencoes = itemManutencoes(entrada.manutencoesAbertas, entrada.hoje);
  if (manutencoes) itens.push(manutencoes);

  return itens;
}
