import { fireEvent, render, screen } from '@testing-library/react-native';

import FinanceiroRoute from '../../../app/(app)/(tabs)/financeiro';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

beforeEach(() => {
  mockPush.mockReset();
});

// A aba Financeiro é a porta de entrada das telas do módulo (Admin e Financeiro).
describe('aba Financeiro', () => {
  it.each([
    ['Categorias', '/categorias'],
    ['Formas de Pagamento', '/formas-pagamento'],
    ['Movimentações', '/movimentacoes'],
  ])('atalho %s leva para %s', (rotulo, href) => {
    render(<FinanceiroRoute />);

    fireEvent.press(screen.getByRole('button', { name: rotulo }));

    expect(mockPush).toHaveBeenCalledWith(href);
  });
});
