import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, TextInput } from 'react-native';

import { porTipo } from '@/testing/componentes';

import { CampoBusca } from '../CampoBusca';
import { colors, controlHeight, radius } from '../tokens';

// A busca única das listas de cadastro: mesma caixa do Input, lupa à esquerda, sem rótulo acima e com
// o "×" para limpar quando há texto.
describe('CampoBusca', () => {
  it('a lupa e o placeholder dizem o que procurar; o leitor de tela anuncia o placeholder', async () => {
    await render(<CampoBusca placeholder="Buscar categoria" value="" onChangeText={jest.fn()} />);

    expect(screen.getByLabelText('Buscar categoria')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Buscar categoria')).toBeOnTheScreen();
    expect(screen.getByTestId('icone-buscar', { includeHiddenElements: true })).toBeTruthy();
  });

  it('aceita um nome próprio para o leitor de tela', async () => {
    await render(
      <CampoBusca placeholder="Placa ou modelo" accessibilityLabel="Buscar veículo" value="" onChangeText={jest.fn()} />,
    );

    expect(screen.getByLabelText('Buscar veículo')).toBeOnTheScreen();
  });

  it('devolve o texto digitado', async () => {
    const onChangeText = jest.fn();
    await render(<CampoBusca placeholder="Buscar rota" value="" onChangeText={onChangeText} />);

    await fireEvent.changeText(screen.getByLabelText('Buscar rota'), 'sao');

    expect(onChangeText).toHaveBeenCalledWith('sao');
  });

  it('vazio, não mostra o "×"; com texto, o "×" limpa a busca com um toque', async () => {
    const onChangeText = jest.fn();
    const { rerender } = await render(<CampoBusca placeholder="Buscar rota" value="" onChangeText={onChangeText} />);
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).not.toBeOnTheScreen();

    await rerender(<CampoBusca placeholder="Buscar rota" value="sao" onChangeText={onChangeText} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Limpar busca' }));

    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('mesma caixa do Input: fundo surface, borda borderMuted, raio de campo e 48pt de altura', async () => {
    await render(<CampoBusca placeholder="Buscar rota" value="" onChangeText={jest.fn()} />);

    const caixa = StyleSheet.flatten(porTipo(TextInput).elementoNativo().parent?.props.style);
    expect(caixa).toMatchObject({
      backgroundColor: colors.surface,
      borderColor: colors.borderMuted,
      borderRadius: radius.input,
      minHeight: controlHeight,
    });
  });

  it('com foco, ganha o anel de 2px em accent', async () => {
    await render(<CampoBusca placeholder="Buscar rota" value="" onChangeText={jest.fn()} />);

    await fireEvent(screen.getByLabelText('Buscar rota'), 'focus');

    const caixa = StyleSheet.flatten(porTipo(TextInput).elementoNativo().parent?.props.style);
    expect(caixa).toMatchObject({ borderWidth: 2, borderColor: colors.accent });
  });
});
