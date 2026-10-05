import { render, screen } from '@testing-library/react-native';

import { Text } from '../Text';
import { colors } from '../tokens';

// Verde e vermelho só aparecem no valor financeiro (exceção semântica do DESIGN_CYAN),
// sempre acompanhados de sinal + / − na tela — a cor nunca é o único indicador.
describe('Text — tons', () => {
  it.each([
    ['success', colors.success],
    ['danger', colors.danger],
    ['primary', colors.textPrimary],
    ['body', colors.textBody],
    ['muted', colors.textMuted],
    ['accent', colors.accentEdge],
    ['onAccent', colors.onAccent],
  ] as const)('tom %s usa a cor %s', (tone, cor) => {
    render(<Text tone={tone}>+ R$ 10,00</Text>);

    expect(screen.getByText('+ R$ 10,00')).toHaveStyle({ color: cor });
  });
});
