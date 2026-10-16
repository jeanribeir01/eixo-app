import { render, screen } from '@testing-library/react-native';

import FrotaRoute from '../../../app/(app)/(tabs)/frota';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

// A aba Frota abre o hub do módulo (EIX-77), não mais a lista de veículos. O comportamento do hub está
// em FrotaHubView.test.
describe('aba Frota', () => {
  it('renderiza o hub: título e menu do módulo', () => {
    render(<FrotaRoute />);

    expect(screen.getByText('Frota')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Veículos' })).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText('Buscar por placa ou modelo')).not.toBeOnTheScreen();
  });
});
