import { act, render, screen } from '@testing-library/react-native';

import { IndicadorSincronizacao } from '../IndicadorSincronizacao';
import { useSyncStore, type SyncState } from '../syncStore';

type Estado = Pick<SyncState, 'isOnline' | 'pendentes' | 'falhas' | 'conflitos' | 'sincronizando'>;

function renderizar(estado: Partial<Estado>) {
  useSyncStore.setState({ isOnline: true, pendentes: 0, falhas: 0, conflitos: 0, sincronizando: false, ...estado });
  return render(<IndicadorSincronizacao />);
}

describe('IndicadorSincronizacao', () => {
  it('não ocupa espaço quando está online e tudo já subiu', () => {
    renderizar({});

    expect(screen.queryByTestId('indicador-sincronizacao')).not.toBeOnTheScreen();
  });

  it('offline e sem pendência, avisa que o registro fica salvo no aparelho', () => {
    renderizar({ isOnline: false });

    expect(screen.getByText('Offline')).toBeOnTheScreen();
    expect(
      screen.getByText('O que você registrar fica salvo no aparelho e é enviado quando a internet voltar.'),
    ).toBeOnTheScreen();
  });

  it.each([
    [1, '1 registro aguardando sincronização.'],
    [3, '3 registros aguardando sincronização.'],
  ])('mostra %i pendência(s) no singular ou plural', (pendentes, texto) => {
    renderizar({ isOnline: false, pendentes });

    expect(screen.getByText(texto)).toBeOnTheScreen();
    expect(screen.queryByText(/fica salvo no aparelho/)).not.toBeOnTheScreen();
  });

  it('mostra o envio em andamento', () => {
    renderizar({ sincronizando: true, pendentes: 2 });

    expect(screen.getByText('Sincronizando…')).toBeOnTheScreen();
    expect(screen.queryByText('Offline')).not.toBeOnTheScreen();
  });

  it('mostra falha e conflito separados, mesmo sem nada pendente', () => {
    renderizar({ falhas: 1, conflitos: 2 });

    expect(screen.getByText('1 registro recusado pelo servidor.')).toBeOnTheScreen();
    expect(screen.getByText('2 conflitos de hodômetro aguardando revisão do gestor.')).toBeOnTheScreen();
  });

  it('acompanha a store quando o status muda', () => {
    renderizar({});
    expect(screen.queryByTestId('indicador-sincronizacao')).not.toBeOnTheScreen();

    act(() => {
      useSyncStore.setState({ pendentes: 1 });
    });

    expect(screen.getByText('1 registro aguardando sincronização.')).toBeOnTheScreen();
  });
});
