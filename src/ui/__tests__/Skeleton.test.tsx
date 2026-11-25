import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { Skeleton } from '../Skeleton';
import { colors, radius, spacing } from '../tokens';

describe('Skeleton', () => {
  afterEach(() => jest.restoreAllMocks());

  it('pulsa entre 1 e 0,5 e volta a 1 em ciclo de 1 segundo (ANI-01)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    await render(<Skeleton accessibilityLabel="Carregando" />);
    await waitFor(() => expect(StyleSheet.flatten(screen.getByLabelText('Carregando').props.style)).toMatchObject({
      animationName: { from: { opacity: 1 }, '50%': { opacity: 0.5 }, to: { opacity: 1 } },
      animationDuration: 1000,
      animationIterationCount: 'infinite',
    }));
  });

  it('sem animação até conhecer a preferência e com remover animações ligado (ANI-01)', async () => {
    let resolvePreference: (value: boolean) => void = () => {};
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise((resolve) => { resolvePreference = resolve; }));
    await render(<Skeleton accessibilityLabel="Carregando" />);
    expect(StyleSheet.flatten(screen.getByLabelText('Carregando').props.style).animationName).toBeUndefined();
    await act(async () => resolvePreference(true));
    expect(StyleSheet.flatten(screen.getByLabelText('Carregando').props.style).animationName).toBeUndefined();
    expect(screen.getByLabelText('Carregando')).toHaveStyle({ opacity: 1 });
  });

  it('para o pulso quando a preferência muda com o app aberto (ANI-01)', async () => {
    let changePreference: (value: boolean) => void = () => {};
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const remove = jest.fn();
    const subscribe = jest.spyOn(AccessibilityInfo, 'addEventListener') as unknown as jest.SpyInstance<{ remove: () => void }, [string, (value: boolean) => void]>;
    subscribe.mockImplementation((_event, handler) => {
      changePreference = handler;
      return { remove };
    });
    const { unmount } = await render(<Skeleton accessibilityLabel="Carregando" />);
    await waitFor(() => expect(StyleSheet.flatten(screen.getByLabelText('Carregando').props.style).animationDuration).toBe(1000));
    await act(() => changePreference(true));
    expect(StyleSheet.flatten(screen.getByLabelText('Carregando').props.style).animationName).toBeUndefined();
    expect(screen.getByLabelText('Carregando')).toHaveStyle({ opacity: 1 });
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
  it('bloco neutro na cor da hairline, com radius de cartão', async () => {
    await render(<Skeleton accessibilityLabel="Carregando" />);

    expect(screen.getByLabelText('Carregando')).toHaveStyle({
      backgroundColor: colors.border,
      borderRadius: radius.card,
      height: spacing.lg,
    });
  });

  it('a altura vem de um token de spacing', async () => {
    await render(<Skeleton height="xxl" accessibilityLabel="Carregando saldo" />);

    expect(screen.getByLabelText('Carregando saldo')).toHaveStyle({ height: spacing.xxl });
  });
});
