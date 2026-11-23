import { Image, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, radius, spacing, touchTarget } from './tokens';

type AvatarProps = {
  name: string;
  photoUrl: string | null;
  // `md` (56) no cartão de perfil e no Início; `sm` (40) na linha de lista, ao lado de dois textos.
  size?: 'sm' | 'md';
};

const TAMANHOS = { sm: touchTarget - spacing.xs, md: touchTarget + spacing.md } as const;

// Iniciais: primeira letra do primeiro e do último nome ("Jean Ribeiro" → "JR"), como no protótipo.
// Um nome só, ou o e-mail no lugar do nome (contas de teste), fica com uma letra.
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1 || nome.includes('@')) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

// Foto do usuário quando existe; senão, as iniciais sobre accentSoft (mesmo par do Badge neutral).
export function Avatar({ name, photoUrl, size = 'md' }: AvatarProps) {
  const dimensao = TAMANHOS[size];
  const circulo = { width: dimensao, height: dimensao, borderRadius: radius.pill };

  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} accessibilityLabel={`Foto de ${name}`} style={circulo} />;
  }

  return (
    <View style={[circulo, styles.fallback]} accessibilityLabel={`Iniciais de ${name}`}>
      <Text variant={size === 'sm' ? 'bodySm' : 'subheading'} weight="medium" tone="accent">
        {iniciais(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
