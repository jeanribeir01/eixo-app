import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { List } from '../List';
import { ListItem } from '../ListItem';
import { Skeleton } from '../Skeleton';
import { touchTarget } from '../tokens';

const renderItem = ({ item }: { item: { id: string } }) => <ListItem title={item.id} />;
const keyExtractor = (item: { id: string }) => item.id;

type Assinatura = jest.SpyInstance<{ remove: () => void }, [string, (value: boolean) => void]>;

// Troca o addEventListener por um que guarda os handlers, para o teste simular a pessoa mudando a
// preferência com o app aberto.
function capturarMudancas() {
  const handlers = new Set<(value: boolean) => void>();
  const remove = jest.fn();
  const subscribe = jest.spyOn(AccessibilityInfo, 'addEventListener') as unknown as Assinatura;
  subscribe.mockImplementation((_event, handler) => {
    handlers.add(handler);
    return {
      remove: () => {
        remove();
        handlers.delete(handler);
      },
    };
  });
  return { subscribe, remove, mudar: (value: boolean) => act(() => handlers.forEach((handler) => handler(value))) };
}

describe('Movimento das listas (ANI-01)', () => {
  // isReduceMotionEnabled e addEventListener já são jest.fn no preset: o spyOn devolve o mesmo mock,
  // então as chamadas de um teste somariam no seguinte sem esta limpeza.
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it('configura reflow de 200 ms na célula e preserva a transição ao incluir/remover linhas', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const duration = jest.spyOn(LinearTransition, 'duration');
    const reduceMotion = jest.spyOn(LinearTransition, 'reduceMotion');
    const { rerender } = render(<List data={[{ id: 'A' }]} renderItem={renderItem} keyExtractor={keyExtractor} />);
    await waitFor(() => expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBeDefined());
    const transition = screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation;
    expect(duration).toHaveBeenCalledWith(200);
    expect(reduceMotion).toHaveBeenCalledWith(ReduceMotion.Never);

    rerender(<List data={[{ id: 'B' }, { id: 'A' }]} renderItem={renderItem} keyExtractor={keyExtractor} />);
    expect(screen.getByText('B')).toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBe(transition);
    rerender(<List data={[{ id: 'A' }]} renderItem={renderItem} keyExtractor={keyExtractor} />);
    expect(screen.queryByText('B')).not.toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBe(transition);
  });

  it('primeira montagem e nova visita não têm entering nem exiting', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const check = () => {
      const list = screen.UNSAFE_getByType(Animated.FlatList);
      expect(list.props.skipEnteringExitingAnimations).toBe(true);
      expect(list.props.entering).toBeUndefined();
      expect(list.props.exiting).toBeUndefined();
      expect(screen.UNSAFE_root.findAll((node) => node.props.entering !== undefined || node.props.exiting !== undefined)).toHaveLength(0);
    };
    const first = render(<List data={[{ id: 'A' }]} renderItem={renderItem} keyExtractor={keyExtractor} />);
    await waitFor(() => expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBeDefined());
    check();
    first.unmount();
    render(<List data={[{ id: 'A' }]} renderItem={renderItem} keyExtractor={keyExtractor} />);
    await waitFor(() => expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBeDefined());
    check();
  });

  it('só a célula anima: a linha fica parada, dentro e fora da List', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    render(<List data={[{ id: 'A' }, { id: 'B' }]} renderItem={renderItem} keyExtractor={keyExtractor} />);
    await waitFor(() => expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBeDefined());
    expect(screen.UNSAFE_root.findAll((node) => node.props.layout !== undefined)).toHaveLength(0);
  });

  // Embrulhar o Pressable com createAnimatedComponent fazia o Reanimated trocar o estilo-função por
  // [função], e no aparelho a linha perdia altura mínima, padding e separador. O mock do Reanimated
  // devolve o Pressable sem mudança, então o Jest não reproduz o bug: quem impede a volta dele é o
  // teste acima (a linha não recebe `layout`). Este confere o estilo que a linha precisa manter.
  it('linha tocável mantém o estilo da linha, com alvo de 44pt', () => {
    render(<ListItem title="Dívidas" onPress={() => {}} />);
    const estilo = StyleSheet.flatten(screen.getByRole('button', { name: 'Dívidas' }).props.style);
    expect(estilo).toMatchObject({ minHeight: touchTarget, borderBottomWidth: 1 });
  });

  it('remover animações desliga o layout da lista, inclusive ao mudar a preferência', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const reduceMotion = jest.spyOn(LinearTransition, 'reduceMotion');
    const { mudar } = capturarMudancas();
    render(<List data={[{ id: 'A' }]} renderItem={renderItem} keyExtractor={keyExtractor} />);
    await act(async () => {});
    expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBeUndefined();

    mudar(false);
    // Ao reativar, o snapshot de inicialização do Reanimated não pode suprimir a transição.
    expect(reduceMotion).toHaveBeenCalledWith(ReduceMotion.Never);
    expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBeDefined();

    mudar(true);
    expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBeUndefined();
  });

  it('sem movimento enquanto a preferência não chegou', async () => {
    let responder: (value: boolean) => void = () => {};
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise((resolve) => { responder = resolve; }));
    render(<List data={[{ id: 'A' }]} renderItem={renderItem} keyExtractor={keyExtractor} />);
    expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBeUndefined();
    await act(async () => responder(false));
    expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBeDefined();
  });
});

describe('Preferência de movimento compartilhada', () => {
  // isReduceMotionEnabled e addEventListener já são jest.fn no preset: o spyOn devolve o mesmo mock,
  // então as chamadas de um teste somariam no seguinte sem esta limpeza.
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it('uma lista com várias linhas e skeletons consulta e assina a preferência uma vez só', async () => {
    const consulta = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const { subscribe, remove } = capturarMudancas();
    const { unmount } = render(
      <View>
        <Skeleton accessibilityLabel="Carregando" />
        <Skeleton accessibilityLabel="Carregando mais" />
        <List data={[{ id: 'A' }, { id: 'B' }, { id: 'C' }]} renderItem={renderItem} keyExtractor={keyExtractor} />
      </View>,
    );
    await waitFor(() => expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBeDefined());
    expect(consulta).toHaveBeenCalledTimes(1);
    expect(subscribe.mock.calls.filter(([event]) => event === 'reduceMotionChanged')).toHaveLength(1);

    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('um componente que monta depois da mudança já nasce com o valor atual', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const { mudar } = capturarMudancas();
    // As queries procuram a partir do primeiro elemento: um View por fora mantém o Skeleton ao alcance.
    const tela = (comSkeleton: boolean) => (
      <View>
        <List data={[{ id: 'A' }]} renderItem={renderItem} keyExtractor={keyExtractor} />
        {comSkeleton && <Skeleton accessibilityLabel="Carregando" />}
      </View>
    );
    const { rerender } = render(tela(false));
    await waitFor(() => expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBeDefined());

    mudar(true);
    rerender(tela(true));
    expect(StyleSheet.flatten(screen.getByLabelText('Carregando').props.style).animationName).toBeUndefined();
  });
});
