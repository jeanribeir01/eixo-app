import type { Session } from '@supabase/supabase-js';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { listarUsuarios } from '@/features/usuarios/usuariosRepository';

import { ContaView } from '../ContaView';
import { signOut } from '../googleAuth';
import { useProfileStore, type UsuarioLogado } from '../profileStore';
import { useSessionStore } from '../sessionStore';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@/features/usuarios/usuariosRepository', () => ({ listarUsuarios: jest.fn() }));
jest.mock('../googleAuth', () => ({ signOut: jest.fn() }));
jest.mock('@/supabase/client', () => ({ supabase: { auth: {} } }));
// A versão vem do app.config.ts em tempo de build; no teste, um valor fixo.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.4.2' } } }));

function sessionWith(email: string, metadata: Record<string, unknown>): Session {
  return { access_token: 'token', user: { id: 'user-1', email, user_metadata: metadata } } as unknown as Session;
}

function perfil(perfilNome: UsuarioLogado['perfil']): UsuarioLogado {
  return { id: 'user-1', nome: 'Maria', email: 'maria@example.com', perfil: perfilNome, status: 'Ativo' };
}

function logarComo(perfilNome: UsuarioLogado['perfil'], metadata: Record<string, unknown> = { full_name: 'Maria Silva' }) {
  useSessionStore.setState({ session: sessionWith('maria@example.com', metadata), isRestoring: false });
  useProfileStore.setState({ usuarioId: 'user-1', estado: 'pronto', usuario: perfil(perfilNome) });
}

beforeEach(() => {
  (signOut as jest.Mock).mockReset().mockResolvedValue(undefined);
  mockPush.mockReset();
  jest.mocked(listarUsuarios).mockReset().mockResolvedValue({ ok: true, data: [] });
  logarComo('Motorista');
});

describe('ContaView — cartão do usuário (CTA-01)', () => {
  it('título da aba no conteúdo; nome completo, e-mail e o perfil num Badge', () => {
    logarComo('Financeiro');

    render(<ContaView />);

    expect(screen.getByText('Conta')).toBeOnTheScreen();
    expect(screen.getByText('Maria Silva')).toBeOnTheScreen();
    expect(screen.getByText('maria@example.com')).toBeOnTheScreen();
    expect(screen.getByText('Financeiro')).toBeOnTheScreen();
  });

  it('a Home de teste sumiu: sem "Login confirmado" nem o aviso de tela de teste', () => {
    render(<ContaView />);

    expect(screen.queryByText('Login confirmado')).not.toBeOnTheScreen();
    expect(screen.queryByText(/tela de teste/i)).not.toBeOnTheScreen();
    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
  });

  it('com o perfil ainda carregando, o Badge não aparece', () => {
    useProfileStore.setState({ estado: 'carregando', usuario: null });

    render(<ContaView />);

    expect(screen.getByText('Maria Silva')).toBeOnTheScreen();
    for (const nome of ['Admin', 'Gestor de Frota', 'Financeiro', 'Motorista']) {
      expect(screen.queryByText(nome)).not.toBeOnTheScreen();
    }
  });

  it('com foto do Google, exibe a foto (AUTH-14)', () => {
    logarComo('Motorista', { full_name: 'Maria Silva', avatar_url: 'https://lh3.googleusercontent.com/foto-maria' });

    render(<ContaView />);

    expect(screen.getByLabelText('Foto de Maria Silva')).toHaveProp('source', {
      uri: 'https://lh3.googleusercontent.com/foto-maria',
    });
    expect(screen.queryByLabelText('Iniciais de Maria Silva')).not.toBeOnTheScreen();
  });

  it('sem foto, exibe a inicial maiúscula do nome (AUTH-14)', () => {
    logarComo('Motorista', { full_name: 'maria Silva' });

    render(<ContaView />);

    expect(screen.getByLabelText('Iniciais de maria Silva')).toHaveTextContent('MS');
  });

  it('nome vazio no Google: usa o e-mail no lugar do nome (edge case)', () => {
    useSessionStore.setState({ session: sessionWith('joao@example.com', { full_name: '' }), isRestoring: false });

    render(<ContaView />);

    // Duas vezes: no lugar do nome e na linha do e-mail.
    expect(screen.getAllByText('joao@example.com')).toHaveLength(2);
    expect(screen.getByLabelText('Iniciais de joao@example.com')).toHaveTextContent('J');
  });
});

describe('ContaView — linhas e Sair (CTA-01)', () => {
  it('Admin vê a linha "Usuários", que abre a tela de usuários (RBAC-03)', () => {
    logarComo('Admin');
    render(<ContaView />);

    expect(screen.getByText('Administração')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Usuários' }));

    expect(mockPush).toHaveBeenCalledWith('/usuarios');
  });

  it.each(['Gestor de Frota', 'Financeiro', 'Motorista'] as const)(
    'perfil %s não vê a linha "Usuários" (RBAC-03 AC1) nem consulta a tabela',
    (perfilNome) => {
      logarComo(perfilNome);

      render(<ContaView />);

      expect(screen.queryByRole('button', { name: 'Usuários' })).not.toBeOnTheScreen();
      expect(screen.queryByText('Administração')).not.toBeOnTheScreen();
      expect(listarUsuarios).not.toHaveBeenCalled();
    },
  );

  it('Admin vê quantas pessoas há e quantas aguardam aprovação', async () => {
    const pessoa = { email: 'x@empresa.com', perfil: { id: 'p', nome: 'Motorista' as const } };
    jest.mocked(listarUsuarios).mockResolvedValue({
      ok: true,
      data: [
        { ...pessoa, id: 'a', nome: 'A', status: 'Ativo' },
        { ...pessoa, id: 'b', nome: 'B', status: 'Ativo' },
        { ...pessoa, id: 'c', nome: 'C', status: 'AguardandoAprovacao' },
      ],
    });
    logarComo('Admin');

    render(<ContaView />);

    expect(await screen.findByText('3 pessoas · 1 aguardando aprovação')).toBeOnTheScreen();
  });

  it('Admin, com a busca da equipe falhando: a linha diz o que a tela faz, sem número', async () => {
    jest.mocked(listarUsuarios).mockResolvedValue({ ok: false, mensagem: 'Sem conexão.' });
    logarComo('Admin');

    render(<ContaView />);

    expect(await screen.findByText('Aprovar, mudar perfil e bloquear')).toBeOnTheScreen();
  });

  it('Financeiro vê Categorias e Formas de pagamento em "Cadastros"', () => {
    logarComo('Financeiro');
    render(<ContaView />);

    expect(screen.getByText('Cadastros')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Categorias' }));
    fireEvent.press(screen.getByRole('button', { name: 'Formas de pagamento' }));

    expect(mockPush).toHaveBeenCalledWith('/categorias');
    expect(mockPush).toHaveBeenCalledWith('/formas-pagamento');
  });

  it.each(['Gestor de Frota', 'Motorista'] as const)('%s não vê os cadastros do Caixa', (perfilNome) => {
    logarComo(perfilNome);
    render(<ContaView />);

    expect(screen.queryByRole('button', { name: 'Categorias' })).not.toBeOnTheScreen();
  });

  it('linha "Versão" mostra a versão do app.config.ts', () => {
    render(<ContaView />);

    expect(screen.getByText('Versão')).toBeOnTheScreen();
    expect(screen.getByText('1.4.2')).toBeOnTheScreen();
  });

  it('"Sair" encerra a sessão direto, sem diálogo de confirmação (AUTH-15)', () => {
    render(<ContaView />);

    fireEvent.press(screen.getByRole('button', { name: 'Sair da conta' }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
