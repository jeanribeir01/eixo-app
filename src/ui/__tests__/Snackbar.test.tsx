import { act, render, screen } from '@testing-library/react-native';

import { Snackbar } from '../Snackbar';

describe('Snackbar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('mostra a mensagem de sucesso', () => {
    render(<Snackbar message="Categoria salva." tone="success" onDismiss={jest.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Categoria salva.');
  });

  it('mostra a mensagem de erro', () => {
    render(<Snackbar message="Não foi possível salvar." tone="error" onDismiss={jest.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar.');
  });

  it('chama onDismiss sozinho após a duração informada', () => {
    const onDismiss = jest.fn();
    render(<Snackbar message="Categoria salva." tone="success" onDismiss={onDismiss} duration={1000} />);

    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
