import { fireEvent, render, screen } from '@testing-library/react-native';

import { FrotaHubView } from '../FrotaHubView';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

beforeEach(() => {
  mockPush.mockReset();
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
    expect(screen.getByTestId('simbolo-local_shipping', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('simbolo-alt_route', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('simbolo-build', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
