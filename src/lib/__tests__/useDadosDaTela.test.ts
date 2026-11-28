import { act, renderHook, waitFor } from '@testing-library/react-native';

import { MENSAGEM_SEM_INTERNET, useConexaoStore } from '../conexao';
import { useDadosDaTela, type Resultado } from '../useDadosDaTela';
import { segurarPrimeiraCarga } from '@/testing/eventos';

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
    const buscar: Buscar = jest.fn().mockResolvedValue(ok(['a', 'b']));
    const liberarCarga = segurarPrimeiraCarga(jest.mocked(buscar));
    const { result } = await renderHook(() => useDadosDaTela(buscar));

    expect(result.current.status).toBe('carregando');
    await liberarCarga();
    await waitFor(() => expect(result.current.status).toBe('pronto'));
    expect(result.current.dados).toEqual(['a', 'b']);
  });

  it('primeira carga com erro: status erro com a mensagem; "Tentar novamente" carrega de novo', async () => {
    const buscar: Buscar = jest.fn().mockResolvedValueOnce(falha('Sem conexão.')).mockResolvedValueOnce(ok(['a']));
    const { result } = await renderHook(() => useDadosDaTela(buscar));

    await waitFor(() => expect(result.current.status).toBe('erro'));
    expect(result.current.erro).toBe('Sem conexão.');

    await act(async () => result.current.recarregar());

    expect(result.current.status).toBe('pronto');
    expect(result.current.dados).toEqual(['a']);
    expect(result.current.erro).toBeNull();
  });

  it('recarga ao voltar o foco: os dados antigos ficam na tela, sem skeleton, até o novo chegar', async () => {
    const segunda = pendente<string[]>();
    const buscar: Buscar = jest.fn().mockResolvedValueOnce(ok(['antigo'])).mockReturnValueOnce(segunda.promessa);
    const { result } = await renderHook(() => useDadosDaTela(buscar));
    await waitFor(() => expect(result.current.status).toBe('pronto'));

    await focarDeNovo();
    expect(result.current.status).toBe('pronto');
    expect(result.current.dados).toEqual(['antigo']);

    await act(async () => segunda.resolver(ok(['novo'])));
    expect(result.current.dados).toEqual(['novo']);
  });

  it('falha numa recarga com dados na tela vira feedbackErro e mantém a lista', async () => {
    const buscar: Buscar = jest.fn().mockResolvedValueOnce(ok(['a'])).mockResolvedValueOnce(falha('Não foi possível carregar.'));
    const { result } = await renderHook(() => useDadosDaTela(buscar));
    await waitFor(() => expect(result.current.status).toBe('pronto'));

    await focarDeNovo();

    expect(result.current.status).toBe('pronto');
    expect(result.current.dados).toEqual(['a']);
    expect(result.current.feedbackErro).toBe('Não foi possível carregar.');

    await act(() => result.current.limparFeedbackErro());
    expect(result.current.feedbackErro).toBeNull();
  });

  it('resposta de um pedido antigo que chega depois é descartada', async () => {
    const primeira = pendente<string[]>();
    const segunda = pendente<string[]>();
    const buscar: Buscar = jest.fn().mockReturnValueOnce(primeira.promessa).mockReturnValueOnce(segunda.promessa);
    const { result } = await renderHook(() => useDadosDaTela(buscar));

    await focarDeNovo();
    await act(async () => segunda.resolver(ok(['recente'])));
    await act(async () => primeira.resolver(ok(['antiga'])));

    expect(result.current.dados).toEqual(['recente']);
  });

  it('consulta nova (outro mês): volta ao skeleton em vez de mostrar os dados da anterior', async () => {
    const outubro: Buscar = jest.fn().mockResolvedValue(ok(['outubro']));
    const novembro = pendente<string[]>();
    const buscarNovembro: Buscar = jest.fn().mockReturnValue(novembro.promessa);
    const { result, rerender } = await renderHook((props: { buscar: Buscar }) => useDadosDaTela(props.buscar), {
      initialProps: { buscar: outubro },
    });
    await waitFor(() => expect(result.current.dados).toEqual(['outubro']));

    await act(async () => await rerender({ buscar: buscarNovembro }));

    expect(result.current.status).toBe('carregando');
    expect(result.current.dados).toBeNull();
    await act(async () => novembro.resolver(ok(['novembro'])));
    expect(result.current.dados).toEqual(['novembro']);
  });

  it('pull-to-refresh: atualizando enquanto busca, e os dados novos no fim', async () => {
    const segunda = pendente<string[]>();
    const buscar: Buscar = jest.fn().mockResolvedValueOnce(ok(['a'])).mockReturnValueOnce(segunda.promessa);
    const { result } = await renderHook(() => useDadosDaTela(buscar));
    await waitFor(() => expect(result.current.status).toBe('pronto'));

    let puxando: Promise<void> = Promise.resolve();
    await act(() => {
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
    const buscar: Buscar = jest.fn().mockResolvedValue(ok(['a', 'b']));
    const { result } = await renderHook(() => useDadosDaTela(buscar));
    await waitFor(() => expect(result.current.status).toBe('pronto'));

    await act(() => result.current.atualizarDados((atuais) => atuais.filter((item) => item !== 'a')));

    expect(result.current.dados).toEqual(['b']);
  });
});

describe('useDadosDaTela sem internet', () => {
  const ficarSemInternet = () => act(() => useConexaoStore.setState({ online: false }));
  const voltarAInternet = () => act(() => useConexaoStore.setState({ online: true }));

  afterEach(() => useConexaoStore.setState({ online: true }));

  it('abrir sem internet: erro "Sem internet" na hora, sem consultar (nada de skeleton eterno)', async () => {
    useConexaoStore.setState({ online: false });
    const buscar: Buscar = jest.fn().mockResolvedValue(ok(['a']));
    const { result } = await renderHook(() => useDadosDaTela(buscar));

    expect(result.current.status).toBe('erro');
    expect(result.current.erro).toBe(MENSAGEM_SEM_INTERNET);
    expect(result.current.semInternet).toBe(true);
    expect(buscar).not.toHaveBeenCalled();
  });

  it('a conexão voltou: carrega sozinha, sem ninguém tocar em "Tentar novamente"', async () => {
    useConexaoStore.setState({ online: false });
    const buscar: Buscar = jest.fn().mockResolvedValue(ok(['a']));
    const { result } = await renderHook(() => useDadosDaTela(buscar));

    await voltarAInternet();

    await waitFor(() => expect(result.current.status).toBe('pronto'));
    expect(result.current.dados).toEqual(['a']);
    expect(result.current.semInternet).toBe(false);
  });

  it('caiu com dados na tela: os dados ficam, a recarga não consulta, e a hora da carga vem junto', async () => {
    const buscar: Buscar = jest.fn().mockResolvedValue(ok(['a']));
    const { result } = await renderHook(() => useDadosDaTela(buscar));
    await waitFor(() => expect(result.current.status).toBe('pronto'));
    expect(result.current.carregadoAs).toMatch(/^\d{2}:\d{2}$/);

    await ficarSemInternet();
    await focarDeNovo();
    await act(async () => result.current.puxarParaAtualizar());

    expect(buscar).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('pronto');
    expect(result.current.dados).toEqual(['a']);
    expect(result.current.semInternet).toBe(true);
    expect(result.current.feedbackErro).toBeNull();
  });

  it('a internet caiu no meio da primeira carga: sai do skeleton para o erro; a resposta atrasada ainda entra', async () => {
    const carga = pendente<string[]>();
    const buscar: Buscar = jest.fn().mockReturnValue(carga.promessa);
    const { result } = await renderHook(() => useDadosDaTela(buscar));
    expect(result.current.status).toBe('carregando');

    await ficarSemInternet();

    expect(result.current.status).toBe('erro');
    expect(result.current.erro).toBe(MENSAGEM_SEM_INTERNET);

    await act(async () => carga.resolver(ok(['a'])));
    expect(result.current.status).toBe('pronto');
    expect(result.current.dados).toEqual(['a']);
  });

  it('tela offline-first (precisaDeInternet: false): sem internet carrega normalmente e não avisa', async () => {
    useConexaoStore.setState({ online: false });
    const buscar: Buscar = jest.fn().mockResolvedValue(ok(['local']));
    const { result } = await renderHook(() => useDadosDaTela(buscar, { precisaDeInternet: false }));

    await waitFor(() => expect(result.current.status).toBe('pronto'));
    expect(result.current.dados).toEqual(['local']);
    expect(result.current.semInternet).toBe(false);
  });
});
