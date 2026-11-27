import { render, screen } from '@testing-library/react-native';

import { buscarFrotaAgora } from '@/features/frota-agora/frotaAgora';

import FrotaRoute from '../../../app/(app)/(tabs)/frota';

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: jest.fn() }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]),
  };
});

jest.mock('@/features/frota-agora/frotaAgora', () => ({ buscarFrotaAgora: jest.fn() }));

// A aba Frota abre o hub do módulo (EIX-77), não a lista de veículos. O comportamento do hub está em
// FrotaHubView.test.
describe('aba Frota', () => {
  it('renderiza o hub: título, a frota agora e o menu do módulo', async () => {
    jest.mocked(buscarFrotaAgora).mockResolvedValue({ ok: true, data: { contagem: { estrada: 0, oficina: 0, parado: 0 }, veiculos: [] } });
    await render(<FrotaRoute />);

    expect(await screen.findByText('Veículos agora')).toBeOnTheScreen();
    expect(screen.getByText('Frota')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Veículos' })).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText('Buscar por placa ou modelo')).not.toBeOnTheScreen();
  });
});
