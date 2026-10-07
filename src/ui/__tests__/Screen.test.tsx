import { render, screen } from '@testing-library/react-native';
import { HeaderHeightContext } from 'expo-router/react-navigation';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '../Screen';
import { colors, spacing } from '../tokens';

// Lado da tela que o SafeAreaView protege (o header nativo já protege o topo das telas internas).
function bordasProtegidas() {
  return screen.UNSAFE_getByType(SafeAreaView).props.edges;
}

describe('Screen (NAV-04)', () => {
  it('sem props: fundo canvas, protege as 4 bordas e não rola', () => {
    render(
      <Screen>
        <Text>Conteúdo</Text>
      </Screen>,
    );

    expect(screen.getByText('Conteúdo')).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.UNSAFE_getByType(SafeAreaView).props.style)).toMatchObject({
      backgroundColor: colors.canvas,
    });
    expect(bordasProtegidas()).toEqual(['top', 'right', 'bottom', 'left']);
    expect(screen.UNSAFE_queryByType(ScrollView)).toBeNull();
  });

  it('underHeader: não protege o topo, que já é do header nativo (AC 11)', () => {
    render(
      <Screen underHeader>
        <Text>Conteúdo</Text>
      </Screen>,
    );

    expect(bordasProtegidas()).toEqual(['right', 'bottom', 'left']);
  });

  it('scroll: conteúdo num ScrollView que não perde o toque com o teclado aberto (AC 9)', () => {
    render(
      <Screen scroll>
        <Text>Campo</Text>
      </Screen>,
    );

    const rolagem = screen.UNSAFE_getByType(ScrollView);
    expect(rolagem.props.keyboardShouldPersistTaps).toBe('handled');
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('padding');
    expect(screen.getByText('Campo')).toBeOnTheScreen();
  });

  it('scroll sob o header: o teclado desconta a altura do header (AC 10)', () => {
    render(
      <HeaderHeightContext.Provider value={64}>
        <Screen scroll underHeader>
          <Text>Campo</Text>
        </Screen>
      </HeaderHeightContext.Provider>,
    );

    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(64);
  });

  it('scroll fora de um navegador: nenhum desconto de header', () => {
    render(
      <Screen scroll>
        <Text>Campo</Text>
      </Screen>,
    );

    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(0);
  });

  it('overlay fica fora da rolagem, para Snackbar e FAB não rolarem com o conteúdo', () => {
    render(
      <Screen scroll overlay={<Text>Flutuante</Text>}>
        <Text>Campo</Text>
      </Screen>,
    );

    const rolagem = screen.UNSAFE_getByType(ScrollView);
    expect(rolagem.findAll((no) => no.props.children === 'Flutuante')).toHaveLength(0);
    expect(screen.getByText('Flutuante')).toBeOnTheScreen();
  });

  it('overlay assenta no rodapé com o respiro lateral da tela', () => {
    render(
      <Screen overlay={<Text>Flutuante</Text>}>
        <Text>Campo</Text>
      </Screen>,
    );

    const camada = screen.getByText('Flutuante').parent?.parent;
    expect(camada).toHaveStyle({ position: 'absolute', justifyContent: 'flex-end', padding: spacing.base });
  });
});
