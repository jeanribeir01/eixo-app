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

// O Alert do sistema não renderiza na árvore de teste: encontra o botão "Confirmar" no
// argumento da chamada e executa o onPress, como o usuário faria.
async function confirmarNoAlerta() {
  const botoes = (Alert.alert as jest.Mock).mock.calls[0]?.[2] as BotaoAlerta[] | undefined;
  const confirmar = botoes?.find((botao) => botao.text === 'Confirmar');
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
    render(<FecharViagemView viagemId="viagem-1" />);

    expect(await screen.findByText('BRA2E19 • Actros', { exact: false })).toBeTruthy();
    expect(screen.getByText('Hodômetro Inicial: 10.000 km', { exact: false })).toBeTruthy();

    const input = screen.getByLabelText('Hodômetro Final (km)');
    // 10.080 - 10.000 = 80 km (antes, o parser lia "10.080" como 10,08)
    fireEvent.changeText(input, '10.080');

    expect(await screen.findByText('Distância calculada: 80 km')).toBeTruthy();
  });

  it('exibe aviso visual quando a distância rodada ultrapassa muito a estimativa da rota (Passo 3.3)', async () => {
    render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19 • Actros', { exact: false });

    const input = screen.getByLabelText('Hodômetro Final (km)');
    // 10150 - 10000 = 150 km (> 100 km * 1.2 = 120 km)
    fireEvent.changeText(input, '10150');

    expect(await screen.findByText(/excede a estimativa da rota/i)).toBeTruthy();
  });

  it('confirma no Alert do sistema com o texto "X km rodados, confirma?" e finaliza viagem', async () => {
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

    render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19 • Actros', { exact: false });

    // 10095 - 10000 = 95 km, digitado no padrão pt-BR
    fireEvent.changeText(screen.getByLabelText('Hodômetro Final (km)'), '10.095');

    fireEvent.press(screen.getByRole('button', { name: 'Fechar viagem' }));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Confirmar encerramento',
      '95 km rodados, confirma?',
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

    render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19 • Actros', { exact: false });

    // 10100,3 - 10000,1 = 100.19999999999891 em ponto flutuante
    fireEvent.changeText(screen.getByLabelText('Hodômetro Final (km)'), '10.100,3');
    fireEvent.press(screen.getByRole('button', { name: 'Fechar viagem' }));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Confirmar encerramento',
      '100,2 km rodados, confirma?',
      expect.any(Array),
    );
  });

  it('usa a mensagem do schema quando o hodômetro final está vazio', async () => {
    render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19 • Actros', { exact: false });

    fireEvent.press(screen.getByRole('button', { name: 'Fechar viagem' }));

    expect(await screen.findByText('Informe um número para o hodômetro final.')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('usa a mensagem do schema quando o hodômetro final é zero', async () => {
    render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19 • Actros', { exact: false });

    fireEvent.changeText(screen.getByLabelText('Hodômetro Final (km)'), '0');
    fireEvent.press(screen.getByRole('button', { name: 'Fechar viagem' }));

    expect(await screen.findByText('O hodômetro final deve ser maior que zero.')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it.each(['9.999', '10.000'])(
    'impede fechamento com hodômetro final menor ou igual ao inicial (%s)',
    async (valor) => {
      render(<FecharViagemView viagemId="viagem-1" />);

      await screen.findByText('BRA2E19 • Actros', { exact: false });

      const input = screen.getByLabelText('Hodômetro Final (km)');
      fireEvent.changeText(input, valor);

      fireEvent.press(screen.getByRole('button', { name: 'Fechar viagem' }));

      expect(
        await screen.findByText('O hodômetro final deve ser maior que o inicial (10.000 km).'),
      ).toBeTruthy();
      expect(Alert.alert).not.toHaveBeenCalled();
    },
  );

  it('inclui o aviso de distância excessiva no texto do Alert', async () => {
    render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19 • Actros', { exact: false });
    fireEvent.changeText(screen.getByLabelText('Hodômetro Final (km)'), '10.150');
    fireEvent.press(screen.getByRole('button', { name: 'Fechar viagem' }));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Confirmar encerramento',
      expect.stringContaining(
        'Atenção: a distância percorrida é consideravelmente superior à distância estimada para esta rota.',
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

    render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19 • Actros', { exact: false });
    fireEvent.changeText(screen.getByLabelText('Hodômetro Final (km)'), '10.095');
    fireEvent.press(screen.getByRole('button', { name: 'Fechar viagem' }));

    await confirmarNoAlerta();

    await waitFor(() => expect(repo.fecharViagem).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível fechar a viagem.');
    expect(screen.getByRole('button', { name: 'Fechar viagem' })).not.toBeDisabled();

    await waitFor(() => expect(Animated.timing).toHaveBeenCalled());
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockBack).not.toHaveBeenCalled();
  });

  it('em exceção do repositório, reabilita o botão e mostra erro sem travar', async () => {
    jest.spyOn(repo, 'fecharViagem').mockRejectedValue(new Error('falha de rede'));

    render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19 • Actros', { exact: false });
    fireEvent.changeText(screen.getByLabelText('Hodômetro Final (km)'), '10.095');
    fireEvent.press(screen.getByRole('button', { name: 'Fechar viagem' }));

    await confirmarNoAlerta();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível fechar a viagem. Tente novamente.',
    );
    expect(screen.getByRole('button', { name: 'Fechar viagem' })).not.toBeDisabled();
  });

  it('não fecha duas vezes quando o Confirmar do Alert é tocado repetidamente', async () => {
    let resolver: (valor: Awaited<ReturnType<typeof repo.fecharViagem>>) => void = () => {};
    const resposta = new Promise<Awaited<ReturnType<typeof repo.fecharViagem>>>((resolve) => {
      resolver = resolve;
    });
    const spyFechar = jest.spyOn(repo, 'fecharViagem').mockReturnValue(resposta);

    render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19 • Actros', { exact: false });
    fireEvent.changeText(screen.getByLabelText('Hodômetro Final (km)'), '10.095');
    fireEvent.press(screen.getByRole('button', { name: 'Fechar viagem' }));

    const botoes = (Alert.alert as jest.Mock).mock.calls[0]?.[2] as BotaoAlerta[] | undefined;
    const confirmar = botoes?.find((botao) => botao.text === 'Confirmar');
    expect(confirmar).toBeDefined();

    act(() => {
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

    render(<FecharViagemView viagemId="viagem-1" />);

    expect(await screen.findByText(/status "Concluída"/)).toBeTruthy();
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

    render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19 • Actros', { exact: false });
    fireEvent.changeText(screen.getByLabelText('Hodômetro Final (km)'), '10.095');
    fireEvent.press(screen.getByRole('button', { name: 'Fechar viagem' }));

    await confirmarNoAlerta();

    await waitFor(() => expect(repo.fecharViagem).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('alert')).toHaveTextContent('Viagem concluída com sucesso!');
    // Espera a entrada do Snackbar montar o timer de auto-dismiss.
    await waitFor(() => expect(Animated.timing).toHaveBeenCalled());
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Fechar viagem' })).toBeDisabled();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
