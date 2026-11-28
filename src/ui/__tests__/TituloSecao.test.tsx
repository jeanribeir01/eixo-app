import { render, screen } from '@testing-library/react-native';

import { colors, fontFamily, typography } from '../tokens';
import { TituloSecao } from '../TituloSecao';

describe('TituloSecao', () => {
  it('title em peso 600, na cor de título, marcado como cabeçalho', async () => {
    await render(<TituloSecao titulo="Pede atenção" />);

    expect(screen.getByRole('header', { name: 'Pede atenção' })).toHaveStyle({
      color: colors.textPrimary,
      fontSize: typography.title.fontSize,
      fontFamily: fontFamily.semibold,
    });
  });

  it('com quantidade, junta o número ao título com um ponto', async () => {
    await render(<TituloSecao titulo="Concluídas" quantidade={93} />);

    expect(screen.getByRole('header', { name: 'Concluídas · 93' })).toBeOnTheScreen();
  });

  it('quantidade zero também aparece: a seção vazia diz que está vazia', async () => {
    await render(<TituloSecao titulo="Aguardando aprovação" quantidade={0} />);

    expect(screen.getByText('Aguardando aprovação · 0')).toBeOnTheScreen();
  });
});
