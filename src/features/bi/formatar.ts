import { formatarMoeda } from '@/lib/money';

// Só formatação para exibir os números das RPCs de BI (./queries.ts). Nenhum cálculo aqui.

export type UnidadeIndicador = 'moeda' | 'custoPorKm' | 'kmPorLitro';

// O banco devolve nulo quando a conta dividiria por zero (viagem sem KM ou sem litros). A tela
// mostra o travessão, nunca "Infinity", "NaN" ou "R$ 0,00" no lugar de "sem dado".
const SEM_VALOR = '—';

/**
 * Formata um indicador de BI no padrão brasileiro.
 * - `moeda`: centavos → "R$ 1.334,57"; negativo → "− R$ 100,00".
 * - `custoPorKm`: centavos por KM → "R$ 1,33/km".
 * - `kmPorLitro`: número → "3,33 km/L".
 * - nulo, em qualquer unidade → "—".
 */
export function formatarIndicador(valor: number | null, unidade: UnidadeIndicador): string {
  if (valor === null) return SEM_VALOR;

  if (unidade === 'kmPorLitro') return `${valor.toFixed(2).replace('.', ',')} km/L`;

  // formatarMoeda não trata negativo: o valor vai positivo e o sinal fica por conta daqui. Mesmo
  // formato do Caixa (formatarMoedaComSinal): cor nunca é o único indicador.
  const moeda = formatarMoeda(Math.abs(valor));
  const comSinal = valor < 0 ? `− ${moeda}` : moeda;
  return unidade === 'custoPorKm' ? `${comSinal}/km` : comSinal;
}
