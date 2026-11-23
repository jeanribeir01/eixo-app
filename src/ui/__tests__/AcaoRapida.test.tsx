import { fireEvent, render, screen } from '@testing-library/react-native';

import { AcaoRapida } from '../AcaoRapida';
import { colors, controlHeight, spacing } from '../tokens';

describe('AcaoRapida', () => {
  it('é um botão com o próprio rótulo e chama onPress', () => {
    const onPress = jest.fn();
    render(<AcaoRapida label="Dívidas" icon="dividas" onPress={onPress} />);

    fireEvent.press(screen.getByRole('button', { name: 'Dívidas' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('quadrado comum: surface com hairline, maior que o alvo mínimo de toque', () => {
    render(<AcaoRapida label="Dívidas" icon="dividas" onPress={jest.fn()} />);

    const quadrado = screen.getByTestId('acao-rapida-icone');
    expect(quadrado).toHaveStyle({ backgroundColor: colors.surface, borderColor: colors.border });
    expect(quadrado).toHaveStyle({ width: controlHeight + spacing.sm, height: controlHeight + spacing.sm });
  });

  it('destaque: accentSoft com o ícone em accentText', () => {
    render(<AcaoRapida label="Lançar" icon="adicionar" destaque onPress={jest.fn()} />);

    expect(screen.getByTestId('acao-rapida-icone')).toHaveStyle({ backgroundColor: colors.accentSoft });
    expect(screen.getByTestId('icone-adicionar', { includeHiddenElements: true })).toHaveStyle({ color: colors.accentText });
  });
});
