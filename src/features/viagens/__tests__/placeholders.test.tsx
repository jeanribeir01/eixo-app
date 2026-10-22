import { render, screen } from '@testing-library/react-native';

import { AbrirViagemView } from '../AbrirViagemView';
import { FecharViagemView } from '../FecharViagemView';
import { ViagensListView } from '../ViagensListView';

// Placeholders da EIX-77 (NAV5-13): a EIX-40 substituiu estas telas pelas telas reais de US08.
describe.skip('placeholders de Viagens (EIX-77) - substituído pela EIX-40', () => {
  it.each([
    ['lista (aba)', <ViagensListView key="lista" />, 'Viagens', 'Abertura e fechamento de viagens com o hodômetro, mesmo sem internet.'],
    ['abrir', <AbrirViagemView key="abrir" />, 'Hodômetro inicial', 'Veículo, rota, motorista e hodômetro inicial da viagem.'],
    ['fechar', <FecharViagemView key="fechar" viagemId="v1" />, 'Hodômetro final', 'O hodômetro final encerra a viagem e calcula os km rodados.'],
  ])('%s mostra o ícone de viagens, o título e a frase', (_tela, elemento, titulo, frase) => {
    render(elemento);

    expect(screen.getByTestId('simbolo-route', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText(titulo)).toBeOnTheScreen();
    expect(screen.getByText(frase)).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});
