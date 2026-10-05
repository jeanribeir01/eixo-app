import { render, screen } from '@testing-library/react-native';

import { Text } from '../Text';
import { colors } from '../tokens';

describe('Text', () => {
  it('tone success: valor positivo em verde semântico', () => {
    render(<Text tone="success">+ R$ 10,00</Text>);

    expect(screen.getByText('+ R$ 10,00')).toHaveStyle({ color: colors.success });
  });

  it('tone danger: valor negativo em vermelho semântico', () => {
    render(<Text tone="danger">− R$ 10,00</Text>);

    expect(screen.getByText('− R$ 10,00')).toHaveStyle({ color: colors.danger });
  });

  it('sem tone, usa a cor de título', () => {
    render(<Text>Saldo</Text>);

    expect(screen.getByText('Saldo')).toHaveStyle({ color: colors.textPrimary });
  });
});
