import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import ViagensRoute from '../../app/(app)/(tabs)/viagens';
import VeiculoDetalheRoute from '../../app/(app)/frota/[id]/index';
import VeiculosRoute from '../../app/(app)/frota/veiculos';
import ManutencoesRoute from '../../app/(app)/manutencoes/index';
import NovaManutencaoRoute from '../../app/(app)/manutencoes/nova';
import EditarRotaRoute from '../../app/(app)/rotas/[id]/editar';
import RotasRoute from '../../app/(app)/rotas/index';
import NovaRotaRoute from '../../app/(app)/rotas/nova';
import FecharViagemRoute from '../../app/(app)/viagens/[id]/fechar';
import AbrirViagemRoute from '../../app/(app)/viagens/nova';

// NAV5-11 (EIX-77): cada rota só renderiza a view da feature. As views são substituídas por stubs que
// mostram o nome e as props: quando a EIX-38, a EIX-39 e a EIX-40 trocarem os placeholders pelas telas
// reais, este teste continua valendo sem ninguém mexer nele. O prefixo `mock` deixa o jest.mock usar a função.
function mockStub(nome: string) {
  return (props: Record<string, unknown>) => <Text>{`${nome} ${JSON.stringify(props)}`}</Text>;
}

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'id-1' }) }));
jest.mock('@/features/veiculos/VeiculosListView', () => ({ VeiculosListView: mockStub('VeiculosListView') }));
jest.mock('@/features/rotas/RotasListView', () => ({ RotasListView: mockStub('RotasListView') }));
jest.mock('@/features/rotas/RotaFormView', () => ({ RotaFormView: mockStub('RotaFormView') }));
jest.mock('@/features/manutencao/ManutencoesListView', () => ({ ManutencoesListView: mockStub('ManutencoesListView') }));
jest.mock('@/features/manutencao/ManutencaoFormView', () => ({ ManutencaoFormView: mockStub('ManutencaoFormView') }));
jest.mock('@/features/manutencao/VeiculoDetalheView', () => ({ VeiculoDetalheView: mockStub('VeiculoDetalheView') }));
jest.mock('@/features/viagens/ViagensListView', () => ({ ViagensListView: mockStub('ViagensListView') }));
jest.mock('@/features/viagens/AbrirViagemView', () => ({ AbrirViagemView: mockStub('AbrirViagemView') }));
jest.mock('@/features/viagens/FecharViagemView', () => ({ FecharViagemView: mockStub('FecharViagemView') }));

describe('rotas da S5 renderizam a view da feature (NAV5-11)', () => {
  it.each([
    ['frota/veiculos', VeiculosRoute, 'VeiculosListView {}'],
    ['rotas/index', RotasRoute, 'RotasListView {}'],
    ['rotas/nova', NovaRotaRoute, 'RotaFormView {}'],
    ['rotas/[id]/editar', EditarRotaRoute, 'RotaFormView {"rotaId":"id-1"}'],
    ['manutencoes/index', ManutencoesRoute, 'ManutencoesListView {}'],
    ['manutencoes/nova', NovaManutencaoRoute, 'ManutencaoFormView {}'],
    // Detalhe do veículo com o histórico (EIX-39, MAN-33).
    ['frota/[id]/index', VeiculoDetalheRoute, 'VeiculoDetalheView {"veiculoId":"id-1"}'],
    ['(tabs)/viagens', ViagensRoute, 'ViagensListView {}'],
    ['viagens/nova', AbrirViagemRoute, 'AbrirViagemView {}'],
    ['viagens/[id]/fechar', FecharViagemRoute, 'FecharViagemView {"viagemId":"id-1"}'],
  ])('%s', (_rota, Rota, esperado) => {
    render(<Rota />);

    expect(screen.getByText(esperado)).toBeOnTheScreen();
  });
});
