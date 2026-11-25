import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { porTipo } from '@/testing/componentes';

import { ListItem } from '../ListItem';
import { Switch } from '../Switch';
import { colors } from '../tokens';

describe('ListItem', () => {
  it('renderiza o conteúdo sem virar botão quando não tem onPress', async () => {
    await render(
      <ListItem>
        <Text>Combustível</Text>
      </ListItem>,
    );

    expect(screen.getByText('Combustível')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('com onPress, vira botão acessível e dispara a ação', async () => {
    const onPress = jest.fn();
    await render(
      <ListItem onPress={onPress} accessibilityLabel="Editar Combustível">
        <Text>Combustível</Text>
      </ListItem>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Editar Combustível' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

// Linha padrão de lista (UIP-01): título, subtítulo, ícone à esquerda e algo à direita.
describe('ListItem — linha padrão (UIP-01)', () => {
  it('mostra título, subtítulo e o ícone pedido', async () => {
    await render(<ListItem title="Movimentações" subtitle="Entradas e saídas do mês" icon="movimentacoes" />);

    expect(screen.getByText('Movimentações')).toBeOnTheScreen();
    expect(screen.getByText('Entradas e saídas do mês')).toBeOnTheScreen();
    expect(screen.getByTestId('icone-movimentacoes', { includeHiddenElements: true })).toBeTruthy();
  });

  it('subtítulo longo fica numa linha só, com reticências', async () => {
    await render(<ListItem title="Frete" subtitle="Categoria · 05/10 · Recebido" />);

    expect(screen.getByText('Categoria · 05/10 · Recebido').props.numberOfLines).toBe(1);
  });

  it('com onPress e sem trailing, mostra o chevron em textMuted e a linha inteira é um botão com o título', async () => {
    const onPress = jest.fn();
    await render(<ListItem title="Categorias" onPress={onPress} />);

    expect(screen.getByTestId('icone-avancar', { includeHiddenElements: true })).toHaveStyle({
      color: colors.textMuted,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Categorias' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('com trailing, mostra o trailing no lugar do chevron', async () => {
    await render(<ListItem title="Frete" onPress={jest.fn()} trailing={<Text>+ R$ 100,00</Text>} />);

    expect(screen.getByText('+ R$ 100,00')).toBeOnTheScreen();
    expect(screen.queryByTestId('icone-avancar', { includeHiddenElements: true })).toBeNull();
  });

  it('sem onPress não mostra chevron nem vira botão', async () => {
    await render(<ListItem title="Versão" trailing={<Text>1.0.0</Text>} />);

    expect(screen.queryByTestId('icone-avancar', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('accessibilityLabel explícito vence o título', async () => {
    await render(<ListItem title="Bruno Lima" accessibilityLabel="Gerenciar Bruno Lima" onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Gerenciar Bruno Lima' })).toBeOnTheScreen();
  });

  it('ao tocar no Android, mostra o ripple na cor da hairline (UIP-01, AC 3)', async () => {
    await render(<ListItem title="Categorias" onPress={jest.fn()} />);

    // O ripple é prop do Pressable, não do elemento nativo: por isso a busca é pelo componente.
    expect(porTipo(Pressable).props.android_ripple).toEqual({ color: colors.border });
  });

  it('o modo livre (children) com onPress continua sem chevron, como hoje', async () => {
    await render(
      <ListItem onPress={jest.fn()} accessibilityLabel="Pix">
        <Text>Pix</Text>
      </ListItem>,
    );

    expect(screen.queryByTestId('icone-avancar', { includeHiddenElements: true })).toBeNull();
  });

  it('control: tocar na linha abre o item e o switch fica fora do botão da linha (LST-01)', async () => {
    const onPress = jest.fn();
    const onValueChange = jest.fn();
    await render(
      <ListItem
        title="Combustível"
        onPress={onPress}
        control={<Switch label="Ativa" accessibilityLabel="Ativa: Combustível" value onValueChange={onValueChange} />}
      />,
    );

    const linha = screen.getByRole('button', { name: 'Combustível' });
    // Fora do botão da linha, o leitor de tela alcança o switch como elemento próprio.
    expect(within(linha).queryByRole('switch')).not.toBeOnTheScreen();

    await fireEvent(screen.getByRole('switch', { name: 'Ativa: Combustível' }), 'valueChange', false);
    expect(onValueChange).toHaveBeenCalledWith(false);
    expect(onPress).not.toHaveBeenCalled();

    await fireEvent.press(linha);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('control: com o controle à direita, a linha não mostra o chevron', async () => {
    await render(<ListItem title="Combustível" onPress={jest.fn()} control={<Switch label="Ativa" value onValueChange={jest.fn()} />} />);

    expect(screen.queryByTestId('icone-avancar', { includeHiddenElements: true })).not.toBeOnTheScreen();
  });
});
