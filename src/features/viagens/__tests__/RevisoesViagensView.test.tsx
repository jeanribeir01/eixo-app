import { Alert, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { porTipo } from '@/testing/componentes';
import { spacing } from '@/ui';

import { RevisoesViagensView } from '../RevisoesViagensView';
import { listarRevisoesPendentes, resolverRevisao } from '../revisoesRepository';
import type { RevisaoViagem } from '../types';

// Largura da janela controlada pelo teste: 412 é celular, 800 é tablet (EIX-94).
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 900, scale: 1, fontScale: 1 })),
}));

function mockLargura(width: number) {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const react = require('react');
    react.useEffect(callback, [callback]);
  },
}));

jest.mock('../revisoesRepository', () => ({
  listarRevisoesPendentes: jest.fn(),
  resolverRevisao: jest.fn(),
}));

const mockListar = jest.mocked(listarRevisoesPendentes);
const mockResolver = jest.mocked(resolverRevisao);

function revisao(overrides: Partial<RevisaoViagem> = {}): RevisaoViagem {
  return {
    id: 'revisao-1',
    viagem_id: 'viagem-1',
    solicitante_id: 'motorista-1',
    motorista_id: 'motorista-1',
    motorista_nome: 'Carlos Motorista',
    veiculo_id: 'veiculo-1',
    veiculo_placa: 'BRA2E19',
    rota_id: 'rota-1',
    rota_trecho: 'São Paulo/SP → Campinas/SP',
    codigo: 'VG005',
    mensagem: 'A viagem já foi encerrada no servidor.',
    payload: { status: 'Finalizada' },
    status: 'Pendente',
    observacao: null,
    resolvido_por: null,
    resolvido_em: null,
    data_inclusao: '2026-10-26T12:00:00.000Z',
    data_atualizacao: '2026-10-26T12:00:00.000Z',
    ...overrides,
  };
}

function confirmarAlerta(): void {
  jest.spyOn(Alert, 'alert').mockImplementation((_titulo, _mensagem, botoes) => {
    const confirmar = botoes?.find((botao) => botao.text === 'Resolver' || botao.text === 'Descartar');
    confirmar?.onPress?.();
  });
}

describe('RevisoesViagensView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListar.mockResolvedValue({ ok: true, data: [] });
    mockResolver.mockResolvedValue({ ok: true, data: revisao() });
  });

  it('mostra o estado de carregando enquanto busca a fila', async () => {
    mockListar.mockReturnValue(new Promise(() => {}));

    await render(<RevisoesViagensView />);

    expect(screen.getByLabelText('Carregando revisões')).toBeOnTheScreen();
  });

  it('mostra o estado vazio quando não há revisão pendente', async () => {
    await render(<RevisoesViagensView />);

    expect(await screen.findByText('Nenhuma revisão pendente')).toBeOnTheScreen();
  });

  it('lista a revisão com veículo, motorista, rota e código', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [revisao()] });

    await render(<RevisoesViagensView />);

    expect(await screen.findByText('BRA2E19 • Carlos Motorista')).toBeOnTheScreen();
    expect(screen.getByText('São Paulo/SP → Campinas/SP')).toBeOnTheScreen();
    expect(screen.getByText('A viagem já foi encerrada no servidor.')).toBeOnTheScreen();
    expect(screen.getByText(/Código: VG005/)).toBeOnTheScreen();
  });

  it('resolve a revisão com a observação e remove o cartão da fila', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [revisao()] });
    confirmarAlerta();

    await render(<RevisoesViagensView />);

    await screen.findByText('BRA2E19 • Carlos Motorista');
    await fireEvent.changeText(
      screen.getByPlaceholderText('Ex.: hodômetro conferido com o motorista'),
      'Hodômetro conferido',
    );

    await act(async () => {
      await fireEvent.press(screen.getByText('Resolver'));
    });

    await waitFor(() =>
      expect(mockResolver).toHaveBeenCalledWith('revisao-1', {
        status: 'Resolvida',
        observacao: 'Hodômetro conferido',
      }),
    );
    expect(await screen.findByText('Revisão marcada como resolvida.')).toBeOnTheScreen();
    expect(screen.queryByText('BRA2E19 • Carlos Motorista')).not.toBeOnTheScreen();
  });

  it('descarta a revisão com feedback de que a viagem local não foi alterada', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [revisao()] });
    confirmarAlerta();

    await render(<RevisoesViagensView />);

    await screen.findByText('BRA2E19 • Carlos Motorista');
    await act(async () => {
      await fireEvent.press(screen.getByText('Descartar'));
    });

    await waitFor(() =>
      expect(mockResolver).toHaveBeenCalledWith('revisao-1', {
        status: 'Descartada',
        observacao: '',
      }),
    );
    expect(
      await screen.findByText('Revisão descartada. A viagem local não foi alterada.'),
    ).toBeOnTheScreen();
  });

  it('mostra o erro e mantém o cartão quando a decisão falha', async () => {
    mockListar.mockResolvedValue({ ok: true, data: [revisao()] });
    mockResolver.mockResolvedValue({
      ok: false,
      mensagem: 'Não foi possível salvar a decisão da revisão. Tente novamente.',
    });
    confirmarAlerta();

    await render(<RevisoesViagensView />);

    await screen.findByText('BRA2E19 • Carlos Motorista');
    await act(async () => {
      await fireEvent.press(screen.getByText('Resolver'));
    });

    expect(
      await screen.findByText('Não foi possível salvar a decisão da revisão. Tente novamente.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('BRA2E19 • Carlos Motorista')).toBeOnTheScreen();
  });

  it('mostra o estado de erro quando a fila não carrega', async () => {
    mockListar.mockResolvedValue({
      ok: false,
      mensagem: 'Não foi possível carregar as revisões. Tente novamente.',
    });

    await render(<RevisoesViagensView />);

    expect(await screen.findByText('Não foi possível carregar as revisões')).toBeOnTheScreen();
    expect(
      screen.getByText('Não foi possível carregar as revisões. Tente novamente.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Tentar novamente')).toBeOnTheScreen();
  });

  describe('RevisoesViagensView — tablet (EIX-94)', () => {
    afterEach(() => mockLargura(412));

    function estiloDoConteudo() {
      return StyleSheet.flatten(screen.getByTestId('screen-conteudo').props.style);
    }

    function estiloDaLista() {
      return StyleSheet.flatten(porTipo(FlatList).props.contentContainerStyle);
    }

    it('412: nada muda, o respiro lateral continua no Screen e a lista não ganha coluna', async () => {
      await render(<RevisoesViagensView />);
      await screen.findByText('Nenhuma revisão pendente');

      expect(estiloDoConteudo()).toMatchObject({ paddingHorizontal: spacing.base });
      expect(estiloDaLista()?.maxWidth).toBeUndefined();
    });

    it('800: a lista rola na largura toda e o conteúdo fica na coluna de 720', async () => {
      mockLargura(800);
      await render(<RevisoesViagensView />);
      await screen.findByText('Nenhuma revisão pendente');

      expect(estiloDoConteudo().maxWidth).toBeUndefined();
      expect(estiloDoConteudo().paddingHorizontal).toBeUndefined();
      expect(estiloDaLista()).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
      expect(screen.queryByTestId('screen-coluna')).toBeNull();
    });
  });
});
