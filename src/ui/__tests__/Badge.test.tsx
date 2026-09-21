import { render, screen } from '@testing-library/react-native';

import { Badge } from '../Badge';
import { colors } from '../tokens';

describe('Badge', () => {
  it('tone success: fundo successWash e texto success (chip de Entrada)', () => {
    render(<Badge label="Entrada" tone="success" />);

    expect(screen.getByText('Entrada')).toHaveStyle({ color: colors.success });
  });

  it('tone danger: fundo dangerWash e texto danger (chip de Saída)', () => {
    render(<Badge label="Saída" tone="danger" />);

    expect(screen.getByText('Saída')).toHaveStyle({ color: colors.danger });
  });

  it('sem tone, usa o acento neutro', () => {
    render(<Badge label="Info" />);

    expect(screen.getByText('Info')).toHaveStyle({ color: colors.accentEdge });
  });
});
