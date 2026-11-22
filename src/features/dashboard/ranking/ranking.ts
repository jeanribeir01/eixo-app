import {
  listarEstatisticasRotas,
  listarEstatisticasVeiculos,
  type EstatisticaRota,
  type EstatisticaVeiculo,
  type Periodo,
  type Resultado,
} from '@/features/bi/queries';

// Ranking de eficiência logística (US13, EIX-46). Os números vêm prontos das RPCs da US10
// (src/features/bi/queries.ts), já na ordem do ranking: rotas do maior lucro para o menor, veículos do
// maior R$/KM para o menor, com desempate fixo no banco. Aqui não se soma nem se reordena nada (RNF06):
// só se corta o Top 3 e se numera a posição de cada item.

export const TAMANHO_DO_RANKING = 3;

export type ItemRanqueado<T> = {
  item: T;
  // Posição em "competição": dois itens com a mesma métrica dividem a posição e o próximo pula
  // (1º, 1º, 3º). É o jeito que um pódio é lido, e não esconde que houve empate.
  posicao: number;
  // Outro item do Top 3 tem a mesma métrica. A tela avisa, porque a posição repetida sozinha confunde.
  empatado: boolean;
};

export type Ranking = {
  rotasMaisLucrativas: ItemRanqueado<EstatisticaRota>[];
  veiculosMaiorCustoPorKm: ItemRanqueado<EstatisticaVeiculo>[];
};

/**
 * Corta os primeiros `TAMANHO_DO_RANKING` itens, na ordem em que chegaram, e numera a posição.
 * `itens` precisa vir ordenado pela métrica, do melhor colocado para o pior (a RPC já entrega assim).
 * Com menos de 3 itens, devolve só os que existem.
 */
export function ranquear<T>(itens: readonly T[], metrica: (item: T) => number): ItemRanqueado<T>[] {
  const topo = itens.slice(0, TAMANHO_DO_RANKING);

  return topo.map((item, indice) => {
    const valor = metrica(item);
    // Como a lista está ordenada, o primeiro item com o mesmo valor é quem define a posição do grupo.
    const primeiroComOMesmoValor = topo.findIndex((outro) => metrica(outro) === valor);
    const empatado = topo.some((outro, outroIndice) => outroIndice !== indice && metrica(outro) === valor);
    return { item, posicao: primeiroComOMesmoValor + 1, empatado };
  });
}

/**
 * Busca as duas visões do ranking no mesmo período, juntas: trocar de aba não espera outra consulta.
 * Se qualquer uma falhar, devolve o erro dela (mensagem em português já traduzida pela US10).
 */
export async function buscarRanking(periodo: Periodo): Promise<Resultado<Ranking>> {
  const [rotas, veiculos] = await Promise.all([listarEstatisticasRotas(periodo), listarEstatisticasVeiculos(periodo)]);

  if (!rotas.ok) return rotas;
  if (!veiculos.ok) return veiculos;

  // Veículo sem KM rodado tem R$/KM nulo (o banco evita a divisão por zero) e vem por último. Sem
  // custo por KM não há o que ranquear: ele fica fora, em vez de ocupar uma posição com "—".
  const comCustoPorKm = veiculos.data.filter(
    (veiculo): veiculo is EstatisticaVeiculo & { custo_por_km_centavos: number } =>
      veiculo.custo_por_km_centavos !== null,
  );

  return {
    ok: true,
    data: {
      rotasMaisLucrativas: ranquear(rotas.data, (rota) => rota.lucro_centavos),
      veiculosMaiorCustoPorKm: ranquear(comCustoPorKm, (veiculo) => veiculo.custo_por_km_centavos),
    },
  };
}
