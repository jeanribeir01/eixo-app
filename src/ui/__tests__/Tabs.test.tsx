import { fireEvent, render, screen } from '@testing-library/react-native';

import { Tabs } from '../Tabs';
import { colors } from '../tokens';

const options = [
  { label: 'Entrada', value: 'Entrada' },
  { label: 'Saída', value: 'Saida' },
];

describe('Tabs', () => {
  it('marca a aba ativa como selecionada', () => {
    render(<Tabs options={options} value="Entrada" onChange={jest.fn()} />);

    expect(screen.getByRole('tab', { name: 'Entrada' })).toHaveStyle({ backgroundColor: colors.inverted });
    expect(screen.getByRole('tab', { name: 'Saída' })).toHaveStyle({ backgroundColor: 'transparent' });
  });

  it('chama onChange com o valor tocado', () => {
    const onChange = jest.fn();
    render(<Tabs options={options} value="Entrada" onChange={onChange} />);

    fireEvent.press(screen.getByRole('tab', { name: 'Saída' }));

    expect(onChange).toHaveBeenCalledWith('Saida');
  });
});
