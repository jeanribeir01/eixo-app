import { fireEvent, render, screen } from '@testing-library/react-native';

import { UsuariosListView } from '../UsuariosListView';
import { listarUsuarios } from '../usuariosRepository';

// O runner do CI é mais lento que a máquina local (mesmo ajuste de CategoriasListView).
jest.setTimeout(15000);

const mockPush = jest.fn();

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, []),
  };
});

jest.mock('../usuariosRepository', () => ({ listarUsuarios: jest.fn() }));

const usuarios = [
  {
    id: 'u1',
    nome: 'Ana Souza',
    email: 'ana@empresa.com',
    status: 'Aprovado' as const,
    perfil: { id: 'p1', nome: 'Admin' as const },
  },
  {
    id: 'u2',
    nome: 'Bruno Lima',
    email: 'bruno@empresa.com',
    status: 'AguardandoAprovacao' as const,
    perfil: { id: 'p2', nome: 'Motorista' as const },
  },
];

beforeEach(() => {
  mockPush.mockReset();
  (listarUsuarios as jest.Mock).mockReset();
});

describe('UsuariosListView', () => {
  it('mostra carregando e depois nome, e-mail, perfil e status de cada usuário (AC2, AC3)', async () => {
    (listarUsuarios as jest.Mock).mockResolvedValue({ ok: true, data: usuarios });

    render(<UsuariosListView />);

    expect(screen.getByLabelText('Carregando usuários')).toBeOnTheScreen();
    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen();
    expect(screen.getByText('ana@empresa.com')).toBeOnTheScreen();
    expect(screen.getByText('Administrador')).toBeOnTheScreen();
    expect(screen.getByText('Aprovado')).toBeOnTheScreen();
    expect(screen.getByText('Bruno Lima')).toBeOnTheScreen();
    expect(screen.getByText('bruno@empresa.com')).toBeOnTheScreen();
    expect(screen.getByText('Operador/Motorista')).toBeOnTheScreen();
    expect(screen.getByText('Aguardando aprovação')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Carregando usuários')).not.toBeOnTheScreen();
  });

  it('tocar em um usuário abre o detalhe dele', async () => {
    (listarUsuarios as jest.Mock).mockResolvedValue({ ok: true, data: usuarios });
    render(<UsuariosListView />);

    fireEvent.press(await screen.findByRole('button', { name: 'Gerenciar Bruno Lima' }));

    expect(mockPush).toHaveBeenCalledWith('/usuarios/u2');
  });

  it('lista vazia: "Nenhum usuário encontrado"', async () => {
    (listarUsuarios as jest.Mock).mockResolvedValue({ ok: true, data: [] });

    render(<UsuariosListView />);

    expect(await screen.findByText('Nenhum usuário encontrado')).toBeOnTheScreen();
  });

  it('erro: mensagem e "Tentar novamente" recarrega (AC4)', async () => {
    (listarUsuarios as jest.Mock)
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar os usuários. Tente novamente.' })
      .mockResolvedValueOnce({ ok: true, data: usuarios });
    render(<UsuariosListView />);

    expect(await screen.findByText('Não foi possível carregar')).toBeOnTheScreen();
    expect(screen.getByText('Não foi possível carregar os usuários. Tente novamente.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen();
    expect(listarUsuarios).toHaveBeenCalledTimes(2);
  });
});
