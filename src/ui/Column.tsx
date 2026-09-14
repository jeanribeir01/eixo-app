import type { ReactNode } from 'react';
import { View } from 'react-native';

import { spacing } from './tokens';

type ColumnProps = {
  children: ReactNode;
  // Espaço entre os filhos, sempre um token (nunca número solto na tela).
  gap?: keyof typeof spacing;
  align?: 'stretch' | 'center' | 'start';
};

const alignItems = { stretch: 'stretch', center: 'center', start: 'flex-start' } as const;

// Empilha elementos na vertical. Existe para que as telas agrupem conteúdo sem criar StyleSheet próprio.
export function Column({ children, gap = 'sm', align = 'stretch' }: ColumnProps) {
  return <View style={{ gap: spacing[gap], alignItems: alignItems[align] }}>{children}</View>;
}
