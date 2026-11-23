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

  it('sem tone, usa o neutral: accentText (6,4:1 sobre accentSoft)', () => {
    render(<Badge label="Info" />);

    expect(screen.getByText('Info')).toHaveStyle({ color: colors.accentText });
  });

  it.each([
    ['warning', colors.warning],
    ['muted', colors.textBody],
  ] as const)('tone %s pinta o rótulo e o ponto com %s', (tone, cor) => {
    render(<Badge label="Status" tone={tone} />);

    expect(screen.getByText('Status')).toHaveStyle({ color: cor });
    expect(screen.getByTestId('badge-ponto')).toHaveStyle({ backgroundColor: cor });
  });
});
