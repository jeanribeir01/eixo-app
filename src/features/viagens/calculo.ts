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
 * Lê o hodômetro digitado no padrão brasileiro: ponto separa milhar e vírgula separa decimal.
 * "15.000" e "15.000,5" precisam virar 15000 e 15000.5 — `Number(texto.replace(',', '.'))`
 * transformava o primeiro em 15 e o segundo em NaN.
 */
export function parseHodometro(valor: string): number | null {
  const texto = valor.trim();
  if (!texto) return null;

  // Com vírgula, todo ponto é separador de milhar (ex.: "1.234.567,8").
  // Sem vírgula, "15.000" também é milhar; "15000.5" continua aceito como decimal.
  const normalizado = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(texto)
      ? texto.replace(/\./g, '')
      : texto;

  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null;

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
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
