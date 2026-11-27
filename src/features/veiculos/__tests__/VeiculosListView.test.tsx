import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { FlatList, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';

import { porTipo } from '@/testing/componentes';
import { segurarPrimeiraCarga } from '@/testing/eventos';
import { FAB_ALTURA_RESERVADA, spacing } from '@/ui';

import { VeiculosListView } from '../VeiculosListView';
import { listarVeiculos } from '../repository';

// Largura da janela controlada pelo teste: 412 é celular, 800 é tablet (EIX-94).
// O filtro de status é um chip: abre a folha e toca na opção.
async function escolherStatus(opcao: string) {
  await fireEvent.press(screen.getByRole('button', { name: /^Status: / }));
  await fireEvent.press(screen.getByRole('button', { name: opcao }));
}

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 900, scale: 1, fontScale: 1 })),
}));

function mockLargura(width: number) {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

// O runner do GitHub Actions é mais lento que a máquina local: o padrão de 5s estourava no CI.
jest.setTimeout(15000);

const mockPush = jest.fn();

// Jest hoista jest.mock() acima dos imports: a fábrica só pode usar variáveis com prefixo "mock".
// O useFocusEffect real roda de novo quando o callback muda (busca/filtro); o mock imita isso.
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]),
  };
});

jest.mock('../repository', () => ({
  listarVeiculos: jest.fn(),
}));

const veiculosMock = [
  { id: '1', placa: 'ABC1234', marca: 'Volvo', modelo: 'FH 540', capacidade_carga: 12.5, status: 'Disponivel' as const },
  { id: '2', placa: 'DEF1G23', marca: 'Scania', modelo: 'R 450', capacidade_carga: 30, status: 'EmManutencao' as const },
];

describe('VeiculosListView', () => {
  beforeEach(() => {
    mockPush.mockReset();
    (listarVeiculos as jest.Mock).mockReset();
  });

  const desativado = { ...veiculosMock[0], id: '3', placa: 'GHI1234', status: 'Inativo' as const };

  // INA/REA: desativar e reativar moram no Editar (VeiculoFormView), igual em Categorias, Formas de
  // pagamento e Rotas. A linha não tem "Mais opções" nem o Alert do sistema.
  it('a linha não tem "Mais opções" nem botão de desativar/reativar', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [...veiculosMock, desativado] });
    await render(<VeiculosListView />);
    await screen.findByText('ABC-1234');

    expect(screen.queryByRole('button', { name: /^(Inativar|Desativar|Reativar|Mais opções)/ })).toBeNull();
  });

  it('desativados ficam recolhidos no fim, com as placas ao lado; ao abrir, a linha leva ao Editar', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [...veiculosMock, desativado] });
    await render(<VeiculosListView />);
    await screen.findByText('ABC-1234');

    const cabecalho = screen.getByRole('button', { name: 'Desativados, 1' });
    expect(cabecalho).toBeCollapsed();
    expect(screen.getByText('GHI-1234')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Editar GHI-1234' })).toBeNull();
    // O desativado não vira um grupo comum entre os outros.
    expect(screen.getAllByRole('header').map((titulo) => titulo.props.children)).toEqual(['Disponíveis · 1', 'Em manutenção · 1']);

    await fireEvent.press(cabecalho);
    await fireEvent.press(screen.getByRole('button', { name: 'Editar GHI-1234' }));

    expect(mockPush).toHaveBeenCalledWith('/frota/3/editar');
  });

  it('sem desativados, o grupo recolhido não aparece', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });
    await render(<VeiculosListView />);
    await screen.findByText('ABC-1234');

    expect(screen.queryByRole('button', { name: /^Desativados/ })).toBeNull();
  });

  it('o filtro de status não oferece "Desativado" e rola na horizontal em telas pequenas (SEL-01)', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    await render(<VeiculosListView />);
    await screen.findByText('Nenhum veículo cadastrado');
    // O filtro é um chip numa linha que rola na horizontal: nada quebra nem corta em 360 (EIX-82).
    const filtro = porTipo(ScrollView);
    expect(filtro.props.horizontal).toBe(true);
    expect(within(filtro.elementoNativo()).getByRole('button', { name: 'Status: Todos' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /^Status: / }));

    expect(screen.getByRole('button', { name: 'Disponível' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Desativado' })).toBeNull();
  });

  it('"Novo veículo" é o FAB, como nas outras listas, e a lista reserva o espaço dele no fim', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });
    await render(<VeiculosListView />);
    await screen.findByText('ABC-1234');

    expect(within(screen.getByTestId('screen-coluna')).queryByRole('button', { name: 'Novo veículo' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Novo veículo' }));
    expect(mockPush).toHaveBeenCalledWith('/frota/novo');
    expect(StyleSheet.flatten(porTipo(FlatList).props.contentContainerStyle)).toMatchObject({
      paddingBottom: FAB_ALTURA_RESERVADA,
    });
  });

  it('mostra carregando e depois a lista com placa mascarada, capacidade e o status no grupo', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });
    // Segura a primeira carga: o render async esperaria a resposta e pularia o "carregando".
    const liberarCarga = segurarPrimeiraCarga(jest.mocked(listarVeiculos));

    await render(<VeiculosListView />);

    expect(screen.getByLabelText('Carregando veículos')).toBeOnTheScreen();
    await liberarCarga();
    expect(await screen.findByText('ABC-1234')).toBeOnTheScreen();
    expect(screen.getByText('DEF1G23')).toBeOnTheScreen();
    expect(screen.getByText('Volvo FH 540 · 12,5 t')).toBeOnTheScreen();
    // O status vem do grupo, na ordem em que o gestor olha a frota; grupo vazio não aparece.
    const grupos = screen.getAllByRole('header').map((cabecalho) => cabecalho.props.children);
    expect(grupos).toEqual(['Disponíveis · 1', 'Em manutenção · 1']);
  });

  // Desde a EIX-77 a lista abre por cima do hub de Frota, com o header nativo "Veículos" (NAV5-14).
  it('não repete título no conteúdo: quem dá o título é o header nativo', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });

    await render(<VeiculosListView />);

    expect(await screen.findByText('ABC-1234')).toBeOnTheScreen();
    expect(screen.queryByText('Frota')).not.toBeOnTheScreen();
    expect(screen.queryByText('Eixo Certo')).not.toBeOnTheScreen();
  });

  it('lista vazia sem filtro mostra estado vazio com ação de cadastrar', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [] });

    await render(<VeiculosListView />);

    expect(await screen.findByText('Nenhum veículo cadastrado')).toBeOnTheScreen();
    // Duas entradas para o mesmo cadastro: a ação do estado vazio e o FAB.
    await fireEvent.press(screen.getAllByRole('button', { name: 'Novo veículo' })[0]);
    expect(mockPush).toHaveBeenCalledWith('/frota/novo');
  });

  it('erro mostra mensagem em português e "Tentar novamente" recarrega', async () => {
    (listarVeiculos as jest.Mock)
      .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar os veículos. Tente novamente.' })
      .mockResolvedValueOnce({ ok: true, data: veiculosMock });

    await render(<VeiculosListView />);

    expect(await screen.findByText('Não foi possível carregar os veículos. Tente novamente.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('ABC-1234')).toBeOnTheScreen();
  });

  it('filtro por status consulta o repositório com o status escolhido', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });

    await render(<VeiculosListView />);
    await screen.findByText('ABC-1234');

    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    await escolherStatus('Em Viagem');

    await waitFor(() => expect(listarVeiculos).toHaveBeenLastCalledWith({ busca: undefined, status: 'EmViagem' }));
    expect(await screen.findByText('Nenhum veículo encontrado')).toBeOnTheScreen();
  });

  it('busca por placa/modelo consulta o repositório depois que o usuário para de digitar', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });

    await render(<VeiculosListView />);
    await screen.findByText('ABC-1234');

    await fireEvent.changeText(screen.getByLabelText('Buscar por placa ou modelo'), 'fh');

    await waitFor(() => expect(listarVeiculos).toHaveBeenLastCalledWith({ busca: 'fh', status: undefined }));
  });

  it('tocar na linha abre a edição do veículo', async () => {
    (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });

    await render(<VeiculosListView />);
    await screen.findByText('ABC-1234');

    await fireEvent.press(screen.getByRole('button', { name: 'Editar ABC-1234' }));
    expect(mockPush).toHaveBeenCalledWith('/frota/1/editar');
  });

  describe('VeiculosListView — tablet (EIX-94)', () => {
    afterEach(() => mockLargura(412));

    function estiloDoConteudo() {
      return StyleSheet.flatten(screen.getByTestId('screen-conteudo').props.style);
    }

    function estiloDaLista() {
      return StyleSheet.flatten(porTipo(FlatList).props.contentContainerStyle);
    }

    it('412: nada muda, o respiro lateral continua no Screen e a lista não ganha coluna', async () => {
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });
      await render(<VeiculosListView />);
      await screen.findByText('ABC-1234');

      expect(estiloDoConteudo()).toMatchObject({ paddingHorizontal: spacing.base });
      expect(estiloDaLista()?.maxWidth).toBeUndefined();
    });

    it('800: a lista rola na largura toda e o conteúdo fica na coluna de 720', async () => {
      mockLargura(800);
      (listarVeiculos as jest.Mock).mockResolvedValue({ ok: true, data: veiculosMock });
      await render(<VeiculosListView />);
      await screen.findByText('ABC-1234');

      expect(estiloDoConteudo().maxWidth).toBeUndefined();
      expect(estiloDoConteudo().paddingHorizontal).toBeUndefined();
      expect(estiloDaLista()).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
      const coluna = screen.getByTestId('screen-coluna');
      expect(StyleSheet.flatten(coluna.props.style)).toMatchObject({ maxWidth: 720, alignSelf: 'center' });
      expect(within(coluna).getByLabelText('Buscar por placa ou modelo')).toBeOnTheScreen();
    });
  });
});
