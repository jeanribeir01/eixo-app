import { render, screen } from '@testing-library/react-native';

import { TabBarIcon } from '../TabBarIcon';
import { colors, indicatorSize } from '../tokens';

// Aba ativa da tab bar (DESIGN_CYAN 2.0 §7): três sinais juntos — forma, fundo e cor — porque só a cor
// sumia ao sol (auditoria de UI, "Menu").
describe('TabBarIcon', () => {
  it('ativa: ícone cheio em accentText sobre a pílula accentSoft', async () => {
    await render(<TabBarIcon name="frota" focused />);

    const icone = screen.getByTestId('icone-frota', { includeHiddenElements: true });
    expect(icone.props.weight).toBe('fill');
    expect(icone).toHaveStyle({ color: colors.accentText });
    expect(screen.getByTestId('aba-ativa')).toHaveStyle({
      backgroundColor: colors.accentSoft,
      width: indicatorSize.tabWidth,
      height: indicatorSize.tabHeight,
    });
  });

  it('inativa: contorno em textBody, sem pílula', async () => {
    await render(<TabBarIcon name="frota" focused={false} />);

    const icone = screen.getByTestId('icone-frota', { includeHiddenElements: true });
    expect(icone.props.weight).toBe('regular');
    expect(icone).toHaveStyle({ color: colors.textBody });
    expect(screen.queryByTestId('aba-ativa')).not.toBeOnTheScreen();
  });
});
