// Regras de negócio de hodômetro e quilometragem para a interface (US08 / EIX-40).

/**
 * Cálculo Offline (Passo 3.1):
 * Na UI, renderiza a quilometragem usando: km_rodado ?? (hodometro_final - hodometro_inicial).
 * Permite exibir a distância mesmo se a coluna gerada do banco ainda não tiver sido sincronizada.
 */
export function calcularKmRodado(dados: {
  km_rodado?: number | null;
  hodometro_final?: number | null;
  hodometro_inicial: number;
}): number | null {
  if (dados.km_rodado !== null && dados.km_rodado !== undefined) {
    return dados.km_rodado;
  }
  if (dados.hodometro_final !== null && dados.hodometro_final !== undefined) {
    return dados.hodometro_final - dados.hodometro_inicial;
  }
  return null;
}

/**
 * Formata quilometragem no padrão brasileiro.
 */
export function formatarKm(km: number | null | undefined): string {
  if (km === null || km === undefined) return '—';
  return `${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

/**
 * Formata número de hodômetro.
 */
export function formatarHodometro(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

/**
 * Aviso Visual (Passo 3.3):
 * Detecta se a distância rodada calculada ultrapassa significativamente a estimativa da rota.
 * Tolerância padrão: 20% acima da distância estimada.
 */
export function distanciaUltrapassaEstimativa(
  kmRodado: number | null | undefined,
  distanciaEstimadaKm: number | null | undefined,
  toleranciaPercentual = 0.2,
): boolean {
  if (kmRodado === null || kmRodado === undefined || kmRodado <= 0) return false;
  if (distanciaEstimadaKm === null || distanciaEstimadaKm === undefined || distanciaEstimadaKm <= 0) return false;
  return kmRodado > distanciaEstimadaKm * (1 + toleranciaPercentual);
}
