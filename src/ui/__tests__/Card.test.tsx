import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Card } from '../Card';
import { colors, radius, spacing } from '../tokens';

// Cartão do guia (UIP-05): borda hairline como estrutura; `feature` para o destaque do topo e
// `onPress` para o cartão inteiro virar um botão.
describe('Card (UIP-05)', () => {
  it('padrão: fundo surface, borda hairline, radius.card e padding spacing.lg', () => {
    render(
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

  it('feature usa radius.feature e mantém a borda hairline', () => {
    render(
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

  it('sem onPress não é um botão', () => {
    render(
      <Card>
        <Text>Saldo</Text>
      </Card>,
    );

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('com onPress o cartão inteiro é um botão com nome acessível e dispara o toque', () => {
    const onPress = jest.fn();
    render(
      <Card variant="feature" onPress={onPress} accessibilityLabel="Ver saldo e projeção">
        <Text>Saldo</Text>
      </Card>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Ver saldo e projeção' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Ver saldo e projeção' })).toHaveStyle({ borderRadius: radius.feature });
  });

  it('tocável: ripple na cor da hairline, cortado nos cantos arredondados', () => {
    render(
      <Card onPress={jest.fn()} accessibilityLabel="Abrir">
        <Text>Saldo</Text>
      </Card>,
    );

    // O Pressable só repassa o ripple para a View nativa no Android; no teste, lê-se a prop do Pressable.
    const comRipple = screen.UNSAFE_root.findAll((no) => no.props.android_ripple !== undefined);
    expect(comRipple[0]?.props.android_ripple).toEqual({ color: colors.border });
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveStyle({ overflow: 'hidden' });
  });
});
