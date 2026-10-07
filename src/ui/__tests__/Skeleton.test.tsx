import { render, screen } from '@testing-library/react-native';

import { Skeleton } from '../Skeleton';
import { colors, radius, spacing } from '../tokens';

describe('Skeleton', () => {
  it('bloco neutro na cor da hairline, com radius de cartão', () => {
    render(<Skeleton accessibilityLabel="Carregando" />);

    expect(screen.getByLabelText('Carregando')).toHaveStyle({
      backgroundColor: colors.border,
      borderRadius: radius.card,
      height: spacing.lg,
    });
  });

  it('a altura vem de um token de spacing', () => {
    render(<Skeleton height="xxl" accessibilityLabel="Carregando saldo" />);

    expect(screen.getByLabelText('Carregando saldo')).toHaveStyle({ height: spacing.xxl });
  });
});
