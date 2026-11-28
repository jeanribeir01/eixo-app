import { render, screen } from '@testing-library/react-native';

import { AvisoSemInternet } from '../AvisoSemInternet';

describe('AvisoSemInternet', () => {
  it('diz de quando são os dados que continuam na tela e que ela se atualiza sozinha', async () => {
    await render(<AvisoSemInternet carregadoAs="14:32" />);

    expect(screen.getByText('Sem internet')).toBeOnTheScreen();
    expect(
      screen.getByText('Mostrando o que foi carregado às 14:32. A tela se atualiza sozinha quando a conexão voltar.'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('icone-semInternet', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('sem a hora da carga, só diz que a tela se atualiza sozinha', async () => {
    await render(<AvisoSemInternet />);

    expect(screen.getByText('A tela se atualiza sozinha quando a conexão voltar.')).toBeOnTheScreen();
  });
});
