import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Skeleton, colors } from '@/ui';

import type { Usuario } from '../types';
import { UsuariosListView } from '../UsuariosListView';
import { listarUsuarios } from '../usuariosRepository';

// O runner do CI é mais lento que a máquina local (mesmo ajuste de CategoriasListView).
jest.setTimeout(15000);

const mockPush = jest.fn();
let mockAoFocar: (() => void) | null = null;

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => {
      mockAoFocar = callback;
      react.useEffect(callback, [callback]);
    },
  };
});

jest.mock('../usuariosRepository', () => ({ listarUsuarios: jest.fn() }));

const mockListar = listarUsuarios as jest.MockedFunction<typeof listarUsuarios>;

const usuarios: Usuario[] = [
  { id: 'u1', nome: 'Ana Souza', email: 'ana@empresa.com', status: 'Ativo', perfil: { id: 'p1', nome: 'Admin' } },
  {
    id: 'u2',
    nome: 'Bruno Lima',
    email: 'bruno@empresa.com',
    status: 'AguardandoAprovacao',
    perfil: { id: 'p2', nome: 'Motorista' },
  },
  {
    id: 'u3',
    nome: 'Carla Dias',
    email: 'carla@empresa.com',
    status: 'Bloqueado',
    perfil: { id: 'p3', nome: 'Financeiro' },
  },
];

beforeEach(() => {
  mockPush.mockReset();
  mockListar.mockReset();
});

async function renderComLista() {
  mockListar.mockResolvedValue({ ok: true, data: usuarios });
  render(<UsuariosListView />);
  await screen.findByText('Ana Souza');
}

function rotulosDosBadges(): string[] {
  return screen.UNSAFE_getAllByType(Badge).map((badge) => badge.props.label);
}

describe('UsuariosListView — linha (CTA-02)', () => {
  it('primeira carga: três skeletons, depois nome e e-mail de cada usuário', async () => {
    mockListar.mockResolvedValue({ ok: true, data: usuarios });
    render(<UsuariosListView />);

    expect(screen.getByLabelText('Carregando usuários')).toBeOnTheScreen();
    expect(screen.UNSAFE_getAllByType(Skeleton)).toHaveLength(3);

    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen();
    expect(screen.getByText('ana@empresa.com')).toBeOnTheScreen();
    expect(screen.getByText('Bruno Lima')).toBeOnTheScreen();
    expect(screen.getByText('bruno@empresa.com')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Carregando usuários')).not.toBeOnTheScreen();
  });

  it('usuário ativo: o Badge mostra o perfil', async () => {
    await renderComLista();

    expect(rotulosDosBadges()[0]).toBe('Administrador');
  });

  it('usuário aguardando ou bloqueado: o Badge mostra o status, que é o que o Admin precisa resolver', async () => {
    await renderComLista();

    expect(rotulosDosBadges()).toEqual(['Administrador', 'Aguardando aprovação', 'Bloqueado']);
    expect(screen.queryByText('Operador/Motorista')).not.toBeOnTheScreen();
  });

  it('tocar em um usuário abre o detalhe dele', async () => {
    await renderComLista();

    fireEvent.press(screen.getByRole('button', { name: 'Gerenciar Bruno Lima' }));

    expect(mockPush).toHaveBeenCalledWith('/usuarios/u2');
  });

  it('o título da tela fica no header nativo, não no conteúdo (NAV-02)', async () => {
    await renderComLista();

    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
    expect(screen.queryByText('Usuários')).not.toBeOnTheScreen();
    // Tela interna: o header nativo protege o topo, o Screen não repete o inset (NAV-04, AC 11).
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
  });
});

describe('UsuariosListView — carga (CTA-02)', () => {
  it('puxar a lista para baixo recarrega (AC 7)', async () => {
    await renderComLista();

    const refresh = screen.UNSAFE_getByType(RefreshControl);
    expect(refresh.props.colors).toEqual([colors.accent]);
    await act(async () => refresh.props.onRefresh());

    expect(mockListar).toHaveBeenCalledTimes(2);
  });

  it('voltar do detalhe recarrega sem skeleton e mostra a mudança', async () => {
    await renderComLista();
    mockListar.mockResolvedValue({
      ok: true,
      data: [{ ...usuarios[1], status: 'Ativo' }],
    });

    await act(async () => {
      mockAoFocar?.();
    });

    expect(screen.queryByLabelText('Carregando usuários')).not.toBeOnTheScreen();
    expect(rotulosDosBadges()).toEqual(['Operador/Motorista']);
  });

  it('recarga que falha mantém a lista e avisa no Snackbar', async () => {
    await renderComLista();
    mockListar.mockResolvedValue({ ok: false, mensagem: 'Sem conexão com o servidor.' });

    await act(async () => {
      mockAoFocar?.();
    });

    expect(screen.getByText('Sem conexão com o servidor.')).toBeOnTheScreen();
    expect(screen.getByText('Ana Souza')).toBeOnTheScreen();
  });

  it('lista vazia: "Nenhum usuário encontrado", ainda com pull-to-refresh', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [] });

    render(<UsuariosListView />);

    expect(await screen.findByText('Nenhum usuário encontrado')).toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(RefreshControl)).toBeTruthy();
  });

  it('erro na primeira carga: mensagem e "Tentar novamente" recarrega', async () => {
    mockListar
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar os usuários. Tente novamente.' })
      .mockResolvedValueOnce({ ok: true, data: usuarios });
    render(<UsuariosListView />);

    expect(await screen.findByText('Não foi possível carregar')).toBeOnTheScreen();
    expect(screen.getByText('Não foi possível carregar os usuários. Tente novamente.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen();
    expect(mockListar).toHaveBeenCalledTimes(2);
  });
});
