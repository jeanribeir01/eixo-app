import { render, screen } from '@testing-library/react-native';

import { ManutencoesListView } from '../ManutencoesListView';

// Placeholder da EIX-77 (NAV5-13): a EIX-39 troca esta tela pela real. Até lá, ela diz o que vai
// fazer, com o ícone do módulo e sem nenhum botão. O formulário já é o real (ManutencaoFormView.test.tsx).
describe('placeholder da lista de Manutenção (EIX-77)', () => {
  it('lista mostra o ícone de manutenção, o título e a frase', () => {
    render(<ManutencoesListView />);

    expect(screen.getByTestId('simbolo-build', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Ordens de serviço')).toBeOnTheScreen();
    expect(screen.getByText('Histórico de manutenções da frota, com a despesa lançada no caixa.')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});
