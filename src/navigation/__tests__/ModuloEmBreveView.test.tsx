import { render, screen } from '@testing-library/react-native';

import { ModuloEmBreveView } from '../ModuloEmBreveView';

// Abas cujo módulo ainda não existe (FIN-04): ícone, nome e o que o módulo vai fazer. A aba Viagens saiu
// daqui na EIX-77 e a aba Dashboards na EIX-46: elas renderizam a view da feature (cobertas em
// __tests__/routes/).
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
});
