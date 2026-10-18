import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { RotaDetalheView } from '../RotaDetalheView';
import { buscarRotaPorId } from '../rotasRepository';
import type { Rota } from '../types';

jest.setTimeout(15000);

const mockPush = jest.fn();
// Guarda o callback do foco para o teste simular "voltei da edição para esta tela".
let mockAoFocar: (() => void) | null = null;

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => {
      mockAoFocar = callback;
      react.useEffect(callback, [callback]);
    },
  };
});

jest.mock('../rotasRepository', () => ({ buscarRotaPorId: jest.fn() }));

// O MapaRota real entra na tela; só o MapLibre (nativo) é trocado por Views, como em MapaRota.test.tsx.
jest.mock('@maplibre/maplibre-react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const peca = (testID: string) =>
    function PecaMockada(props: Record<string, unknown>) {
      return <View testID={testID} {...props} />;
    };
  return { Map: peca('maplibre-map'), Camera: peca('maplibre-camera'), GeoJSONSource: peca('maplibre-source'), Layer: peca('maplibre-layer') };
});

const mockBuscar = buscarRotaPorId as jest.MockedFunction<typeof buscarRotaPorId>;

const curitibaSp: Rota = {
  id: 'r1',
  cidade_origem: 'Curitiba',
  uf_origem: 'PR',
  cidade_destino: 'São Paulo',
  uf_destino: 'SP',
  distancia_estimada_km: 408.5,
  ativa: true,
};

beforeEach(() => {
  mockBuscar.mockReset();
  mockPush.mockReset();
  mockAoFocar = null;
});

async function renderComRota(rota: Rota = curitibaSp) {
  mockBuscar.mockResolvedValue({ ok: true, data: rota });
  render(<RotaDetalheView id={rota.id} />);
  await screen.findByText(`${rota.cidade_origem}/${rota.uf_origem} → ${rota.cidade_destino}/${rota.uf_destino}`);
}

describe('RotaDetalheView — sucesso', () => {
  // MAPA-14
  it('busca a rota pelo id e mostra trecho, distância com vírgula e o mapa', async () => {
    await renderComRota();

    expect(mockBuscar).toHaveBeenCalledWith('r1');
    expect(screen.getByText('Curitiba/PR → São Paulo/SP')).toBeOnTheScreen();
    expect(screen.getByText('408,5 km')).toBeOnTheScreen();
    expect(screen.getByTestId('maplibre-map')).toBeOnTheScreen();
    expect(screen.getByText('Origem: Curitiba/PR')).toBeOnTheScreen();
  });

  // MAPA-15
  it('rota inativa: "<n> km · Inativa"', async () => {
    await renderComRota({ ...curitibaSp, ativa: false });

    expect(screen.getByText('408,5 km · Inativa')).toBeOnTheScreen();
  });

  // MAPA-16
  it('"Editar" abre a edição da rota', async () => {
    await renderComRota();

    fireEvent.press(screen.getByRole('button', { name: 'Editar' }));

    expect(mockPush).toHaveBeenCalledWith('/rotas/r1/editar');
  });

  // MAPA-20
  it('ao voltar para a tela, busca a rota de novo e mostra o trecho atualizado', async () => {
    await renderComRota();
    mockBuscar.mockResolvedValue({ ok: true, data: { ...curitibaSp, cidade_destino: 'Joinville', uf_destino: 'SC' } });

    await act(async () => {
      mockAoFocar?.();
    });

    expect(mockBuscar).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Curitiba/PR → Joinville/SC')).toBeOnTheScreen();
    expect(screen.getByText('Destino: Joinville/SC')).toBeOnTheScreen();
  });

  // MAPA-20: o enquadramento só vale na montagem do mapa. Trecho novo precisa remontar o mapa,
  // voltar ao carregando e enquadrar o trecho novo, mesmo que o anterior já tivesse carregado.
  it('trecho editado: remonta o mapa, volta ao carregando e enquadra o trecho novo', async () => {
    await renderComRota();
    fireEvent(screen.getByTestId('maplibre-map'), 'didFinishLoadingMap');
    expect(screen.queryByLabelText('Carregando mapa')).not.toBeOnTheScreen();

    mockBuscar.mockResolvedValue({ ok: true, data: { ...curitibaSp, cidade_destino: 'Joinville', uf_destino: 'SC' } });
    await act(async () => {
      mockAoFocar?.();
    });

    expect(screen.getByLabelText('Carregando mapa')).toBeOnTheScreen();
    // Curitiba → Joinville no municipios.json: [oeste, sul, leste, norte].
    expect(screen.getByTestId('maplibre-camera').props.initialViewState.bounds).toEqual([
      -49.2646, -26.3045, -48.8487, -25.4195,
    ]);
  });
});

describe('RotaDetalheView — carregando e erro', () => {
  // MAPA-17
  it('carregando: indicador "Carregando rota"', () => {
    mockBuscar.mockReturnValue(new Promise(() => {}));
    render(<RotaDetalheView id="r1" />);

    expect(screen.getByLabelText('Carregando rota')).toBeOnTheScreen();
  });

  // MAPA-18
  it('erro: mensagem do repositório e "Tentar novamente" busca de novo', async () => {
    mockBuscar.mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar a rota. Tente novamente.' });
    render(<RotaDetalheView id="r1" />);

    expect(await screen.findByText('Não foi possível carregar')).toBeOnTheScreen();
    expect(screen.getByText('Não foi possível carregar a rota. Tente novamente.')).toBeOnTheScreen();

    mockBuscar.mockResolvedValueOnce({ ok: true, data: curitibaSp });
    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Curitiba/PR → São Paulo/SP')).toBeOnTheScreen();
    expect(mockBuscar).toHaveBeenCalledTimes(2);
  });

  // MAPA-22
  it('rota não encontrada: mostra "Rota não encontrada."', async () => {
    mockBuscar.mockResolvedValue({ ok: false, mensagem: 'Rota não encontrada.' });
    render(<RotaDetalheView id="nao-existe" />);

    expect(await screen.findByText('Rota não encontrada.')).toBeOnTheScreen();
  });
});

describe('RotaDetalheView — resto da tela usável sem mapa (MAPA-23)', () => {
  it('cidade fora do dataset: mensagem do mapa, e trecho, distância e "Editar" continuam', async () => {
    await renderComRota({ ...curitibaSp, cidade_origem: 'Curitba' });

    expect(
      screen.getByText('Não encontramos Curitba/PR no mapa. Confira o nome da cidade na edição da rota.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('408,5 km')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeOnTheScreen();
  });

  it('falha do mapa: erro do mapa, e trecho, distância e "Editar" continuam', async () => {
    await renderComRota();

    fireEvent(screen.getByTestId('maplibre-map'), 'didFailLoadingMap');

    expect(screen.getByText('Não foi possível carregar o mapa')).toBeOnTheScreen();
    expect(screen.getByText('Curitiba/PR → São Paulo/SP')).toBeOnTheScreen();
    expect(screen.getByText('408,5 km')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeOnTheScreen();
  });
});
