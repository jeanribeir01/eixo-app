import { fireEvent, render, screen } from '@testing-library/react-native';

import { useProfileStore } from '@/features/auth/profileStore';

import { UsuarioDetalheView } from '../UsuarioDetalheView';
import { alterarPerfilUsuario, alterarStatusUsuario, buscarUsuarioPorId, listarPerfis } from '../usuariosRepository';

jest.setTimeout(15000);

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useLocalSearchParams: () => ({ id: 'u2' }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, []),
  };
});
jest.mock('@/supabase/client', () => ({ supabase: {} }));
jest.mock('../usuariosRepository', () => ({
  buscarUsuarioPorId: jest.fn(),
  listarPerfis: jest.fn(),
  alterarPerfilUsuario: jest.fn(),
  alterarStatusUsuario: jest.fn(),
}));

const perfis = [
  { id: 'p-mot', nome: 'Motorista' as const },
  { id: 'p-adm', nome: 'Admin' as const },
  { id: 'p-fin', nome: 'Financeiro' as const },
  { id: 'p-ges', nome: 'Gestor de Frota' as const },
];

const bruno = {
  id: 'u2',
  nome: 'Bruno Lima',
  email: 'bruno@empresa.com',
  status: 'AguardandoAprovacao' as const,
  perfil: { id: 'p-mot', nome: 'Motorista' as const },
};

function logadoComo(id: string) {
  useProfileStore.setState({
    usuarioId: id,
    estado: 'pronto',
    usuario: { id, nome: 'Ana', email: 'ana@empresa.com', perfil: 'Admin', status: 'Aprovado' },
  });
}

beforeEach(() => {
  logadoComo('u1');
  (buscarUsuarioPorId as jest.Mock).mockReset().mockResolvedValue({ ok: true, data: bruno });
  (listarPerfis as jest.Mock).mockReset().mockResolvedValue({ ok: true, data: perfis });
  (alterarPerfilUsuario as jest.Mock).mockReset();
  (alterarStatusUsuario as jest.Mock).mockReset();
});

describe('UsuarioDetalheView', () => {
  it('mostra carregando e depois nome, e-mail, status e os 4 perfis com rótulo', async () => {
    render(<UsuarioDetalheView />);

    expect(screen.getByLabelText('Carregando usuário')).toBeOnTheScreen();
    expect(await screen.findByText('Bruno Lima')).toBeOnTheScreen();
    expect(buscarUsuarioPorId).toHaveBeenCalledWith('u2');
    expect(screen.getByText('bruno@empresa.com')).toBeOnTheScreen();
    expect(screen.getByText('Aguardando aprovação')).toBeOnTheScreen();
    for (const rotulo of ['Administrador', 'Gestor de Frota', 'Financeiro', 'Operador/Motorista']) {
      expect(screen.getByRole('button', { name: `Perfil ${rotulo}` })).toBeOnTheScreen();
    }
  });

  it('salvar perfil grava o perfil escolhido e mostra "Perfil atualizado." (AC5)', async () => {
    (alterarPerfilUsuario as jest.Mock).mockResolvedValue({
      ok: true,
      data: { ...bruno, perfil: { id: 'p-fin', nome: 'Financeiro' } },
    });
    render(<UsuarioDetalheView />);
    await screen.findByText('Bruno Lima');

    // Sem mudança de perfil, salvar fica desabilitado.
    expect(screen.getByRole('button', { name: 'Salvar perfil' })).toBeDisabled();

    fireEvent.press(screen.getByRole('button', { name: 'Perfil Financeiro' }));
    fireEvent.press(screen.getByRole('button', { name: 'Salvar perfil' }));

    expect(await screen.findByText('Perfil atualizado.')).toBeOnTheScreen();
    expect(alterarPerfilUsuario).toHaveBeenCalledWith('u2', 'p-fin');
  });

  it('Aprovar grava status Aprovado e mostra "Usuário aprovado." (AC6)', async () => {
    (alterarStatusUsuario as jest.Mock).mockResolvedValue({ ok: true, data: { ...bruno, status: 'Aprovado' } });
    render(<UsuarioDetalheView />);
    await screen.findByText('Bruno Lima');

    fireEvent.press(screen.getByRole('button', { name: 'Aprovar' }));

    expect(await screen.findByText('Usuário aprovado.')).toBeOnTheScreen();
    expect(alterarStatusUsuario).toHaveBeenCalledWith('u2', 'Aprovado');
    // Já aprovado: a ação disponível passa a ser Bloquear.
    expect(screen.getByText('Aprovado')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Bloquear' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeOnTheScreen();
  });

  it('Bloquear grava status Bloqueado e mostra "Usuário bloqueado." (AC7)', async () => {
    (buscarUsuarioPorId as jest.Mock).mockResolvedValue({ ok: true, data: { ...bruno, status: 'Aprovado' } });
    (alterarStatusUsuario as jest.Mock).mockResolvedValue({ ok: true, data: { ...bruno, status: 'Bloqueado' } });
    render(<UsuarioDetalheView />);
    await screen.findByText('Bruno Lima');

    fireEvent.press(screen.getByRole('button', { name: 'Bloquear' }));

    expect(await screen.findByText('Usuário bloqueado.')).toBeOnTheScreen();
    expect(alterarStatusUsuario).toHaveBeenCalledWith('u2', 'Bloqueado');
    expect(screen.getByText('Bloqueado')).toBeOnTheScreen();
  });

  it('falha ao gravar: mostra o erro e mantém o status anterior (AC8)', async () => {
    (alterarStatusUsuario as jest.Mock).mockResolvedValue({
      ok: false,
      mensagem: 'Não foi possível alterar o status. Tente novamente.',
    });
    render(<UsuarioDetalheView />);
    await screen.findByText('Bruno Lima');

    fireEvent.press(screen.getByRole('button', { name: 'Aprovar' }));

    expect(await screen.findByText('Não foi possível alterar o status. Tente novamente.')).toBeOnTheScreen();
    expect(screen.getByText('Aguardando aprovação')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeOnTheScreen();
  });

  it('falha ao salvar perfil: mostra o erro e mantém o perfil anterior (AC8)', async () => {
    (alterarPerfilUsuario as jest.Mock).mockResolvedValue({
      ok: false,
      mensagem: 'Não foi possível alterar o perfil. Tente novamente.',
    });
    render(<UsuarioDetalheView />);
    await screen.findByText('Bruno Lima');

    fireEvent.press(screen.getByRole('button', { name: 'Perfil Financeiro' }));
    fireEvent.press(screen.getByRole('button', { name: 'Salvar perfil' }));

    expect(await screen.findByText('Não foi possível alterar o perfil. Tente novamente.')).toBeOnTheScreen();
    expect(screen.queryByText('Perfil atualizado.')).not.toBeOnTheScreen();
    // O botão segue habilitado: a escolha ainda difere do perfil gravado (Motorista).
    expect(screen.getByRole('button', { name: 'Salvar perfil' })).toBeEnabled();
  });

  it('próprio usuário: sem escolha de perfil e sem Bloquear, com aviso (Admin não perde acesso AC3)', async () => {
    logadoComo('u2');
    (buscarUsuarioPorId as jest.Mock).mockResolvedValue({
      ok: true,
      data: { ...bruno, status: 'Aprovado', perfil: { id: 'p-adm', nome: 'Admin' } },
    });
    render(<UsuarioDetalheView />);
    await screen.findByText('Bruno Lima');

    expect(screen.getByText('Você não pode alterar o próprio perfil nem bloquear a si mesmo.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Salvar perfil' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Perfil Administrador' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Bloquear' })).not.toBeOnTheScreen();
  });

  it('erro ao carregar: mensagem e "Tentar novamente"', async () => {
    (buscarUsuarioPorId as jest.Mock)
      .mockResolvedValueOnce({ ok: false, mensagem: 'Usuário não encontrado.' })
      .mockResolvedValueOnce({ ok: true, data: bruno });
    render(<UsuarioDetalheView />);

    expect(await screen.findByText('Usuário não encontrado.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Bruno Lima')).toBeOnTheScreen();
  });
});
