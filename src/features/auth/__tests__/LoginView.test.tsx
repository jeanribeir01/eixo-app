import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { signInWithEmail } from '../emailAuth';
import { signInWithGoogle, type SignInResult } from '../googleAuth';
import { LoginView } from '../LoginView';

jest.mock('../googleAuth', () => ({ signInWithGoogle: jest.fn() }));
jest.mock('../emailAuth', () => ({ loginEmailHabilitado: false, signInWithEmail: jest.fn() }));

const mockSignIn = signInWithGoogle as jest.MockedFunction<typeof signInWithGoogle>;
const mockSignInEmail = signInWithEmail as jest.MockedFunction<typeof signInWithEmail>;

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
  mockSignInEmail.mockReset();
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

describe('LoginView — login de teste por e-mail e senha', () => {
  function preencher(email: string, senha: string) {
    fireEvent.changeText(screen.getByLabelText('E-mail'), email);
    fireEvent.changeText(screen.getByLabelText('Senha'), senha);
  }

  function pressEmail() {
    fireEvent.press(screen.getByRole('button', { name: 'Entrar com e-mail' }));
  }

  it('fica escondido quando a flag do .env está desligada', () => {
    render(<LoginView />);

    expect(screen.queryByLabelText('E-mail')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Entrar com e-mail' })).not.toBeOnTheScreen();
  });

  it('mostra e-mail, senha e o botão quando habilitado', () => {
    render(<LoginView mostrarLoginEmail />);

    expect(screen.getByLabelText('E-mail')).toBeOnTheScreen();
    expect(screen.getByLabelText('Senha')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Entrar com e-mail' })).toBeEnabled();
  });

  it('bloqueia campos vazios com mensagem em português e não chama o Supabase', () => {
    render(<LoginView mostrarLoginEmail />);

    pressEmail();

    expect(screen.getByText('Informe o e-mail.')).toBeOnTheScreen();
    expect(screen.getByText('Informe a senha.')).toBeOnTheScreen();
    expect(mockSignInEmail).not.toHaveBeenCalled();
  });

  it('bloqueia e-mail inválido', () => {
    render(<LoginView mostrarLoginEmail />);

    preencher('financeiro', '123456');
    pressEmail();

    expect(screen.getByText('Informe um e-mail válido.')).toBeOnTheScreen();
    expect(mockSignInEmail).not.toHaveBeenCalled();
  });

  it('envia e-mail sem espaços e a senha, com loading no botão', async () => {
    let resolve: (result: SignInResult) => void = () => undefined;
    mockSignInEmail.mockReturnValue(new Promise<SignInResult>((r) => (resolve = r)));
    render(<LoginView mostrarLoginEmail />);

    preencher('  financeiro@teste.com ', 'senha-secreta');
    pressEmail();

    expect(mockSignInEmail).toHaveBeenCalledWith('financeiro@teste.com', 'senha-secreta');
    expect(screen.getByRole('button', { name: 'Entrar com e-mail' })).toBeBusy();
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeDisabled();

    await act(async () => resolve({ ok: true }));
  });

  it('credenciais erradas mostram erro e reabilitam o botão', async () => {
    mockSignInEmail.mockResolvedValue({ ok: false, code: 'invalid_credentials' });
    render(<LoginView mostrarLoginEmail />);

    preencher('financeiro@teste.com', 'errada');
    await act(async () => pressEmail());

    expect(screen.getByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
    expect(screen.getByRole('button', { name: 'Entrar com e-mail' })).toBeEnabled();
  });
});
