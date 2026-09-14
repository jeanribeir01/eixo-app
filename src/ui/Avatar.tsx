import { Image, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, radius, touchTarget } from './tokens';

type AvatarProps = {
  name: string;
  photoUrl: string | null;
};

const SIZE = touchTarget + 12;

// Foto do usuário quando existe; senão, a inicial do nome num círculo neutro (sem cor nova na paleta).
export function Avatar({ name, photoUrl }: AvatarProps) {
  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} accessibilityLabel={`Foto de ${name}`} style={styles.circle} />;
  }

  return (
    <View style={[styles.circle, styles.fallback]} accessibilityLabel={`Inicial de ${name}`}>
      <Text variant="subheading">{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
  },
  fallback: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
