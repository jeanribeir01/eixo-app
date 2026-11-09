import { render, screen } from '@testing-library/react-native';
import { HeaderHeightContext } from 'expo-router/react-navigation';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FAB_ALTURA_RESERVADA } from '../FAB';
import { Screen } from '../Screen';
import { colors, spacing } from '../tokens';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 900, scale: 1, fontScale: 1 })),
}));

// Lado da tela que o SafeAreaView protege (o header nativo já protege o topo das telas internas).
function bordasProtegidas() {
  return screen.UNSAFE_getByType(SafeAreaView).props.edges;
}

// Camada absoluta do Snackbar e do FAB. Buscada por testID: subir por .parent depende da árvore interna
// do Text e pode cair no nó errado sem o teste perceber.
function camadaFlutuante() {
  return screen.getByTestId('screen-camada-flutuante');
}

// Todas as chaves que algum item do array de estilo declara, mesmo com valor undefined.
// O StyleSheet.flatten trata undefined como "apaga", mas o renderer nativo não faz isso ao atualizar
// uma View já montada; por isso o teste confere a declaração, não o resultado achatado.
function chavesDeclaradas(style: unknown): string[] {
  if (Array.isArray(style)) return style.flatMap(chavesDeclaradas);
  if (style && typeof style === 'object') return Object.keys(style);
  return [];
}

function mockLargura(width: number) {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
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

    expect(camadaFlutuante()).toHaveStyle({ position: 'absolute', justifyContent: 'flex-end', padding: spacing.base });
  });

  it('overlay não engole o toque: o conteúdo embaixo continua tocável fora do Snackbar (AC 12)', () => {
    render(
      <Screen overlay={<Text>Flutuante</Text>}>
        <Text>Campo</Text>
      </Screen>,
    );

    expect(camadaFlutuante().props.pointerEvents).toBe('box-none');
  });

  it('fab: o Snackbar do overlay fica acima do FAB, os dois na camada flutuante (UIP-04, AC 7)', () => {
    render(
      <Screen overlay={<Text>Mensagem</Text>} fab={<Text>Botão flutuante</Text>}>
        <Text>Conteúdo</Text>
      </Screen>,
    );

    const camada = camadaFlutuante();
    const filhos = camada
      .findAll((no) => typeof no.type === 'string' && typeof no.props.children === 'string')
      .map((no) => no.props.children);
    expect(filhos).toEqual(['Mensagem', 'Botão flutuante']);
    expect(camada).toHaveStyle({ justifyContent: 'flex-end', gap: spacing.md });
  });

  it('fab com scroll: o fim do conteúdo ganha espaço para o FAB não cobrir a última linha (LST, AC 13)', () => {
    render(
      <Screen scroll fab={<Text>Botão flutuante</Text>}>
        <Text>Última linha</Text>
      </Screen>,
    );

    expect(StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle)).toMatchObject({
      paddingBottom: FAB_ALTURA_RESERVADA,
    });
  });
});

describe('Screen responsivo (TAB-01)', () => {
  afterEach(() => mockLargura(412));

  it.each([360, 412, 767, 768, 800])('largura %i: limita e centraliza somente a partir de 768', (width) => {
    mockLargura(width);
    const { rerender } = render(<Screen><Text>Conteúdo</Text></Screen>);
    const contentStyle = StyleSheet.flatten(screen.getByTestId('screen-conteudo').props.style);
    if (width >= 768) {
      expect(contentStyle).toMatchObject({ width: '100%', maxWidth: 720, alignSelf: 'center' });
    } else {
      expect(contentStyle.maxWidth).toBeUndefined();
    }

    rerender(<Screen scroll overlay={<Text>Mensagem</Text>}><Text>Conteúdo</Text></Screen>);
    const scrollStyle = StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle);
    const overlayStyle = StyleSheet.flatten(camadaFlutuante().props.style);
    if (width >= 768) {
      expect(scrollStyle).toMatchObject({ width: '100%', maxWidth: 720, alignSelf: 'center' });
      expect(overlayStyle).toMatchObject({ position: 'absolute', top: 0, bottom: 0, width: '100%', maxWidth: 720, alignSelf: 'center' });
    } else {
      expect(scrollStyle.maxWidth).toBeUndefined();
      expect(overlayStyle).toMatchObject({ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 });
      expect(overlayStyle.maxWidth).toBeUndefined();
    }
  });

  it('celular → tablet com a tela aberta: a camada flutuante deixa de declarar left/right, senão não centraliza', () => {
    // Elemento novo a cada render: com o mesmo objeto o React pularia a atualização. Mesmo tipo na mesma
    // posição, então é atualização da View montada, não montagem nova.
    const tela = () => <Screen overlay={<Text>Mensagem</Text>} fab={<Text>Botão flutuante</Text>}><Text>Conteúdo</Text></Screen>;
    mockLargura(412);
    const { rerender } = render(tela());
    const camadaAntes = camadaFlutuante();
    expect(chavesDeclaradas(camadaFlutuante().props.style)).toEqual(expect.arrayContaining(['left', 'right']));

    // Mesma árvore, janela maior (rotação, tela dividida, dobrável aberto): é atualização, não montagem.
    mockLargura(800);
    rerender(tela());
    expect(camadaFlutuante()).toBe(camadaAntes);
    const chaves = chavesDeclaradas(camadaFlutuante().props.style);
    expect(chaves).not.toContain('left');
    expect(chaves).not.toContain('right');
    expect(StyleSheet.flatten(camadaFlutuante().props.style)).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
    expect(screen.getByText('Mensagem')).toBeOnTheScreen();
    expect(screen.getByText('Botão flutuante')).toBeOnTheScreen();
  });
});
