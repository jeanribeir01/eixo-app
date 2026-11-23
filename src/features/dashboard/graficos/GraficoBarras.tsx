import { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { formatarMes, formatarMoedaComSinal } from '@/features/caixa/formatadores';
import { Column, Text } from '@/ui';
import { colors, radius, spacing } from '@/ui/tokens';

import { ALTURA_BARRAS, alturaDaBarra, COR_ENTRADAS, COR_SAIDAS, LARGURA_MIN_COLUNA } from './geometria';
import type { MesDoFluxo } from './queries';

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

type GraficoBarrasProps = {
  meses: MesDoFluxo[];
};

// '2026-01' → 'jan'. O ano aparece embaixo na primeira coluna e em janeiro, para o gráfico de 2 anos
// não deixar dúvida de qual "jan" é qual.
function rotuloDaColuna(mes: string, indice: number): { mesCurto: string; ano: string | null } {
  const [ano, numero] = mes.split('-');
  return { mesCurto: MESES_CURTOS[Number(numero) - 1]!, ano: indice === 0 || numero === '01' ? ano! : null };
}

// Entrada com "+", Saída com "−" (zero fica sem sinal): cor nunca é o único indicador.
function entradas(centavos: number): string {
  return formatarMoedaComSinal(centavos);
}
function saidas(centavos: number): string {
  return formatarMoedaComSinal(-centavos);
}

// Barras de Entradas vs Saídas pagas por mês (US12, GRAF-06/07). Os valores vêm somados do banco;
// aqui só se desenha. Tocar numa coluna mostra os valores exatos do mês acima do gráfico. A coluna
// tem no mínimo 44pt: se os meses não cabem na largura, o gráfico rola na horizontal.
export const GraficoBarras = memo(function GraficoBarras({ meses }: GraficoBarrasProps) {
  // Começa no mês mais recente: o valor exato já aparece sem precisar tocar.
  const [selecionado, setSelecionado] = useState(meses.length - 1);
  const [largura, setLargura] = useState(0);

  const maior = Math.max(0, ...meses.map((m) => Math.max(m.entradas_centavos, m.saidas_centavos)));
  const larguraDaColuna = Math.max(LARGURA_MIN_COLUNA, meses.length > 0 ? largura / meses.length : 0);
  const mes = meses[Math.min(selecionado, meses.length - 1)];

  function medir(evento: LayoutChangeEvent) {
    setLargura(evento.nativeEvent.layout.width);
  }

  return (
    <Column gap="md">
      {mes && (
        <View accessibilityLiveRegion="polite">
          <Text variant="bodySm" tone="body">
            {formatarMes(mes.mes)}
          </Text>
          <Column direction="row" gap="lg" wrap>
            <Text>
              {'Entradas '}
              <Text tone={mes.entradas_centavos > 0 ? 'success' : 'primary'}>{entradas(mes.entradas_centavos)}</Text>
            </Text>
            <Text>
              {'Saídas '}
              <Text tone={mes.saidas_centavos > 0 ? 'danger' : 'primary'}>{saidas(mes.saidas_centavos)}</Text>
            </Text>
          </Column>
        </View>
      )}

      <View onLayout={medir}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.eixo}>
            {meses.map((item, indice) => {
              const { mesCurto, ano } = rotuloDaColuna(item.mes, indice);
              const ativo = indice === selecionado;
              return (
                <Pressable
                  key={item.mes}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatarMes(item.mes)}: entradas ${entradas(item.entradas_centavos)}, saídas ${saidas(item.saidas_centavos)}`}
                  accessibilityState={{ selected: ativo }}
                  onPress={() => setSelecionado(indice)}
                  style={[styles.coluna, { width: larguraDaColuna }, ativo && styles.colunaAtiva]}
                >
                  <View style={styles.barras}>
                    <View
                      style={[
                        styles.barra,
                        { height: alturaDaBarra(item.entradas_centavos, maior, ALTURA_BARRAS), backgroundColor: COR_ENTRADAS },
                      ]}
                    />
                    <View
                      style={[
                        styles.barra,
                        { height: alturaDaBarra(item.saidas_centavos, maior, ALTURA_BARRAS), backgroundColor: COR_SAIDAS },
                      ]}
                    />
                  </View>
                  <Text variant="caption" tone={ativo ? 'primary' : 'body'} weight={ativo ? 'medium' : 'regular'}>
                    {mesCurto}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {ano ?? ' '}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Legenda: a cor sempre vem com o nome (cor nunca é o único indicador). */}
      <Column direction="row" gap="lg">
        <Column direction="row" gap="xs" align="center">
          <View style={[styles.amostra, { backgroundColor: COR_ENTRADAS }]} />
          <Text variant="bodySm" tone="body">
            Entradas
          </Text>
        </Column>
        <Column direction="row" gap="xs" align="center">
          <View style={[styles.amostra, { backgroundColor: COR_SAIDAS }]} />
          <Text variant="bodySm" tone="body">
            Saídas
          </Text>
        </Column>
      </Column>
    </Column>
  );
});

const styles = StyleSheet.create({
  eixo: {
    flexDirection: 'row',
  },
  coluna: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
    borderRadius: radius.icon,
  },
  colunaAtiva: {
    backgroundColor: colors.border,
  },
  // A linha de base é uma hairline, como o resto do app (a borda é a estrutura). As colunas encostam
  // umas nas outras, então as linhas de cada uma formam um eixo contínuo.
  barras: {
    alignSelf: 'stretch',
    height: ALTURA_BARRAS,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  barra: {
    width: spacing.md,
    borderTopLeftRadius: radius.icon,
    borderTopRightRadius: radius.icon,
  },
  amostra: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: radius.icon,
  },
});
