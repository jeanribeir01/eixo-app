import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import * as authStore from '@/features/auth/profileStore';
import * as rotasRepo from '@/features/rotas/rotasRepository';
import * as veiculosRepo from '@/features/veiculos/repository';
import { AbrirViagemView } from '../AbrirViagemView';
import * as repo from '../viagensRepository';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

const mockVeiculo = {
  id: 'veic-1',
  placa: 'BRA2E19',
  marca: 'Scania',
  modelo: 'R450',
  capacidade_carga: 15,
  status: 'Disponivel' as const,
};

const mockRota = {
  id: 'rota-1',
  cidade_origem: 'São Paulo',
  uf_origem: 'SP' as const,
  cidade_destino: 'Curitiba',
  uf_destino: 'PR' as const,
  distancia_estimada_km: 400,
  ativa: true,
  viagens_finalizadas: 5,
};

describe('AbrirViagemView', () => {
  const mockBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      back: mockBack,
    });
    jest.spyOn(authStore, 'useProfile').mockReturnValue({
      usuario: {
        id: 'mot-1',
        nome: 'Carlos Motorista',
        email: 'carlos@transportadora.com',
        perfil: 'Motorista',
        status: 'Ativo',
      },
      estado: 'pronto',
      isAprovado: true,
      isAdmin: false,
      canSeeFinanceiro: false,
      canSeeFrota: false,
      recarregar: jest.fn(),
    });
    jest.spyOn(veiculosRepo, 'listarVeiculos').mockResolvedValue({
      ok: true,
      data: [mockVeiculo],
    });
    jest.spyOn(rotasRepo, 'listarRotas').mockResolvedValue({
      ok: true,
      data: [mockRota],
    });
  });

  it('renderiza os campos solicitados: Veículo, Rota, Motorista e Hodômetro Inicial', async () => {
    render(<AbrirViagemView />);

    expect(await screen.findByText('Informações da nova viagem')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Veículo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rota' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Motorista' })).toBeTruthy();
    expect(screen.getByLabelText('Hodômetro Inicial (km)')).toBeTruthy();
  });

  it('submete o formulário chamando abrirViagem sem enviar km_rodado', async () => {
    const spyAbrir = jest.spyOn(repo, 'abrirViagem').mockResolvedValue({
      ok: true,
      data: {
        id: 'v-nova',
        veiculo_id: 'veic-1',
        rota_id: 'rota-1',
        motorista_id: 'mot-1',
        hodometro_inicial: 10000,
        hodometro_final: null,
        data_inicio: '2026-10-18T10:00:00Z',
        data_fim: null,
        status: 'EmAndamento',
        km_rodado: null,
        data_inclusao: '2026-10-18T10:00:00Z',
        data_atualizacao: '2026-10-18T10:00:00Z',
      },
    });

    render(<AbrirViagemView />);

    await screen.findByText('Informações da nova viagem');

    // Seleciona Veículo
    fireEvent.press(screen.getByRole('button', { name: 'Veículo' }));
    fireEvent.press(await screen.findByRole('button', { name: 'BRA2E19 • R450' }));

    // Seleciona Rota
    fireEvent.press(screen.getByRole('button', { name: 'Rota' }));
    fireEvent.press(await screen.findByRole('button', { name: 'São Paulo/SP → Curitiba/PR' }));

    // Preenche hodômetro
    const inputHodometro = screen.getByLabelText('Hodômetro Inicial (km)');
    fireEvent.changeText(inputHodometro, '10000');

    // Submete
    const botaoSalvar = screen.getByRole('button', { name: 'Abrir viagem' });
    fireEvent.press(botaoSalvar);

    await waitFor(() => {
      expect(spyAbrir).toHaveBeenCalledWith(
        expect.objectContaining({
          veiculo_id: 'veic-1',
          rota_id: 'rota-1',
          motorista_id: 'mot-1',
          hodometro_inicial: 10000,
        }),
      );
    });

    const payloadChamado = spyAbrir.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payloadChamado.km_rodado).toBeUndefined();
  });
});
