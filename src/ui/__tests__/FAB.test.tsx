import { fireEvent, render, screen } from '@testing-library/react-native';

import { FAB, FAB_ALTURA_RESERVADA } from '../FAB';
import { colors, radius, spacing, touchTarget } from '../tokens';

// Botão flutuante da ação principal da tela (UIP-03): pílula cyan com ícone e rótulo.
// É o único elemento cyan preenchido da tela (DESIGN_CYAN §1).
describe('FAB (UIP-03)', () => {
  it('é um botão acessível com o rótulo e dispara a ação (AC 6)', () => {
    const onPress = jest.fn();
    render(<FAB label="Nova categoria" onPress={onPress} />);

    fireEvent.press(screen.getByRole('button', { name: 'Nova categoria' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('pílula cyan com borda accentEdge e alvo de toque de 44pt, alinhada à direita (AC 5)', () => {
    render(<FAB label="Nova categoria" onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Nova categoria' })).toHaveStyle({
      backgroundColor: colors.accent,
      borderColor: colors.accentEdge,
      borderWidth: 1,
      borderRadius: radius.pill,
      minHeight: touchTarget,
      alignSelf: 'flex-end',
    });
  });

  it('mostra o ícone de adicionar e o rótulo em onAccent, peso medium', () => {
    render(<FAB label="Nova movimentação" onPress={jest.fn()} />);

    expect(screen.getByTestId('simbolo-add', { includeHiddenElements: true })).toHaveStyle({ color: colors.onAccent });
    expect(screen.getByText('Nova movimentação')).toHaveStyle({ color: colors.onAccent, fontFamily: 'Inter_500Medium' });
  });

  it('reserva a altura do FAB mais o respiro de cima e de baixo para as listas', () => {
    expect(FAB_ALTURA_RESERVADA).toBe(touchTarget + spacing.base * 2);
  });
});
