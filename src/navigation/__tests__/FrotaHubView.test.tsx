import { fireEvent, render, screen } from '@testing-library/react-native';

import { useProfileStore } from '@/features/auth/profileStore';

import { FrotaHubView } from '../FrotaHubView';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

beforeEach(() => {
  mockPush.mockReset();
  useProfileStore.setState({ usuario: null, estado: 'pronto' });
});

// Aba Frota (EIX-77): o menu do módulo, no padrão do hub Financeiro.
describe('FrotaHubView (EIX-77)', () => {
  it('título da aba no conteúdo e as três entradas do módulo (NAV5-01)', () => {
    render(<FrotaHubView />);

    expect(screen.getByText('Frota')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Veículos' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Rotas' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Manutenções' })).toBeOnTheScreen();
  });

  it.each([
    ['Veículos', '/frota/veiculos'],
    ['Rotas', '/rotas'],
    ['Manutenções', '/manutencoes'],
  ])('tocar em "%s" abre %s (NAV5-02 a NAV5-04)', (entrada, rota) => {
    render(<FrotaHubView />);

    fireEvent.press(screen.getByRole('button', { name: entrada }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(rota);
  });

  it('as linhas ficam em "Operação" e "Cadastros", com o ícone de cada módulo', () => {
    render(<FrotaHubView />);

    expect(screen.getByText('Operação')).toBeOnTheScreen();
    expect(screen.getByText('Cadastros')).toBeOnTheScreen();
    expect(screen.getByTestId('icone-frota', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('icone-rotas', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('icone-manutencoes', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  // O Admin não tem a aba Viagens (passaria de 5 abas): a lista dele abre por aqui.
  it('Admin vê "Viagens" em Operação, que abre /frota/viagens; o Gestor, que tem a aba, não', () => {
    useProfileStore.setState({
      usuario: { id: 'a', nome: 'Ana', email: 'a@empresa.com', perfil: 'Admin', status: 'Ativo' },
      estado: 'pronto',
    });
    const { unmount } = render(<FrotaHubView />);

    fireEvent.press(screen.getByRole('button', { name: 'Viagens' }));
    expect(mockPush).toHaveBeenCalledWith('/frota/viagens');
    unmount();

    useProfileStore.setState({
      usuario: { id: 'g', nome: 'Gil', email: 'g@empresa.com', perfil: 'Gestor de Frota', status: 'Ativo' },
      estado: 'pronto',
    });
    render(<FrotaHubView />);
    expect(screen.queryByRole('button', { name: 'Viagens' })).not.toBeOnTheScreen();
  });
});
