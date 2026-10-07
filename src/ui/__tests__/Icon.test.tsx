import { render, screen } from '@testing-library/react-native';

import { Icon } from '../Icon';
import { colors, iconSize } from '../tokens';

describe('Icon (NAV-03)', () => {
  it('desenha o Material Symbol do mapa no tamanho do token pedido', () => {
    render(<Icon name="financeiro" size="lg" accessibilityLabel="Financeiro" />);

    expect(screen.getByTestId('simbolo-account_balance_wallet')).toHaveStyle({
      width: iconSize.lg,
      height: iconSize.lg,
    });
  });

  it('usa o tamanho md quando nenhum é pedido', () => {
    render(<Icon name="frota" accessibilityLabel="Frota" />);

    expect(screen.getByTestId('simbolo-local_shipping')).toHaveStyle({ width: iconSize.md, height: iconSize.md });
  });

  it('pinta com a cor do tom pedido', () => {
    render(<Icon name="frota" tone="body" accessibilityLabel="Frota" />);

    expect(screen.getByTestId('simbolo-local_shipping')).toHaveStyle({ color: colors.textBody });
  });

  it('sem accessibilityLabel é decorativo: o leitor de tela não o encontra', () => {
    render(<Icon name="adicionar" />);

    expect(screen.queryByRole('image')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('simbolo-add')).not.toBeOnTheScreen();
    expect(screen.getByTestId('simbolo-add', { includeHiddenElements: true })).toBeTruthy();
  });

  it('com accessibilityLabel é anunciado como imagem com o rótulo', () => {
    render(<Icon name="alerta" accessibilityLabel="Saldo negativo" />);

    expect(screen.getByRole('image', { name: 'Saldo negativo' })).toBeOnTheScreen();
  });
});
