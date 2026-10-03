import { fireEvent, render, screen } from '@testing-library/react-native';

import { ModuloEmBreveView } from '../ModuloEmBreveView';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

beforeEach(() => {
  mockPush.mockReset();
});

describe('ModuloEmBreveView', () => {
  it('mostra o título do módulo e o aviso de em construção', () => {
    render(<ModuloEmBreveView titulo="Frota" />);

    expect(screen.getByText('Frota')).toBeOnTheScreen();
    expect(screen.getByText('Em breve')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('atalho leva para a tela já existente do módulo', () => {
    render(<ModuloEmBreveView titulo="Financeiro" atalhos={[{ rotulo: 'Categorias', href: '/categorias' }]} />);

    fireEvent.press(screen.getByRole('button', { name: 'Categorias' }));

    expect(mockPush).toHaveBeenCalledWith('/categorias');
  });
});
