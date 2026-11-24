import { fireEvent, render, screen } from '@testing-library/react-native';
import { ActivityIndicator } from 'react-native';

import { Aviso } from '../Aviso';
import { colors } from '../tokens';

import { porTipo } from '@/testing/componentes';

describe('Aviso', () => {
  it.each([
    ['info', colors.accentSoft, colors.accentText],
    ['warning', colors.warningWash, colors.warning],
    ['success', colors.successWash, colors.success],
    ['danger', colors.dangerWash, colors.danger],
  ] as const)('tom %s: fundo tingido e título na cor do tom', async (tom, fundo, texto) => {
    await render(<Aviso tom={tom} titulo="Sem internet" icone="semInternet" />);

    expect(screen.getByTestId('aviso')).toHaveStyle({ backgroundColor: fundo });
    expect(screen.getByText('Sem internet')).toHaveStyle({ color: texto });
  });

  it('cor nunca sozinha: o ícone acompanha o título', async () => {
    await render(<Aviso tom="warning" titulo="Sem internet" icone="semInternet" />);

    expect(screen.getByTestId('icone-semInternet', { includeHiddenElements: true })).toBeTruthy();
  });

  it('texto simples vira o corpo do aviso; anunciado ao aparecer', async () => {
    await render(
      <Aviso tom="info" titulo="Falta liberar seu acesso">
        Quem administra precisa aprovar.
      </Aviso>,
    );

    expect(screen.getByText('Quem administra precisa aprovar.')).toBeOnTheScreen();
    expect(screen.getByTestId('aviso').props.accessibilityLiveRegion).toBe('polite');
  });

  it('em andamento: indicador de progresso no lugar do ícone', async () => {
    await render(<Aviso tom="info" titulo="Enviando 2 registros" icone="enviando" emAndamento />);

    expect(porTipo(ActivityIndicator)).toBeTruthy();
    expect(screen.queryByTestId('icone-enviando', { includeHiddenElements: true })).toBeNull();
  });

  it('com ação: botão secundário que responde ao toque', async () => {
    const onPress = jest.fn();
    await render(<Aviso tom="danger" titulo="1 registro não foi enviado" acao={{ label: 'Tentar enviar agora', onPress }} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar enviar agora' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
