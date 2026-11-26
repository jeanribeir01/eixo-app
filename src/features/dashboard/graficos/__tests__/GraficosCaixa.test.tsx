import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { hojeISO } from '@/lib/datas';

import type { Periodo } from '../../periodo';
import { GraficosCaixa } from '../GraficosCaixa';
import { buscarDespesasPorCategoria, buscarFluxoMensal, type FatiaDespesa, type MesDoFluxo } from '../queries';

jest.setTimeout(15000);

// Callbacks de foco ativos: chamar todos simula o usuário voltando à aba (recarga da mesma consulta).
const mockFocos = new Set<() => void>();

// Jest hoista jest.mock() acima dos imports: a fábrica só pode usar variáveis com prefixo "mock".
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    useFocusEffect: (callback: () => void) =>
      react.useEffect(() => {
        mockFocos.add(callback);
        callback();
        return () => {
          mockFocos.delete(callback);
        };
      }, [callback]),
  };
});

jest.mock('../queries', () => ({
  ...jest.requireActual('../queries'),
  buscarFluxoMensal: jest.fn(),
  buscarDespesasPorCategoria: jest.fn(),
}));

const mockFluxo = buscarFluxoMensal as jest.MockedFunction<typeof buscarFluxoMensal>;
const mockDespesas = buscarDespesasPorCategoria as jest.MockedFunction<typeof buscarDespesasPorCategoria>;

// Períodos no passado: o mês final das barras é a própria data final do filtro.
const OUTUBRO: Periodo = { modo: 'mes', dataInicial: '2025-10-01', dataFinal: '2025-10-31' };
const SETEMBRO: Periodo = { modo: 'mes', dataInicial: '2025-09-01', dataFinal: '2025-09-30' };

const MESES: MesDoFluxo[] = [
  { mes: '2025-09', entradas_centavos: 0, saidas_centavos: 0 },
  { mes: '2025-10', entradas_centavos: 100163, saidas_centavos: 20025 },
];
const FATIAS: FatiaDespesa[] = [{ categoria_id: 'c-1', titulo: 'Combustível', total_centavos: 20025, percentual: 100 }];

async function renderizar(periodo: Periodo = OUTUBRO, onErroAoAtualizar = jest.fn()) {
  return await render(<GraficosCaixa periodo={periodo} onErroAoAtualizar={onErroAoAtualizar} />);
}

beforeEach(() => {
  mockFluxo.mockReset();
  mockDespesas.mockReset();
  mockFluxo.mockResolvedValue({ ok: true, data: MESES });
  mockDespesas.mockResolvedValue({ ok: true, data: FATIAS });
});

describe('GraficosCaixa', () => {
  it('abre com "6 meses" até o mês final do filtro e a rosca no período do filtro (GRAF-06, GRAF-14)', async () => {
    await renderizar();

    expect(await screen.findByText('+ R$ 1.001,63')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: '6 meses' })).toBeSelected();
    expect(mockFluxo).toHaveBeenLastCalledWith('2025-10-31', 6);
    expect(mockDespesas).toHaveBeenLastCalledWith({ dataInicial: '2025-10-01', dataFinal: '2025-10-31' });
    expect(screen.getAllByText('Combustível').length).toBeGreaterThan(0);
  });

  it.each([
    ['3 meses', 3],
    ['1 ano', 12],
    ['2 anos', 24],
    ['Máximo', null],
  ])('a aba "%s" consulta as barras com %s meses (GRAF-06)', async (aba, meses) => {
    await renderizar();
    await screen.findByText('+ R$ 1.001,63');

    await fireEvent.press(screen.getByRole('tab', { name: aba }));

    await screen.findByText('+ R$ 1.001,63');
    expect(mockFluxo).toHaveBeenLastCalledWith('2025-10-31', meses);
  });

  it('trocar o filtro consulta os dois gráficos com o período novo (GRAF-14)', async () => {
    const { rerender } = await renderizar();
    await screen.findByText('+ R$ 1.001,63');

    rerender(<GraficosCaixa periodo={SETEMBRO} onErroAoAtualizar={jest.fn()} />);

    await screen.findByText('+ R$ 1.001,63');
    expect(mockFluxo).toHaveBeenLastCalledWith('2025-09-30', 6);
    expect(mockDespesas).toHaveBeenLastCalledWith({ dataInicial: '2025-09-01', dataFinal: '2025-09-30' });
  });

  it('filtro que termina no futuro faz as barras pararem em hoje (GRAF-14)', async () => {
    await renderizar({ modo: 'ano', dataInicial: '2999-01-01', dataFinal: '2999-12-31' });
    await screen.findByText('+ R$ 1.001,63');

    expect(mockFluxo).toHaveBeenLastCalledWith(hojeISO(), 6);
  });

  it('mostra o skeleton de cada gráfico enquanto carrega (GRAF-15)', async () => {
    mockFluxo.mockReturnValue(new Promise(() => {}));
    mockDespesas.mockReturnValue(new Promise(() => {}));

    await renderizar();

    expect(screen.getByLabelText('Carregando gráfico de entradas e saídas')).toBeOnTheScreen();
    expect(screen.getByLabelText('Carregando despesas por categoria')).toBeOnTheScreen();
  });

  it('um gráfico com erro mostra a mensagem e "Tentar novamente", e o outro continua (GRAF-16)', async () => {
    mockFluxo.mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar o gráfico. Tente novamente.' });

    await renderizar();

    expect(await screen.findByText('Não foi possível carregar o gráfico. Tente novamente.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Combustível/ })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('+ R$ 1.001,63')).toBeOnTheScreen();
  });

  it('a rosca com erro mostra a mensagem e "Tentar novamente", e as barras continuam (GRAF-16)', async () => {
    mockDespesas.mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar o gráfico. Tente novamente.' });

    await renderizar();

    expect(await screen.findByText('Não foi possível carregar o gráfico. Tente novamente.')).toBeOnTheScreen();
    expect(screen.getByText('+ R$ 1.001,63')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('button', { name: /^Combustível/ })).toBeOnTheScreen();
  });

  it('período sem nada pago mostra o vazio dos dois gráficos (GRAF-17)', async () => {
    mockFluxo.mockResolvedValue({ ok: true, data: [{ mes: '2025-10', entradas_centavos: 0, saidas_centavos: 0 }] });
    mockDespesas.mockResolvedValue({ ok: true, data: [] });

    await renderizar();

    expect(await screen.findByText('Nada pago nesses meses')).toBeOnTheScreen();
    expect(await screen.findByText('Nenhuma despesa paga no período')).toBeOnTheScreen();
  });

  it('"Máximo" sem nenhum pagamento (lista vazia) também mostra o vazio (GRAF-17)', async () => {
    mockFluxo.mockResolvedValue({ ok: true, data: [] });

    await renderizar();

    expect(await screen.findByText('Nada pago nesses meses')).toBeOnTheScreen();
  });

  it('erro ao recarregar com o gráfico na tela avisa a tela e mantém o gráfico (GRAF-16)', async () => {
    const onErro = jest.fn();
    await renderizar(OUTUBRO, onErro);
    await screen.findByText('+ R$ 1.001,63');

    mockFluxo.mockResolvedValueOnce({ ok: false, mensagem: 'Sem conexão.' });
    await act(async () => {
      mockFocos.forEach((focar) => focar());
    });

    expect(onErro).toHaveBeenCalledWith('Sem conexão.');
    expect(onErro).toHaveBeenCalledTimes(1);
    expect(screen.getByText('+ R$ 1.001,63')).toBeOnTheScreen();
  });
});
