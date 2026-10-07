import { colors, fontFamily, touchTarget } from '@/ui';

import { tabBarOptions } from '../tabBarOptions';

// Tab bar com ícone acima do rótulo (NAV-01) e cores de token (NAV-01, AC 2).
describe('tabBarOptions (NAV-01)', () => {
  it('rótulo sempre abaixo do ícone, também no tablet', () => {
    expect(tabBarOptions.tabBarLabelPosition).toBe('below-icon');
  });

  it('ativa em textPrimary e inativa em textBody', () => {
    expect(tabBarOptions.tabBarActiveTintColor).toBe(colors.textPrimary);
    expect(tabBarOptions.tabBarInactiveTintColor).toBe(colors.textBody);
  });

  it('rótulo em Inter medium e alvo de toque de 44pt', () => {
    expect(tabBarOptions.tabBarLabelStyle).toMatchObject({ fontFamily: fontFamily.medium });
    expect(tabBarOptions.tabBarItemStyle).toMatchObject({ minHeight: touchTarget });
  });
});
