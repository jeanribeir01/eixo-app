import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { signInWithGoogle, type SignInResult } from '../googleAuth';
import { LoginView } from '../LoginView';

jest.mock('../googleAuth', () => ({ signInWithGoogle: jest.fn() }));

const mockSignIn = signInWithGoogle as jest.MockedFunction<typeof signInWithGoogle>;

function pressGoogle() {
  fireEvent.press(screen.getByRole('button', { name: 'Continuar com Google' }));
}

// Deixa a promessa pendente para observar o estado "em andamento" e resolve quando o teste mandar.
function pendingSignIn() {
  let resolve: (result: SignInResult) => void = () => undefined;
  mockSignIn.mockReturnValue(new Promise<SignInResult>((r) => (resolve = r)));
  return (result: SignInResult) => act(async () => resolve(result));
}

beforeEach(() => {
  mockSignIn.mockReset();
});

describe('LoginView', () => {
  it('exibe o botão "Continuar com Google" habilitado (AUTH-01)', () => {
    render(<LoginView />);

    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeEnabled();
  });

  it('tocar no botão inicia o login com Google (AUTH-02)', async () => {
    const finish = pendingSignIn();
    render(<LoginView />);

    pressGoogle();
    await finish({ ok: true });

    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });

  it('durante a autenticação o botão fica desabilitado, com indicador, e ignora novos toques (AUTH-03)', async () => {
    const finish = pendingSignIn();
    render(<LoginView />);

    pressGoogle();

    const button = screen.getByRole('button', { name: 'Continuar com Google' });
    expect(button).toBeDisabled();
    expect(button).toBeBusy();
    expect(screen.getByTestId('button-loading')).toBeOnTheScreen();

    pressGoogle();
    expect(mockSignIn).toHaveBeenCalledTimes(1);

    await finish({ ok: true });
  });

  it('cancelar o seletor não mostra erro e reabilita o botão (AUTH-04)', async () => {
    const finish = pendingSignIn();
    render(<LoginView />);

    pressGoogle();
    await finish({ ok: false, code: 'cancelled' });

    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeEnabled();
  });

  it.each([
    ['play_services', 'Google Play Services indisponível neste dispositivo.', 'AUTH-05'],
    ['no_id_token', 'Não foi possível obter o token do Google. Tente novamente.', 'AUTH-06'],
    ['unknown', 'Não foi possível entrar. Tente novamente.', 'AUTH-07'],
  ] as const)('falha %s mostra "%s" e reabilita o botão (%s)', async (code, message, _requirement) => {
    const finish = pendingSignIn();
    render(<LoginView />);

    pressGoogle();
    await finish({ ok: false, code });

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeEnabled();
  });
});
