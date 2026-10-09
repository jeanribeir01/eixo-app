import { render, screen } from '@testing-library/react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { Logo } from '../Logo';
import { colors, spacing } from '../tokens';

describe('Logo (MRC-02)', () => {
  it('é uma imagem chamada "Eixo Certo" para o leitor de tela', () => {
    render(<Logo />);

    const logo = screen.getByLabelText('Eixo Certo');
    expect(logo.props.accessibilityRole).toBe('image');
  });

  it('sem withWordmark mostra só a marca, sem o nome escrito', () => {
    render(<Logo />);

    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
    expect(screen.UNSAFE_getAllByType(Svg)).toHaveLength(1);
  });

  it('com withWordmark mostra o nome abaixo da marca, os dois centralizados', () => {
    render(<Logo withWordmark />);

    expect(screen.getByText('Eixo Certo')).toBeOnTheScreen();
    expect(screen.getByLabelText('Eixo Certo')).toHaveStyle({ alignItems: 'center', gap: spacing.sm });
  });

  it('desenha as duas rodas e o eixo na cor accentEdge do design system', () => {
    render(<Logo />);

    const rodas = screen.UNSAFE_getAllByType(Path);
    expect(rodas).toHaveLength(2);
    rodas.forEach((roda) => expect(roda.props.fill).toBe(colors.accentEdge));
    expect(screen.UNSAFE_getByType(Line).props.stroke).toBe(colors.accentEdge);
  });
});
