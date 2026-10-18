import { fireEvent, render, screen } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';

import { colors, spacing } from '@/ui';

import { MapaRota } from '../MapaRota';

jest.setTimeout(15000);

// O MapLibre é nativo e não roda no Jest (critério de aceite da EIX-80: mapa mockado). Cada peça
// vira uma View com testID que repassa as props, para o teste ler o que a tela mandou desenhar e
// disparar os eventos de carga (`didFinishLoadingMap`, `didFailLoadingMap`).
jest.mock('@maplibre/maplibre-react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const peca = (testID: string) =>
    function PecaMockada(props: Record<string, unknown>) {
      const id = typeof props.id === 'string' ? `${testID}-${props.id}` : testID;
      return <View testID={id} {...props} />;
    };
  return {
    Map: peca('maplibre-map'),
    Camera: peca('maplibre-camera'),
    GeoJSONSource: peca('maplibre-source'),
    Layer: peca('maplibre-layer'),
  };
});

// O `useWindowDimensions` do pacote react-native é um getter que lê este módulo: mockar aqui troca a
// largura da tela vista pelo componente.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockDimensoes = useWindowDimensions as jest.MockedFunction<typeof useWindowDimensions>;

// Coordenadas do municipios.json real, em [longitude, latitude].
const CURITIBA = [-49.2646, -25.4195];
const SAO_PAULO = [-46.6395, -23.5329];
const JOINVILLE = [-48.8487, -26.3045];

const curitibaSp = { cidade_origem: 'Curitiba', uf_origem: 'PR', cidade_destino: 'São Paulo', uf_destino: 'SP' } as const;

function larguraDaTela(width: number) {
  mockDimensoes.mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });
}

type Feicao = { geometry: { type: string; coordinates: unknown }; properties: { papel: string } };

function feicoes(): Feicao[] {
  return screen.getByTestId('maplibre-source-trecho').props.data.features;
}

beforeEach(() => {
  larguraDaTela(390);
});

describe('MapaRota — com coordenadas', () => {
  // MAPA-01
  it('desenha a origem, o destino e a linha reta entre eles', () => {
    render(<MapaRota rota={curitibaSp} />);

    const lista = feicoes();
    expect(lista).toContainEqual({ type: 'Feature', geometry: { type: 'Point', coordinates: CURITIBA }, properties: { papel: 'origem' } });
    expect(lista).toContainEqual({ type: 'Feature', geometry: { type: 'Point', coordinates: SAO_PAULO }, properties: { papel: 'destino' } });
    expect(lista).toContainEqual({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [CURITIBA, SAO_PAULO] },
      properties: { papel: 'trecho' },
    });
  });

  // MAPA-02
  it('enquadra a caixa dos dois pontos com folga de spacing.xl', () => {
    render(<MapaRota rota={curitibaSp} />);

    expect(screen.getByTestId('maplibre-camera').props.initialViewState).toEqual({
      bounds: [CURITIBA[0], CURITIBA[1], SAO_PAULO[0], SAO_PAULO[1]],
      padding: { top: spacing.xl, right: spacing.xl, bottom: spacing.xl, left: spacing.xl },
    });
  });

  // MAPA-02: a caixa vai de oeste a leste e de sul a norte mesmo quando o destino fica a sudoeste
  it('enquadra certo com o destino a sudoeste da origem', () => {
    render(<MapaRota rota={{ cidade_origem: 'São Paulo', uf_origem: 'SP', cidade_destino: 'Curitiba', uf_destino: 'PR' }} />);

    expect(screen.getByTestId('maplibre-camera').props.initialViewState.bounds).toEqual([
      CURITIBA[0],
      CURITIBA[1],
      SAO_PAULO[0],
      SAO_PAULO[1],
    ]);
  });

  // MAPA-02: com a origem a noroeste (Curitiba → Joinville), o sul e o norte vêm da latitude de cada
  // ponto, não do mesmo canto da longitude. Pega uma caixa montada pelos cantos em vez de min/max.
  it('enquadra certo com a origem a noroeste do destino', () => {
    render(<MapaRota rota={{ cidade_origem: 'Curitiba', uf_origem: 'PR', cidade_destino: 'Joinville', uf_destino: 'SC' }} />);

    expect(screen.getByTestId('maplibre-camera').props.initialViewState.bounds).toEqual([
      CURITIBA[0],
      JOINVILLE[1],
      JOINVILLE[0],
      CURITIBA[1],
    ]);
  });

  // MAPA-04
  it('linha em accentEdge; origem com miolo surface e destino preenchido de accent, borda accentEdge', () => {
    render(<MapaRota rota={curitibaSp} />);

    const linha = screen.getByTestId('maplibre-layer-trecho-linha').props.paint;
    expect(linha['line-color']).toBe(colors.accentEdge);

    const pontos = screen.getByTestId('maplibre-layer-trecho-pontos').props.paint;
    expect(pontos['circle-color']).toEqual(['match', ['get', 'papel'], 'origem', colors.surface, colors.accent]);
    expect(pontos['circle-stroke-color']).toBe(colors.accentEdge);
  });

  // MAPA-04: nenhuma cor fora dos tokens
  it('não usa nenhuma cor fora de accent, accentEdge e surface', () => {
    render(<MapaRota rota={curitibaSp} />);

    const pinturas = [
      screen.getByTestId('maplibre-layer-trecho-linha').props.paint,
      screen.getByTestId('maplibre-layer-trecho-pontos').props.paint,
    ];
    const cores = JSON.stringify(pinturas).match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(cores.length).toBeGreaterThan(0);
    for (const cor of cores) {
      expect([colors.accent, colors.accentEdge, colors.surface]).toContain(cor);
    }
  });

  // MAPA-05
  it('legenda em texto com a origem e o destino', () => {
    render(<MapaRota rota={curitibaSp} />);

    expect(screen.getByText('Origem: Curitiba/PR')).toBeOnTheScreen();
    expect(screen.getByText('Destino: São Paulo/SP')).toBeOnTheScreen();
  });

  // MAPA-10
  it('desliga arrastar, zoom, girar e inclinar', () => {
    render(<MapaRota rota={curitibaSp} />);

    const mapa = screen.getByTestId('maplibre-map').props;
    expect(mapa.dragPan).toBe(false);
    expect(mapa.touchZoom).toBe(false);
    expect(mapa.doubleTapZoom).toBe(false);
    expect(mapa.doubleTapHoldZoom).toBe(false);
    expect(mapa.touchRotate).toBe(false);
    expect(mapa.touchPitch).toBe(false);
  });

  // MAPA-12 e atribuição (Assumptions da spec)
  it('usa o estilo positron do OpenFreeMap e mantém a atribuição do OpenStreetMap', () => {
    render(<MapaRota rota={curitibaSp} />);

    const mapa = screen.getByTestId('maplibre-map').props;
    expect(mapa.mapStyle).toBe('https://tiles.openfreemap.org/styles/positron');
    expect(mapa.attribution).not.toBe(false);
  });
});

describe('MapaRota — proporção (MAPA-11, RNF02)', () => {
  it('celular (abaixo de 600 pt): 4:3', () => {
    larguraDaTela(390);
    render(<MapaRota rota={curitibaSp} />);

    expect(screen.getByTestId('mapa-rota-area')).toHaveStyle({ aspectRatio: 4 / 3 });
  });

  it('tablet (600 pt ou mais): 16:9', () => {
    larguraDaTela(600);
    render(<MapaRota rota={curitibaSp} />);

    expect(screen.getByTestId('mapa-rota-area')).toHaveStyle({ aspectRatio: 16 / 9 });
  });
});

describe('MapaRota — carregando e erro', () => {
  // MAPA-06
  it('mostra "Carregando mapa" até o mapa terminar de carregar', () => {
    render(<MapaRota rota={curitibaSp} />);

    expect(screen.getByLabelText('Carregando mapa')).toBeOnTheScreen();

    fireEvent(screen.getByTestId('maplibre-map'), 'didFinishLoadingMap');

    expect(screen.queryByLabelText('Carregando mapa')).not.toBeOnTheScreen();
    expect(screen.getByTestId('maplibre-map')).toBeOnTheScreen();
  });

  // MAPA-07
  it('falha do mapa: esconde o mapa e mostra a mensagem com "Tentar novamente"', () => {
    render(<MapaRota rota={curitibaSp} />);

    fireEvent(screen.getByTestId('maplibre-map'), 'didFailLoadingMap');

    expect(screen.queryByTestId('maplibre-map')).not.toBeOnTheScreen();
    expect(screen.getByText('Não foi possível carregar o mapa')).toBeOnTheScreen();
    expect(screen.getByText('Verifique a conexão e tente de novo.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen();
  });

  // MAPA-08
  it('"Tentar novamente" monta o mapa de novo e volta ao carregando', () => {
    render(<MapaRota rota={curitibaSp} />);
    fireEvent(screen.getByTestId('maplibre-map'), 'didFailLoadingMap');

    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(screen.getByTestId('maplibre-map')).toBeOnTheScreen();
    expect(screen.getByLabelText('Carregando mapa')).toBeOnTheScreen();
    expect(screen.queryByText('Não foi possível carregar o mapa')).not.toBeOnTheScreen();
  });
});

describe('MapaRota — sem coordenadas (MAPA-09)', () => {
  it('cidade de origem fora do dataset: mensagem e nenhum mapa', () => {
    render(<MapaRota rota={{ ...curitibaSp, cidade_origem: 'Curitba' }} />);

    expect(
      screen.getByText('Não encontramos Curitba/PR no mapa. Confira o nome da cidade na edição da rota.'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('maplibre-map')).not.toBeOnTheScreen();
    expect(screen.queryByText(/São Paulo\/SP no mapa/)).not.toBeOnTheScreen();
  });

  it('as duas fora do dataset: uma mensagem por cidade, origem primeiro', () => {
    render(<MapaRota rota={{ cidade_origem: 'Curitba', uf_origem: 'PR', cidade_destino: 'Sao Paolo', uf_destino: 'SP' }} />);

    const mensagens = screen.getAllByText(/^Não encontramos/).map((elemento) => elemento.props.children);
    expect(mensagens).toEqual([
      'Não encontramos Curitba/PR no mapa. Confira o nome da cidade na edição da rota.',
      'Não encontramos Sao Paolo/SP no mapa. Confira o nome da cidade na edição da rota.',
    ]);
    expect(screen.queryByTestId('maplibre-map')).not.toBeOnTheScreen();
  });
});

describe('MapaRota — mesmo ponto (MAPA-21)', () => {
  it('origem e destino na mesma coordenada: centraliza com zoom 10, sem caixa', () => {
    render(<MapaRota rota={{ cidade_origem: 'Curitiba', uf_origem: 'PR', cidade_destino: 'curitiba', uf_destino: 'PR' }} />);

    expect(screen.getByTestId('maplibre-camera').props.initialViewState).toEqual({ center: CURITIBA, zoom: 10 });
  });
});
