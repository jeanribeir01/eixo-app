import { fireEvent, render, screen } from '@testing-library/react-native';

import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renderiza título e descrição', () => {
    render(<EmptyState title="Nenhuma categoria cadastrada" description="Crie a primeira categoria." />);

    expect(screen.getByText('Nenhuma categoria cadastrada')).toBeOnTheScreen();
    expect(screen.getByText('Crie a primeira categoria.')).toBeOnTheScreen();
  });

  it('sem actionLabel/onAction, não mostra botão', () => {
    render(<EmptyState title="Nenhuma categoria cadastrada" />);

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('com ação, dispara onAction ao tocar', () => {
    const onAction = jest.fn();
    render(<EmptyState title="Nenhuma categoria" actionLabel="Nova categoria" onAction={onAction} />);

    fireEvent.press(screen.getByRole('button', { name: 'Nova categoria' }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
