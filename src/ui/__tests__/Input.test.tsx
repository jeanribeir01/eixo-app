import { fireEvent, render, screen } from '@testing-library/react-native';

import { Input } from '../Input';
import { colors } from '../tokens';

describe('Input', () => {
  it('renderiza o label e aceita digitação', () => {
    const onChangeText = jest.fn();
    render(<Input label="Título" value="" onChangeText={onChangeText} />);

    expect(screen.getByText('Título')).toBeOnTheScreen();

    fireEvent.changeText(screen.getByLabelText('Título'), 'Combustível');
    expect(onChangeText).toHaveBeenCalledWith('Combustível');
  });

  it('respeita o alvo de toque mínimo de 44pt', () => {
    render(<Input label="Título" value="" onChangeText={jest.fn()} />);

    expect(screen.getByLabelText('Título')).toHaveStyle({ minHeight: 44 });
  });

  it('sem erro, não mostra alerta', () => {
    render(<Input label="Título" value="" onChangeText={jest.fn()} />);

    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('com erro, mostra a mensagem em português com role de alerta', () => {
    render(<Input label="Título" value="" onChangeText={jest.fn()} error="Informe o título da categoria." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Informe o título da categoria.');
  });

  it('com erro, reforça a borda além da mensagem (cor nunca é o único indicador)', () => {
    render(<Input label="Título" value="" onChangeText={jest.fn()} error="Informe o título da categoria." />);

    expect(screen.getByLabelText('Título')).toHaveStyle({ borderColor: colors.textPrimary });
  });
});
