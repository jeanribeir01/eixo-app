import { render, screen } from '@testing-library/react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { Logo } from '../Logo';
import { colors, spacing } from '../tokens';

import { porTipo, todosPorTipo } from '@/testing/componentes';

describe('Logo (MRC-02)', () => {
  it('é uma imagem chamada "Eixo Certo" para o leitor de tela', async () => {
    await render(<Logo />);

    const logo = screen.getByLabelText('Eixo Certo');
    expect(logo.props.accessibilityRole).toBe('image');
  });

  it('sem withWordmark mostra só a marca, sem o nome escrito', async () => {
    await render(<Logo />);

    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
    expect(todosPorTipo(Svg)).toHaveLength(1);
  });

  it('com withWordmark mostra o nome abaixo da marca, os dois centralizados', async () => {
    await render(<Logo withWordmark />);

    expect(screen.getByText('Eixo Certo')).toBeOnTheScreen();
    expect(screen.getByLabelText('Eixo Certo')).toHaveStyle({ alignItems: 'center', gap: spacing.sm });
  });

  it('compacto: marca de 28pt com o nome ao lado, não embaixo (cabeçalho do Login)', async () => {
    await render(<Logo withWordmark compacto />);

    expect(screen.getByLabelText('Eixo Certo')).toHaveStyle({ flexDirection: 'row' });
    expect(porTipo(Svg).props.width).toBe(spacing.lg + spacing.xs);
    expect(screen.getByText('Eixo Certo')).toBeOnTheScreen();
  });

  it('desenha as duas rodas e o eixo na cor accentEdge do design system', async () => {
    await render(<Logo />);

    const rodas = todosPorTipo(Path);
    expect(rodas).toHaveLength(2);
    rodas.forEach((roda) => expect(roda.props.fill).toBe(colors.accentEdge));
    expect(porTipo(Line).props.stroke).toBe(colors.accentEdge);
  });
});
