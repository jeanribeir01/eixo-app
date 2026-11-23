import { fireEvent, render, screen } from '@testing-library/react-native';

import { Input } from '../Input';
import { colors, controlHeight, iconSize, spacing } from '../tokens';

describe('Input', () => {
  it('renderiza o label e aceita digitação', () => {
    const onChangeText = jest.fn();
    render(<Input label="Título" value="" onChangeText={onChangeText} />);

    expect(screen.getByText('Título')).toBeOnTheScreen();

    fireEvent.changeText(screen.getByLabelText('Título'), 'Combustível');
    expect(onChangeText).toHaveBeenCalledWith('Combustível');
  });

  it('tem altura confortável de 48pt, acima do mínimo de 44', () => {
    render(<Input label="Título" value="" onChangeText={jest.fn()} />);

    expect(screen.getByLabelText('Título')).toHaveStyle({ minHeight: controlHeight });
  });

  it('sem erro, não mostra alerta', () => {
    render(<Input label="Título" value="" onChangeText={jest.fn()} />);

    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('com erro, mostra a mensagem em português com role de alerta', () => {
    render(<Input label="Título" value="" onChangeText={jest.fn()} error="Informe o título da categoria." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Informe o título da categoria.');
  });

  it('com ícone: o ícone fica dentro do campo, à esquerda, e o texto começa depois dele', () => {
    render(<Input label="E-mail" icone="email" value="" onChangeText={jest.fn()} />);

    expect(screen.getByTestId('icone-email', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('E-mail')).toHaveStyle({ paddingLeft: spacing.md + iconSize.md + spacing.sm });
  });

  it('sem ícone, nenhum ícone aparece no campo', () => {
    render(<Input label="Título" value="" onChangeText={jest.fn()} />);

    expect(screen.queryByTestId('icone-email', { includeHiddenElements: true })).toBeNull();
  });

  it('com erro, borda e mensagem em danger, com ícone de alerta (cor nunca é o único indicador)', () => {
    render(<Input label="Título" value="" onChangeText={jest.fn()} error="Informe o título da categoria." />);

    expect(screen.getByLabelText('Título')).toHaveStyle({ borderColor: colors.danger });
    expect(screen.getByRole('alert')).toHaveStyle({ color: colors.danger });
    expect(screen.getByTestId('icone-alerta', { includeHiddenElements: true })).toBeTruthy();
  });
});
