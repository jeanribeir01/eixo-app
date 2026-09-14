import { renderRouter, screen } from 'expo-router/testing-library';

import RootLayout from '../../app/_layout';
import Index from '../../app/index';

describe('RootLayout (scaffold)', () => {
  it('renderiza a rota inicial através do expo-router', async () => {
    const router = renderRouter({ _layout: RootLayout, index: Index }, { initialUrl: '/' });

    expect(await screen.findByText('Eixo Certo')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/');
  });
});
