import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useDadosDaTela, type Resultado } from '../useDadosDaTela';

// Guarda o callback do foco para o teste simular "voltei para esta tela".
let mockAoFocar: (() => void) | null = null;

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useFocusEffect: (callback: () => void) => {
      mockAoFocar = callback;
      react.useEffect(callback, [callback]);
    },
  };
});

async function focarDeNovo() {
  await act(async () => {
    mockAoFocar?.();
  });
}

// Promessa que o teste resolve quando quiser: simula o banco respondendo depois.
function pendente<T>() {
  let resolver: (valor: Resultado<T>) => void = () => undefined;
  const promessa = new Promise<Resultado<T>>((resolve) => (resolver = resolve));
  return { promessa, resolver };
}

const ok = <T,>(data: T): Resultado<T> => ({ ok: true, data });

type Buscar = () => Promise<Resultado<string[]>>;
const falha = (mensagem: string): Resultado<never> => ({ ok: false, mensagem });

describe('useDadosDaTela (LST-03)', () => {
  it('primeira carga: carregando e depois pronto com os dados', async () => {
    const buscar = jest.fn().mockResolvedValue(ok(['a', 'b']));
    const { result } = renderHook(() => useDadosDaTela(buscar));

    expect(result.current.status).toBe('carregando');
    await waitFor(() => expect(result.current.status).toBe('pronto'));
    expect(result.current.dados).toEqual(['a', 'b']);
  });

  it('primeira carga com erro: status erro com a mensagem; "Tentar novamente" carrega de novo', async () => {
    const buscar = jest.fn().mockResolvedValueOnce(falha('Sem conexão.')).mockResolvedValueOnce(ok(['a']));
    const { result } = renderHook(() => useDadosDaTela(buscar));

    await waitFor(() => expect(result.current.status).toBe('erro'));
    expect(result.current.erro).toBe('Sem conexão.');

    await act(async () => result.current.recarregar());

    expect(result.current.status).toBe('pronto');
    expect(result.current.dados).toEqual(['a']);
    expect(result.current.erro).toBeNull();
  });

  it('recarga ao voltar o foco: os dados antigos ficam na tela, sem skeleton, até o novo chegar', async () => {
    const segunda = pendente<string[]>();
    const buscar = jest.fn().mockResolvedValueOnce(ok(['antigo'])).mockReturnValueOnce(segunda.promessa);
    const { result } = renderHook(() => useDadosDaTela(buscar));
    await waitFor(() => expect(result.current.status).toBe('pronto'));

    await focarDeNovo();
    expect(result.current.status).toBe('pronto');
    expect(result.current.dados).toEqual(['antigo']);

    await act(async () => segunda.resolver(ok(['novo'])));
    expect(result.current.dados).toEqual(['novo']);
  });

  it('falha numa recarga com dados na tela vira feedbackErro e mantém a lista', async () => {
    const buscar = jest.fn().mockResolvedValueOnce(ok(['a'])).mockResolvedValueOnce(falha('Não foi possível carregar.'));
    const { result } = renderHook(() => useDadosDaTela(buscar));
    await waitFor(() => expect(result.current.status).toBe('pronto'));

    await focarDeNovo();

    expect(result.current.status).toBe('pronto');
    expect(result.current.dados).toEqual(['a']);
    expect(result.current.feedbackErro).toBe('Não foi possível carregar.');

    act(() => result.current.limparFeedbackErro());
    expect(result.current.feedbackErro).toBeNull();
  });

  it('resposta de um pedido antigo que chega depois é descartada', async () => {
    const primeira = pendente<string[]>();
    const segunda = pendente<string[]>();
    const buscar = jest.fn().mockReturnValueOnce(primeira.promessa).mockReturnValueOnce(segunda.promessa);
    const { result } = renderHook(() => useDadosDaTela(buscar));

    await focarDeNovo();
    await act(async () => segunda.resolver(ok(['recente'])));
    await act(async () => primeira.resolver(ok(['antiga'])));

    expect(result.current.dados).toEqual(['recente']);
  });

  it('consulta nova (outro mês): volta ao skeleton em vez de mostrar os dados da anterior', async () => {
    const outubro: Buscar = jest.fn().mockResolvedValue(ok(['outubro']));
    const novembro = pendente<string[]>();
    const buscarNovembro: Buscar = jest.fn().mockReturnValue(novembro.promessa);
    const { result, rerender } = renderHook((props: { buscar: Buscar }) => useDadosDaTela(props.buscar), {
      initialProps: { buscar: outubro },
    });
    await waitFor(() => expect(result.current.dados).toEqual(['outubro']));

    await act(async () => rerender({ buscar: buscarNovembro }));

    expect(result.current.status).toBe('carregando');
    expect(result.current.dados).toBeNull();
    await act(async () => novembro.resolver(ok(['novembro'])));
    expect(result.current.dados).toEqual(['novembro']);
  });

  it('pull-to-refresh: atualizando enquanto busca, e os dados novos no fim', async () => {
    const segunda = pendente<string[]>();
    const buscar = jest.fn().mockResolvedValueOnce(ok(['a'])).mockReturnValueOnce(segunda.promessa);
    const { result } = renderHook(() => useDadosDaTela(buscar));
    await waitFor(() => expect(result.current.status).toBe('pronto'));

    let puxando: Promise<void> = Promise.resolve();
    act(() => {
      puxando = result.current.puxarParaAtualizar();
    });
    expect(result.current.atualizando).toBe(true);
    expect(result.current.dados).toEqual(['a']);

    await act(async () => {
      segunda.resolver(ok(['b']));
      await puxando;
    });
    expect(result.current.atualizando).toBe(false);
    expect(result.current.dados).toEqual(['b']);
  });

  it('atualizarDados ajusta a lista na tela depois de uma ação que deu certo', async () => {
    const buscar = jest.fn().mockResolvedValue(ok(['a', 'b']));
    const { result } = renderHook(() => useDadosDaTela(buscar));
    await waitFor(() => expect(result.current.status).toBe('pronto'));

    act(() => result.current.atualizarDados((atuais) => atuais.filter((item) => item !== 'a')));

    expect(result.current.dados).toEqual(['b']);
  });
});
