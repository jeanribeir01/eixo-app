import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';
import { colors, spacing, touchTarget } from './tokens';

export type ListItemProps = {
  // Linha padrão: título, subtítulo, ícone à esquerda e algo à direita (valor, switch, badge).
  title?: string;
  subtitle?: string;
  icon?: IconName;
  // Sem trailing e com onPress, a linha mostra o chevron: "toque para abrir".
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  // Modo livre, para conteúdo que não cabe na linha padrão. Funciona como antes da linha padrão existir.
  children?: ReactNode;
};

// Linha de lista: borda hairline como separador, sem sombra (DESIGN_CYAN §5). Ao tocar, a linha inteira
// reage com o ripple do Android na cor da hairline; o opacity 0.6 fica para os botões.
export function ListItem({ title, subtitle, icon, trailing, onPress, accessibilityLabel, children }: ListItemProps) {
  const conteudo =
    title !== undefined ? (
      <View style={styles.linha}>
        {icon && <Icon name={icon} tone="body" />}
        <View style={styles.textos}>
          <Text>{title}</Text>
          {!!subtitle && (
            <Text variant="bodySm" tone="body" numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {trailing ?? (onPress && <Icon name="avancar" tone="muted" />)}
      </View>
    ) : (
      children
    );

  if (!onPress) {
    return <View style={styles.item}>{conteudo}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      android_ripple={{ color: colors.border }}
      // No Android o ripple já é o feedback; no iOS, que não tem ripple, a linha escurece de leve.
      style={({ pressed }) => [styles.item, pressed && Platform.OS === 'ios' && styles.pressedIos]}
    >
      {conteudo}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    minHeight: touchTarget,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    justifyContent: 'center',
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  textos: {
    flex: 1,
    gap: spacing.xs,
  },
  pressedIos: {
    backgroundColor: colors.border,
  },
});
