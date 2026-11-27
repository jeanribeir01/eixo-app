import { fireEvent, render, screen } from '@testing-library/react-native';

import { GrupoRecolhivel } from '../GrupoRecolhivel';
import { ListItem } from '../ListItem';
import { touchTarget } from '../tokens';

// O grupo "Desativadas · N" do fim das listas de cadastro (Categorias, Formas de pagamento, Rotas e
// Veículos): começa recolhido, com os nomes ao lado, e abre para mostrar as linhas.
describe('GrupoRecolhivel', () => {
  async function renderGrupo() {
    await render(
      <GrupoRecolhivel rotulo="Desativadas" quantidade={2} resumo="Alimento, Lavagem">
        <ListItem title="Alimento" onPress={jest.fn()} />
        <ListItem title="Lavagem" onPress={jest.fn()} />
      </GrupoRecolhivel>,
    );
  }

  it('começa recolhido: cabeçalho com a contagem e o resumo, sem as linhas', async () => {
    await renderGrupo();

    expect(screen.getByRole('button', { name: 'Desativadas, 2' })).toBeCollapsed();
    expect(screen.getByText('Desativadas · 2')).toBeOnTheScreen();
    expect(screen.getByText('Alimento, Lavagem')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Alimento' })).not.toBeOnTheScreen();
    expect(screen.getByTestId('icone-avancar', { includeHiddenElements: true })).toBeTruthy();
  });

  it('tocar abre: as linhas aparecem, o resumo some e a seta aponta para baixo; tocar de novo recolhe', async () => {
    await renderGrupo();

    await fireEvent.press(screen.getByRole('button', { name: 'Desativadas, 2' }));

    expect(screen.getByRole('button', { name: 'Desativadas, 2' })).toBeExpanded();
    expect(screen.getByRole('button', { name: 'Alimento' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lavagem' })).toBeOnTheScreen();
    expect(screen.queryByText('Alimento, Lavagem')).not.toBeOnTheScreen();
    expect(screen.getByTestId('icone-recolher', { includeHiddenElements: true })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Desativadas, 2' }));

    expect(screen.queryByRole('button', { name: 'Alimento' })).not.toBeOnTheScreen();
  });

  it('o cabeçalho tem o alvo de toque mínimo de 44pt', async () => {
    await renderGrupo();

    expect(screen.getByRole('button', { name: 'Desativadas, 2' })).toHaveStyle({ minHeight: touchTarget });
  });

  it('sem resumo, o cabeçalho mostra só o rótulo e a contagem', async () => {
    await render(
      <GrupoRecolhivel rotulo="Desativados" quantidade={1}>
        <ListItem title="GHI-1234" />
      </GrupoRecolhivel>,
    );

    expect(screen.getByText('Desativados · 1')).toBeOnTheScreen();
  });
});
