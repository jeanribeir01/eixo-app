import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useProfileStore } from '@/features/auth/profileStore';
import type { PerfilNome } from '@/features/auth/permissions';
import { viagem } from '@/features/inicio/__mocks__/fixtures';

import { duracao, ViagemDetalheView } from '../ViagemDetalheView';
import { buscarViagemPorId } from '../viagensRepository';

jest.setTimeout(15000);

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush, back: mockBack }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]),
  };
});

jest.mock('../viagensRepository', () => ({ buscarViagemPorId: jest.fn() }));

const mockBuscar = buscarViagemPorId as jest.MockedFunction<typeof buscarViagemPorId>;

// Saiu 08:15 e chegou 16:45 (horário de Brasília): 8 h 30 min e 432 km de 590 estimados.
const concluida = viagem({
  status: 'Finalizada',
  data_inicio: '2026-11-23T11:15:00.000Z',
  data_fim: '2026-11-23T19:45:00.000Z',
  hodometro_final: 125012,
  km_rodado: 432,
});

function entrarComo(perfil: PerfilNome) {
  useProfileStore.setState({
    usuario: { id: 'u', nome: 'Ana', email: 'ana@empresa.com', perfil, status: 'Ativo' },
    estado: 'pronto',
  });
}

async function renderComViagem(dados = concluida) {
  mockBuscar.mockResolvedValue({ ok: true, data: dados });
  await render(<ViagemDetalheView viagemId={dados.id} />);
  await screen.findByText('Campinas → Belo Horizonte');
}

beforeEach(() => {
  mockPush.mockReset();
  mockBack.mockReset();
  mockBuscar.mockReset();
  entrarComo('Admin');
});

describe('ViagemDetalheView — a viagem', () => {
  it('concluída: trecho, quem foi, km rodados contra a estimativa, horários e hodômetro', async () => {
    await renderComViagem();

    expect(screen.getByText('Concluída')).toBeOnTheScreen();
    expect(screen.getByText('Carlos Almeida · RTA4B21')).toBeOnTheScreen();
    expect(screen.getByText('Km rodados')).toBeOnTheScreen();
    expect(screen.getByText('432 km')).toBeOnTheScreen();
    expect(screen.getByText('Estimativa da rota: 590 km')).toBeOnTheScreen();
    expect(screen.getByText(/^23\/11 às \d{2}:15$/)).toBeOnTheScreen();
    expect(screen.getByText(/^23\/11 às \d{2}:45$/)).toBeOnTheScreen();
    expect(screen.getByText('8 h 30 min')).toBeOnTheScreen();
    expect(screen.getByText('124.580')).toBeOnTheScreen();
    expect(screen.getByText('125.012')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Finalizar viagem' })).not.toBeOnTheScreen();
  });

  it('na estrada: há quanto tempo, sem chegada, e "Finalizar viagem" abre o fechamento', async () => {
    await renderComViagem(viagem());

    expect(screen.getByText('Na estrada')).toBeOnTheScreen();
    expect(screen.getByText('Na estrada há')).toBeOnTheScreen();
    expect(screen.queryByText('Chegada')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Finalizar viagem' }));

    expect(mockPush).toHaveBeenCalledWith('/viagens/vg1/fechar');
  });

  it('cancelada: a data do fim vira "Cancelada em"', async () => {
    await renderComViagem(viagem({ status: 'Cancelada', data_fim: '2026-11-23T13:00:00.000Z' }));

    expect(screen.getAllByText('Cancelada').length).toBeGreaterThan(0);
    expect(screen.getByText('Cancelada em')).toBeOnTheScreen();
    expect(screen.queryByText('Chegada')).not.toBeOnTheScreen();
  });

  it('rodou bem acima da estimativa: aviso para conferir o hodômetro', async () => {
    await renderComViagem({ ...concluida, km_rodado: 800, hodometro_final: 125380 });

    expect(screen.getByText('Acima da rota')).toBeOnTheScreen();
    expect(screen.getByText('Rodou 800 km, e a rota estima 590 km. Confira o hodômetro final.')).toBeOnTheScreen();
  });

  it('em revisão: o aviso diz por quê e leva às revisões', async () => {
    await renderComViagem({ ...concluida, em_revisao: true });

    expect(screen.getByText('Em revisão')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver revisões' }));

    expect(mockPush).toHaveBeenCalledWith('/viagens/revisoes');
  });
});

describe('ViagemDetalheView — o que abre a partir daqui', () => {
  it('Admin: o veículo abre o Detalhe do veículo e os lançamentos abrem a ponte com o Caixa', async () => {
    await renderComViagem();

    await fireEvent.press(screen.getByRole('button', { name: 'Ver veículo RTA4B21' }));
    expect(mockPush).toHaveBeenCalledWith('/frota/v1');

    await fireEvent.press(screen.getByRole('button', { name: 'Lançamentos da viagem' }));
    expect(mockPush).toHaveBeenCalledWith('/viagens/vg1/lancamentos');
  });

  it('Gestor de Frota: vê o veículo, mas não os lançamentos (não lê movimentação)', async () => {
    entrarComo('Gestor de Frota');
    await renderComViagem();

    expect(screen.getByRole('button', { name: 'Ver veículo RTA4B21' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Lançamentos da viagem' })).not.toBeOnTheScreen();
  });

  it('Motorista: só a viagem, sem linhas para telas que ele não abre', async () => {
    entrarComo('Motorista');
    await renderComViagem({ ...concluida, em_revisao: true });

    expect(screen.queryByText('Desta viagem')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ver revisões' })).not.toBeOnTheScreen();
  });
});

describe('ViagemDetalheView — carga', () => {
  it('carregando: skeleton', async () => {
    mockBuscar.mockReturnValue(new Promise(() => {}));
    await render(<ViagemDetalheView viagemId="vg1" />);

    expect(screen.getByLabelText('Carregando viagem')).toBeOnTheScreen();
  });

  it('erro: mensagem, e "Tentar novamente" busca de novo', async () => {
    mockBuscar.mockResolvedValueOnce({ ok: false, mensagem: 'Viagem não encontrada.' });
    await render(<ViagemDetalheView viagemId="vg1" />);
    await screen.findByText('Viagem não encontrada.');

    mockBuscar.mockResolvedValue({ ok: true, data: concluida });
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' })));
    expect(screen.getByText('432 km')).toBeOnTheScreen();
  });

  it('"Voltar" no erro volta para a lista', async () => {
    mockBuscar.mockResolvedValue({ ok: false, mensagem: 'Viagem não encontrada.' });
    await render(<ViagemDetalheView viagemId="vg1" />);
    await screen.findByText('Viagem não encontrada.');

    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));

    expect(mockBack).toHaveBeenCalled();
  });
});

describe('duracao', () => {
  it.each([
    ['2026-11-23T10:00:00Z', '2026-11-23T10:45:00Z', '45 min'],
    ['2026-11-23T10:00:00Z', '2026-11-23T13:00:00Z', '3 h'],
    ['2026-11-23T10:00:00Z', '2026-11-23T18:30:00Z', '8 h 30 min'],
    ['2026-11-23T10:00:00Z', '2026-11-24T14:10:00Z', '1 dia 4 h'],
    ['2026-11-23T10:00:00Z', '2026-11-25T10:00:00Z', '2 dias'],
    // Relógio do aparelho atrasado: nunca tempo negativo.
    ['2026-11-23T10:00:00Z', '2026-11-23T09:00:00Z', '0 min'],
  ])('%s → %s: %s', (inicio, fim, esperado) => {
    expect(duracao(inicio, fim)).toBe(esperado);
  });
});
