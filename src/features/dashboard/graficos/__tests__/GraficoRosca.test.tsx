import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Path } from 'react-native-svg';

import { todosPorTipo } from '@/testing/componentes';
import { colors } from '@/ui/tokens';

import { GraficoRosca } from '../GraficoRosca';
import type { FatiaDespesa } from '../queries';

const FATIAS: FatiaDespesa[] = [
  { categoria_id: 'c-1', titulo: 'Combustível', total_centavos: 60113, percentual: 60.1 },
  { categoria_id: 'c-2', titulo: 'Pedágio', total_centavos: 29887, percentual: 29.9 },
  { categoria_id: null, titulo: 'Outras', total_centavos: 10000, percentual: 10 },
];

function linha(nome: RegExp) {
  return screen.getByRole('button', { name: nome });
}

describe('GraficoRosca', () => {
  it('desenha uma fatia por categoria e abre na maior despesa', async () => {
    await render(<GraficoRosca fatias={FATIAS} />);

    expect(screen.getByTestId('fatia-0')).toBeOnTheScreen();
    expect(screen.getByTestId('fatia-2')).toBeOnTheScreen();
    expect(screen.getByText('R$ 601,13')).toBeOnTheScreen();
    expect(linha(/^Combustível/)).toBeSelected();
  });

  it('tocar numa fatia mostra categoria, valor e percentual no centro (GRAF-13)', async () => {
    await render(<GraficoRosca fatias={FATIAS} />);

    await fireEvent.press(screen.getByTestId('fatia-1'));

    expect(screen.getByText('R$ 298,87')).toBeOnTheScreen();
    // O percentual aparece no centro e na legenda.
    expect(screen.getAllByText('29,9%')).toHaveLength(2);
    expect(screen.getAllByText('Pedágio')).toHaveLength(2);
    expect(linha(/^Pedágio/)).toBeSelected();
    expect(linha(/^Combustível/)).not.toBeSelected();
  });

  it('tocar na linha da legenda também escolhe a fatia (GRAF-13)', async () => {
    await render(<GraficoRosca fatias={FATIAS} />);

    await fireEvent.press(linha(/^Outras/));

    expect(screen.getByText('R$ 100,00')).toBeOnTheScreen();
    expect(screen.getAllByText('10,0%')).toHaveLength(2);
  });

  it('a legenda anuncia categoria, valor e percentual de cada fatia', async () => {
    await render(<GraficoRosca fatias={FATIAS} />);

    expect(linha(/^Combustível: R\$ 601,13, 60,1%$/)).toBeOnTheScreen();
  });

  it('cada linha da legenda tem o alvo de toque de 44pt', async () => {
    await render(<GraficoRosca fatias={FATIAS} />);

    expect(StyleSheet.flatten(linha(/^Pedágio/).props.style).minHeight).toBe(44);
  });

  it('as fatias usam as cores dos tokens, e "Outras" a mais apagada (GRAF-19)', async () => {
    await render(<GraficoRosca fatias={FATIAS} />);

    // A cor que a tela passa ao Path (o elemento nativo recebe a cor já convertida em número).
    const cores = todosPorTipo(Path).map((fatia) => fatia.props.fill);

    expect(cores).toEqual([colors.accent, colors.inverted, colors.textMuted]);
  });

  it('uma categoria só (100%) desenha o anel inteiro', async () => {
    await render(<GraficoRosca fatias={[{ categoria_id: 'c-1', titulo: 'Combustível', total_centavos: 1234, percentual: 100 }]} />);

    // Anel inteiro = dois círculos no mesmo Path (dois "M").
    expect(String(screen.getByTestId('fatia-0').props.d).match(/M /g)).toHaveLength(2);
    expect(screen.getAllByText('100,0%')).toHaveLength(2);
  });
});
