import { colors, spacing, touchTarget } from '@/ui/tokens';

import type { Horizonte } from './queries';

// Geometria e medidas dos gráficos da US12. Só desenho: nenhum valor exibido é calculado aqui (as
// somas e os percentuais vêm do banco). Os números abaixo derivam dos tokens para não haver medida
// solta na tela (AGENTS.md §2.1); os gráficos não têm token próprio em src/ui/tokens.ts.

/** Altura da área das barras: 192pt. */
export const ALTURA_BARRAS = spacing.xxl * 4;
/** Largura mínima de uma coluna de mês: o alvo de toque de 44pt (DESIGN_CYAN §6). */
export const LARGURA_MIN_COLUNA = touchTarget;
/** Uma barra com valor acima de zero nunca some: no mínimo 4pt. */
export const ALTURA_MIN_BARRA = spacing.xs;
/** Diâmetro máximo da rosca (240pt). Em tela estreita, ela encolhe para caber. */
export const DIAMETRO_MAX_ROSCA = spacing.xxl * 5;
/** Espessura do anel da rosca. */
export const ESPESSURA_ANEL = spacing.lg;

// Entrada verde e saída vermelha, como no resto do app (valores, cartão do mês na aba Caixa). Antes a
// saída era preta e destoava. Cada cor aparece com rótulo ao lado: cor nunca é o único indicador.
export const COR_ENTRADAS = colors.success;
export const COR_SAIDAS = colors.danger;
// A rosca é toda de despesas: vermelho em tudo não separa nada. As fatias vão do azul da marca aos
// neutros stone, da maior para a menor, sem o preto (que lia como "saída" no gráfico de barras).
const CORES_DAS_FATIAS = [colors.accentStrong, colors.accent, colors.textBody, colors.accentWash, colors.borderMuted];
const COR_OUTRAS = colors.textMuted;

/** Cor da fatia na posição `indice` (0 = maior). "Outras" tem cor própria, sempre a mais apagada. */
export function corDaFatia(indice: number, ehOutras: boolean): string {
  if (ehOutras) return COR_OUTRAS;
  return CORES_DAS_FATIAS[indice % CORES_DAS_FATIAS.length]!;
}

// As abas do horizonte das barras. O valor é texto porque o primitivo Tabs trabalha com texto.
export const OPCOES_HORIZONTE: { label: string; value: string }[] = [
  { label: '3 meses', value: '3' },
  { label: '6 meses', value: '6' },
  { label: '1 ano', value: '12' },
  { label: '2 anos', value: '24' },
  { label: 'Máximo', value: 'max' },
];

/** O critério de aceite pede "últimos 6 meses" como visão inicial. */
export const HORIZONTE_PADRAO = '6';

const HORIZONTES: Record<string, Horizonte> = { '3': 3, '6': 6, '12': 12, '24': 24, max: null };

/** Converte o valor da aba no horizonte da RPC. Valor desconhecido devolve `undefined`. */
export function horizonteDaOpcao(valor: string): Horizonte | undefined {
  return valor in HORIZONTES ? HORIZONTES[valor] : undefined;
}

/**
 * Mês final das barras: a data final do filtro, mas nunca depois de hoje. A aba "Ano" de 2026 termina
 * em dezembro; mostrar barras zeradas de meses que ainda não aconteceram confundiria. Datas em ISO
 * (AAAA-MM-DD) comparam certo como texto.
 */
export function mesFinalDoGrafico(dataFinalDoFiltro: string, hoje: string): string {
  return dataFinalDoFiltro < hoje ? dataFinalDoFiltro : hoje;
}

/** Altura da barra proporcional ao maior valor do gráfico. Zero fica sem barra; acima de zero, no mínimo 4pt. */
export function alturaDaBarra(valor: number, maior: number, alturaTotal: number): number {
  if (valor <= 0 || maior <= 0) return 0;
  return Math.max(ALTURA_MIN_BARRA, Math.round((valor / maior) * alturaTotal));
}

export type Setor = { inicio: number; fim: number };

/**
 * Ângulos de cada fatia, em graus, no sentido horário a partir do topo (0° = 12 horas). Proporcionais
 * aos totais: o percentual do banco é arredondado e somaria 99,9 ou 100,1, deixando o anel aberto.
 */
export function setoresDaRosca(totais: number[]): Setor[] {
  const soma = totais.reduce((acumulado, total) => acumulado + total, 0);
  if (soma <= 0) return [];

  let inicio = 0;
  return totais.map((total) => {
    const fim = inicio + (total / soma) * 360;
    const setor = { inicio, fim };
    inicio = fim;
    return setor;
  });
}

function ponto(centro: number, raio: number, graus: number): string {
  // 0° no topo: subtrai 90° do ângulo do círculo trigonométrico (que começa às 3 horas).
  const radianos = ((graus - 90) * Math.PI) / 180;
  const x = centro + raio * Math.cos(radianos);
  const y = centro + raio * Math.sin(radianos);
  return `${x.toFixed(3)} ${y.toFixed(3)}`;
}

/**
 * `d` do Path SVG de uma fatia: um pedaço de anel entre `raioInterno` e `raioExterno`, centrado em
 * (`centro`, `centro`). Uma fatia de 360° não tem como ser desenhada como arco (início e fim coincidem):
 * vira dois círculos, e o Path precisa de `fillRule="evenodd"` para o miolo ficar vazado.
 */
export function caminhoDoSetor(centro: number, raioExterno: number, raioInterno: number, setor: Setor): string {
  if (setor.fim - setor.inicio >= 360) {
    const circulo = (raio: number) =>
      `M ${ponto(centro, raio, 0)} A ${raio} ${raio} 0 1 1 ${ponto(centro, raio, 180)} ` +
      `A ${raio} ${raio} 0 1 1 ${ponto(centro, raio, 360)} Z`;
    return `${circulo(raioExterno)} ${circulo(raioInterno)}`;
  }

  const arcoGrande = setor.fim - setor.inicio > 180 ? 1 : 0;
  return [
    `M ${ponto(centro, raioExterno, setor.inicio)}`,
    `A ${raioExterno} ${raioExterno} 0 ${arcoGrande} 1 ${ponto(centro, raioExterno, setor.fim)}`,
    `L ${ponto(centro, raioInterno, setor.fim)}`,
    `A ${raioInterno} ${raioInterno} 0 ${arcoGrande} 0 ${ponto(centro, raioInterno, setor.inicio)}`,
    'Z',
  ].join(' ');
}
