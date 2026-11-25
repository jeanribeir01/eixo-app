import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { isRunningInExpoGo } from 'expo';

import { signInWithEmail } from '../emailAuth';
import { signInWithGoogle, type SignInResult } from '../googleAuth';
import { dispararSemEsperar } from '@/testing/eventos';
import { colors } from '@/ui';

import { LoginView } from '../LoginView';

jest.mock('../googleAuth', () => ({ signInWithGoogle: jest.fn() }));
jest.mock('../emailAuth', () => ({ loginEmailHabilitado: false, signInWithEmail: jest.fn() }));

const mockSignIn = signInWithGoogle as jest.MockedFunction<typeof signInWithGoogle>;
const mockSignInEmail = signInWithEmail as jest.MockedFunction<typeof signInWithEmail>;

// Toca no Google sem esperar o login terminar: os testes deixam o login pendente e o resolvem com `finish`.
async function pressGoogle() {
  await dispararSemEsperar(() => fireEvent.press(screen.getByRole('button', { name: 'Continuar com Google' })));
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
  it('mostra a marca Eixo Certo com o nome no topo (MRC-02)', async () => {
    await render(<LoginView />);

    expect(screen.getByRole('image', { name: 'Eixo Certo' })).toBeOnTheScreen();
    expect(screen.getByText('Eixo Certo')).toBeOnTheScreen();
  });

  it('a foto do caminhão no topo é decorativa: o leitor de tela não para nela', async () => {
    await render(<LoginView />);

    const foto = screen.getByTestId('login-foto', { includeHiddenElements: true });
    expect(foto.props.accessible).toBe(false);
    expect(screen.getByText('Bem-vindo de volta')).toBeOnTheScreen();
  });

  it('exibe o botão "Continuar com Google" habilitado (AUTH-01)', async () => {
    await render(<LoginView />);

    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeEnabled();
  });

  it('tocar no botão inicia o login com Google (AUTH-02)', async () => {
    const finish = pendingSignIn();
    await render(<LoginView />);

    await pressGoogle();
    await finish({ ok: true });

    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });

  it('durante a autenticação o botão fica desabilitado, com indicador, e ignora novos toques (AUTH-03)', async () => {
    const finish = pendingSignIn();
    await render(<LoginView />);

    await pressGoogle();

    const button = screen.getByRole('button', { name: 'Continuar com Google' });
    expect(button).toBeDisabled();
    expect(button).toBeBusy();
    expect(screen.getByTestId('button-loading')).toBeOnTheScreen();

    await pressGoogle();
    expect(mockSignIn).toHaveBeenCalledTimes(1);

    await finish({ ok: true });
  });

  it('cancelar o seletor não mostra erro e reabilita o botão (AUTH-04)', async () => {
    const finish = pendingSignIn();
    await render(<LoginView />);

    await pressGoogle();
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
    await render(<LoginView />);

    await pressGoogle();
    await finish({ ok: false, code });

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    // Em danger e com o ícone de alerta: o erro não se confunde com o texto da tela.
    expect(screen.getByRole('alert')).toHaveStyle({ color: colors.danger });
    expect(screen.getByTestId('icone-alerta', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeEnabled();
  });
});

describe('LoginView — login de teste por e-mail e senha', () => {
  async function preencher(email: string, senha: string) {
    await fireEvent.changeText(screen.getByLabelText('E-mail'), email);
    await fireEvent.changeText(screen.getByLabelText('Senha'), senha);
  }

  async function pressEmail() {
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar com e-mail' }));
  }

  it('fica escondido quando a flag do .env está desligada', async () => {
    await render(<LoginView />);

    expect(screen.queryByLabelText('E-mail')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Entrar com e-mail' })).not.toBeOnTheScreen();
  });

  it('mostra e-mail, senha e o botão quando habilitado', async () => {
    await render(<LoginView mostrarLoginEmail />);

    expect(screen.getByLabelText('E-mail')).toBeOnTheScreen();
    expect(screen.getByLabelText('Senha')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Entrar com e-mail' })).toBeEnabled();
  });

  it('separa o login de teste do Google, com ícone em cada campo e o botão "Entrar"', async () => {
    await render(<LoginView mostrarLoginEmail />);

    expect(screen.getByText('ou com e-mail')).toBeOnTheScreen();
    expect(screen.getByTestId('icone-email', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('icone-senha', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar com e-mail' })).toHaveTextContent('Entrar');
  });

  it('sem o login de teste, nem o divisor aparece', async () => {
    await render(<LoginView />);

    expect(screen.queryByText('ou com e-mail')).not.toBeOnTheScreen();
  });

  it('bloqueia campos vazios com mensagem em português e não chama o Supabase', async () => {
    await render(<LoginView mostrarLoginEmail />);

    await pressEmail();

    expect(screen.getByText('Informe o e-mail.')).toBeOnTheScreen();
    expect(screen.getByText('Informe a senha.')).toBeOnTheScreen();
    expect(mockSignInEmail).not.toHaveBeenCalled();
  });

  it('bloqueia e-mail inválido', async () => {
    await render(<LoginView mostrarLoginEmail />);

    await preencher('financeiro', '123456');
    await pressEmail();

    expect(screen.getByText('Informe um e-mail válido.')).toBeOnTheScreen();
    expect(mockSignInEmail).not.toHaveBeenCalled();
  });

  it('envia e-mail sem espaços e a senha, com loading no botão', async () => {
    let resolve: (result: SignInResult) => void = () => undefined;
    mockSignInEmail.mockReturnValue(new Promise<SignInResult>((r) => (resolve = r)));
    await render(<LoginView mostrarLoginEmail />);

    await preencher('  financeiro@teste.com ', 'senha-secreta');
    // Sem esperar o login: ele fica pendente para o teste ver o loading.
    const toque1 = await dispararSemEsperar(() => fireEvent.press(screen.getByRole('button', { name: 'Entrar com e-mail' })));

    expect(mockSignInEmail).toHaveBeenCalledWith('financeiro@teste.com', 'senha-secreta');
    expect(screen.getByRole('button', { name: 'Entrar com e-mail' })).toBeBusy();
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeDisabled();

    await act(async () => {
      resolve({ ok: true });
      await toque1.terminou;
    });
  });

  it('credenciais erradas mostram erro e reabilitam o botão', async () => {
    mockSignInEmail.mockResolvedValue({ ok: false, code: 'invalid_credentials' });
    await render(<LoginView mostrarLoginEmail />);

    await preencher('financeiro@teste.com', 'errada');
    await pressEmail();

    expect(screen.getByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
    expect(screen.getByRole('button', { name: 'Entrar com e-mail' })).toBeEnabled();
  });
});

// No Expo Go não existe o módulo nativo do Google: a tela troca o Google pelo login por e-mail, para o
// app abrir num iPhone sem conta de desenvolvedor da Apple.
describe('LoginView no Expo Go', () => {
  const mockIsRunningInExpoGo = isRunningInExpoGo as jest.Mock;

  beforeEach(() => mockIsRunningInExpoGo.mockReturnValue(true));
  afterEach(() => mockIsRunningInExpoGo.mockReturnValue(false));

  it('esconde o botão do Google', async () => {
    await render(<LoginView />);

    expect(screen.queryByRole('button', { name: 'Continuar com Google' })).not.toBeOnTheScreen();
  });

  it('mostra o login por e-mail mesmo com a flag do .env desligada, sem o divisor', async () => {
    await render(<LoginView mostrarLoginEmail={false} />);

    expect(screen.getByLabelText('E-mail')).toBeOnTheScreen();
    expect(screen.getByLabelText('Senha')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Entrar com e-mail' })).toBeEnabled();
    expect(screen.queryByText('ou com e-mail')).not.toBeOnTheScreen();
  });

  it('o login por e-mail funciona: envia e-mail e senha ao Supabase', async () => {
    mockSignInEmail.mockResolvedValue({ ok: true });
    await render(<LoginView />);

    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'motorista@empresa.com');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'senha-segura');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar com e-mail' }));

    expect(mockSignInEmail).toHaveBeenCalledWith('motorista@empresa.com', 'senha-segura');
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});
