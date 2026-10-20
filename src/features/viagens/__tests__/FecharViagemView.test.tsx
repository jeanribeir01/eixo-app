import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

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

describe('FecharViagemView', () => {
  const mockBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      back: mockBack,
    });
  });

  it('exibe dados da viagem e calcula distância offline ao digitar hodômetro final', async () => {
    jest.spyOn(repo, 'buscarViagemPorId').mockResolvedValue({
      ok: true,
      data: mockViagemAberta,
    });

    render(<FecharViagemView viagemId="viagem-1" />);

    expect(await screen.findByText('BRA2E19 • Actros', { exact: false })).toBeTruthy();
    expect(screen.getByText('Hodômetro Inicial: 10.000 km', { exact: false })).toBeTruthy();

    const input = screen.getByLabelText('Hodômetro Final (km)');
    fireEvent.changeText(input, '10080');

    // 10080 - 10000 = 80 km
    expect(await screen.findByText('Distância calculada: 80 km')).toBeTruthy();
  });

  it('exibe aviso visual quando a distância rodada ultrapassa muito a estimativa da rota (Passo 3.3)', async () => {
    jest.spyOn(repo, 'buscarViagemPorId').mockResolvedValue({
      ok: true,
      data: mockViagemAberta, // Estimada: 100 km
    });

    render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19 • Actros', { exact: false });

    const input = screen.getByLabelText('Hodômetro Final (km)');
    // 10150 - 10000 = 150 km (> 100 km * 1.2 = 120 km)
    fireEvent.changeText(input, '10150');

    expect(await screen.findByText(/excede a estimativa da rota/i)).toBeTruthy();
  });

  it('exibe confirmação com o texto "X km rodados, confirma?" e finaliza viagem (Passo 3.2)', async () => {
    jest.spyOn(repo, 'buscarViagemPorId').mockResolvedValue({
      ok: true,
      data: mockViagemAberta,
    });
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

    const input = screen.getByLabelText('Hodômetro Final (km)');
    // 10095 - 10000 = 95 km
    fireEvent.changeText(input, '10095');

    const botaoFechar = screen.getByRole('button', { name: 'Fechar viagem' });
    fireEvent.press(botaoFechar);

    // Texto de confirmação exigido
    expect(await screen.findByText('95 km rodados, confirma?')).toBeTruthy();

    const botaoConfirmar = screen.getByRole('button', { name: 'Confirmar' });
    fireEvent.press(botaoConfirmar);

    await waitFor(() => {
      expect(spyFechar).toHaveBeenCalledWith('viagem-1', {
        hodometro_final: 10095,
      });
    });
  });

  it('impede fechamento com hodômetro menor ou igual ao inicial', async () => {
    jest.spyOn(repo, 'buscarViagemPorId').mockResolvedValue({
      ok: true,
      data: mockViagemAberta,
    });

    render(<FecharViagemView viagemId="viagem-1" />);

    await screen.findByText('BRA2E19 • Actros', { exact: false });

    const input = screen.getByLabelText('Hodômetro Final (km)');
    fireEvent.changeText(input, '9999');

    const botaoFechar = screen.getByRole('button', { name: 'Fechar viagem' });
    fireEvent.press(botaoFechar);

    expect(await screen.findByText(/deve ser maior que o inicial/i)).toBeTruthy();
  });
});
