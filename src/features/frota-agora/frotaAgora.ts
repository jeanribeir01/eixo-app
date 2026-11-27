import { listarManutencoes } from '@/features/manutencao/manutencaoRepository';
import type { ManutencaoComPlaca } from '@/features/manutencao/types';
import { listarVeiculos } from '@/features/veiculos/repository';
import type { Veiculo } from '@/features/veiculos/types';
import type { ViagemDetalhada } from '@/features/viagens/types';
import { listarViagens } from '@/features/viagens/viagensRepository';
import { dataLocalISO, diasEntre, hojeISO } from '@/lib/datas';

// A aba Frota responde "o que cada veículo está fazendo agora". O Início do Gestor olha pelas viagens
// (quem está na estrada); aqui o ponto de partida é o veículo, inclusive o que está parado, que é o que
// custa dinheiro sem gerar frete.

export type Resultado<T> = { ok: true; data: T } | { ok: false; mensagem: string };

export type SituacaoAgora =
  // `viagem` pode faltar: o veículo está EmViagem no banco, mas a viagem ainda não chegou a este aparelho.
  | { tipo: 'estrada'; viagem: ViagemDetalhada | null }
  // `manutencao` pode faltar pelo mesmo motivo (status mudou, a ordem de serviço não veio na lista).
  | { tipo: 'oficina'; manutencao: ManutencaoComPlaca | null; dias: number | null }
  // `dias` nulo: o veículo nunca fez viagem nem saiu de manutenção registrada.
  | { tipo: 'parado'; dias: number | null };

export type VeiculoAgora = { veiculo: Veiculo; situacao: SituacaoAgora };

export type FrotaAgora = {
  // Mesma lista das linhas, contada aqui para os números do resumo baterem com o que aparece embaixo.
  contagem: { estrada: number; parado: number; oficina: number };
  veiculos: VeiculoAgora[];
};

type Entrada = {
  veiculos: Veiculo[];
  viagensEmAndamento: ViagemDetalhada[];
  viagensFinalizadas: ViagemDetalhada[];
  manutencoes: ManutencaoComPlaca[];
  hoje: string;
};

// A última vez que o veículo ficou livre: o fim da viagem mais recente ou a conclusão da manutenção mais
// recente, o que vier depois. É dali que conta o "parado há N dias".
function liberadoEm(veiculoId: string, { viagensFinalizadas, manutencoes }: Entrada): string | null {
  const datas = [
    ...viagensFinalizadas
      .filter((viagem) => viagem.veiculo_id === veiculoId && viagem.data_fim)
      .map((viagem) => dataLocalISO(new Date(viagem.data_fim!))),
    ...manutencoes
      .filter((manutencao) => manutencao.veiculo_id === veiculoId && manutencao.data_conclusao)
      // `data_conclusao` é timestamptz: vira a data deste aparelho, como o fim da viagem.
      .map((manutencao) => dataLocalISO(new Date(manutencao.data_conclusao!))),
  ];
  return datas.length === 0 ? null : datas.reduce((maior, data) => (data > maior ? data : maior));
}

function situacaoDe(veiculo: Veiculo, entrada: Entrada): SituacaoAgora | null {
  if (veiculo.status === 'EmViagem') {
    return { tipo: 'estrada', viagem: entrada.viagensEmAndamento.find((viagem) => viagem.veiculo_id === veiculo.id) ?? null };
  }
  if (veiculo.status === 'EmManutencao') {
    // A lista vem da mais recente para a mais antiga: a primeira aberta é a atual.
    const aberta = entrada.manutencoes.find((item) => item.veiculo_id === veiculo.id && item.data_conclusao === null) ?? null;
    return { tipo: 'oficina', manutencao: aberta, dias: aberta ? diasEntre(aberta.data_manutencao, entrada.hoje) : null };
  }
  if (veiculo.status === 'Disponivel') {
    const desde = liberadoEm(veiculo.id, entrada);
    return { tipo: 'parado', dias: desde ? Math.max(diasEntre(desde, entrada.hoje), 0) : null };
  }
  // Desativado não é frota em operação: fica na lista de Veículos, não aqui.
  return null;
}

const ORDEM = { estrada: 0, oficina: 1, parado: 2 } as const;

function diasPara(situacao: SituacaoAgora): number {
  return situacao.tipo === 'estrada' ? 0 : (situacao.dias ?? -1);
}

// Na ordem em que o gestor age: quem está rodando, quem está na oficina, quem está parado. Dentro de
// oficina e parados, o mais antigo primeiro, porque é o que mais pede decisão.
export function montarFrotaAgora(entrada: Entrada): FrotaAgora {
  const veiculos: VeiculoAgora[] = [];
  for (const veiculo of entrada.veiculos) {
    const situacao = situacaoDe(veiculo, entrada);
    if (situacao) veiculos.push({ veiculo, situacao });
  }

  veiculos.sort(
    (a, b) =>
      ORDEM[a.situacao.tipo] - ORDEM[b.situacao.tipo] ||
      diasPara(b.situacao) - diasPara(a.situacao) ||
      a.veiculo.placa.localeCompare(b.veiculo.placa),
  );

  const contar = (tipo: SituacaoAgora['tipo']) => veiculos.filter((item) => item.situacao.tipo === tipo).length;
  return { contagem: { estrada: contar('estrada'), parado: contar('parado'), oficina: contar('oficina') }, veiculos };
}

// Uma falha em qualquer parte vira o erro do bloco inteiro: um veículo sem a situação certa engana.
export async function buscarFrotaAgora(): Promise<Resultado<FrotaAgora>> {
  const [veiculos, emAndamento, finalizadas, manutencoes] = await Promise.all([
    listarVeiculos(),
    // As viagens vêm do banco local (offline-first, RNF01), como no Início do Gestor.
    listarViagens({ status: 'EmAndamento' }),
    listarViagens({ status: 'Finalizada', limite: 500 }),
    listarManutencoes(),
  ]);

  if (!veiculos.ok) return veiculos;
  if (!emAndamento.ok) return emAndamento;
  if (!finalizadas.ok) return finalizadas;
  if (!manutencoes.ok) return manutencoes;

  return {
    ok: true,
    data: montarFrotaAgora({
      veiculos: veiculos.data,
      viagensEmAndamento: emAndamento.data,
      viagensFinalizadas: finalizadas.data,
      manutencoes: manutencoes.data,
      hoje: hojeISO(),
    }),
  };
}
