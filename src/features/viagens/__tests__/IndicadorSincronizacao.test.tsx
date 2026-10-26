import { render, screen } from '@testing-library/react-native';

import { IndicadorSincronizacao } from '../IndicadorSincronizacao';
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
    });
  });

  it('não renderiza nada se estiver online, sem pendências e sem sincronizar', () => {
    render(
      <IndicadorSincronizacao
        isOnline
        pendentes={0}
        comErro={0}
        emRevisao={0}
        sincronizando={false}
      />,
    );

    expect(screen.queryByTestId('indicador-sincronizacao')).toBeNull();
  });

  it('renderiza badge "Offline" e mensagem explicativa quando desconectado e sem pendências', () => {
    render(<IndicadorSincronizacao isOnline={false} pendentes={0} />);

    expect(screen.getByTestId('indicador-sincronizacao')).toBeTruthy();
    expect(screen.getByText('Offline')).toBeTruthy();
    expect(
      screen.getByText(
        'As operações serão guardadas no dispositivo e enviadas quando a internet voltar.',
      ),
    ).toBeTruthy();
  });

  it('exibe "1 registro aguardando sincronização" no singular', () => {
    render(<IndicadorSincronizacao isOnline={false} pendentes={1} />);

    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.getByText('1 registro aguardando sincronização')).toBeTruthy();
  });

  it('exibe "3 registros aguardando sincronização" no plural', () => {
    render(<IndicadorSincronizacao isOnline={false} pendentes={3} />);

    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.getByText('3 registros aguardando sincronização')).toBeTruthy();
  });

  it('exibe pendências mesmo online (aguardando a próxima drenagem)', () => {
    render(<IndicadorSincronizacao isOnline pendentes={2} />);

    expect(screen.queryByText('Offline')).toBeNull();
    expect(screen.getByText('2 registros aguardando sincronização')).toBeTruthy();
  });

  it('exibe estado de sincronização em andamento com indicador de atividade', () => {
    render(<IndicadorSincronizacao isOnline pendentes={2} sincronizando />);

    expect(screen.getByText('Sincronizando...')).toBeTruthy();
  });

  it('exibe tentativa automática quando algum item falhou', () => {
    render(<IndicadorSincronizacao isOnline pendentes={2} comErro={1} />);

    expect(
      screen.getByText('1 registro não pôde ser enviado. Nova tentativa automática em instantes.'),
    ).toBeTruthy();
  });

  it('exibe revisão do gestor no singular e no plural', () => {
    const { rerender } = render(
      <IndicadorSincronizacao isOnline pendentes={1} emRevisao={1} />,
    );

    expect(screen.getByText('1 registro está em revisão com o gestor.')).toBeTruthy();

    rerender(<IndicadorSincronizacao isOnline pendentes={1} emRevisao={2} />);

    expect(screen.getByText('2 registros estão em revisão com o gestor.')).toBeTruthy();
  });

  it('lê valores padrão da store Zustand quando nenhuma prop é fornecida', () => {
    useSyncStore.setState({ isOnline: false, pendentes: 4 });

    render(<IndicadorSincronizacao atualizarAoMontar={false} />);

    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.getByText('4 registros aguardando sincronização')).toBeTruthy();
  });

  it('chama atualizarStatus ao montar quando atualizarAoMontar for true', () => {
    const spyAtualizar = jest.spyOn(useSyncStore.getState(), 'atualizarStatus');

    render(<IndicadorSincronizacao />);

    expect(spyAtualizar).toHaveBeenCalled();
  });
});
