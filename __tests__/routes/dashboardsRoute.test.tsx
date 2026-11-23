import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import DashboardsRoute from '../../app/(app)/(tabs)/dashboards';

// EIX-46: a aba Dashboards deixou de ser o placeholder "em breve" e só renderiza a view do ranking (US13).
// A view vira um stub, no molde do rotasDaS5: a tela em si é coberta em
// src/features/dashboard/ranking/__tests__/RankingView.test.tsx. O prefixo `mock` deixa o jest.mock usar a função.
function MockRankingView() {
  return <Text>RankingView</Text>;
}

jest.mock('@/features/dashboard/ranking/RankingView', () => ({ RankingView: MockRankingView }));

describe('aba Dashboards (EIX-46)', () => {
  it('renderiza o ranking de eficiência', async () => {
    await render(<DashboardsRoute />);

    expect(screen.getByText('RankingView')).toBeOnTheScreen();
  });
});
