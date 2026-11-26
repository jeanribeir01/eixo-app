import { StyleSheet, View } from 'react-native';

import { Text, colors, radius, spacing } from '@/ui';

import { formatarMoedaComSinal } from '../formatadores';

// Medidas derivadas dos tokens (AGENTS.md §2.1): os gráficos não têm token próprio.
/** Altura da área das barras: 144pt. */
const ALTURA_GRAFICO = spacing.xxl * 3;
/** Barra com valor diferente de zero nunca some: no mínimo 4pt. */
const ALTURA_MIN_BARRA = spacing.xs;

export type PontoDoGrafico = {
  chave: string;
  // Rótulo curto embaixo da barra ("nov", "2027").
  rotulo: string;
  // Nome completo do período, para o leitor de tela ("Novembro de 2026").
  titulo: string;
  centavos: number;
};

// Altura de cada barra em proporção ao maior valor do lado dela (acima ou abaixo do zero). Só desenho:
// os saldos vêm prontos do banco (RNF06).
function alturaDaBarra(centavos: number, maior: number, areaDisponivel: number): number {
  if (centavos === 0 || maior === 0) return 0;
  return Math.max(ALTURA_MIN_BARRA, (Math.abs(centavos) / maior) * areaDisponivel);
}

// Saldo projetado ao longo do tempo, uma barra por período. Positivo cresce para cima a partir do zero,
// negativo cresce para baixo e fica vermelho; a lista logo abaixo traz o valor exato de cada período,
// então o gráfico é um resumo visual e o leitor de tela recebe a mesma informação numa frase só.
export function GraficoSaldoProjetado({ pontos }: { pontos: PontoDoGrafico[] }) {
  const maiorPositivo = Math.max(0, ...pontos.map((ponto) => ponto.centavos));
  const maiorNegativo = Math.max(0, ...pontos.map((ponto) => -ponto.centavos));
  const total = maiorPositivo + maiorNegativo;
  // O eixo do zero divide a altura na proporção dos dois lados; sem negativo, ele fica no pé do gráfico.
  const areaPositiva = total === 0 ? ALTURA_GRAFICO : (maiorPositivo / total) * ALTURA_GRAFICO;
  const areaNegativa = ALTURA_GRAFICO - areaPositiva;

  const primeiro = pontos[0];
  const ultimo = pontos.at(-1);
  const resumo =
    primeiro && ultimo
      ? `Saldo projetado de ${primeiro.titulo.toLowerCase()} a ${ultimo.titulo.toLowerCase()}: de ${formatarMoedaComSinal(primeiro.centavos)} a ${formatarMoedaComSinal(ultimo.centavos)}.`
      : 'Sem saldo projetado.';

  return (
    <View testID="grafico-saldo-projetado" accessible accessibilityRole="image" accessibilityLabel={resumo}>
      <View style={styles.colunas}>
        {pontos.map((ponto) => {
          const negativo = ponto.centavos < 0;
          return (
            <View key={ponto.chave} style={styles.coluna}>
              <View style={[styles.lado, styles.ladoPositivo, { height: areaPositiva }]}>
                {!negativo && (
                  <View
                    testID={`barra-${ponto.chave}`}
                    style={[styles.barra, styles.barraPositiva, { height: alturaDaBarra(ponto.centavos, maiorPositivo, areaPositiva) }]}
                  />
                )}
              </View>
              {areaNegativa > 0 && (
                <View style={[styles.lado, { height: areaNegativa }]}>
                  {negativo && (
                    <View
                      testID={`barra-${ponto.chave}`}
                      style={[styles.barra, styles.barraNegativa, { height: alturaDaBarra(ponto.centavos, maiorNegativo, areaNegativa) }]}
                    />
                  )}
                </View>
              )}
              <Text variant="caption" tone="body" numberOfLines={1}>
                {ponto.rotulo}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  colunas: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  coluna: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  lado: {
    width: '100%',
    justifyContent: 'flex-start',
  },
  // Acima do zero a barra encosta no eixo, embaixo; abaixo do zero ela pende do eixo, em cima.
  ladoPositivo: {
    justifyContent: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  barra: {
    width: '100%',
    borderRadius: radius.icon,
  },
  barraPositiva: {
    backgroundColor: colors.accentStrong,
  },
  barraNegativa: {
    backgroundColor: colors.danger,
  },
});
