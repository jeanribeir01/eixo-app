import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import { ChipFiltro, LinhaDeFiltros } from '../ChipFiltro';
import { colors, touchTarget } from '../tokens';

import { porTipo } from '@/testing/componentes';

const OPCOES = [
  { value: 'todas', label: 'Todas' },
  { value: 'Entrada', label: 'Entradas' },
  { value: 'Saida', label: 'Saídas' },
];

describe('ChipFiltro', () => {
  it('no valor padrão: neutro, mostra o nome do filtro e o leitor de tela ouve o valor', async () => {
    await render(<ChipFiltro label="Tipo" value="todas" valorPadrao="todas" options={OPCOES} onChange={jest.fn()} />);

    const chip = screen.getByRole('button', { name: 'Tipo: Todas' });
    expect(chip).toHaveTextContent('Tipo');
    expect(chip).toHaveStyle({ backgroundColor: colors.surface, minHeight: touchTarget });
  });

  it('com filtro aplicado: tingido e mostra a opção escolhida', async () => {
    await render(<ChipFiltro label="Tipo" value="Saida" valorPadrao="todas" options={OPCOES} onChange={jest.fn()} />);

    const chip = screen.getByRole('button', { name: 'Tipo: Saídas' });
    expect(chip).toHaveTextContent('Saídas');
    expect(chip).toHaveStyle({ backgroundColor: colors.accentSoft });
  });

  it('sem valor padrão (ex.: o mês), o chip está sempre ativo', async () => {
    await render(<ChipFiltro label="Mês" value="2026-11" options={[{ value: '2026-11', label: 'Novembro 2026' }]} onChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Mês: Novembro 2026' })).toHaveStyle({ backgroundColor: colors.accentSoft });
  });

  it('tocar abre a folha com as opções; escolher chama onChange e fecha', async () => {
    const onChange = jest.fn();
    await render(<ChipFiltro label="Tipo" value="todas" valorPadrao="todas" options={OPCOES} onChange={onChange} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Tipo: Todas' }));
    expect(screen.getByRole('button', { name: 'Tipo: Todas' })).toBeExpanded();
    // A opção atual tem o ícone de confirmação, não só peso ou cor.
    expect(screen.getByTestId('icone-sucesso', { includeHiddenElements: true })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Entradas' }));

    expect(onChange).toHaveBeenCalledWith('Entrada');
    expect(screen.getByRole('button', { name: 'Tipo: Todas' })).toBeCollapsed();
  });

  it('Cancelar fecha a folha sem mudar o filtro', async () => {
    const onChange = jest.fn();
    await render(<ChipFiltro label="Tipo" value="todas" valorPadrao="todas" options={OPCOES} onChange={onChange} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Tipo: Todas' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tipo: Todas' })).toBeCollapsed();
  });
});

describe('LinhaDeFiltros', () => {
  it('rola na horizontal, sem barra de rolagem', async () => {
    await render(
      <LinhaDeFiltros accessibilityLabel="Filtros">
        <ChipFiltro label="Tipo" value="todas" valorPadrao="todas" options={OPCOES} onChange={jest.fn()} />
      </LinhaDeFiltros>,
    );

    const linha = porTipo(ScrollView);
    expect(linha.props.horizontal).toBe(true);
    expect(linha.props.showsHorizontalScrollIndicator).toBe(false);
  });
});
