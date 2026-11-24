import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { colors } from '@/ui';

import { DURACAO_CONFIRMACAO_MS, IndicadorSincronizacao } from '../IndicadorSincronizacao';
import { useSyncStore } from '../syncStore';

describe('IndicadorSincronizacao', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSyncStore.setState({
      isOnline: true,
      pendentes: 0,
      comErro: 0,
      emRevisao: 0,
      sincronizando: false,
      ultimoErro: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('não renderiza nada se estiver online, sem pendências e sem sincronizar', async () => {
    await render(<IndicadorSincronizacao isOnline pendentes={0} comErro={0} emRevisao={0} sincronizando={false} />);

    expect(screen.queryByTestId('indicador-sincronizacao')).toBeNull();
  });

  it('sem internet e sem pendência: aviso em warning dizendo que o registro fica guardado', async () => {
    await render(<IndicadorSincronizacao isOnline={false} pendentes={0} />);

    expect(screen.getByText('Sem internet')).toHaveStyle({ color: colors.warning });
    expect(screen.getByTestId('icone-semInternet', { includeHiddenElements: true })).toBeTruthy();
    expect(
      screen.getByText('O que você registrar fica guardado no aparelho e é enviado quando a conexão voltar.'),
    ).toBeTruthy();
    expect(screen.getByTestId('aviso')).toHaveStyle({ backgroundColor: colors.warningWash });
  });

  it('sem internet com pendência: quantos aguardam, no singular e no plural', async () => {
    const { rerender } = await render(<IndicadorSincronizacao isOnline={false} pendentes={1} />);
    expect(screen.getByText('Sem internet · 1 registro aguardando envio')).toBeTruthy();
    expect(screen.getByText('Você pode continuar usando o app. O envio é automático quando a conexão voltar.')).toBeTruthy();

    await rerender(<IndicadorSincronizacao isOnline={false} pendentes={3} />);
    expect(screen.getByText('Sem internet · 3 registros aguardando envio')).toBeTruthy();
  });

  it('online com pendência: aguardando envio (a próxima drenagem já vem)', async () => {
    await render(<IndicadorSincronizacao isOnline pendentes={2} />);

    expect(screen.queryByText(/Sem internet/)).toBeNull();
    expect(screen.getByText('2 registros aguardando envio')).toBeTruthy();
  });

  it('enviando: indicador de progresso ao lado do título, não por cima do texto', async () => {
    await render(<IndicadorSincronizacao isOnline pendentes={2} sincronizando />);

    expect(screen.getByText('Enviando 2 registros')).toBeTruthy();
    expect(screen.queryByTestId('icone-enviando', { includeHiddenElements: true })).toBeNull();
  });

  it('baixando do servidor sem nada a enviar: nenhum aviso (o puxar-para-atualizar já mostra)', async () => {
    await render(<IndicadorSincronizacao isOnline pendentes={0} sincronizando />);

    expect(screen.queryByTestId('indicador-sincronizacao')).toBeNull();
  });

  it('falha no envio: aviso em danger com "Tentar enviar agora", que sincroniza na hora', async () => {
    const sincronizar = jest.fn().mockResolvedValue(undefined);
    useSyncStore.setState({ sincronizarTudo: sincronizar });
    await render(<IndicadorSincronizacao isOnline pendentes={2} comErro={1} />);

    expect(screen.getByText('1 registro não foi enviado')).toHaveStyle({ color: colors.danger });
    expect(screen.getByText('Nova tentativa automática em instantes.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar enviar agora' }));
    expect(sincronizar).toHaveBeenCalledTimes(1);
  });

  it('último erro sem pendência: "Envio pausado" com a mensagem do envio', async () => {
    useSyncStore.setState({
      ultimoErro: 'Sem conexão com a internet. Os dados serão enviados quando a conexão voltar.',
    });

    await render(<IndicadorSincronizacao isOnline pendentes={0} comErro={0} emRevisao={0} sincronizando={false} />);

    expect(screen.getByText('Envio pausado')).toBeTruthy();
    expect(screen.getByText('Sem conexão com a internet. Os dados serão enviados quando a conexão voltar.')).toBeTruthy();
  });

  it('revisão do gestor no singular e no plural, junto do estado do envio', async () => {
    const { rerender } = await render(<IndicadorSincronizacao isOnline pendentes={1} emRevisao={1} />);

    expect(screen.getByText('1 registro em revisão')).toBeTruthy();
    expect(screen.getByText('1 registro aguardando envio')).toBeTruthy();

    await rerender(<IndicadorSincronizacao isOnline pendentes={1} emRevisao={2} />);
    expect(screen.getByText('2 registros em revisão')).toBeTruthy();
  });

  it('a fila esvaziou: confirma "Tudo enviado" e some depois de alguns segundos', async () => {
    jest.useFakeTimers();
    const { rerender } = await render(<IndicadorSincronizacao isOnline pendentes={2} sincronizando />);

    await rerender(<IndicadorSincronizacao isOnline pendentes={0} sincronizando={false} />);
    expect(screen.getByText('Tudo enviado')).toHaveStyle({ color: colors.success });
    expect(screen.getByText('Seus registros já estão no servidor.')).toBeTruthy();

    await act(() => jest.advanceTimersByTime(DURACAO_CONFIRMACAO_MS));
    expect(screen.queryByTestId('indicador-sincronizacao')).toBeNull();
  });

  it('abrir a tela com a fila já vazia não mostra a confirmação', async () => {
    await render(<IndicadorSincronizacao isOnline pendentes={0} sincronizando={false} />);

    expect(screen.queryByText('Tudo enviado')).toBeNull();
  });

  it('lê valores padrão da store Zustand quando nenhuma prop é fornecida', async () => {
    useSyncStore.setState({ isOnline: false, pendentes: 4 });

    await render(<IndicadorSincronizacao atualizarAoMontar={false} />);

    expect(screen.getByText('Sem internet · 4 registros aguardando envio')).toBeTruthy();
  });

  it('chama atualizarStatus ao montar quando atualizarAoMontar for true', async () => {
    const spyAtualizar = jest.spyOn(useSyncStore.getState(), 'atualizarStatus');

    await render(<IndicadorSincronizacao />);

    expect(spyAtualizar).toHaveBeenCalled();
  });
});
