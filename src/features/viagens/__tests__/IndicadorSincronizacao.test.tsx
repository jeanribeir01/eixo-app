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
      conflitos: 0,
      sincronizando: false,
    });
  });

  it('não renderiza nada se estiver online, sem pendências e sem sincronizar', () => {
    render(<IndicadorSincronizacao isOnline pendentes={0} conflitos={0} sincronizando={false} />);

    expect(screen.queryByTestId('indicador-sincronizacao')).toBeNull();
  });

  it('renderiza badge "offline" e mensagem explicativa quando desconectado e sem pendências', () => {
    render(<IndicadorSincronizacao isOnline={false} pendentes={0} />);

    expect(screen.getByTestId('indicador-sincronizacao')).toBeTruthy();
    expect(screen.getByText('offline')).toBeTruthy();
    expect(
      screen.getByText('As operações serão guardadas no dispositivo e enviadas quando a internet voltar.'),
    ).toBeTruthy();
  });

  it('exibe "1 registo a aguardar sincronização" no singular quando houver 1 pendência', () => {
    render(<IndicadorSincronizacao isOnline={false} pendentes={1} />);

    expect(screen.getByText('offline')).toBeTruthy();
    expect(screen.getByText('1 registo a aguardar sincronização')).toBeTruthy();
  });

  it('exibe "3 registos a aguardar sincronização" no plural quando houver múltiplas pendências', () => {
    render(<IndicadorSincronizacao isOnline={false} pendentes={3} />);

    expect(screen.getByText('offline')).toBeTruthy();
    expect(screen.getByText('3 registos a aguardar sincronização')).toBeTruthy();
  });

  it('exibe pendências mesmo se estiver online (aguardando disparo de sincronização)', () => {
    render(<IndicadorSincronizacao isOnline pendentes={2} />);

    expect(screen.queryByText('offline')).toBeNull();
    expect(screen.getByText('2 registos a aguardar sincronização')).toBeTruthy();
  });

  it('exibe estado de sincronização em andamento com indicador de atividade', () => {
    render(<IndicadorSincronizacao isOnline pendentes={2} sincronizando />);

    expect(screen.getByText('A sincronizar...')).toBeTruthy();
  });

  it('exibe aviso de conflito quando houver registros marcados para revisão do gestor', () => {
    render(<IndicadorSincronizacao isOnline pendentes={1} conflitos={1} />);

    expect(screen.getByText('1 conflito detectado (aguardando revisão do gestor).')).toBeTruthy();
  });

  it('lê valores padrão da store Zustand quando nenhuma prop é fornecida', () => {
    useSyncStore.setState({ isOnline: false, pendentes: 4 });

    render(<IndicadorSincronizacao atualizarAoMontar={false} />);

    expect(screen.getByText('offline')).toBeTruthy();
    expect(screen.getByText('4 registos a aguardar sincronização')).toBeTruthy();
  });

  it('chama atualizarStatus ao montar quando atualizarAoMontar for true', () => {
    const spyAtualizar = jest.spyOn(useSyncStore.getState(), 'atualizarStatus');

    render(<IndicadorSincronizacao />);

    expect(spyAtualizar).toHaveBeenCalled();
  });
});
