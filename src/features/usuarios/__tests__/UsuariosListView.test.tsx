import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { segurarPrimeiraCarga } from '@/testing/eventos';
import { porTipo, todosPorTipo } from '@/testing/componentes';
import { Badge, ListItem, Skeleton, colors, spacing } from '@/ui';

import type { Usuario } from '../types';
import { UsuariosListView } from '../UsuariosListView';
import { alterarStatusUsuario, listarUsuarios } from '../usuariosRepository';

// Largura da janela controlada pelo teste: 412 é celular, 800 é tablet (EIX-94).
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 900, scale: 1, fontScale: 1 })),
}));

function mockLargura(width: number) {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

// O runner do CI é mais lento que a máquina local (mesmo ajuste de CategoriasListView).
jest.setTimeout(15000);

const mockPush = jest.fn();
let mockAoFocar: (() => void) | null = null;

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  // Mesmo objeto em todo render, como o useRouter real (devolve o router global do expo-router).
  // Um objeto novo por render mudaria os callbacks das linhas e desfaria o memo (EIX-71).
  const roteador = { push: (...args: unknown[]) => mockPush(...args) };
  return {
    useRouter: () => roteador,
    useFocusEffect: (callback: () => void) => {
      mockAoFocar = callback;
      react.useEffect(callback, [callback]);
    },
  };
});

jest.mock('../usuariosRepository', () => ({ listarUsuarios: jest.fn(), alterarStatusUsuario: jest.fn() }));

// O ListItem real, só embrulhado num jest.fn: o teste de memo (EIX-71) conta quantas vezes ele renderiza.
jest.mock('@/ui', () => {
  const real = jest.requireActual('@/ui');
  return { ...real, ListItem: jest.fn(real.ListItem) };
});

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
  jest.mocked(alterarStatusUsuario).mockReset();
});

async function renderComLista() {
  mockListar.mockResolvedValue({ ok: true, data: usuarios });
  await render(<UsuariosListView />);
  await screen.findByText('Ana Souza');
}

function rotulosDosBadges(): string[] {
  return todosPorTipo(Badge).map((badge) => badge.props.label);
}

describe('UsuariosListView — linha (CTA-02)', () => {
  it('primeira carga: três skeletons, depois nome e e-mail de cada usuário', async () => {
    mockListar.mockResolvedValue({ ok: true, data: usuarios });
    // Segura a primeira carga: o render async esperaria a resposta e pularia o "carregando".
    const liberarCarga = segurarPrimeiraCarga(mockListar);
    await render(<UsuariosListView />);

    expect(screen.getByLabelText('Carregando usuários')).toBeOnTheScreen();
    expect(todosPorTipo(Skeleton)).toHaveLength(3);

    await liberarCarga();
    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen();
    expect(screen.getByText('ana@empresa.com')).toBeOnTheScreen();
    expect(screen.getByText('Bruno Lima')).toBeOnTheScreen();
    expect(screen.getByText('bruno@empresa.com')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Carregando usuários')).not.toBeOnTheScreen();
  });

  it('usuário ativo: o Badge mostra o perfil', async () => {
    await renderComLista();

    expect(rotulosDosBadges()[0]).toBe('Admin');
  });

  it('bloqueado: o Badge mostra o status, em danger, que é o que o Admin precisa ver', async () => {
    await renderComLista();

    expect(rotulosDosBadges()).toEqual(['Admin', 'Bloqueado']);
    const bloqueado = todosPorTipo(Badge).find((badge) => badge.props.label === 'Bloqueado');
    expect(bloqueado?.props.tone).toBe('danger');
  });

  it('tocar em alguém da equipe abre o detalhe dele', async () => {
    await renderComLista();

    await fireEvent.press(screen.getByRole('button', { name: 'Gerenciar Ana Souza' }));

    expect(mockPush).toHaveBeenCalledWith('/usuarios/u1');
  });

  it('o título da tela fica no header nativo, não no conteúdo (NAV-02)', async () => {
    await renderComLista();

    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
    expect(screen.queryByText('Usuários')).not.toBeOnTheScreen();
    // Tela interna: o header nativo protege o topo, o Screen não repete o inset (NAV-04, AC 11).
    expect(porTipo(SafeAreaView).props.edges).not.toContain('top');
  });
});

describe('UsuariosListView — carga (CTA-02)', () => {
  it('puxar a lista para baixo recarrega (AC 7)', async () => {
    await renderComLista();

    const refresh = porTipo(RefreshControl);
    expect(refresh.props.colors).toEqual([colors.accentStrong]);
    await act(async () => refresh.props.onRefresh!());

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
    expect(rotulosDosBadges()).toEqual(['Motorista']);
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

  it('a tela re-renderizar (Snackbar de erro) não re-renderiza as linhas: elas são memoizadas (EIX-71)', async () => {
    await renderComLista();
    mockListar.mockResolvedValue({ ok: false, mensagem: 'Sem conexão com o servidor.' });
    const rendersAntes = jest.mocked(ListItem).mock.calls.length;

    await act(async () => {
      mockAoFocar?.();
    });

    // A tela mudou (o Snackbar apareceu), mas nenhum usuário mudou: nenhuma linha renderiza de novo.
    expect(screen.getByText('Sem conexão com o servidor.')).toBeOnTheScreen();
    expect(jest.mocked(ListItem).mock.calls.length).toBe(rendersAntes);
  });

  it('lista vazia: "Nenhum usuário encontrado", ainda com pull-to-refresh', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [] });

    await render(<UsuariosListView />);

    expect(await screen.findByText('Nenhum usuário encontrado')).toBeOnTheScreen();
    expect(porTipo(RefreshControl)).toBeTruthy();
  });

  it('erro na primeira carga: mensagem e "Tentar novamente" recarrega', async () => {
    mockListar
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar os usuários. Tente novamente.' })
      .mockResolvedValueOnce({ ok: true, data: usuarios });
    await render(<UsuariosListView />);

    expect(await screen.findByText('Não foi possível carregar')).toBeOnTheScreen();
    expect(screen.getByText('Não foi possível carregar os usuários. Tente novamente.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen();
    expect(mockListar).toHaveBeenCalledTimes(2);
  });
});

describe('UsuariosListView — tablet (EIX-94)', () => {
  afterEach(() => mockLargura(412));

  function estiloDoConteudo() {
    return StyleSheet.flatten(screen.getByTestId('screen-conteudo').props.style);
  }

  function estiloDaLista() {
    return StyleSheet.flatten(porTipo(FlatList).props.contentContainerStyle);
  }

  it('412: nada muda, o respiro lateral continua no Screen e a lista não ganha coluna', async () => {
    await renderComLista();

    expect(estiloDoConteudo()).toMatchObject({ paddingHorizontal: spacing.base });
    expect(estiloDaLista()?.maxWidth).toBeUndefined();
  });

  it('800: a lista rola na largura toda e o conteúdo fica na coluna de 720', async () => {
    mockLargura(800);
    await renderComLista();

    expect(estiloDoConteudo().maxWidth).toBeUndefined();
    expect(estiloDoConteudo().paddingHorizontal).toBeUndefined();
    expect(estiloDaLista()).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
    const coluna = screen.getByTestId('screen-coluna');
    expect(StyleSheet.flatten(coluna.props.style)).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
    expect(within(coluna).getByLabelText('Buscar por nome ou e-mail')).toBeOnTheScreen();
  });
});

// Pedido de acesso no topo, com Aprovar e Recusar ali mesmo (auditoria de UI, item 6).
describe('UsuariosListView — aguardando aprovação', () => {
  it('o pedido fica numa seção própria no topo, fora da equipe', async () => {
    await renderComLista();

    expect(screen.getByText('Aguardando aprovação · 1')).toBeOnTheScreen();
    expect(screen.getByText('Equipe · 2')).toBeOnTheScreen();
    expect(screen.getByText(/Ao aprovar, começa como Operador\/Motorista/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Gerenciar Bruno Lima' })).not.toBeOnTheScreen();
  });

  it('Aprovar grava Ativo, avisa e move a pessoa para a equipe', async () => {
    jest.mocked(alterarStatusUsuario).mockResolvedValue({ ok: true, data: { ...usuarios[1], status: 'Ativo' } });
    await renderComLista();

    await fireEvent.press(screen.getByRole('button', { name: 'Aprovar Bruno Lima' }));

    expect(await screen.findByText('Bruno Lima aprovado.')).toBeOnTheScreen();
    expect(alterarStatusUsuario).toHaveBeenCalledWith('u2', 'Ativo');
    expect(screen.queryByText('Aguardando aprovação · 1')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Gerenciar Bruno Lima' })).toBeOnTheScreen();
  });

  it('Recusar grava Bloqueado; erro do banco aparece e o pedido continua no topo', async () => {
    jest
      .mocked(alterarStatusUsuario)
      .mockResolvedValue({ ok: false, mensagem: 'Não foi possível alterar o status. Tente novamente.' });
    await renderComLista();

    await fireEvent.press(screen.getByRole('button', { name: 'Recusar Bruno Lima' }));

    expect(await screen.findByText('Não foi possível alterar o status. Tente novamente.')).toBeOnTheScreen();
    expect(alterarStatusUsuario).toHaveBeenCalledWith('u2', 'Bloqueado');
    expect(screen.getByText('Aguardando aprovação · 1')).toBeOnTheScreen();
  });

  it('a busca filtra por nome ou e-mail nas duas seções', async () => {
    await renderComLista();

    await fireEvent.changeText(screen.getByLabelText('Buscar por nome ou e-mail'), 'carla@');

    expect(screen.getByText('Carla Dias')).toBeOnTheScreen();
    expect(screen.queryByText('Ana Souza')).not.toBeOnTheScreen();
    expect(screen.queryByText('Aguardando aprovação · 1')).not.toBeOnTheScreen();
  });
});
