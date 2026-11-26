import { fireEvent, render, screen } from '@testing-library/react-native';

import { Switch } from '../Switch';

describe('Switch', () => {
  it('renderiza o rótulo e o estado atual', async () => {
    await render(<Switch label="Mostrar desativadas" value={false} onValueChange={jest.fn()} />);

    expect(screen.getByText('Mostrar desativadas')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Mostrar desativadas' })).not.toBeChecked();
  });

  it('chama onValueChange ao alternar', async () => {
    const onValueChange = jest.fn();
    await render(<Switch label="Mostrar desativadas" value={false} onValueChange={onValueChange} />);

    await fireEvent(screen.getByRole('switch', { name: 'Mostrar desativadas' }), 'valueChange', true);

    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('disabled: fica desabilitado para o toque e para o leitor de tela (LST-01, AC 4)', async () => {
    await render(<Switch label="Ativa" value onValueChange={jest.fn()} disabled />);

    expect(screen.getByRole('switch', { name: 'Ativa' })).toBeDisabled();
  });

  it('accessibilityLabel troca só o nome anunciado; o rótulo visível continua o mesmo', async () => {
    await render(<Switch label="Ativa" accessibilityLabel="Ativa: Combustível" value onValueChange={jest.fn()} />);

    expect(screen.getByText('Ativa')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Ativa: Combustível' })).toBeChecked();
  });
});
