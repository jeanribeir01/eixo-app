import { fireEvent, render, screen } from '@testing-library/react-native';

import { Switch } from '../Switch';

describe('Switch', () => {
  it('renderiza o rótulo e o estado atual', () => {
    render(<Switch label="Mostrar desativadas" value={false} onValueChange={jest.fn()} />);

    expect(screen.getByText('Mostrar desativadas')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Mostrar desativadas' })).not.toBeChecked();
  });

  it('chama onValueChange ao alternar', () => {
    const onValueChange = jest.fn();
    render(<Switch label="Mostrar desativadas" value={false} onValueChange={onValueChange} />);

    fireEvent(screen.getByRole('switch', { name: 'Mostrar desativadas' }), 'valueChange', true);

    expect(onValueChange).toHaveBeenCalledWith(true);
  });
});
