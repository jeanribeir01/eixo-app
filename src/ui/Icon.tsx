import { View } from 'react-native';

import { icons, type IconName } from './icons';
import { toneColors, type TextTone } from './Text';
import { iconSize } from './tokens';

type IconProps = {
  name: IconName;
  size?: keyof typeof iconSize;
  // Mesmos tons do Text: o ícone nunca recebe cor solta.
  tone?: TextTone;
  // regular = contorno, o padrão. fill = cheio, para o estado ativo (aba selecionada). duotone =
  // contorno com preenchimento claro, só em ilustração de estado vazio.
  weight?: 'regular' | 'fill' | 'duotone';
  // Sem rótulo, o ícone é decorativo (o texto ao lado já diz o que é). Com rótulo, vira uma imagem
  // anunciada pelo leitor de tela — use quando o ícone aparece sozinho.
  accessibilityLabel?: string;
};

export function Icon({ name, size = 'md', tone = 'primary', weight = 'regular', accessibilityLabel }: IconProps) {
  const Glyph = icons[name];
  // A View de fora cuida da acessibilidade: o SVG do ícone não deve ser lido nem focado sozinho.
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    >
      <Glyph testID={`icone-${name}`} size={iconSize[size]} color={toneColors[tone]} weight={weight} />
    </View>
  );
}
