import { render, screen } from '@testing-library/react-native';

import FinanceiroRoute from '../../../app/(app)/(tabs)/financeiro';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useFocusEffect: jest.fn() }));
jest.mock('@/features/caixa/fonteResumoCaixa', () => ({ buscarResumoCaixa: jest.fn() }));

// A aba Caixa (rota /financeiro) abre o hub do módulo (EIX-62). O comportamento do hub está em FinanceiroHubView.test.
describe('aba Caixa', () => {
  it('renderiza o hub: título, menu do módulo e FAB', async () => {
    await render(<FinanceiroRoute />);

    expect(screen.getByText('Caixa')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Movimentações' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Nova movimentação' })).toBeOnTheScreen();
  });
});
