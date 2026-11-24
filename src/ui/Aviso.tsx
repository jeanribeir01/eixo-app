import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text, type TextTone } from './Text';
import { colors, radius, spacing } from './tokens';

export type AvisoTom = 'info' | 'warning' | 'success' | 'danger';

export type AvisoProps = {
  tom: AvisoTom;
  titulo: string;
  // Explicação curta, no tom de quem ajuda: o que aconteceu e o que a pessoa pode fazer.
  children?: ReactNode;
  icone?: IconName;
  // Algo acontecendo agora (ex.: enviando): o ícone dá lugar a um indicador de progresso, ao lado do
  // título, nunca por cima do texto.
  emAndamento?: boolean;
  acao?: { label: string; onPress: () => void; loading?: boolean };
};

// Fundo tingido e cor do título por tom. A cor nunca vem sozinha: o ícone e o título dizem o estado.
const TONS: Record<AvisoTom, { fundo: string; texto: TextTone }> = {
  info: { fundo: colors.accentSoft, texto: 'accent' },
  warning: { fundo: colors.warningWash, texto: 'warning' },
  success: { fundo: colors.successWash, texto: 'success' },
  danger: { fundo: colors.dangerWash, texto: 'danger' },
};

// Bloco de estado (DESIGN-CYAN 2.0): sem internet, aguardando aprovação, tudo enviado. Fica no fluxo da
// tela, diferente do Snackbar, que é o retorno passageiro de uma ação. Anunciado ao aparecer e mudar.
export function Aviso({ tom, titulo, children, icone, emAndamento = false, acao }: AvisoProps) {
  const { fundo, texto } = TONS[tom];
  return (
    <View
      testID="aviso"
      accessible={!acao}
      accessibilityRole={acao ? undefined : 'summary'}
      accessibilityLiveRegion="polite"
      style={[styles.aviso, { backgroundColor: fundo }]}
    >
      <View style={styles.topo}>
        {emAndamento ? (
          <ActivityIndicator size="small" color={colors[tom === 'info' ? 'accentText' : tom]} />
        ) : (
          icone && <Icon name={icone} tone={texto} />
        )}
        <Text weight="semibold" tone={texto} style={styles.titulo}>
          {titulo}
        </Text>
      </View>
      {typeof children === 'string' ? <Text variant="bodySm">{children}</Text> : children}
      {acao && (
        <View style={styles.acao}>
          <Button label={acao.label} variant="ghost" onPress={acao.onPress} loading={acao.loading} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  aviso: {
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: radius.card,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titulo: {
    flex: 1,
  },
  acao: {
    alignSelf: 'flex-start',
  },
});
