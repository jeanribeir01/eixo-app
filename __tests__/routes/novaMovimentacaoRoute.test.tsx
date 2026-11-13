import { render, screen } from '@testing-library/react-native';

import NovaMovimentacaoRoute from '../../app/(app)/movimentacoes/nova';

// PONTE-08 (EIX-42): o "Nova movimentação" do detalhe da viagem abre `/movimentacoes/nova?viagemId=…`,
// e a rota entrega esse id ao formulário. O formulário em si é testado à parte.
const mockParametros = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParametros(),
}));

// Jest hoista jest.mock() acima dos imports: o Text vem do require dentro da fábrica.
jest.mock('@/features/movimentacoes/MovimentacaoFormView', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text: MockText } = require('react-native') as typeof import('react-native');
  return {
    MovimentacaoFormView: ({ viagemIdInicial }: { viagemIdInicial?: string }) => (
      <MockText>{`viagemIdInicial=${viagemIdInicial ?? 'nenhuma'}`}</MockText>
    ),
  };
});

describe('rota /movimentacoes/nova', () => {
  it('passa o viagemId da URL para o formulário', () => {
    mockParametros.mockReturnValue({ viagemId: 'v-2' });

    render(<NovaMovimentacaoRoute />);

    expect(screen.getByText('viagemIdInicial=v-2')).toBeOnTheScreen();
  });

  it('sem viagemId na URL, o formulário abre sem viagem', () => {
    mockParametros.mockReturnValue({});

    render(<NovaMovimentacaoRoute />);

    expect(screen.getByText('viagemIdInicial=nenhuma')).toBeOnTheScreen();
  });
});
