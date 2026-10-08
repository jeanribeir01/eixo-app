import { render, screen } from '@testing-library/react-native';

import DashboardsRoute from '../../../app/(app)/(tabs)/dashboards';
import ViagensRoute from '../../../app/(app)/(tabs)/viagens';
import { ModuloEmBreveView } from '../ModuloEmBreveView';

// Abas cujo módulo ainda não existe (FIN-04): ícone, nome e o que o módulo vai fazer.
describe('ModuloEmBreveView (FIN-04)', () => {
  it('mostra o ícone do módulo, o nome e a frase, sem botão nenhum', () => {
    render(<ModuloEmBreveView titulo="Viagens" icone="viagens" descricao="Abertura e fechamento de viagens." />);

    expect(screen.getByTestId('simbolo-route', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Viagens')).toBeOnTheScreen();
    expect(screen.getByText('Abertura e fechamento de viagens.')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('não fala em "Em breve" nem "em construção"', () => {
    render(<ModuloEmBreveView titulo="Viagens" icone="viagens" descricao="Abertura e fechamento de viagens." />);

    expect(screen.queryByText(/Em breve/i)).not.toBeOnTheScreen();
    expect(screen.queryByText(/em construção/i)).not.toBeOnTheScreen();
  });

  it.each([
    ['Dashboards', DashboardsRoute, 'simbolo-dashboard', /^Indicadores do caixa e da frota/],
    ['Viagens', ViagensRoute, 'simbolo-route', /^Abertura e fechamento de viagens/],
  ])('a aba %s usa o ícone do módulo e diz o que ele vai fazer', (titulo, Rota, simbolo, frase) => {
    render(<Rota />);

    expect(screen.getByText(titulo)).toBeOnTheScreen();
    expect(screen.getByTestId(simbolo, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText(frase)).toBeOnTheScreen();
  });
});
