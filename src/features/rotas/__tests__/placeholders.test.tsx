import { render, screen } from '@testing-library/react-native';

import { RotaFormView } from '../RotaFormView';
import { RotasListView } from '../RotasListView';

// Placeholders da EIX-77 (NAV5-13): a EIX-38 troca estas telas pelas reais. Até lá, cada uma diz o que
// vai fazer, com o ícone do módulo e sem nenhum botão.
describe('placeholders de Rotas (EIX-77)', () => {
  it.each([
    ['lista', <RotasListView key="lista" />, 'Trechos padrão', 'Origem, destino e distância estimada das rotas mais comuns da frota.'],
    ['nova', <RotaFormView key="nova" />, 'Origem, destino e distância', 'Cidade e UF de origem e de destino, com a distância estimada em km.'],
    ['editar', <RotaFormView key="editar" rotaId="r1" />, 'Origem, destino e distância', 'Cidade e UF de origem e de destino, com a distância estimada em km.'],
  ])('%s mostra o ícone de rotas, o título e a frase', (_tela, elemento, titulo, frase) => {
    render(elemento);

    expect(screen.getByTestId('simbolo-alt_route', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText(titulo)).toBeOnTheScreen();
    expect(screen.getByText(frase)).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});
