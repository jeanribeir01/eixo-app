import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AguardandoLiberacaoView } from '../AguardandoLiberacaoView';
import { signOut } from '../googleAuth';
import { useProfileStore, type UsuarioLogado } from '../profileStore';

jest.mock('../googleAuth', () => ({ signOut: jest.fn() }));
// Recarregar o perfil consulta `usuario` de novo; `mockConsulta` registra essas consultas.
const mockConsulta = jest.fn();
jest.mock('@/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => ({
      select: () => ({
        eq: (_coluna: string, id: string) => ({
          maybeSingle: () => {
            mockConsulta(tabela, id);
            return Promise.resolve({ data: null, error: null });
          },
        }),
      }),
    }),
  },
}));

function usuario(status: UsuarioLogado['status']): UsuarioLogado {
  return { id: 'u1', nome: 'Ana', email: 'ana@empresa.com', perfil: 'Motorista', status };
}

beforeEach(() => {
  (signOut as jest.Mock).mockReset().mockResolvedValue(undefined);
  mockConsulta.mockReset();
});

describe('AguardandoLiberacaoView', () => {
  it('conta pendente: "Aguardando aprovação", quem é e o que falta (Novo usuário AC6)', () => {
    useProfileStore.setState({ usuarioId: 'u1', estado: 'pronto', usuario: usuario('AguardandoAprovacao') });

    render(<AguardandoLiberacaoView />);

    expect(screen.getByRole('header', { name: 'Aguardando aprovação' })).toBeOnTheScreen();
    expect(screen.getByText('Ana')).toBeOnTheScreen();
    expect(screen.getByText('ana@empresa.com')).toBeOnTheScreen();
    expect(screen.getByText('Falta liberar seu acesso')).toBeOnTheScreen();
    expect(screen.getByTestId('icone-aguardando', { includeHiddenElements: true })).toBeTruthy();
  });

  it('sem linha em usuario: também mostra "Aguardando liberação" (deny-by-default)', () => {
    useProfileStore.setState({ usuarioId: 'u1', estado: 'pronto', usuario: null });

    render(<AguardandoLiberacaoView />);

    expect(screen.getByRole('header', { name: 'Aguardando aprovação' })).toBeOnTheScreen();
  });

  it('conta bloqueada: mostra o texto de bloqueio (AC7)', () => {
    useProfileStore.setState({ usuarioId: 'u1', estado: 'pronto', usuario: usuario('Bloqueado') });

    render(<AguardandoLiberacaoView />);

    expect(screen.getByRole('header', { name: 'Acesso bloqueado' })).toBeOnTheScreen();
    expect(screen.getByText('Seu acesso foi bloqueado')).toBeOnTheScreen();
    expect(screen.getByTestId('icone-bloqueado', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Verificar aprovação' })).not.toBeOnTheScreen();
  });

  it('Sair encerra a sessão (AC8)', () => {
    useProfileStore.setState({ usuarioId: 'u1', estado: 'pronto', usuario: usuario('AguardandoAprovacao') });
    render(<AguardandoLiberacaoView />);

    fireEvent.press(screen.getByRole('button', { name: 'Sair da conta' }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('"Verificar aprovação" recarrega o perfil', async () => {
    useProfileStore.setState({ usuarioId: 'u1', estado: 'pronto', usuario: usuario('AguardandoAprovacao') });
    render(<AguardandoLiberacaoView />);

    fireEvent.press(screen.getByRole('button', { name: 'Verificar aprovação' }));

    await waitFor(() => expect(mockConsulta).toHaveBeenCalledWith('usuario', 'u1'));
  });

  it('verificou e a aprovação ainda não saiu: a tela diz isso, em vez de parecer que nada aconteceu', async () => {
    useProfileStore.setState({ usuarioId: 'u1', estado: 'pronto', usuario: usuario('AguardandoAprovacao') });
    render(<AguardandoLiberacaoView />);

    fireEvent.press(screen.getByRole('button', { name: 'Verificar aprovação' }));

    expect(await screen.findByText('Verificado agora: a aprovação ainda não saiu.')).toBeOnTheScreen();
  });

  it('erro ao carregar: mensagem, "Tentar novamente" e "Sair" (AC9)', async () => {
    useProfileStore.setState({ usuarioId: 'u1', estado: 'erro', usuario: null });
    render(<AguardandoLiberacaoView />);

    expect(screen.getByText('Não foi possível carregar seu perfil.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(mockConsulta).toHaveBeenCalledWith('usuario', 'u1'));

    fireEvent.press(screen.getByRole('button', { name: 'Sair da conta' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('carregando: mostra o indicador e nenhuma mensagem de status', () => {
    useProfileStore.setState({ usuarioId: 'u1', estado: 'carregando', usuario: null });

    render(<AguardandoLiberacaoView />);

    expect(screen.getByLabelText('Carregando seu perfil')).toBeOnTheScreen();
    expect(screen.queryByText('Aguardando aprovação')).not.toBeOnTheScreen();
  });
});
