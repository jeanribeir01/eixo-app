import { readFileSync } from 'fs';
import path from 'path';

import { icons, type IconName } from '../icons';
import { iconSize } from '../tokens';

// Catálogo de Material Symbols que o expo-symbols desenha no Android. Lido do disco porque o pacote
// não exporta o JSON; um nome fora dele vira um quadrado vazio na tela.
const catalogoAndroid: Record<string, number> = JSON.parse(
  readFileSync(path.join(path.dirname(require.resolve('expo-symbols')), 'android', 'symbols.json'), 'utf-8'),
);

const nomes = Object.keys(icons) as IconName[];

describe('mapa de ícones (NAV-03)', () => {
  it.each(nomes)('%s usa um nome que existe nos Material Symbols do Android', (nome) => {
    expect(catalogoAndroid).toHaveProperty(icons[nome].android);
  });

  it.each(nomes)('%s tem o par SF Symbol do iOS', (nome) => {
    expect(icons[nome].ios).toMatch(/^[a-z0-9.]+$/);
  });

  it('cada aba do menu tem o ícone pedido na spec (NAV-01)', () => {
    expect(icons.dashboards.android).toBe('dashboard');
    expect(icons.financeiro.android).toBe('account_balance_wallet');
    expect(icons.frota.android).toBe('local_shipping');
    expect(icons.viagens.android).toBe('route');
    expect(icons.configuracoes.android).toBe('settings');
  });
});

describe('token iconSize (NAV-03)', () => {
  it('oferece só os tamanhos 16, 20 e 24', () => {
    expect(iconSize).toEqual({ sm: 16, md: 20, lg: 24 });
  });
});
