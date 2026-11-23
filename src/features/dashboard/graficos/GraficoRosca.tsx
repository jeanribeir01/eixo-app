import { memo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { formatarMoeda } from '@/lib/money';
import { Column, Text } from '@/ui';
import { colors, radius, spacing, touchTarget } from '@/ui/tokens';

import { caminhoDoSetor, corDaFatia, DIAMETRO_MAX_ROSCA, ESPESSURA_ANEL, setoresDaRosca } from './geometria';
import type { FatiaDespesa } from './queries';

type GraficoRoscaProps = {
  fatias: FatiaDespesa[];
};

// 60.1 → "60,1%". O percentual vem pronto do banco, com 1 casa; aqui só troca o separador.
function formatarPercentual(percentual: number): string {
  return `${percentual.toFixed(1).replace('.', ',')}%`;
}

// Rosca das despesas pagas por categoria (US12, GRAF-13). Totais e percentuais vêm do banco; aqui só se
// desenha. Tocar numa fatia ou na linha da legenda mostra categoria, valor e percentual no centro. A
// legenda é o alvo de toque garantido (44pt), mesmo para uma fatia fina demais para o dedo.
export const GraficoRosca = memo(function GraficoRosca({ fatias }: GraficoRoscaProps) {
  // Começa na maior despesa: o valor exato já aparece sem precisar tocar.
  const [selecionada, setSelecionada] = useState(0);
  const [largura, setLargura] = useState(0);

  const diametro = largura > 0 ? Math.min(DIAMETRO_MAX_ROSCA, largura) : DIAMETRO_MAX_ROSCA;
  const centro = diametro / 2;
  const setores = setoresDaRosca(fatias.map((fatia) => fatia.total_centavos));
  const fatia = fatias[Math.min(selecionada, fatias.length - 1)];

  function medir(evento: LayoutChangeEvent) {
    setLargura(evento.nativeEvent.layout.width);
  }

  return (
    <Column gap="lg">
      <View onLayout={medir} style={styles.area}>
        <View style={{ width: diametro, height: diametro }}>
          <Svg width={diametro} height={diametro}>
            {setores.map((setor, indice) => {
              const ativa = indice === selecionada;
              // A fatia escolhida fica do tamanho cheio; as outras recuam 4pt: destaque sem cor nova.
              const raioExterno = ativa ? centro : centro - spacing.xs;
              return (
                <Path
                  key={fatias[indice]!.categoria_id ?? 'outras'}
                  testID={`fatia-${indice}`}
                  d={caminhoDoSetor(centro, raioExterno, centro - ESPESSURA_ANEL, setor)}
                  fill={corDaFatia(indice, fatias[indice]!.categoria_id === null)}
                  fillRule="evenodd"
                  onPress={() => setSelecionada(indice)}
                />
              );
            })}
          </Svg>
          {fatia && (
            <View style={[StyleSheet.absoluteFill, styles.centro]} pointerEvents="none" accessibilityLiveRegion="polite">
              <Text variant="bodySm" tone="body" numberOfLines={1}>
                {fatia.titulo}
              </Text>
              <Text variant="subheading" numberOfLines={1} adjustsFontSizeToFit>
                {formatarMoeda(fatia.total_centavos)}
              </Text>
              <Text variant="bodySm" tone="body">
                {formatarPercentual(fatia.percentual)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Legenda: cada cor vem com o nome e o percentual (cor nunca é o único indicador). */}
      <View>
        {fatias.map((item, indice) => {
          const ativa = indice === selecionada;
          return (
            <Pressable
              key={item.categoria_id ?? 'outras'}
              accessibilityRole="button"
              accessibilityLabel={`${item.titulo}: ${formatarMoeda(item.total_centavos)}, ${formatarPercentual(item.percentual)}`}
              accessibilityState={{ selected: ativa }}
              onPress={() => setSelecionada(indice)}
              style={[styles.linha, ativa && styles.linhaAtiva]}
            >
              <View style={[styles.amostra, { backgroundColor: corDaFatia(indice, item.categoria_id === null) }]} />
              <View style={styles.titulo}>
                <Text numberOfLines={1} weight={ativa ? 'medium' : 'regular'}>
                  {item.titulo}
                </Text>
              </View>
              <Text tone="body">{formatarPercentual(item.percentual)}</Text>
            </Pressable>
          );
        })}
      </View>
    </Column>
  );
});

const styles = StyleSheet.create({
  area: {
    alignItems: 'center',
  },
  // O texto do centro não invade o anel.
  centro: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ESPESSURA_ANEL + spacing.sm,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.icon,
  },
  linhaAtiva: {
    backgroundColor: colors.border,
  },
  titulo: {
    flex: 1,
  },
  amostra: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: radius.icon,
  },
});
