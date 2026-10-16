import { render, screen } from '@testing-library/react-native';

import { ManutencaoFormView } from '../ManutencaoFormView';
import { ManutencoesListView } from '../ManutencoesListView';

// Placeholders da EIX-77 (NAV5-13): a EIX-39 troca estas telas pelas reais. Até lá, cada uma diz o que
// vai fazer, com o ícone do módulo e sem nenhum botão.
describe('placeholders de Manutenção (EIX-77)', () => {
  it.each([
    ['lista', <ManutencoesListView key="lista" />, 'Ordens de serviço', 'Histórico de manutenções da frota, com a despesa lançada no caixa.'],
    ['nova', <ManutencaoFormView key="nova" />, 'Registro de manutenção', 'Veículo, serviço, valor e forma de pagamento. A despesa entra no caixa junto.'],
  ])('%s mostra o ícone de manutenção, o título e a frase', (_tela, elemento, titulo, frase) => {
    render(elemento);

    expect(screen.getByTestId('simbolo-build', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText(titulo)).toBeOnTheScreen();
    expect(screen.getByText(frase)).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});
