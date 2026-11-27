import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { useProfileStore } from '@/features/auth/profileStore';
import { buscarFrotaAgora, type FrotaAgora, type VeiculoAgora } from '@/features/frota-agora/frotaAgora';
import { manutencao, viagem } from '@/features/inicio/__mocks__/fixtures';
import type { Veiculo } from '@/features/veiculos/types';
import { colors, radius } from '@/ui';

import { FrotaHubView } from '../FrotaHubView';

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

jest.mock('@/features/frota-agora/frotaAgora', () => ({ buscarFrotaAgora: jest.fn() }));

const mockBuscar = buscarFrotaAgora as jest.MockedFunction<typeof buscarFrotaAgora>;

function veiculo(id: string, placa: string, modelo: string, status: Veiculo['status']): Veiculo {
  return { id, placa, marca: 'Marca', modelo, ano_fabricacao: 2020, capacidade_carga: 30, status };
}

const linhas: VeiculoAgora[] = [
  { veiculo: veiculo('v1', 'RTA4B21', 'FH 540', 'EmViagem'), situacao: { tipo: 'estrada', viagem: viagem() } },
  { veiculo: veiculo('v2', 'PWX9J13', 'XF 530', 'EmManutencao'), situacao: { tipo: 'oficina', manutencao: manutencao(), dias: 8 } },
  { veiculo: veiculo('v3', 'QKP7E58', 'R 450', 'Disponivel'), situacao: { tipo: 'parado', dias: 10 } },
  { veiculo: veiculo('v4', 'ABC1234', 'Actros 2651', 'Disponivel'), situacao: { tipo: 'parado', dias: 1 } },
];

const frota: FrotaAgora = { contagem: { estrada: 1, oficina: 1, parado: 2 }, veiculos: linhas };

const NOME_DO_RESUMO = 'Frota agora: 4 veículos, 1 na estrada, 2 disponíveis, 1 na oficina. Ver veículos';

beforeEach(() => {
  mockPush.mockReset();
  mockBuscar.mockReset();
  useProfileStore.setState({ usuario: null, estado: 'pronto' });
});

async function renderComFrota(dados: FrotaAgora = frota) {
  mockBuscar.mockResolvedValue({ ok: true, data: dados });
  await render(<FrotaHubView />);
  await screen.findByText('Veículos agora');
}

describe('FrotaHubView — a frota agora', () => {
  it('título da aba no conteúdo e o resumo da frota num cartão de destaque', async () => {
    await renderComFrota();

    expect(screen.getByText('Frota')).toBeOnTheScreen();
    expect(screen.getByText('4 veículos')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: NOME_DO_RESUMO })).toHaveStyle({ borderRadius: radius.feature });
  });

  it('a barra divide a frota na proporção de cada situação; a legenda diz os números em texto', async () => {
    await renderComFrota();

    const fatias = screen.getByTestId('barra-frota', { includeHiddenElements: true }).children;
    expect(fatias.map((fatia) => typeof fatia !== 'string' && StyleSheet.flatten(fatia.props.style))).toEqual([
      { flex: 1, backgroundColor: colors.accent },
      { flex: 2, backgroundColor: colors.success },
      { flex: 1, backgroundColor: colors.warning },
    ]);
    expect(screen.getByText('1 na estrada')).toBeOnTheScreen();
    expect(screen.getByText('2 disponíveis')).toBeOnTheScreen();
    expect(screen.getByText('1 na oficina')).toBeOnTheScreen();
  });

  it('tocar no resumo abre Veículos', async () => {
    await renderComFrota();

    await fireEvent.press(screen.getByRole('button', { name: NOME_DO_RESUMO }));

    expect(mockPush).toHaveBeenCalledWith('/frota/veiculos');
  });

  it('cada veículo diz o que está fazendo, numa linha que cabe na tela', async () => {
    await renderComFrota();

    expect(screen.getByText('Na estrada · Campinas → Belo Horizonte')).toBeOnTheScreen();
    expect(screen.getByText('Na oficina há 8 dias · Retífica do motor')).toBeOnTheScreen();
    expect(screen.getByText('Parado há 10 dias · R 450')).toBeOnTheScreen();
    expect(screen.getByText('Parado há 1 dia · Actros 2651')).toBeOnTheScreen();
    // Placa antiga com o hífen da máscara.
    expect(screen.getByText('ABC-1234')).toBeOnTheScreen();
  });

  it('tocar num veículo abre o Detalhe do veículo', async () => {
    await renderComFrota();

    await fireEvent.press(screen.getByRole('button', { name: 'PWX9J13' }));

    expect(mockPush).toHaveBeenCalledWith('/frota/v2');
  });

  it.each([
    [{ tipo: 'estrada', viagem: null }, 'Na estrada'],
    [{ tipo: 'oficina', manutencao: null, dias: null }, 'Na oficina'],
    [{ tipo: 'oficina', manutencao: null, dias: 0 }, 'Na oficina desde hoje'],
    [{ tipo: 'parado', dias: 0 }, 'Disponível desde hoje · FH 540'],
    [{ tipo: 'parado', dias: null }, 'Disponível · FH 540'],
  ] as const)('situação sem todos os dados (%o): "%s"', async (situacao, texto) => {
    await renderComFrota({
      contagem: { estrada: 0, oficina: 0, parado: 1 },
      veiculos: [{ veiculo: veiculo('v9', 'XYZ9Z99', 'FH 540', 'Disponivel'), situacao }],
    });

    expect(screen.getByText(texto)).toBeOnTheScreen();
  });

  it('frota vazia: o resumo diz zero, sem barra, e a lista aponta o cadastro', async () => {
    await renderComFrota({ contagem: { estrada: 0, oficina: 0, parado: 0 }, veiculos: [] });

    expect(screen.getByText('0 veículos')).toBeOnTheScreen();
    expect(screen.queryByTestId('barra-frota', { includeHiddenElements: true })).not.toBeOnTheScreen();
    expect(screen.getByText('Nenhum veículo em operação')).toBeOnTheScreen();
  });

  it('carregando: skeleton no lugar do resumo, e o menu já está lá', async () => {
    mockBuscar.mockReturnValue(new Promise(() => {}));
    await render(<FrotaHubView />);

    expect(screen.getByLabelText('Carregando a frota')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Veículos' })).toBeOnTheScreen();
  });

  it('erro: mensagem e "Tentar novamente"; tentar de novo mostra a frota', async () => {
    mockBuscar.mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar os veículos. Tente novamente.' });
    await render(<FrotaHubView />);
    await screen.findByText('Não foi possível carregar os veículos. Tente novamente.');
    mockBuscar.mockResolvedValue({ ok: true, data: frota });

    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' })));

    expect(screen.getByText('4 veículos')).toBeOnTheScreen();
  });
});

// O menu do módulo continua embaixo (EIX-77).
describe('FrotaHubView — menu do módulo (EIX-77)', () => {
  it.each([
    ['Veículos', '/frota/veiculos'],
    ['Rotas', '/rotas'],
    ['Manutenções', '/manutencoes'],
  ])('tocar em "%s" abre %s (NAV5-02 a NAV5-04)', async (entrada, rota) => {
    await renderComFrota();

    await fireEvent.press(screen.getByRole('button', { name: entrada }));

    expect(mockPush).toHaveBeenCalledWith(rota);
  });

  it('as linhas ficam em "Operação" e "Cadastros"', async () => {
    await renderComFrota();

    expect(screen.getByText('Operação')).toBeOnTheScreen();
    expect(screen.getByText('Cadastros')).toBeOnTheScreen();
    expect(screen.getAllByTestId('icone-rotas', { includeHiddenElements: true }).length).toBeGreaterThan(0);
  });

  // O Admin não tem a aba Viagens (passaria de 5 abas): a lista dele abre por aqui.
  it('Admin vê "Viagens" em Operação, que abre /frota/viagens; o Gestor, que tem a aba, não', async () => {
    useProfileStore.setState({
      usuario: { id: 'a', nome: 'Ana', email: 'a@empresa.com', perfil: 'Admin', status: 'Ativo' },
      estado: 'pronto',
    });
    const { unmount } = await (async () => {
      mockBuscar.mockResolvedValue({ ok: true, data: frota });
      const resultado = await render(<FrotaHubView />);
      await screen.findByText('Veículos agora');
      return resultado;
    })();

    await fireEvent.press(screen.getByRole('button', { name: 'Viagens' }));
    expect(mockPush).toHaveBeenCalledWith('/frota/viagens');
    await unmount();

    useProfileStore.setState({
      usuario: { id: 'g', nome: 'Gil', email: 'g@empresa.com', perfil: 'Gestor de Frota', status: 'Ativo' },
      estado: 'pronto',
    });
    await renderComFrota();
    expect(screen.queryByRole('button', { name: 'Viagens' })).not.toBeOnTheScreen();
  });
});
