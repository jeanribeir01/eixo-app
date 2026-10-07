import { Pressable, StyleSheet } from 'react-native';

import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';
import { colors, radius, shadow, spacing, touchTarget } from './tokens';

// Altura que o FAB ocupa no rodapé (o botão mais o respiro de cima e de baixo). As listas usam como
// espaço no fim, para a última linha nunca ficar escondida atrás do botão.
export const FAB_ALTURA_RESERVADA = touchTarget + spacing.base * 2;

type FABProps = {
  // O rótulo também é o nome que o leitor de tela anuncia: um FAB nunca fica sem nome acessível.
  label: string;
  onPress: () => void;
  icon?: IconName;
};

// Botão flutuante da ação principal da tela (Nova categoria, Nova movimentação...). Pílula cyan com
// ícone e rótulo, como o Button primary: é o único elemento cyan preenchido da tela (DESIGN_CYAN §1).
// Vai na prop `fab` do Screen, que o posiciona no rodapé à direita, acima da área segura.
export function FAB({ label, onPress, icon = 'adicionar' }: FABProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <Icon name={icon} tone="onAccent" />
      <Text weight="medium" tone="onAccent">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentEdge,
    backgroundColor: colors.accent,
    // Sombra "subtle" do guia: separa o botão do conteúdo que rola por baixo dele.
    ...shadow.subtle,
  },
  pressed: {
    opacity: 0.6,
  },
});
