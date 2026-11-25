import { fireEvent, render, screen } from '@testing-library/react-native';

import { useProfileStore } from '@/features/auth/profileStore';

import { resumoFrota, viagem } from '../__mocks__/fixtures';
import { buscarInicioFrota } from '../inicioFrotaRepository';
import { InicioFrotaView, saida } from '../InicioFrotaView';

jest.setTimeout(15000);

const mockPush = jest.fn();

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]),
  };
});

jest.mock('@/supabase/client', () => ({ supabase: {} }));
jest.mock('../inicioFrotaRepository', () => ({ buscarInicioFrota: jest.fn() }));

const mockBuscar = jest.mocked(buscarInicioFrota);

beforeEach(() => {
  mockPush.mockReset();
  mockBuscar.mockReset();
  useProfileStore.setState({
    usuario: { id: 'g', nome: 'Gabriel Souza', email: 'g@empresa.com', perfil: 'Gestor de Frota', status: 'Ativo' },
    estado: 'pronto',
  });
});

async function renderPronto(resumo = resumoFrota()) {
  mockBuscar.mockResolvedValue({ ok: true, data: resumo });
  await render(<InicioFrotaView />);
  await screen.findByText('Viagens em andamento');
}

describe('InicioFrotaView', () => {
  it('cartão vivo: quantos estão na estrada, placa, trecho e motorista; o toque abre Viagens', async () => {
    await renderPronto();

    expect(screen.getByText('1 na estrada')).toBeOnTheScreen();
    expect(screen.getByText('RTA4B21 · Campinas → Belo Horizonte')).toBeOnTheScreen();
    expect(screen.getByText(/^Carlos Almeida · saiu /)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Viagens em andamento: 1 na estrada. Ver viagens' }));
    expect(mockPush).toHaveBeenCalledWith('/viagens');
  });

  it('ninguém na estrada: o cartão diz isso em vez de um zero solto', async () => {
    await renderPronto(resumoFrota({ viagensEmAndamento: [] }));

    expect(screen.getByText('Nenhum veículo na estrada')).toBeOnTheScreen();
  });

  it('contagem da frota por status; cada número abre Veículos', async () => {
    await renderPronto();

    await fireEvent.press(screen.getByRole('button', { name: '3 Disponíveis. Ver veículos' }));
    expect(screen.getByRole('button', { name: '2 Em viagem. Ver veículos' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '1 Oficina. Ver veículos' })).toBeOnTheScreen();
    expect(mockPush).toHaveBeenCalledWith('/frota/veiculos');
  });

  it('pede atenção: revisão pendente leva para Revisões de viagens', async () => {
    await renderPronto();

    await fireEvent.press(screen.getByRole('button', { name: '1 viagem para revisar' }));

    expect(mockPush).toHaveBeenCalledWith('/viagens/revisoes');
  });

  it('erro: mensagem e "Tentar novamente"', async () => {
    mockBuscar.mockResolvedValue({ ok: false, mensagem: 'Não foi possível carregar o início. Tente novamente.' });
    await render(<InicioFrotaView />);

    expect(await screen.findByText('Não foi possível carregar o início. Tente novamente.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen();
  });
});

describe('saida', () => {
  it('hoje: só a hora; outro dia: data e hora', () => {
    const local = new Date(2026, 10, 23, 8, 15);
    const deHoje = viagem({ data_inicio: local.toISOString() });
    expect(saida(deHoje, '2026-11-23')).toBe('saiu às 08:15');
    expect(saida(deHoje, '2026-11-24')).toBe('saiu em 23/11 às 08:15');
  });
});
