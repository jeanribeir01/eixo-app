import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Text } from 'react-native';

import { FAB } from '../FAB';
import { Screen } from '../Screen';
import { Snackbar } from '../Snackbar';
import { spacing } from '../tokens';

// A entrada só começa depois que a preferência de "remover animações" chega, por promise.
// Esperar o Animated.timing ser chamado garante que o Snackbar já sabe se pode deslizar.
async function esperarEntradaComecar() {
  await waitFor(() => expect(Animated.timing).toHaveBeenCalled());
}

// Com driver nativo a animação roda fora do JS, e o Jest não vê os quadros. Este mock registra a
// configuração pedida e leva o valor direto ao fim, para conferir o estado final na tela.
function animarAteOFim() {
  jest.mocked(Animated.timing).mockImplementation((valor, config) => ({
    start: (aoTerminar) => {
      if (valor instanceof Animated.Value && typeof config.toValue === 'number') valor.setValue(config.toValue);
      aoTerminar?.({ finished: true });
    },
    stop: () => undefined,
    reset: () => undefined,
  }));
}

beforeEach(() => {
  jest.useFakeTimers();
  // Sem mudar o comportamento: só para os testes saberem quando a entrada começou.
  jest.spyOn(Animated, 'timing');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Snackbar', () => {
  it('mostra a mensagem de sucesso', async () => {
    render(<Snackbar message="Categoria salva." tone="success" onDismiss={jest.fn()} />);
    await esperarEntradaComecar();

    expect(screen.getByRole('alert')).toHaveTextContent('Categoria salva.');
  });

  it('mostra a mensagem de erro', async () => {
    render(<Snackbar message="Não foi possível salvar." tone="error" onDismiss={jest.fn()} />);
    await esperarEntradaComecar();

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar.');
  });

  it('continua anunciando como alerta e chama onDismiss sozinho após a duração (UIP-04)', async () => {
    const onDismiss = jest.fn();
    render(<Snackbar message="Categoria salva." tone="success" onDismiss={onDismiss} duration={1000} />);
    await esperarEntradaComecar();

    expect(screen.getByRole('alert')).toHaveProp('accessibilityLiveRegion', 'polite');

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('Snackbar — entrada (UIP-04)', () => {
  it('começa transparente e 8pt abaixo do lugar final (AC 7)', async () => {
    render(<Snackbar message="Categoria salva." tone="success" onDismiss={jest.fn()} />);
    await esperarEntradaComecar();

    expect(screen.getByRole('alert')).toHaveStyle({ opacity: 0, transform: [{ translateY: spacing.sm }] });
  });

  it('anima em 200 ms no driver nativo e termina opaco e no lugar (AC 7)', async () => {
    animarAteOFim();
    render(<Snackbar message="Categoria salva." tone="success" onDismiss={jest.fn()} />);
    await esperarEntradaComecar();

    expect(Animated.timing).toHaveBeenCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({ toValue: 1, duration: 200, useNativeDriver: true }),
    );
    expect(screen.getByRole('alert')).toHaveStyle({ opacity: 1, transform: [{ translateY: 0 }] });
  });

  it('com "remover animações" ligado, entra só com fade, sem deslize (AC 8)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    render(<Snackbar message="Categoria salva." tone="success" onDismiss={jest.fn()} />);
    await esperarEntradaComecar();

    // Ainda transparente (o fade continua), mas já na posição final: nada desliza.
    expect(screen.getByRole('alert')).toHaveStyle({ opacity: 0, transform: [{ translateY: 0 }] });
  });

  it('sem conseguir ler a preferência do sistema, entra assim mesmo', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('indisponível'));
    animarAteOFim();
    render(<Snackbar message="Categoria salva." tone="success" onDismiss={jest.fn()} />);
    await esperarEntradaComecar();

    expect(screen.getByRole('alert')).toHaveStyle({ opacity: 1 });
  });

  it('no overlay de uma tela com FAB, o Snackbar fica acima do FAB, nunca por cima dele (edge case)', async () => {
    render(
      <Screen
        overlay={<Snackbar message="Categoria salva." tone="success" onDismiss={jest.fn()} />}
        fab={<FAB label="Nova categoria" onPress={jest.fn()} />}
      >
        <Text>Conteúdo</Text>
      </Screen>,
    );
    await esperarEntradaComecar();

    // A camada flutuante empilha os filhos de cima para baixo a partir do rodapé: quem vem
    // primeiro fica acima. O gap entre eles impede que um cubra o outro.
    const camada = screen.root.find((no) => typeof no.type === 'string' && no.props.pointerEvents === 'box-none');
    const papeis = camada
      .findAll((no) => typeof no.type === 'string' && ['alert', 'button'].includes(no.props.accessibilityRole))
      .map((no) => no.props.accessibilityRole);
    expect(papeis).toEqual(['alert', 'button']);
    expect(camada).toHaveStyle({ justifyContent: 'flex-end', gap: spacing.md });
  });
});
