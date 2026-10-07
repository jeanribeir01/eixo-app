import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ListItem } from '../ListItem';
import { ListSection } from '../ListSection';
import { colors, radius, spacing, touchTarget } from '../tokens';

// Grupo de linhas (UIP-02): rótulo opcional + bloco surface com borda, radius de cartão e hairline
// entre as linhas — o padrão de menu e de tela de ajustes, sem virar "um cartão por linha".
describe('ListSection (UIP-02)', () => {
  it('mostra o rótulo do grupo em caption textBody', () => {
    render(
      <ListSection label="Administração">
        <ListItem title="Usuários" />
      </ListSection>,
    );

    expect(screen.getByText('Administração')).toHaveStyle({ color: colors.textBody, fontSize: 11 });
  });

  it('bloco em surface com borda hairline e radius de cartão', () => {
    render(
      <ListSection>
        <ListItem title="Versão" />
      </ListSection>,
    );

    expect(screen.getByTestId('bloco-secao')).toHaveStyle({
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.card,
    });
  });

  it('N linhas geram N−1 separadores; linha condicional que não aparece não deixa separador sobrando', () => {
    const mostrarUsuarios = false;
    render(
      <ListSection>
        <ListItem title="Movimentações" />
        <ListItem title="Saldo e projeção" />
        {mostrarUsuarios && <ListItem title="Usuários" />}
        <ListItem title="Categorias" />
      </ListSection>,
    );

    expect(screen.getAllByTestId('separador-secao')).toHaveLength(2);
  });

  it('dentro do grupo, a linha não desenha a própria borda e ganha o respiro lateral da tela', () => {
    render(
      <ListSection>
        <ListItem title="Categorias" />
      </ListSection>,
    );

    // Sobe do título até a linha (o nó com o alvo de toque mínimo).
    let linha = screen.getByText('Categorias').parent;
    while (linha && StyleSheet.flatten(linha.props.style)?.minHeight !== touchTarget) linha = linha.parent;
    expect(StyleSheet.flatten(linha?.props.style)).toMatchObject({ borderBottomWidth: 0, paddingHorizontal: spacing.base });
  });
});
