import { StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import type { IconName } from './icons';
import { colors, indicatorSize, radius } from './tokens';

type TabBarIconProps = {
  name: IconName;
  focused: boolean;
};

// Ícone de aba da tab bar (DESIGN_CYAN 2.0, Navegação). Aba ativa: ícone cheio em accentText sobre uma
// pílula accentSoft; inativa: contorno em textBody. Antes só a cor mudava, de cinza para preto, e a
// diferença sumia ao sol (auditoria de UI, "Menu"). Forma (cheio × contorno) + fundo + cor: três sinais.
export function TabBarIcon({ name, focused }: TabBarIconProps) {
  return (
    <View testID={focused ? 'aba-ativa' : undefined} style={[styles.indicador, focused && styles.ativo]}>
      <Icon name={name} tone={focused ? 'accent' : 'body'} weight={focused ? 'fill' : 'regular'} />
    </View>
  );
}

const styles = StyleSheet.create({
  indicador: {
    width: indicatorSize.tabWidth,
    height: indicatorSize.tabHeight,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ativo: {
    backgroundColor: colors.accentSoft,
  },
});
