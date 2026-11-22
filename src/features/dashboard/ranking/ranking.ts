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
  // Outro item tem a mesma métrica, inclusive um que ficou fora do corte do Top 3. A tela avisa,
  // porque a posição repetida sozinha confunde e o item cortado não aparece para mostrar o empate.
  empatado: boolean;
};

export type Ranking = {
  rotasMaisLucrativas: ItemRanqueado<EstatisticaRota>[];
  veiculosMaiorCustoPorKm: ItemRanqueado<EstatisticaVeiculo>[];
  // Houve viagem finalizada no período, mas nenhuma rota deu lucro: o ranking de rotas fica vazio por
  // isso, e não por falta de viagem. A tela usa para explicar o vazio com o motivo certo.
  rotasSemLucro: boolean;
  // Houve veículo com viagem finalizada, mas nenhum rodou KM: sem KM não existe custo por KM.
  veiculosSemKm: boolean;
};

/**
 * Numera a posição de cada item e corta os primeiros `TAMANHO_DO_RANKING`, na ordem em que chegaram.
 * `itens` precisa vir ordenado pela métrica, do melhor colocado para o pior (a RPC já entrega assim).
 * Com menos de 3 itens, devolve só os que existem.
 */
export function ranquear<T>(itens: readonly T[], metrica: (item: T) => number): ItemRanqueado<T>[] {
  // Posição e empate são decididos na lista inteira, e só depois se corta o Top 3. Cortar antes
  // esconderia o empate entre o 3º e o 4º: o 4º sumiria e o 3º apareceria sem o aviso de "Empate".
  const valores = itens.map(metrica);

  const ranqueados = itens.map((item, indice) => {
    const valor = valores[indice];
    // Como a lista está ordenada, o primeiro item com o mesmo valor é quem define a posição do grupo.
    const primeiroComOMesmoValor = valores.indexOf(valor);
    const empatado = valores.some((outro, outroIndice) => outroIndice !== indice && outro === valor);
    return { item, posicao: primeiroComOMesmoValor + 1, empatado };
  });

  return ranqueados.slice(0, TAMANHO_DO_RANKING);
}

/**
 * Busca as duas visões do ranking no mesmo período, juntas: trocar de aba não espera outra consulta.
 * Se qualquer uma falhar, devolve o erro dela (mensagem em português já traduzida pela US10).
 */
export async function buscarRanking(periodo: Periodo): Promise<Resultado<Ranking>> {
  const [rotas, veiculos] = await Promise.all([listarEstatisticasRotas(periodo), listarEstatisticasVeiculos(periodo)]);

  if (!rotas.ok) return rotas;
  if (!veiculos.ok) return veiculos;

  // Rota que deu prejuízo (ou empatou em zero) não entra em "rotas mais lucrativas": mostrar um lucro
  // negativo sob esse título diria que a rota é lucrativa quando ela perdeu dinheiro.
  const comLucro = rotas.data.filter((rota) => rota.lucro_centavos > 0);

  // Veículo sem KM rodado tem R$/KM nulo (o banco evita a divisão por zero) e vem por último. Sem
  // custo por KM não há o que ranquear: ele fica fora, em vez de ocupar uma posição com "—".
  const comCustoPorKm = veiculos.data.filter(
    (veiculo): veiculo is EstatisticaVeiculo & { custo_por_km_centavos: number } =>
      veiculo.custo_por_km_centavos !== null,
  );

  return {
    ok: true,
    data: {
      rotasMaisLucrativas: ranquear(comLucro, (rota) => rota.lucro_centavos),
      veiculosMaiorCustoPorKm: ranquear(comCustoPorKm, (veiculo) => veiculo.custo_por_km_centavos),
      rotasSemLucro: rotas.data.length > 0 && comLucro.length === 0,
      veiculosSemKm: veiculos.data.length > 0 && comCustoPorKm.length === 0,
    },
  };
}
