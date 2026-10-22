import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Animated } from 'react-native';

import * as authStore from '@/features/auth/profileStore';
import type { UsuarioLogado } from '@/features/auth/profileStore';
import * as rotasRepo from '@/features/rotas/rotasRepository';
import * as usuariosRepo from '@/features/usuarios/usuariosRepository';
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
  ano_fabricacao: null,
  capacidade_carga: 15,
  status: 'Disponivel' as const,
};

const mockVeiculo2 = {
  id: 'veic-2',
  placa: 'XYZ9A88',
  marca: 'Volvo',
  modelo: 'FH 540',
  ano_fabricacao: 2020,
  capacidade_carga: 30,
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

const usuarioMotorista = {
  id: 'mot-1',
  nome: 'Carlos Motorista',
  email: 'carlos@transportadora.com',
  perfil: 'Motorista' as const,
  status: 'Ativo' as const,
};

const usuarioGestor = {
  id: 'gest-1',
  nome: 'Gestor de Frota',
  email: 'gestor@transportadora.com',
  perfil: 'Gestor de Frota' as const,
  status: 'Ativo' as const,
};

function perfilDoUsuario(usuario: UsuarioLogado, extras?: Record<string, unknown>) {
  return {
    usuario,
    estado: 'pronto' as const,
    isAprovado: true,
    isAdmin: usuario.perfil === 'Admin',
    canSeeFinanceiro: usuario.perfil === 'Admin' || usuario.perfil === 'Financeiro',
    canSeeFrota: usuario.perfil === 'Admin' || usuario.perfil === 'Gestor de Frota',
    recarregar: jest.fn(),
    ...extras,
  };
}

async function selecionarVeiculo(nome: string) {
  fireEvent.press(screen.getByRole('button', { name: 'Veículo' }));
  const opcao = await screen.findByRole('button', { name: nome });
  // A escolha dispara uma consulta assíncrona de status; deixa o estado assentado dentro
  // do act para o teste não acusar update fora dele.
  await act(async () => {
    fireEvent.press(opcao);
    await Promise.resolve();
  });
}

async function preencherFormulario(
  hodometro: string,
  opcoes?: { ultimoHodometroPreenchido?: number },
) {
  await selecionarVeiculo('BRA2E19 • R450');
  await waitFor(() => expect(veiculosRepo.buscarVeiculoPorId).toHaveBeenCalledWith('veic-1'));

  if (opcoes?.ultimoHodometroPreenchido !== undefined) {
    await waitFor(() =>
      expect(screen.getByLabelText('Hodômetro Inicial (km)')).toHaveDisplayValue(
        String(opcoes.ultimoHodometroPreenchido),
      ),
    );
  }

  fireEvent.press(screen.getByRole('button', { name: 'Rota' }));
  fireEvent.press(await screen.findByRole('button', { name: 'São Paulo/SP → Curitiba/PR' }));

  fireEvent.changeText(screen.getByLabelText('Hodômetro Inicial (km)'), hodometro);
}

const viagemAberta = {
  id: 'v-nova',
  veiculo_id: 'veic-1',
  rota_id: 'rota-1',
  motorista_id: 'mot-1',
  hodometro_inicial: 15000,
  hodometro_final: null,
  data_inicio: '2026-10-18T10:00:00Z',
  data_fim: null,
  status: 'EmAndamento' as const,
  km_rodado: null,
  data_inclusao: '2026-10-18T10:00:00Z',
  data_atualizacao: '2026-10-18T10:00:00Z',
};

describe('AbrirViagemView', () => {
  const mockBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      back: mockBack,
    });
    jest.spyOn(authStore, 'useProfile').mockReturnValue(perfilDoUsuario(usuarioMotorista));
    jest.spyOn(veiculosRepo, 'listarVeiculosSelecionaveis').mockResolvedValue({
      ok: true,
      data: [mockVeiculo, mockVeiculo2],
    });
    jest.spyOn(veiculosRepo, 'buscarVeiculoPorId').mockResolvedValue({
      ok: true,
      data: mockVeiculo,
    });
    jest.spyOn(rotasRepo, 'listarRotas').mockResolvedValue({
      ok: true,
      data: [mockRota],
    });
    jest.spyOn(usuariosRepo, 'listarUsuarios').mockResolvedValue({ ok: true, data: [] });
    jest.spyOn(repo, 'buscarUltimoHodometro').mockResolvedValue({ ok: true, data: null });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renderiza os campos solicitados: Veículo, Rota, Motorista e Hodômetro Inicial', async () => {
    render(<AbrirViagemView />);

    await waitFor(() => expect(veiculosRepo.listarVeiculosSelecionaveis).toHaveBeenCalled());
    expect(screen.getByText('Informações da nova viagem')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Veículo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rota' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Motorista' })).toBeTruthy();
    expect(screen.getByLabelText('Hodômetro Inicial (km)')).toBeTruthy();
  });

  it('busca só os veículos selecionáveis para viagem', async () => {
    render(<AbrirViagemView />);

    await screen.findByText('Informações da nova viagem');

    // A exclusão de veículos em manutenção/inativos é feita pelo repositório e está coberta
    // em src/features/veiculos/__tests__/repository.test.ts; aqui garantimos a fonte correta.
    expect(veiculosRepo.listarVeiculosSelecionaveis).toHaveBeenCalledWith('viagem');
  });

  it.each([
    ['EmManutencao', 'Veículo em manutenção não pode sair em viagem.'],
    ['Inativo', 'Veículo inativo não pode sair em viagem.'],
  ] as const)('bloqueia veículo %s usando o status atual', async (status, mensagem) => {
    jest.spyOn(veiculosRepo, 'buscarVeiculoPorId').mockResolvedValue({
      ok: true,
      data: { ...mockVeiculo, status },
    });

    render(<AbrirViagemView />);
    await screen.findByText('Informações da nova viagem');
    await selecionarVeiculo('BRA2E19 • R450');

    expect(await screen.findByText(mensagem)).toBeOnTheScreen();
  });

  it('Motorista não recebe nem prefila o último hodômetro de viagem que não enxerga', async () => {
    const spyHodometro = jest.spyOn(repo, 'buscarUltimoHodometro').mockResolvedValue({
      ok: true,
      data: 15000,
    });

    render(<AbrirViagemView />);
    await screen.findByText('Informações da nova viagem');
    await selecionarVeiculo('BRA2E19 • R450');

    await waitFor(() => expect(veiculosRepo.buscarVeiculoPorId).toHaveBeenCalledWith('veic-1'));
    expect(spyHodometro).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Hodômetro Inicial (km)')).toHaveDisplayValue('');
    expect(screen.queryByText(/Último hodômetro final registrado/)).not.toBeOnTheScreen();
  });

  it('bloqueia veículo que outro motorista deixou em viagem', async () => {
    jest.spyOn(veiculosRepo, 'buscarVeiculoPorId').mockResolvedValue({
      ok: true,
      data: { ...mockVeiculo, status: 'EmViagem' },
    });

    render(<AbrirViagemView />);
    await screen.findByText('Informações da nova viagem');
    await selecionarVeiculo('BRA2E19 • R450');

    expect(
      await screen.findByText('Este veículo já está em uma viagem em andamento.'),
    ).toBeOnTheScreen();
    expect(repo.buscarUltimoHodometro).not.toHaveBeenCalled();
  });

  it('valida veículo e rota com as mensagens do schema antes de chamar o repositório', async () => {
    const spyAbrir = jest.spyOn(repo, 'abrirViagem');

    render(<AbrirViagemView />);
    await screen.findByText('Informações da nova viagem');

    fireEvent.press(screen.getByRole('button', { name: 'Abrir viagem' }));

    expect(await screen.findByText('Selecione um veículo.')).toBeTruthy();
    expect(screen.getByText('Selecione uma rota.')).toBeTruthy();
    expect(spyAbrir).not.toHaveBeenCalled();
  });

  it('usa a mensagem do schema para hodômetro inicial inválido', async () => {
    const spyAbrir = jest.spyOn(repo, 'abrirViagem');

    render(<AbrirViagemView />);
    await screen.findByText('Informações da nova viagem');
    await preencherFormulario('abc');

    fireEvent.press(screen.getByRole('button', { name: 'Abrir viagem' }));

    expect(await screen.findByText('Informe um número para o hodômetro inicial.')).toBeTruthy();
    expect(spyAbrir).not.toHaveBeenCalled();
  });

  it('impede abrir viagem com hodômetro inicial menor que o último final do veículo', async () => {
    (authStore.useProfile as jest.Mock).mockReturnValue(perfilDoUsuario(usuarioGestor));
    jest.spyOn(repo, 'buscarUltimoHodometro').mockResolvedValue({ ok: true, data: 15000 });
    const spyAbrir = jest.spyOn(repo, 'abrirViagem').mockResolvedValue({
      ok: true,
      data: viagemAberta,
    });

    render(<AbrirViagemView />);
    await screen.findByText('Informações da nova viagem');
    await preencherFormulario('14000', { ultimoHodometroPreenchido: 15000 });

    fireEvent.press(screen.getByRole('button', { name: 'Abrir viagem' }));

    expect(
      await screen.findByText(
        'O hodômetro inicial não pode ser menor que o último final (15.000 km).',
      ),
    ).toBeOnTheScreen();
    expect(spyAbrir).not.toHaveBeenCalled();
  });

  it('permite abrir viagem com hodômetro inicial igual ao último final do veículo', async () => {
    (authStore.useProfile as jest.Mock).mockReturnValue(perfilDoUsuario(usuarioGestor));
    jest.spyOn(repo, 'buscarUltimoHodometro').mockResolvedValue({ ok: true, data: 15000 });
    const spyAbrir = jest.spyOn(repo, 'abrirViagem').mockResolvedValue({
      ok: true,
      data: viagemAberta,
    });

    render(<AbrirViagemView />);
    await screen.findByText('Informações da nova viagem');
    await preencherFormulario('15000', { ultimoHodometroPreenchido: 15000 });
    expect(screen.getByText('Último hodômetro final registrado: 15.000 km')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Abrir viagem' }));

    await waitFor(() => {
      expect(spyAbrir).toHaveBeenCalledWith(
        expect.objectContaining({ hodometro_inicial: 15000 }),
      );
    });
    expect(screen.queryByText(/menor que o último final/i)).not.toBeOnTheScreen();
  });

  it('submete o formulário chamando abrirViagem sem enviar km_rodado e entende o milhar pt-BR', async () => {
    const spyAbrir = jest.spyOn(repo, 'abrirViagem').mockResolvedValue({
      ok: true,
      data: viagemAberta,
    });

    render(<AbrirViagemView />);

    await screen.findByText('Informações da nova viagem');
    await preencherFormulario('15.000');

    fireEvent.press(screen.getByRole('button', { name: 'Abrir viagem' }));

    await waitFor(() => {
      expect(spyAbrir).toHaveBeenCalledWith(
        expect.objectContaining({
          veiculo_id: 'veic-1',
          rota_id: 'rota-1',
          motorista_id: 'mot-1',
          hodometro_inicial: 15000,
        }),
      );
    });

    const payloadChamado = spyAbrir.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payloadChamado.km_rodado).toBeUndefined();
  });

  it('limpa o hodômetro ao trocar de veículo e ignora a resposta atrasada do anterior', async () => {
    (authStore.useProfile as jest.Mock).mockReturnValue(perfilDoUsuario(usuarioGestor));
    let resolverVeiculoA: (valor: Awaited<ReturnType<typeof repo.buscarUltimoHodometro>>) => void = () => {};
    const respostaVeiculoA = new Promise<Awaited<ReturnType<typeof repo.buscarUltimoHodometro>>>((resolve) => {
      resolverVeiculoA = resolve;
    });
    const spyHodometro = jest.spyOn(repo, 'buscarUltimoHodometro').mockImplementation((id) =>
      id === 'veic-1' ? respostaVeiculoA : Promise.resolve({ ok: true, data: 20000 }),
    );

    render(<AbrirViagemView />);
    await screen.findByText('Informações da nova viagem');

    await selecionarVeiculo('BRA2E19 • R450');
    await waitFor(() => expect(spyHodometro).toHaveBeenCalledWith('veic-1'));

    await selecionarVeiculo('XYZ9A88 • FH 540');
    await waitFor(() => expect(spyHodometro).toHaveBeenCalledWith('veic-2'));
    await waitFor(() =>
      expect(screen.getByLabelText('Hodômetro Inicial (km)')).toHaveDisplayValue('20000'),
    );

    // A resposta do veículo anterior chega tarde: não pode sobrescrever os 20.000 do novo.
    await act(async () => {
      resolverVeiculoA({ ok: true, data: 10000 });
      await respostaVeiculoA;
    });

    expect(screen.getByLabelText('Hodômetro Inicial (km)')).toHaveDisplayValue('20000');
  });

  it('Admin/Gestor vê só motoristas (e a si mesmo como padrão), nunca Admin/Financeiro de outros', async () => {
    const admin = {
      id: 'adm-1',
      nome: 'Admin Logado',
      email: 'admin@transportadora.com',
      perfil: 'Admin' as const,
      status: 'Ativo' as const,
    };
    const outroAdmin = {
      id: 'adm-2',
      nome: 'Outro Admin',
      email: 'outro@transportadora.com',
      perfil: 'Admin' as const,
      status: 'Ativo' as const,
    };
    const financeira = {
      id: 'fin-1',
      nome: 'Ana Financeira',
      email: 'ana@transportadora.com',
      perfil: 'Financeiro' as const,
      status: 'Ativo' as const,
    };

    (authStore.useProfile as jest.Mock).mockReturnValue(perfilDoUsuario(admin));
    jest.spyOn(usuariosRepo, 'listarUsuarios').mockResolvedValue({
      ok: true,
      data: [
        { ...admin, perfil: { id: 'p-adm', nome: 'Admin' } },
        { ...outroAdmin, perfil: { id: 'p-adm', nome: 'Admin' } },
        { ...financeira, perfil: { id: 'p-fin', nome: 'Financeiro' } },
        {
          id: 'mot-2',
          nome: 'João Motorista',
          email: 'joao@transportadora.com',
          perfil: { id: 'p-mot', nome: 'Motorista' },
          status: 'Ativo',
        },
      ],
    });

    render(<AbrirViagemView />);
    await screen.findByText('Informações da nova viagem');

    // O Admin logado é o padrão, mas continua selecionável por ser ele mesmo.
    expect(screen.getByText('Admin Logado')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Motorista' }));

    expect(await screen.findByRole('button', { name: 'João Motorista' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Outro Admin' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ana Financeira' })).not.toBeOnTheScreen();
  });

  it('mantém o botão em loading e só volta quando o Snackbar de sucesso é dispensado', async () => {
    jest.useFakeTimers();
    jest.spyOn(Animated, 'timing');
    jest.spyOn(repo, 'abrirViagem').mockResolvedValue({ ok: true, data: viagemAberta });

    render(<AbrirViagemView />);
    await screen.findByText('Informações da nova viagem');
    await preencherFormulario('15000');

    fireEvent.press(screen.getByRole('button', { name: 'Abrir viagem' }));

    await waitFor(() => expect(repo.abrirViagem).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('alert')).toHaveTextContent('Viagem aberta com sucesso!');
    // Espera a entrada do Snackbar montar o timer de auto-dismiss.
    await waitFor(() => expect(Animated.timing).toHaveBeenCalled());
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Abrir viagem' })).toBeDisabled();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
