import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import Animated, { LinearTransition, ReduceMotion } from 'react-native-reanimated';
import * as Reanimated from 'react-native-reanimated';

import { List } from '../List';
import { ListItem } from '../ListItem';

const renderItem = ({ item }: { item: { id: string } }) => <ListItem title={item.id} />;
const keyExtractor = (item: { id: string }) => item.id;

describe('Movimento das listas (ANI-01)', () => {
  beforeEach(() => jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false));
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

  it('primeira montagem e nova visita não têm entering nem exiting, inclusive nas linhas', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const first = render(<List data={[{ id: 'A' }]} renderItem={renderItem} keyExtractor={keyExtractor} />);
    await waitFor(() => expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBeDefined());
    const check = () => {
      const list = screen.UNSAFE_getByType(Animated.FlatList);
      expect(list.props.skipEnteringExitingAnimations).toBe(true);
      expect(list.props.entering).toBeUndefined();
      expect(list.props.exiting).toBeUndefined();
      for (const row of screen.UNSAFE_getAllByType(Animated.View)) {
        expect(row.props.entering).toBeUndefined();
        expect(row.props.exiting).toBeUndefined();
      }
    };
    check();
    first.unmount();
    render(<List data={[{ id: 'A' }]} renderItem={renderItem} keyExtractor={keyExtractor} />);
    await waitFor(() => expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBeDefined());
    check();
  });

  it('remover animações desliga layout da lista e da linha, inclusive ao mudar a preferência', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const reduceMotion = jest.spyOn(LinearTransition, 'reduceMotion');
    const handlers = new Set<(value: boolean) => void>();
    const subscribe = jest.spyOn(AccessibilityInfo, 'addEventListener') as unknown as jest.SpyInstance<
      { remove: () => void }, [string, (value: boolean) => void]
    >;
    subscribe.mockImplementation((_event, handler) => {
      handlers.add(handler);
      return { remove: () => { handlers.delete(handler); } };
    });
    render(<List data={[{ id: 'A' }]} renderItem={renderItem} keyExtractor={keyExtractor} />);
    await act(async () => {});
    expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBeUndefined();
    for (const row of screen.UNSAFE_getAllByType(Animated.View)) expect(row.props.layout).toBeUndefined();
    act(() => handlers.forEach((handler) => handler(false)));
    // Ao reativar, a preferência inicial true do Reanimated não pode suprimir a transição.
    expect(reduceMotion).toHaveBeenCalledWith(ReduceMotion.Never);
    expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBeDefined();
    expect(screen.UNSAFE_getAllByType(Animated.View).some((row) => row.props.layout !== undefined)).toBe(true);
    act(() => handlers.forEach((handler) => handler(true)));
    expect(screen.UNSAFE_getByType(Animated.FlatList).props.itemLayoutAnimation).toBeUndefined();
    for (const row of screen.UNSAFE_getAllByType(Animated.View)) expect(row.props.layout).toBeUndefined();
  });
});
