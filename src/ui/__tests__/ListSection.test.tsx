import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ListItem } from '../ListItem';
import { ListSection } from '../ListSection';
import { colors, fontFamily, radius, spacing, touchTarget, typography } from '../tokens';

// Grupo de linhas (UIP-02): rótulo opcional + bloco surface com borda, radius de cartão e hairline
// entre as linhas — o padrão de menu e de tela de ajustes, sem virar "um cartão por linha".
describe('ListSection (UIP-02)', () => {
  it('o rótulo do grupo é um título de seção (title, peso 600, cabeçalho para o leitor de tela)', async () => {
    await render(
      <ListSection label="Administração">
        <ListItem title="Usuários" />
      </ListSection>,
    );

    expect(screen.getByRole('header', { name: 'Administração' })).toHaveStyle({
      color: colors.textPrimary,
      fontSize: typography.title.fontSize,
      fontFamily: fontFamily.semibold,
    });
  });

  it('bloco em surface com borda hairline e radius de cartão', async () => {
    await render(
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

  it('N linhas geram N−1 separadores; linha condicional que não aparece não deixa separador sobrando', async () => {
    const mostrarUsuarios = false;
    await render(
      <ListSection>
        <ListItem title="Movimentações" />
        <ListItem title="Saldo e projeção" />
        {mostrarUsuarios && <ListItem title="Usuários" />}
        <ListItem title="Categorias" />
      </ListSection>,
    );

    expect(screen.getAllByTestId('separador-secao')).toHaveLength(2);
  });

  it('dentro do grupo, a linha não desenha a própria borda e ganha o respiro lateral da tela', async () => {
    await render(
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
