import { render, screen } from '@testing-library/react-native';

import { RotaFormView } from '../RotaFormView';

// Placeholder da EIX-77 (NAV5-13): a EIX-38 troca esta tela pela real. Até lá, ela diz o que vai
// fazer, com o ícone do módulo e sem nenhum botão. A lista já é a real (RotasListView.test.tsx).
describe('placeholder do formulário de Rotas (EIX-77)', () => {
  it.each([
    ['nova', <RotaFormView key="nova" />],
    ['editar', <RotaFormView key="editar" rotaId="r1" />],
  ])('%s mostra o ícone de rotas, o título e a frase', (_tela, elemento) => {
    render(elemento);

    expect(screen.getByTestId('simbolo-alt_route', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Origem, destino e distância')).toBeOnTheScreen();
    expect(
      screen.getByText('Cidade e UF de origem e de destino, com a distância estimada em km.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});
