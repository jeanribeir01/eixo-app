import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/ui';
import { colors, radius, spacing } from '@/ui/tokens';

import type { FrotaAgora } from '../frotaAgora';

type Fatia = { chave: keyof FrotaAgora['contagem']; rotulo: (n: number) => string; cor: string };

// Uma cor por situação, só como reforço: a legenda diz os números em texto (cor nunca sozinha). Na
// estrada é o azul da marca; disponível, o verde de "estado bom"; oficina, o laranja de "pede atenção".
const FATIAS: Fatia[] = [
  { chave: 'estrada', rotulo: (n) => `${n} na estrada`, cor: colors.accent },
  { chave: 'parado', rotulo: (n) => (n === 1 ? '1 disponível' : `${n} disponíveis`), cor: colors.success },
  { chave: 'oficina', rotulo: (n) => `${n} na oficina`, cor: colors.warning },
];

type ResumoDaFrotaProps = {
  contagem: FrotaAgora['contagem'];
  onPress: () => void;
};

// Cartão de destaque da aba Frota (um por tela): quantos veículos operam e como eles se dividem agora.
export function ResumoDaFrota({ contagem, onPress }: ResumoDaFrotaProps) {
  const total = contagem.estrada + contagem.parado + contagem.oficina;
  const titulo = total === 1 ? '1 veículo' : `${total} veículos`;
  const legenda = FATIAS.map((fatia) => fatia.rotulo(contagem[fatia.chave])).join(', ');

  return (
    <Card variant="feature" onPress={onPress} accessibilityLabel={`Frota agora: ${titulo}, ${legenda}. Ver veículos`}>
      <Text variant="bodySm" tone="body">
        Frota agora
      </Text>
      <Text variant="display" weight="semibold">
        {titulo}
      </Text>

      {total > 0 && (
        <View testID="barra-frota" style={styles.barra} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {FATIAS.filter((fatia) => contagem[fatia.chave] > 0).map((fatia) => (
            <View key={fatia.chave} style={{ flex: contagem[fatia.chave], backgroundColor: fatia.cor }} />
          ))}
        </View>
      )}

      <View style={styles.legenda}>
        {FATIAS.map((fatia) => (
          <View key={fatia.chave} style={styles.itemLegenda}>
            <View style={[styles.ponto, { backgroundColor: fatia.cor }]} />
            <Text variant="bodySm" tone="body">
              {fatia.rotulo(contagem[fatia.chave])}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // Fatias lado a lado num trilho de pílula; o vão separa as cores sem precisar de borda.
  barra: {
    flexDirection: 'row',
    height: spacing.md,
    borderRadius: radius.pill,
    overflow: 'hidden',
    gap: spacing.xs,
  },
  legenda: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.base,
    rowGap: spacing.xs,
  },
  itemLegenda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ponto: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radius.pill,
  },
});
