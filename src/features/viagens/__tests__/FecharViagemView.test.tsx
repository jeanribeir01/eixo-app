import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Alert, Animated } from 'react-native';

import { FecharViagemView } from '../FecharViagemView';
import * as repo from '../viagensRepository';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

const mockViagemAberta = {
  id: 'viagem-1',
  veiculo_id: 'veic-1',
  rota_id: 'rota-1',
  motorista_id: 'mot-1',
  hodometro_inicial: 10000,
  hodometro_final: null,
  data_inicio: '2026-10-18T08:00:00Z',
  data_fim: null,
  status: 'EmAndamento' as const,
  km_rodado: null,
  em_revisao: false,
  data_inclusao: '2026-10-18T08:00:00Z',
  data_atualizacao: '2026-10-18T08:00:00Z',
  veiculo: {
    id: 'veic-1',
    placa: 'BRA2E19',
    marca: 'Mercedes-Benz',
    modelo: 'Actros',
    status: 'EmViagem' as const,
  },
  rota: {
    id: 'rota-1',
    cidade_origem: 'São Paulo',
    uf_origem: 'SP' as const,
    cidade_destino: 'Campinas',
    uf_destino: 'SP' as const,
    distancia_estimada_km: 100,
  },
  motorista: {
    id: 'mot-1',
    nome: 'João Silva',
    email: 'joao@transportadora.com',
  },
};

type BotaoAlerta = { text?: string; onPress?: () => void };

// O Alert do sistema não renderiza na árvore de teste: encontra o botão "Finalizar" no
// argumento da chamada e executa o onPress, como o usuário faria.
async function confirmarNoAlerta() {
  const botoes = (Alert.alert as jest.Mock).mock.calls[0]?.[2] as BotaoAlerta[] | undefined;
  const confirmar = botoes?.find((botao) => botao.text === 'Finalizar');
  expect(confirmar).toBeDefined();

  await act(async () => {
    confirmar?.onPress?.();
  });
}

describe('FecharViagemView', () => {
  const mockBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      back: mockBack,
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(repo, 'buscarViagemPorId').mockResolvedValue({
      ok: true,
      data: mockViagemAberta,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('exibe dados da viagem e entende o milhar pt-BR ao digitar o hodômetro final', async () => {
    await render(<FecharViagemView viagemId="viagem-1" />);

    expect(await screen.findByText('BRA2E19')).toBeTruthy();
    expect(screen.getByText('Actros · hodômetro na saída: 10.000 km')).toBeTruthy();

    const input = screen.getByLabelText('Hodômetro final (km)');
    // 10.080 - 10.000 = 80 km (antes, o parser lia "10.080" como 10,08)
    await fireEvent.changeText(input, '10.080');

    expect(await screen.findByText('80 km rodados nesta viagem.')).toBeTruthy();
  });

  it('exibe aviso visual quando a distância rodada ultrapassa muito a estimativa da rota (Passo 3.3)', async () => {
    await render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19');

    const input = screen.getByLabelText('Hodômetro final (km)');
    // 10150 - 10000 = 150 km (> 100 km * 1.2 = 120 km)
    await fireEvent.changeText(input, '10150');

    expect(await screen.findByText('Confira o hodômetro final')).toBeTruthy();
  });

  it('confirma no Alert do sistema com "X km rodados nesta viagem." e finaliza a viagem', async () => {
    const spyFechar = jest.spyOn(repo, 'fecharViagem').mockResolvedValue({
      ok: true,
      data: {
        ...mockViagemAberta,
        status: 'Finalizada',
        hodometro_final: 10095,
        km_rodado: 95,
        data_fim: '2026-10-18T12:00:00Z',
      },
    });

    await render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19');

    // 10095 - 10000 = 95 km, digitado no padrão pt-BR
    await fireEvent.changeText(screen.getByLabelText('Hodômetro final (km)'), '10.095');

    await fireEvent.press(screen.getByRole('button', { name: 'Finalizar viagem' }));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Finalizar viagem?',
      '95 km rodados nesta viagem.',
      expect.any(Array),
    );

    await confirmarNoAlerta();

    expect(spyFechar).toHaveBeenCalledWith('viagem-1', {
      hodometro_final: 10095,
    });
  });

  it('usa formatarKm no texto de confirmação, sem números quebrados', async () => {
    jest.spyOn(repo, 'buscarViagemPorId').mockResolvedValue({
      ok: true,
      data: {
        ...mockViagemAberta,
        hodometro_inicial: 10000.1,
        rota: { ...mockViagemAberta.rota, distancia_estimada_km: 500 },
      },
    });

    await render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19');

    // 10100,3 - 10000,1 = 100.19999999999891 em ponto flutuante
    await fireEvent.changeText(screen.getByLabelText('Hodômetro final (km)'), '10.100,3');
    await fireEvent.press(screen.getByRole('button', { name: 'Finalizar viagem' }));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Finalizar viagem?',
      '100,2 km rodados nesta viagem.',
      expect.any(Array),
    );
  });

  it('usa a mensagem do schema quando o hodômetro final está vazio', async () => {
    await render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19');

    await fireEvent.press(screen.getByRole('button', { name: 'Finalizar viagem' }));

    expect(await screen.findByText('Informe um número para o hodômetro final.')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('usa a mensagem do schema quando o hodômetro final é zero', async () => {
    await render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19');

    await fireEvent.changeText(screen.getByLabelText('Hodômetro final (km)'), '0');
    await fireEvent.press(screen.getByRole('button', { name: 'Finalizar viagem' }));

    expect(await screen.findByText('O hodômetro final deve ser maior que zero.')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it.each(['9.999', '10.000'])(
    'impede fechamento com hodômetro final menor ou igual ao inicial (%s)',
    async (valor) => {
      await render(<FecharViagemView viagemId="viagem-1" />);

      await screen.findByText('BRA2E19');

      const input = screen.getByLabelText('Hodômetro final (km)');
      await fireEvent.changeText(input, valor);

      await fireEvent.press(screen.getByRole('button', { name: 'Finalizar viagem' }));

      expect(
        await screen.findByText('O hodômetro final deve ser maior que o inicial (10.000 km).'),
      ).toBeTruthy();
      expect(Alert.alert).not.toHaveBeenCalled();
    },
  );

  it('inclui o aviso de distância excessiva no texto do Alert', async () => {
    await render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19');
    await fireEvent.changeText(screen.getByLabelText('Hodômetro final (km)'), '10.150');
    await fireEvent.press(screen.getByRole('button', { name: 'Finalizar viagem' }));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Finalizar viagem?',
      expect.stringContaining(
        'A distância está bem acima da estimada para esta rota.',
      ),
      expect.any(Array),
    );
  });

  it('em erro do repositório, reabilita o botão, mostra Snackbar e não navega ao dispensar', async () => {
    jest.useFakeTimers();
    jest.spyOn(Animated, 'timing');
    jest.spyOn(repo, 'fecharViagem').mockResolvedValue({
      ok: false,
      mensagem: 'Não foi possível fechar a viagem.',
    });

    await render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19');
    await fireEvent.changeText(screen.getByLabelText('Hodômetro final (km)'), '10.095');
    await fireEvent.press(screen.getByRole('button', { name: 'Finalizar viagem' }));

    await confirmarNoAlerta();

    await waitFor(() => expect(repo.fecharViagem).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível fechar a viagem.');
    expect(screen.getByRole('button', { name: 'Finalizar viagem' })).not.toBeDisabled();

    await waitFor(() => expect(Animated.timing).toHaveBeenCalled());
    await act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockBack).not.toHaveBeenCalled();
  });

  it('em exceção do repositório, reabilita o botão e mostra erro sem travar', async () => {
    jest.spyOn(repo, 'fecharViagem').mockRejectedValue(new Error('falha de rede'));

    await render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19');
    await fireEvent.changeText(screen.getByLabelText('Hodômetro final (km)'), '10.095');
    await fireEvent.press(screen.getByRole('button', { name: 'Finalizar viagem' }));

    await confirmarNoAlerta();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível finalizar a viagem. Tente novamente.',
    );
    expect(screen.getByRole('button', { name: 'Finalizar viagem' })).not.toBeDisabled();
  });

  it('não fecha duas vezes quando o Finalizar do Alert é tocado repetidamente', async () => {
    let resolver: (valor: Awaited<ReturnType<typeof repo.fecharViagem>>) => void = () => {};
    const resposta = new Promise<Awaited<ReturnType<typeof repo.fecharViagem>>>((resolve) => {
      resolver = resolve;
    });
    const spyFechar = jest.spyOn(repo, 'fecharViagem').mockReturnValue(resposta);

    await render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19');
    await fireEvent.changeText(screen.getByLabelText('Hodômetro final (km)'), '10.095');
    await fireEvent.press(screen.getByRole('button', { name: 'Finalizar viagem' }));

    const botoes = (Alert.alert as jest.Mock).mock.calls[0]?.[2] as BotaoAlerta[] | undefined;
    const confirmar = botoes?.find((botao) => botao.text === 'Finalizar');
    expect(confirmar).toBeDefined();

    await act(() => {
      confirmar?.onPress?.();
      confirmar?.onPress?.();
    });

    expect(spyFechar).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolver({
        ok: true,
        data: {
          ...mockViagemAberta,
          status: 'Finalizada',
          hodometro_final: 10095,
          km_rodado: 95,
          data_fim: '2026-10-18T12:00:00Z',
        },
      });
      await resposta;
    });
  });

  it('exibe "Concluída" no lugar do enum cru "Finalizada"', async () => {
    jest.spyOn(repo, 'buscarViagemPorId').mockResolvedValue({
      ok: true,
      data: {
        ...mockViagemAberta,
        status: 'Finalizada',
        hodometro_final: 10095,
      },
    });

    await render(<FecharViagemView viagemId="viagem-1" />);

    expect(await screen.findByText(/está como "Concluída"/)).toBeTruthy();
    expect(screen.queryByText(/Finalizada/)).not.toBeOnTheScreen();
  });

  it('mantém o botão em loading e só volta quando o Snackbar de sucesso é dispensado', async () => {
    jest.useFakeTimers();
    jest.spyOn(Animated, 'timing');
    jest.spyOn(repo, 'fecharViagem').mockResolvedValue({
      ok: true,
      data: {
        ...mockViagemAberta,
        status: 'Finalizada',
        hodometro_final: 10095,
        km_rodado: 95,
        data_fim: '2026-10-18T12:00:00Z',
      },
    });

    await render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19');
    await fireEvent.changeText(screen.getByLabelText('Hodômetro final (km)'), '10.095');
    await fireEvent.press(screen.getByRole('button', { name: 'Finalizar viagem' }));

    await confirmarNoAlerta();

    await waitFor(() => expect(repo.fecharViagem).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('alert')).toHaveTextContent('Viagem finalizada.');
    // Espera a entrada do Snackbar montar o timer de auto-dismiss.
    await waitFor(() => expect(Animated.timing).toHaveBeenCalled());
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Finalizar viagem' })).toBeDisabled();

    await act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('resume a viagem em andamento: placa, trecho, motorista e hora de saída', async () => {
    await render(<FecharViagemView viagemId="viagem-1" />);

    expect(await screen.findByText('Viagem em andamento')).toBeOnTheScreen();
    expect(screen.getByText('BRA2E19')).toBeOnTheScreen();
    expect(screen.getByText('São Paulo/SP → Campinas/SP')).toBeOnTheScreen();
    expect(screen.getByText(/^João Silva · saída às \d{2}:\d{2}$/)).toBeOnTheScreen();
  });

  it('Continuar viagem volta sem finalizar', async () => {
    const spyFechar = jest.spyOn(repo, 'fecharViagem');
    await render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19');
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar viagem' }));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(spyFechar).not.toHaveBeenCalled();
  });
});
