import type { ReactNode } from 'react';
import { View } from 'react-native';

import { spacing } from './tokens';

type ColumnProps = {
  children: ReactNode;
  // Espaço entre os filhos, sempre um token (nunca número solto na tela).
  gap?: keyof typeof spacing;
  align?: 'stretch' | 'center' | 'start';
  // 'row' agrupa lado a lado (ex.: chip ao lado do título, ações de uma linha de lista).
  direction?: 'column' | 'row';
  wrap?: boolean;
};

const alignItems = { stretch: 'stretch', center: 'center', start: 'flex-start' } as const;

// Empilha (ou enfileira, com direction="row") elementos sem que a tela crie StyleSheet próprio.
export function Column({ children, gap = 'sm', align = 'stretch', direction = 'column', wrap = false }: ColumnProps) {
  return (
    <View
      style={{
        flexDirection: direction,
        flexWrap: wrap ? 'wrap' : 'nowrap',
        gap: spacing[gap],
        alignItems: alignItems[align],
      }}
    >
      {children}
    </View>
  );
}
