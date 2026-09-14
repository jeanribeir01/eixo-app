import type { Session } from '@supabase/supabase-js';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { signOut } from '../googleAuth';
import { HomeView } from '../HomeView';
import { useSessionStore } from '../sessionStore';

jest.mock('../googleAuth', () => ({ signOut: jest.fn() }));
jest.mock('@/supabase/client', () => ({ supabase: { auth: {} } }));

function sessionWith(email: string, metadata: Record<string, unknown>): Session {
  return { access_token: 'token', user: { id: 'user-1', email, user_metadata: metadata } } as unknown as Session;
}

beforeEach(() => {
  (signOut as jest.Mock).mockReset().mockResolvedValue(undefined);
});

describe('HomeView', () => {
  it('exibe nome completo e e-mail do usuário da sessão (AUTH-13)', () => {
    useSessionStore.setState({
      session: sessionWith('maria@example.com', { full_name: 'Maria Silva' }),
      isRestoring: false,
    });

    render(<HomeView />);

    expect(screen.getByText('Maria Silva')).toBeOnTheScreen();
    expect(screen.getByText('maria@example.com')).toBeOnTheScreen();
  });

  it('com foto do Google, exibe a foto (AUTH-14)', () => {
    useSessionStore.setState({
      session: sessionWith('maria@example.com', {
        full_name: 'Maria Silva',
        avatar_url: 'https://lh3.googleusercontent.com/foto-maria',
      }),
      isRestoring: false,
    });

    render(<HomeView />);

    expect(screen.getByLabelText('Foto de Maria Silva')).toHaveProp('source', {
      uri: 'https://lh3.googleusercontent.com/foto-maria',
    });
    expect(screen.queryByLabelText('Inicial de Maria Silva')).not.toBeOnTheScreen();
  });

  it('sem foto, exibe a inicial maiúscula do nome (AUTH-14)', () => {
    useSessionStore.setState({
      session: sessionWith('maria@example.com', { full_name: 'maria Silva' }),
      isRestoring: false,
    });

    render(<HomeView />);

    expect(screen.getByLabelText('Inicial de maria Silva')).toHaveTextContent('M');
    expect(screen.queryByLabelText('Foto de maria Silva')).not.toBeOnTheScreen();
  });

  it('nome vazio: usa o e-mail no lugar do nome e a inicial do e-mail (edge case)', () => {
    useSessionStore.setState({
      session: sessionWith('joao@example.com', { full_name: '' }),
      isRestoring: false,
    });

    render(<HomeView />);

    // Duas vezes: no lugar do nome e na linha do e-mail.
    expect(screen.getAllByText('joao@example.com')).toHaveLength(2);
    expect(screen.getByLabelText('Inicial de joao@example.com')).toHaveTextContent('J');
  });

  it('tocar "Sair" encerra a sessão (AUTH-15)', () => {
    useSessionStore.setState({
      session: sessionWith('maria@example.com', { full_name: 'Maria Silva' }),
      isRestoring: false,
    });
    render(<HomeView />);

    fireEvent.press(screen.getByRole('button', { name: 'Sair' }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
