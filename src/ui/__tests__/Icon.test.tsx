import { render, screen } from '@testing-library/react-native';

import { Icon } from '../Icon';
import { colors, iconSize } from '../tokens';

describe('Icon (NAV-03)', () => {
  it('desenha o ícone do Phosphor do mapa no tamanho do token pedido', () => {
    render(<Icon name="financeiro" size="lg" accessibilityLabel="Financeiro" />);

    expect(screen.getByTestId('icone-financeiro')).toHaveStyle({
      width: iconSize.lg,
      height: iconSize.lg,
    });
  });

  it('usa o tamanho md quando nenhum é pedido', () => {
    render(<Icon name="frota" accessibilityLabel="Frota" />);

    expect(screen.getByTestId('icone-frota')).toHaveStyle({ width: iconSize.md, height: iconSize.md });
  });

  it('usa o peso regular (contorno) quando nenhum é pedido, e fill quando pedido (aba ativa)', () => {
    render(<Icon name="frota" />);
    expect(screen.getByTestId('icone-frota', { includeHiddenElements: true }).props.weight).toBe('regular');

    render(<Icon name="viagens" weight="fill" />);
    expect(screen.getByTestId('icone-viagens', { includeHiddenElements: true }).props.weight).toBe('fill');
  });

  it('pinta com a cor do tom pedido', () => {
    render(<Icon name="frota" tone="body" accessibilityLabel="Frota" />);

    expect(screen.getByTestId('icone-frota')).toHaveStyle({ color: colors.textBody });
  });

  it('sem accessibilityLabel é decorativo: o leitor de tela não o encontra', () => {
    render(<Icon name="adicionar" />);

    expect(screen.queryByRole('image')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('icone-adicionar')).not.toBeOnTheScreen();
    expect(screen.getByTestId('icone-adicionar', { includeHiddenElements: true })).toBeTruthy();
  });

  it('sem accessibilityLabel esconde nas duas plataformas: iOS e Android (TalkBack)', () => {
    render(<Icon name="adicionar" />);

    // Sobe do símbolo até a View do Icon, que é quem carrega as props de acessibilidade.
    let envoltorio = screen.getByTestId('icone-adicionar', { includeHiddenElements: true }).parent;
    while (envoltorio && envoltorio.props.importantForAccessibility === undefined) envoltorio = envoltorio.parent;
    expect(envoltorio?.props.accessibilityElementsHidden).toBe(true);
    expect(envoltorio?.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('com accessibilityLabel é anunciado como imagem com o rótulo', () => {
    render(<Icon name="alerta" accessibilityLabel="Saldo negativo" />);

    expect(screen.getByRole('image', { name: 'Saldo negativo' })).toBeOnTheScreen();
  });
});
