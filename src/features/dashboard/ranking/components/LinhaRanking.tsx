import { StyleSheet, View } from 'react-native';

import { Icon, ListItem, Text, spacing } from '@/ui';

type LinhaRankingProps = {
  posicao: number;
  empatado: boolean;
  titulo: string;
  subtitulo: string;
  // Nome da métrica ("Lucro", "Custo por KM"): o número sozinho não diz o que está sendo ranqueado.
  rotuloMetrica: string;
  // Já formatada (formatarIndicador da US10): "R$ 1.334,57", "R$ 1,33/km".
  metrica: string;
  // Sem onPress a linha só informa: o perfil não tem acesso ao detalhe (o Financeiro não abre a Frota).
  onPress?: () => void;
};

// Uma posição do ranking (US13): posição à esquerda, o item no meio, a métrica à direita. Usa o modo
// livre do ListItem porque a linha padrão não tem lugar para a posição; o toque, o ripple e o alvo de
// 44pt continuam sendo os do ListItem.
export function LinhaRanking({ posicao, empatado, titulo, subtitulo, rotuloMetrica, metrica, onPress }: LinhaRankingProps) {
  const lugar = `${posicao}º`;
  // O leitor de tela lê a linha inteira de uma vez, na ordem em que o olho lê.
  const rotuloAcessivel = [
    `${lugar} lugar${empatado ? ', empatado' : ''}`,
    titulo,
    `${rotuloMetrica} ${metrica}`,
    onPress ? 'Toque para abrir o detalhe' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <ListItem onPress={onPress} accessibilityLabel={rotuloAcessivel}>
      {/* Sem onPress o ListItem vira uma View; o rótulo vai aqui para o leitor ler a linha junta. */}
      <View style={styles.linha} accessible={!onPress} accessibilityLabel={onPress ? undefined : rotuloAcessivel}>
        <View style={styles.posicao}>
          <Text variant="subheading" tone="body">
            {lugar}
          </Text>
        </View>

        <View style={styles.textos}>
          <Text numberOfLines={1}>{titulo}</Text>
          <Text variant="bodySm" tone="body" numberOfLines={1}>
            {empatado ? `Empate · ${subtitulo}` : subtitulo}
          </Text>
        </View>

        <View style={styles.metrica}>
          <Text variant="caption" tone="body">
            {rotuloMetrica}
          </Text>
          <Text weight="medium">{metrica}</Text>
        </View>

        {onPress && <Icon name="avancar" tone="muted" />}
      </View>
    </ListItem>
  );
}

// Só layout, com tokens. A coluna da posição tem largura mínima para "1º" e "3º" alinharem.
const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  posicao: {
    minWidth: spacing.lg,
    alignItems: 'center',
  },
  textos: {
    flex: 1,
    gap: spacing.xs,
  },
  metrica: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
});
