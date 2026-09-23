import { fireEvent, render, screen } from '@testing-library/react-native';
import { Path } from 'react-native-svg';

import { Button } from '../Button';
import { colors, shadow } from '../tokens';

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

  it('google: fundo branco, borda hairline e sombra sutil, sem reaproveitar o ghost (EIX-12)', () => {
    render(<Button label="Continuar com Google" variant="google" onPress={jest.fn()} />);

    const button = screen.getByRole('button', { name: 'Continuar com Google' });
    expect(button).toHaveStyle({ backgroundColor: colors.surface, borderColor: colors.border });
    expect(button).not.toHaveStyle({ backgroundColor: 'transparent' });
    expect(button).toHaveStyle({
      shadowColor: shadow.subtle.shadowColor,
      shadowOpacity: shadow.subtle.shadowOpacity,
      shadowRadius: shadow.subtle.shadowRadius,
      elevation: shadow.subtle.elevation,
    });
    expect(screen.getByText('Continuar com Google')).toHaveStyle({ color: colors.textPrimary });
  });

  it('google: mostra o logo multicolor quando não está carregando', () => {
    render(<Button label="Continuar com Google" variant="google" onPress={jest.fn()} />);

    expect(screen.UNSAFE_queryAllByType(Path)).toHaveLength(4);
  });

  it('google: some o logo e mostra o indicador durante o loading', () => {
    render(<Button label="Continuar com Google" variant="google" onPress={jest.fn()} loading />);

    expect(screen.getByTestId('button-loading')).toBeOnTheScreen();
    expect(screen.UNSAFE_queryAllByType(Path)).toHaveLength(0);
  });

  it('google: respeita o alvo de toque mínimo de 44pt', () => {
    render(<Button label="Continuar com Google" variant="google" onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toHaveStyle({ minHeight: 44 });
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
