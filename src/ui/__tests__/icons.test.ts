import { icons, type IconName } from '../icons';
import { iconSize, indicatorSize } from '../tokens';

// No Jest os ícones do Phosphor vêm do jest.phosphor-stub.js, que dá a cada componente o nome do
// export pedido (displayName). É assim que o teste confere qual ícone do Phosphor cada nome usa.
const nomes = Object.keys(icons) as IconName[];
const nomeDoComponente = (nome: IconName) => (icons[nome] as { displayName?: string }).displayName;

describe('mapa de ícones (NAV-03, ADR 0006)', () => {
  it.each(nomes)('%s aponta para um ícone do Phosphor', (nome) => {
    expect(nomeDoComponente(nome)).toMatch(/^[A-Z][A-Za-z]*Icon$/);
  });

  it('cada aba do menu tem o ícone pedido (NAV-01)', () => {
    expect(nomeDoComponente('dashboards')).toBe('ChartBarIcon');
    expect(nomeDoComponente('financeiro')).toBe('WalletIcon');
    expect(nomeDoComponente('frota')).toBe('TruckIcon');
    expect(nomeDoComponente('viagens')).toBe('PathIcon');
    expect(nomeDoComponente('configuracoes')).toBe('GearSixIcon');
  });
});

describe('tokens de ícone (NAV-03)', () => {
  it('oferece só os tamanhos 16, 20 e 24', () => {
    expect(iconSize).toEqual({ sm: 16, md: 20, lg: 24 });
  });

  it('a pílula da aba ativa cabe o ícone md com folga', () => {
    expect(indicatorSize.tabWidth).toBeGreaterThan(iconSize.md);
    expect(indicatorSize.tabHeight).toBeGreaterThan(iconSize.md);
  });
});
