import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { spacing } from './tokens';

export type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

// Estado vazio/erro obrigatório em toda tela de dados (DESIGN_CYAN §8). A personalidade da marca
// vem da mensagem, não de mascote — o guia web tem ilustração, o app não usa (CLAUDE.md §8).
export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrapper}>
      <Text variant="subheading">{title}</Text>
      {!!description && <Text tone="body">{description}</Text>}
      {!!actionLabel && !!onAction && <Button label={actionLabel} onPress={onAction} variant="ghost" />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
});
