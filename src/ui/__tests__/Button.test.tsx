import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../Button';
import { colors } from '../tokens';

describe('Button', () => {
  it('primary: fundo accent, borda accentEdge e texto branco', () => {
    render(<Button label="Continuar" onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Continuar' })).toHaveStyle({
      backgroundColor: colors.accent,
      borderColor: colors.accentEdge,
    });
    expect(screen.getByText('Continuar')).toHaveStyle({ color: '#ffffff' });
  });

  it('ghost: fundo transparente, borda hairline e texto primário', () => {
    render(<Button label="Sair" variant="ghost" onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Sair' })).toHaveStyle({
      backgroundColor: 'transparent',
      borderColor: colors.border,
    });
    expect(screen.getByText('Sair')).toHaveStyle({ color: colors.textPrimary });
  });

  it('dispara onPress quando habilitado', () => {
    const onPress = jest.fn();
    render(<Button label="Continuar" onPress={onPress} />);

    fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('loading: fica desabilitado, mostra indicador e ignora toques (AUTH-03)', () => {
    const onPress = jest.fn();
    render(<Button label="Continuar" onPress={onPress} loading />);

    const button = screen.getByRole('button', { name: 'Continuar' });
    expect(button).toBeDisabled();
    expect(button).toBeBusy();
    expect(screen.getByTestId('button-loading')).toBeOnTheScreen();

    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('sem loading não mostra indicador', () => {
    render(<Button label="Continuar" onPress={jest.fn()} />);

    expect(screen.queryByTestId('button-loading')).not.toBeOnTheScreen();
  });

  it('respeita o alvo de toque mínimo de 44pt', () => {
    render(<Button label="Continuar" onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Continuar' })).toHaveStyle({ minHeight: 44 });
  });
});
