import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { Text } from './Text';
import { colors, spacing } from './tokens';

export type LogoProps = {
  // O nome "Eixo Certo" abaixo da marca. Só no Login e no header da Home (DESIGN_CYAN §7, Logo).
  withWordmark?: boolean;
};

// 48pt: o tamanho em que a marca foi conferida como legível (EIX-11).
const TAMANHO_MARCA = spacing.xxl;

// Marca Eixo Certo: duas rodas ligadas por um eixo. A geometria vem de assets/brand/eixo-certo-mark.svg,
// a fonte única da marca; se o desenho mudar, copie os paths de lá. O nome é texto em Inter, não SVG,
// para seguir a tipografia do app.
export function Logo({ withWordmark = false }: LogoProps) {
  return (
    // Um elemento só para o leitor de tela: "Eixo Certo, imagem", com ou sem o nome escrito.
    <View accessible accessibilityRole="image" accessibilityLabel="Eixo Certo" style={styles.logo}>
      <Svg width={TAMANHO_MARCA} height={TAMANHO_MARCA} viewBox="0 0 78.74 78.74">
        <Path
          fill={colors.accentEdge}
          d="M61.54,0c-9.5,0-17.2,7.7-17.2,17.2s7.7,17.2,17.2,17.2,17.2-7.7,17.2-17.2S71.04,0,61.54,0ZM61.54,24.44c-4,0-7.24-3.24-7.24-7.24s3.24-7.24,7.24-7.24,7.24,3.24,7.24,7.24-3.24,7.24-7.24,7.24Z"
        />
        <Line
          x1={51.59}
          y1={26.25}
          x2={34.12}
          y2={43.71}
          stroke={colors.accentEdge}
          strokeWidth={9}
          strokeLinecap="round"
        />
        <Path
          fill={colors.accentEdge}
          d="M23.53,31.68C10.54,31.68,0,42.21,0,55.21s10.54,23.53,23.53,23.53,23.53-10.54,23.53-23.53-10.54-23.53-23.53-23.53ZM23.53,65.16c-5.5,0-9.96-4.46-9.96-9.96s4.46-9.96,9.96-9.96,9.96,4.46,9.96,9.96-4.46,9.96-9.96,9.96Z"
        />
      </Svg>
      {withWordmark && <Text variant="subheading">Eixo Certo</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  // Marca e nome empilhados e centralizados um sobre o outro; quem posiciona o bloco é a tela.
  logo: {
    alignItems: 'center',
    gap: spacing.sm,
  },
});
