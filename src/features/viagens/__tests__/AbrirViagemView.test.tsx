import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Animated } from 'react-native';

import * as authStore from '@/features/auth/profileStore';
import type { UsuarioLogado } from '@/features/auth/profileStore';
import { AbrirViagemView } from '../AbrirViagemView';
import type { MotoristaSelecionavel, Resultado, RotaSelecionavel, VeiculoSelecionavel } from '../types';
import * as repo from '../viagensRepository';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

const mockVeiculo: VeiculoSelecionavel & {
  data_inclusao: string;
  data_atualizacao: string;
} = {
  id: 'veic-1',
  placa: 'BRA2E19',
  marca: 'Scania',
  modelo: 'R450',
  ano_fabricacao: null,
  capacidade_carga: 15,
  status: 'Disponivel',
  data_inclusao: '2026-10-18T10:00:00Z',
  data_atualizacao: '2026-10-18T10:00:00Z',
};

const mockVeiculo2: VeiculoSelecionavel & {
  data_inclusao: string;
  data_atualizacao: string;
} = {
  id: 'veic-2',
  placa: 'XYZ9A88',
  marca: 'Volvo',
  modelo: 'FH 540',
  ano_fabricacao: 2020,
  capacidade_carga: 30,
  status: 'Disponivel',
  data_inclusao: '2026-10-18T10:00:00Z',
  data_atualizacao: '2026-10-18T10:00:00Z',
};

const mockRota: RotaSelecionavel = {
  id: 'rota-1',
  cidade_origem: 'São Paulo',
  uf_origem: 'SP',
  cidade_destino: 'Curitiba',
  uf_destino: 'PR',
  distancia_estimada_km: 400,
};

const motoristaCarlos: MotoristaSelecionavel = {
  id: 'mot-1',
  nome: 'Carlos Motorista',
  email: 'carlos@transportadora.com',
};

const motoristaJoao: MotoristaSelecionavel = {
  id: 'mot-2',
  nome: 'João Motorista',
  email: 'joao@transportadora.com',
};

const gestorSelecionavel: MotoristaSelecionavel = {
  id: 'gest-1',
  nome: 'Gestor de Frota',
  email: 'gestor@transportadora.com',
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
  // A escolha dispara as consultas locais de status e hodômetro; deixa o estado assentado
  // dentro do act para o teste não acusar update fora dele.
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
  await waitFor(() => expect(repo.buscarVeiculoParaViagem).toHaveBeenCalledWith('veic-1'));

  if (opcoes?.ultimoHodometroPreenchido !== undefined) {
    await waitFor(() =>
      expect(screen.getByLabelText('Hodômetro inicial (km)')).toHaveDisplayValue(
        String(opcoes.ultimoHodometroPreenchido),
      ),
    );
  }

  fireEvent.press(screen.getByRole('button', { name: 'Rota' }));
  fireEvent.press(await screen.findByRole('button', { name: 'São Paulo/SP → Curitiba/PR' }));

  fireEvent.changeText(screen.getByLabelText('Hodômetro inicial (km)'), hodometro);
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
  em_revisao: false,
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
    jest.spyOn(repo, 'listarVeiculosParaViagem').mockResolvedValue({
      ok: true,
      data: [mockVeiculo, mockVeiculo2],
    });
    jest.spyOn(repo, 'buscarVeiculoParaViagem').mockResolvedValue({ ok: true, data: mockVeiculo });
    jest.spyOn(repo, 'listarRotasParaViagem').mockResolvedValue({ ok: true, data: [mockRota] });
    jest
      .spyOn(repo, 'listarMotoristasParaViagem')
      .mockResolvedValue({ ok: true, data: [gestorSelecionavel, motoristaCarlos, motoristaJoao] });
    jest.spyOn(repo, 'buscarUltimoHodometro').mockResolvedValue({ ok: true, data: null });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renderiza os campos Veículo, Rota, Motorista e Hodômetro inicial', async () => {
    render(<AbrirViagemView />);

    expect(await screen.findByText('Informações da nova viagem')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Veículo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rota' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Motorista' })).toBeTruthy();
    expect(screen.getByLabelText('Hodômetro inicial (km)')).toBeTruthy();
  });

  it('lê veículos, rotas e motoristas do cache local em vez do Supabase', async () => {
    render(<AbrirViagemView />);

    await screen.findByText('Informações da nova viagem');

    expect(repo.listarVeiculosParaViagem).toHaveBeenCalledTimes(1);
    expect(repo.listarRotasParaViagem).toHaveBeenCalledTimes(1);
    expect(repo.listarMotoristasParaViagem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mot-1' }),
    );
  });

  it('mostra carregando enquanto lê o cache local', async () => {
    let resolver: (valor: Resultado<VeiculoSelecionavel[]>) => void = () => {};
    const promessa = new Promise<Resultado<VeiculoSelecionavel[]>>((resolve) => {
      resolver = resolve;
    });
    jest.spyOn(repo, 'listarVeiculosParaViagem').mockReturnValue(promessa);

    render(<AbrirViagemView />);

    expect(screen.getByLabelText('Carregando dados da viagem')).toBeOnTheScreen();

    await act(async () => {
      resolver({ ok: true, data: [mockVeiculo] });
      await promessa;
    });

    expect(await screen.findByText('Informações da nova viagem')).toBeOnTheScreen();
  });

  it('mostra erro de leitura local e permite tentar novamente', async () => {
    jest
      .spyOn(repo, 'listarVeiculosParaViagem')
      .mockResolvedValueOnce({ ok: false, mensagem: 'Falha ao ler o cache local.' })
      .mockResolvedValueOnce({ ok: true, data: [mockVeiculo] });

    render(<AbrirViagemView />);

    expect(await screen.findByText('Não foi possível carregar os dados')).toBeOnTheScreen();
    expect(screen.getByText('Falha ao ler o cache local.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Informações da nova viagem')).toBeOnTheScreen();
    expect(repo.listarVeiculosParaViagem).toHaveBeenCalledTimes(2);
  });

  it('mostra estado vazio quando o cache não tem veículo disponível', async () => {
    jest.spyOn(repo, 'listarVeiculosParaViagem').mockResolvedValue({ ok: true, data: [] });

    render(<AbrirViagemView />);

    expect(await screen.findByText('Nenhum veículo disponível')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Todos os veículos estão em viagem ou em manutenção, ou o cache ainda não foi baixado. Conecte-se para atualizar.',
      ),
    ).toBeOnTheScreen();
  });

  it('mostra estado vazio quando o cache não tem rota ativa', async () => {
    jest.spyOn(repo, 'listarRotasParaViagem').mockResolvedValue({ ok: true, data: [] });

    render(<AbrirViagemView />);

    expect(await screen.findByText('Nenhuma rota ativa')).toBeOnTheScreen();
    expect(
      screen.getByText('Cadastre uma rota ativa ou conecte-se à internet para atualizar os dados.'),
    ).toBeOnTheScreen();
  });

  it.each([
    ['EmManutencao', 'Veículo em manutenção não pode sair em viagem.'],
    ['Inativo', 'Veículo inativo não pode sair em viagem.'],
    ['EmViagem', 'Este veículo já está em uma viagem em andamento.'],
  ] as const)('bloqueia veículo %s usando o status local', async (status, mensagem) => {
    jest
      .spyOn(repo, 'buscarVeiculoParaViagem')
      .mockResolvedValue({ ok: true, data: { ...mockVeiculo, status } });

    render(<AbrirViagemView />);
    await screen.findByText('Informações da nova viagem');
    await selecionarVeiculo('BRA2E19 • R450');

    expect(await screen.findByText(mensagem)).toBeOnTheScreen();
    expect(repo.buscarUltimoHodometro).not.toHaveBeenCalled();
  });

  it('Motorista não recebe nem prefila o último hodômetro de viagem que não enxerga', async () => {
    const spyHodometro = jest.spyOn(repo, 'buscarUltimoHodometro').mockResolvedValue({
      ok: true,
      data: 15000,
    });

    render(<AbrirViagemView />);
    await screen.findByText('Informações da nova viagem');
    await selecionarVeiculo('BRA2E19 • R450');

    await waitFor(() => expect(repo.buscarVeiculoParaViagem).toHaveBeenCalledWith('veic-1'));
    expect(spyHodometro).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Hodômetro inicial (km)')).toHaveDisplayValue('');
    expect(screen.queryByText(/Último hodômetro final registrado/)).not.toBeOnTheScreen();
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

  it('submete sem km_rodado e entende o milhar pt-BR', async () => {
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
    let resolverVeiculoA: (valor: Resultado<number | null>) => void = () => {};
    const respostaVeiculoA = new Promise<Resultado<number | null>>((resolve) => {
      resolverVeiculoA = resolve;
    });
    const spyHodometro = jest
      .spyOn(repo, 'buscarUltimoHodometro')
      .mockImplementation((id) =>
        id === 'veic-1' ? respostaVeiculoA : Promise.resolve({ ok: true, data: 20000 }),
      );

    render(<AbrirViagemView />);
    await screen.findByText('Informações da nova viagem');

    await selecionarVeiculo('BRA2E19 • R450');
    await waitFor(() => expect(spyHodometro).toHaveBeenCalledWith('veic-1'));

    await selecionarVeiculo('XYZ9A88 • FH 540');
    await waitFor(() => expect(spyHodometro).toHaveBeenCalledWith('veic-2'));
    await waitFor(() =>
      expect(screen.getByLabelText('Hodômetro inicial (km)')).toHaveDisplayValue('20000'),
    );

    // A resposta do veículo anterior chega tarde: não pode sobrescrever os 20.000 do novo.
    await act(async () => {
      resolverVeiculoA({ ok: true, data: 10000 });
      await respostaVeiculoA;
    });

    expect(screen.getByLabelText('Hodômetro inicial (km)')).toHaveDisplayValue('20000');
  });

  it('Admin/Gestor escolhe motorista na lista local e usa a si mesmo como padrão', async () => {
    (authStore.useProfile as jest.Mock).mockReturnValue(perfilDoUsuario(usuarioGestor));

    render(<AbrirViagemView />);
    await screen.findByText('Informações da nova viagem');

    expect(screen.getByText('Gestor de Frota')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Motorista' }));

    expect(await screen.findByRole('button', { name: 'João Motorista' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Carlos Motorista' })).toBeOnTheScreen();
  });

  it('motorista tem o campo Motorista travado nele mesmo', async () => {
    render(<AbrirViagemView />);
    await screen.findByText('Informações da nova viagem');

    expect(screen.getByRole('button', { name: 'Motorista' })).toBeDisabled();
    expect(screen.getByText('Carlos Motorista')).toBeOnTheScreen();
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
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Viagem aberta com sucesso! Os dados serão enviados quando houver conexão.',
    );
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
