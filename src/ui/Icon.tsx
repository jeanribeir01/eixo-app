import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { icons, type IconName } from './icons';
import { toneColors, type TextTone } from './Text';
import { iconSize } from './tokens';

type IconProps = {
  name: IconName;
  size?: keyof typeof iconSize;
  // Mesmos tons do Text: o ícone nunca recebe cor solta.
  tone?: TextTone;
  // Sem rótulo, o ícone é decorativo (o texto ao lado já diz o que é). Com rótulo, vira uma imagem
  // anunciada pelo leitor de tela — use quando o ícone aparece sozinho.
  accessibilityLabel?: string;
};

export function Icon({ name, size = 'md', tone = 'primary', accessibilityLabel }: IconProps) {
  // A View de fora cuida da acessibilidade: no Android o SymbolView desenha o ícone como um caractere
  // de fonte e não repassa props de acessibilidade, então o TalkBack leria um símbolo sem sentido.
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    >
      <SymbolView name={icons[name]} size={iconSize[size]} tintColor={toneColors[tone]} />
    </View>
  );
}
