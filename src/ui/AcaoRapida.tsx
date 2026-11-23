import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';
import { colors, controlHeight, radius, spacing } from './tokens';

type AcaoRapidaProps = {
  label: string;
  icon: IconName;
  onPress: () => void;
  // `destaque` é a ação mais frequente da fileira (ex.: Lançar), em accentSoft. Uma por fileira; o
  // azul cheio continua reservado à ação primária da tela (DESIGN_CYAN 2.0 §4).
  destaque?: boolean;
};

// Atalho da fileira do Início: ícone num quadrado e o rótulo embaixo. Leva para uma tela, não executa
// nada sozinho, por isso o papel é de botão com o próprio rótulo como nome.
export function AcaoRapida({ label, icon, onPress, destaque = false }: AcaoRapidaProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.acao, pressed && Platform.OS === 'ios' && styles.pressionada]}
    >
      <View
        testID="acao-rapida-icone"
        style={[styles.quadrado, destaque ? styles.quadradoDestaque : styles.quadradoComum]}
      >
        <Icon name={icon} size="lg" tone={destaque ? 'accent' : 'primary'} />
      </View>
      <Text variant="caption" weight="medium" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  acao: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressionada: {
    opacity: 0.6,
  },
  // O quadrado tem a altura dos controles (48): é o alvo de toque, maior que os 44pt do mínimo.
  quadrado: {
    width: controlHeight + spacing.sm,
    height: controlHeight + spacing.sm,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quadradoComum: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quadradoDestaque: {
    backgroundColor: colors.accentSoft,
  },
});
