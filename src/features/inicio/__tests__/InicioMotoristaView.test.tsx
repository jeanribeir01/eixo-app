import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useProfileStore } from '@/features/auth/profileStore';
import { useSyncStore } from '@/features/viagens/syncStore';
import { listarViagens } from '@/features/viagens/viagensRepository';
import { horaLocal } from '@/lib/datas';

import { viagem } from '../__mocks__/fixtures';
import { InicioMotoristaView } from '../InicioMotoristaView';

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
jest.mock('@/features/viagens/viagensRepository', () => ({ listarViagens: jest.fn() }));

const mockListar = jest.mocked(listarViagens);

const concluida = viagem({
  id: 'vg0',
  status: 'Finalizada',
  hodometro_final: 125112,
  km_rodado: 532,
  data_inicio: '2026-11-20T11:00:00.000Z',
  data_fim: '2026-11-20T19:00:00.000Z',
});

beforeEach(() => {
  mockPush.mockReset();
  mockListar.mockReset();
  useProfileStore.setState({
    usuario: { id: 'm1', nome: 'Carlos Almeida', email: 'carlos@empresa.com', perfil: 'Motorista', status: 'Ativo' },
    estado: 'pronto',
  });
  // Online e sem pendência: o indicador de sincronização não aparece e não puxa o status real.
  useSyncStore.setState({
    isOnline: true,
    pendentes: 0,
    comErro: 0,
    emRevisao: 0,
    sincronizando: false,
    ultimoErro: null,
    ultimaSincronizacaoEm: null,
    atualizarStatus: jest.fn(),
  });
});

async function renderCom(viagens = [viagem(), concluida]) {
  mockListar.mockResolvedValue({ ok: true, data: viagens });
  await render(<InicioMotoristaView />);
  await screen.findByText('Suas viagens');
}

describe('InicioMotoristaView', () => {
  it('lê só as viagens do próprio motorista', async () => {
    await renderCom();

    expect(mockListar).toHaveBeenCalledWith({ status: 'Todos', motorista_id: 'm1' });
  });

  it('viagem em andamento em destaque: placa, trecho, saída e a próxima etapa', async () => {
    await renderCom();

    expect(screen.getByText('RTA4B21')).toBeOnTheScreen();
    expect(screen.getByText('Campinas → Belo Horizonte')).toBeOnTheScreen();
    expect(screen.getByText(`Saída às ${horaLocal('2026-11-23T11:15:00.000Z')} · hodômetro 124.580 km`)).toBeOnTheScreen();
    expect(screen.getByText('Próxima etapa: registrar a chegada')).toBeOnTheScreen();
    expect(screen.getByText('Na estrada')).toBeOnTheScreen();
  });

  it('"Finalizar viagem" abre o fechamento da viagem em andamento', async () => {
    await renderCom();

    await fireEvent.press(screen.getByRole('button', { name: 'Finalizar viagem' }));

    expect(mockPush).toHaveBeenCalledWith('/viagens/vg1/fechar');
  });

  it('sem viagem em andamento, o destaque convida a abrir uma', async () => {
    await renderCom([concluida]);

    expect(screen.getByText('Nenhuma viagem em andamento')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Finalizar viagem' })).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Abrir viagem' }));
    expect(mockPush).toHaveBeenCalledWith('/viagens/nova');
  });

  it('histórico: as outras viagens com a data e os km rodados', async () => {
    await renderCom();

    expect(screen.getByText('RTA4B21 · Campinas → Belo Horizonte')).toBeOnTheScreen();
    expect(screen.getByText('20/11/2026 · 532 km')).toBeOnTheScreen();
  });

  it('viagem em revisão no histórico ganha o selo "Em revisão"', async () => {
    await renderCom([viagem({ ...concluida, em_revisao: true })]);

    expect(screen.getByText('Em revisão')).toBeOnTheScreen();
  });

  it('sem histórico, diz o que vai aparecer ali', async () => {
    await renderCom([viagem()]);

    expect(screen.getByText('As viagens concluídas aparecem aqui, com a data e os km rodados.')).toBeOnTheScreen();
  });

  it('terminou uma sincronização: relê as viagens do aparelho sem voltar ao skeleton', async () => {
    await renderCom([viagem()]);
    expect(mockListar).toHaveBeenCalledTimes(1);

    mockListar.mockResolvedValue({ ok: true, data: [viagem(), concluida] });
    await act(async () => useSyncStore.setState({ ultimaSincronizacaoEm: Date.now() }));

    expect(mockListar).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('20/11/2026 · 532 km')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Carregando suas viagens')).not.toBeOnTheScreen();
  });

  it('erro ao ler: mensagem e "Tentar novamente"', async () => {
    mockListar.mockResolvedValue({ ok: false, mensagem: 'Não foi possível ler as viagens.' });
    await render(<InicioMotoristaView />);

    expect(await screen.findByText('Não foi possível carregar suas viagens')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen();
  });
});
