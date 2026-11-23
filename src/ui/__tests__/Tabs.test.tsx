import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';

import { Tabs } from '../Tabs';
import { colors, spacing, touchTarget } from '../tokens';

const options = [
  { label: 'Entrada', value: 'Entrada' },
  { label: 'Saída', value: 'Saida' },
];

const status = [
  { label: 'Todos', value: 'Todos' },
  { label: 'Disponível', value: 'Disponivel' },
  { label: 'Em Viagem', value: 'EmViagem' },
  { label: 'Em Manutenção', value: 'EmManutencao' },
  { label: 'Inativo', value: 'Inativo' },
];

// Simula o Android medindo a área visível do filtro (ex.: 360 de tela menos o padding lateral).
function medirLargura(width: number) {
  fireEvent(screen.UNSAFE_getByType(ScrollView), 'layout', { nativeEvent: { layout: { width, height: touchTarget } } });
}

describe('Tabs', () => {
  it('marca a aba ativa como selecionada', () => {
    render(<Tabs options={options} value="Entrada" onChange={jest.fn()} />);

    expect(screen.getByRole('tab', { name: 'Entrada' })).toHaveStyle({ backgroundColor: colors.accentSoft });
    expect(screen.getByText('Entrada')).toHaveStyle({ color: colors.accentText });
    expect(screen.getByRole('tab', { name: 'Saída' })).toHaveStyle({ backgroundColor: colors.surface });
  });

  it('chama onChange com o valor tocado', () => {
    const onChange = jest.fn();
    render(<Tabs options={options} value="Entrada" onChange={onChange} />);

    fireEvent.press(screen.getByRole('tab', { name: 'Saída' }));

    expect(onChange).toHaveBeenCalledWith('Saida');
  });

  describe('sem scrollable (padrão)', () => {
    it('não rola e divide a largura com flex 1, como antes da EIX-82', () => {
      render(<Tabs options={options} value="Entrada" onChange={jest.fn()} />);

      expect(screen.UNSAFE_queryByType(ScrollView)).toBeNull();
      expect(screen.getByRole('tab', { name: 'Entrada' })).toHaveStyle({ flex: 1, minHeight: touchTarget });
    });
  });

  describe('com scrollable', () => {
    it('envolve as abas num ScrollView horizontal que só ocupa a altura delas', () => {
      render(<Tabs options={status} value="Todos" onChange={jest.fn()} scrollable />);

      const scroll = screen.UNSAFE_getByType(ScrollView);
      expect(scroll.props.horizontal).toBe(true);
      expect(StyleSheet.flatten(scroll.props.style)).toMatchObject({ flexGrow: 0 });
      for (const option of status) {
        expect(within(scroll).getByRole('tab', { name: option.label })).toBeOnTheScreen();
      }
    });

    it('quando as abas cabem, cada uma recebe a parte igual da largura', () => {
      render(<Tabs options={status} value="Todos" onChange={jest.fn()} scrollable />);

      // Tablet: 800 de largura útil. (800 - 4 gaps de 8) / 5 = 153,6 → 153.
      medirLargura(800);

      const parte = Math.floor((800 - spacing.sm * (status.length - 1)) / status.length);
      for (const option of status) {
        expect(screen.getByRole('tab', { name: option.label })).toHaveStyle({ minWidth: parte, flexGrow: 1 });
      }
    });

    it('quando não cabem, as abas não encolhem (o rótulo não é cortado) e mantêm o alvo de 44', () => {
      render(<Tabs options={status} value="Todos" onChange={jest.fn()} scrollable />);

      medirLargura(328);

      for (const option of status) {
        const aba = screen.getByRole('tab', { name: option.label });
        expect(aba).toHaveStyle({ flexShrink: 0, minHeight: touchTarget });
        expect(aba).not.toHaveStyle({ flex: 1 });
      }
    });

    it('troca de aba e marca a selecionada como na forma padrão', () => {
      const onChange = jest.fn();
      render(<Tabs options={status} value="Todos" onChange={onChange} scrollable />);

      fireEvent.press(screen.getByRole('tab', { name: 'Inativo' }));

      expect(onChange).toHaveBeenCalledWith('Inativo');
      expect(screen.getByRole('tab', { name: 'Todos', selected: true })).toBeOnTheScreen();
    });
  });
});
