import { fireEvent, render, screen } from '@testing-library/react-native';

import { EmptyState } from '../EmptyState';
import { colors, iconSize } from '../tokens';

describe('EmptyState', () => {
  it('renderiza título e descrição', () => {
    render(<EmptyState title="Nenhuma categoria cadastrada" description="Crie a primeira categoria." />);

    expect(screen.getByText('Nenhuma categoria cadastrada')).toBeOnTheScreen();
    expect(screen.getByText('Crie a primeira categoria.')).toBeOnTheScreen();
  });

  it('sem actionLabel/onAction, não mostra botão', () => {
    render(<EmptyState title="Nenhuma categoria cadastrada" />);

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('com ação, dispara onAction ao tocar', () => {
    const onAction = jest.fn();
    render(<EmptyState title="Nenhuma categoria" actionLabel="Nova categoria" onAction={onAction} />);

    fireEvent.press(screen.getByRole('button', { name: 'Nova categoria' }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('com icon, mostra o ícone grande em textMuted, acima do título e fora do leitor de tela (UIP-05, AC 10)', () => {
    render(<EmptyState icon="categorias" title="Nenhuma categoria cadastrada" />);

    const icone = screen.getByTestId('simbolo-category', { includeHiddenElements: true });
    expect(icone).toHaveStyle({ width: iconSize.lg, height: iconSize.lg, color: colors.textMuted });
    // Decorativo: o leitor de tela pula o ícone e anuncia só o título.
    expect(screen.queryByTestId('simbolo-category')).not.toBeOnTheScreen();

    const textos = screen.root
      .findAll((no) => typeof no.type === 'string' && (no.props.testID === 'simbolo-category' || no.props.children === 'Nenhuma categoria cadastrada'))
      .map((no) => no.props.testID ?? no.props.children);
    expect(textos).toEqual(['simbolo-category', 'Nenhuma categoria cadastrada']);
  });

  it('sem icon, não mostra ícone nenhum (como as telas já usam hoje)', () => {
    render(<EmptyState title="Nenhuma categoria cadastrada" />);

    expect(screen.queryByTestId(/^simbolo-/, { includeHiddenElements: true })).not.toBeOnTheScreen();
  });
});
