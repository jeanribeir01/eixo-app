import { act, renderHook, waitFor } from '@testing-library/react-native';

import { MENSAGEM_SEM_INTERNET, useConexaoStore } from '../conexao';
import { useCargaUnica } from '../useCargaUnica';
import type { Resultado } from '../useDadosDaTela';

type Buscar = () => Promise<Resultado<string>>;
const ok = (data: string): Resultado<string> => ({ ok: true, data });

function pendente() {
  let resolver: (valor: Resultado<string>) => void = () => undefined;
  const promessa = new Promise<Resultado<string>>((resolve) => (resolver = resolve));
  return { promessa, resolver };
}

afterEach(() => useConexaoStore.setState({ online: true }));

describe('useCargaUnica', () => {
  it('sem nada a carregar (o "Novo" de um formulário): pronto na hora', async () => {
    const aoCarregar = jest.fn();
    const { result } = await renderHook(() => useCargaUnica<string>(null, aoCarregar));

    expect(result.current.status).toBe('pronto');
    expect(aoCarregar).not.toHaveBeenCalled();
  });

  it('carrega uma vez e entrega os dados para a tela preencher', async () => {
    const buscar: Buscar = jest.fn().mockResolvedValue(ok('Frete'));
    const aoCarregar = jest.fn();
    const { result } = await renderHook(() => useCargaUnica(buscar, aoCarregar));

    await waitFor(() => expect(result.current.status).toBe('pronto'));
    expect(aoCarregar).toHaveBeenCalledWith('Frete');
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('erro do banco: a mensagem dele, e "tentar de novo" carrega outra vez', async () => {
    const buscar: Buscar = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, mensagem: 'Categoria não encontrada.' })
      .mockResolvedValueOnce(ok('Frete'));
    const { result } = await renderHook(() => useCargaUnica(buscar, jest.fn()));

    await waitFor(() => expect(result.current.status).toBe('erro'));
    expect(result.current.erro).toBe('Categoria não encontrada.');

    await act(async () => result.current.tentarDeNovo());

    await waitFor(() => expect(result.current.status).toBe('pronto'));
  });

  it('abrir sem internet: erro "Sem internet" na hora, sem consultar; a conexão voltar carrega sozinha', async () => {
    useConexaoStore.setState({ online: false });
    const buscar: Buscar = jest.fn().mockResolvedValue(ok('Frete'));
    const aoCarregar = jest.fn();
    const { result } = await renderHook(() => useCargaUnica(buscar, aoCarregar));

    expect(result.current.status).toBe('erro');
    expect(result.current.erro).toBe(MENSAGEM_SEM_INTERNET);
    expect(buscar).not.toHaveBeenCalled();

    await act(() => useConexaoStore.setState({ online: true }));

    await waitFor(() => expect(result.current.status).toBe('pronto'));
    expect(aoCarregar).toHaveBeenCalledWith('Frete');
  });

  it('a internet caiu no meio da carga: sai do "carregando" para o erro', async () => {
    const carga = pendente();
    const buscar: Buscar = jest.fn().mockReturnValue(carga.promessa);
    const { result } = await renderHook(() => useCargaUnica(buscar, jest.fn()));
    expect(result.current.status).toBe('carregando');

    await act(() => useConexaoStore.setState({ online: false }));

    expect(result.current.status).toBe('erro');
    expect(result.current.erro).toBe(MENSAGEM_SEM_INTERNET);
  });

  it('com a carga pronta, cair e voltar a internet não recarrega (não apaga o que foi digitado)', async () => {
    const buscar: Buscar = jest.fn().mockResolvedValue(ok('Frete'));
    const { result } = await renderHook(() => useCargaUnica(buscar, jest.fn()));
    await waitFor(() => expect(result.current.status).toBe('pronto'));

    await act(() => useConexaoStore.setState({ online: false }));
    await act(() => useConexaoStore.setState({ online: true }));

    expect(buscar).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('pronto');
  });
});
