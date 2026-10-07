import { colors, fontFamily, typography } from '@/ui';

import { stackOptions } from '../stackOptions';

// Header nativo das telas internas (NAV-02, AC 4): fundo canvas, sem sombra, título subheading
// regular e tint textPrimary — tudo vindo de token.
describe('stackOptions (NAV-02)', () => {
  it('fundo do header e do conteúdo em canvas', () => {
    expect(stackOptions.headerStyle).toEqual({ backgroundColor: colors.canvas });
    expect(stackOptions.contentStyle).toEqual({ backgroundColor: colors.canvas });
  });

  it('sem sombra nem elevação embaixo do header', () => {
    expect(stackOptions.headerShadowVisible).toBe(false);
  });

  it('título no tamanho subheading, peso regular, em textPrimary', () => {
    expect(stackOptions.headerTitleStyle).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: typography.subheading.fontSize,
      color: colors.textPrimary,
    });
  });

  it('seta de voltar em textPrimary, sem o título da tela anterior', () => {
    expect(stackOptions.headerTintColor).toBe(colors.textPrimary);
    expect(stackOptions.headerBackButtonDisplayMode).toBe('minimal');
  });

  it('o header aparece por padrão', () => {
    expect(stackOptions.headerShown).toBe(true);
  });
});
