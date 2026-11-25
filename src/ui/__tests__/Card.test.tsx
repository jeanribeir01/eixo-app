import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { porTipo } from '@/testing/componentes';

import { Card } from '../Card';
import { colors, radius, spacing } from '../tokens';

// Cartão do guia (UIP-05): borda hairline como estrutura; `feature` para o destaque do topo e
// `onPress` para o cartão inteiro virar um botão.
describe('Card (UIP-05)', () => {
  it('padrão: fundo surface, borda hairline, radius.card e padding spacing.lg', async () => {
    await render(
      <Card>
        <Text>Saldo</Text>
      </Card>,
    );

    expect(screen.root).toHaveStyle({
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.card,
      padding: spacing.lg,
    });
  });

  it('feature usa radius.feature e mantém a borda hairline', async () => {
    await render(
      <Card variant="feature">
        <Text>Saldo</Text>
      </Card>,
    );

    expect(screen.root).toHaveStyle({
      borderRadius: radius.feature,
      borderColor: colors.border,
      borderWidth: 1,
    });
  });

  it('sem onPress não é um botão', async () => {
    await render(
      <Card>
        <Text>Saldo</Text>
      </Card>,
    );

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('com onPress o cartão inteiro é um botão com nome acessível e dispara o toque', async () => {
    const onPress = jest.fn();
    await render(
      <Card variant="feature" onPress={onPress} accessibilityLabel="Ver saldo e projeção">
        <Text>Saldo</Text>
      </Card>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Ver saldo e projeção' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Ver saldo e projeção' })).toHaveStyle({ borderRadius: radius.feature });
  });

  it('tocável: ripple na cor da hairline, cortado nos cantos arredondados', async () => {
    await render(
      <Card onPress={jest.fn()} accessibilityLabel="Abrir">
        <Text>Saldo</Text>
      </Card>,
    );

    // O Pressable só repassa o ripple para a View nativa no Android; no teste, lê-se a prop do Pressable.
    expect(porTipo(Pressable).props.android_ripple).toEqual({ color: colors.border });
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveStyle({ overflow: 'hidden' });
  });
});
