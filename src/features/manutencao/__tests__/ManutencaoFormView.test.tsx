import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listarVeiculosSelecionaveis } from '@/features/veiculos/repository';
import type { Veiculo } from '@/features/veiculos/types';

import { ManutencaoFormView } from '../ManutencaoFormView';
import { listarFormasPagamentoAtivas, registrarManutencao } from '../manutencaoRepository';
import type { FormaPagamentoOpcao } from '../types';

// O runner do GitHub Actions é mais lento que a máquina local: o padrão de 5s estourava no CI.
jest.setTimeout(15000);

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
}));

// Os veículos vêm do contrato compartilhado da EIX-79, não do repositório da manutenção.
jest.mock('@/features/veiculos/repository', () => ({
  listarVeiculosSelecionaveis: jest.fn(),
}));

jest.mock('../manutencaoRepository', () => ({
  listarFormasPagamentoAtivas: jest.fn(),
  registrarManutencao: jest.fn(),
}));

const mockVeiculos = listarVeiculosSelecionaveis as jest.MockedFunction<typeof listarVeiculosSelecionaveis>;
const mockFormas = listarFormasPagamentoAtivas as jest.MockedFunction<typeof listarFormasPagamentoAtivas>;
const mockRegistrar = registrarManutencao as jest.MockedFunction<typeof registrarManutencao>;

// O Jest roda com TZ=America/Sao_Paulo (jest.global-setup.js): "hoje" no aparelho é 18/10/2026.
const HOJE = new Date(2026, 9, 18, 10, 0);

const veiculos: Veiculo[] = [
  {
    id: 'v1',
    placa: 'ABC1234',
    marca: 'Volvo',
    modelo: 'FH 540',
    ano_fabricacao: 2020,
    capacidade_carga: 30000,
    status: 'Disponivel',
  },
  {
    id: 'v2',
    placa: 'BRA2E19',
    marca: 'Scania',
    modelo: 'R 450',
    ano_fabricacao: 2022,
    capacidade_carga: 25000,
    status: 'EmManutencao',
  },
];
const formas: FormaPagamentoOpcao[] = [
  { id: 'f1', nome: 'Boleto' },
  { id: 'f2', nome: 'Pix' },
];

function escolher(campo: string, opcao: string) {
  fireEvent.press(screen.getByRole('button', { name: campo }));
  fireEvent.press(screen.getByRole('button', { name: opcao }));
}

function preencher() {
  escolher('Veículo', 'ABC-1234 · Volvo FH 540');
  fireEvent.changeText(screen.getByLabelText('Descrição do serviço'), '  Troca de pneus  ');
  fireEvent.changeText(screen.getByLabelText('Valor total'), '113');
  escolher('Forma de pagamento', 'Pix');
}

async function salvar() {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  });
}

async function renderPronto() {
  render(<ManutencaoFormView />);
  await screen.findByLabelText('Descrição do serviço');
}

beforeEach(() => {
  mockBack.mockReset();
  mockVeiculos.mockReset().mockResolvedValue({ ok: true, data: veiculos });
  mockFormas.mockReset().mockResolvedValue({ ok: true, data: formas });
  mockRegistrar.mockReset();
  jest.useFakeTimers().setSystemTime(HOJE);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ManutencaoFormView — campos', () => {
  // MAN-01, MAN-04
  it('mostra os seis campos, com a data de hoje e o status Pendente', async () => {
    render(<ManutencaoFormView />);

    expect(screen.getByLabelText('Carregando formulário')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Veículo' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Data da manutenção')).toHaveProp('value', '18/10/2026');
    expect(screen.getByLabelText('Descrição do serviço')).toBeOnTheScreen();
    expect(screen.getByLabelText('Valor total')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Forma de pagamento' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Pendente' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Pago' })).not.toBeSelected();
    // Tela interna: header nativo, formulário rola e sobe com o teclado.
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).not.toContain('top');
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).findByType(ScrollView).props.keyboardShouldPersistTaps).toBe(
      'handled',
    );
  });

  // MAN-02
  it('o seletor de Veículo mostra "PLACA · Marca Modelo" dos veículos selecionáveis para manutenção', async () => {
    await renderPronto();

    fireEvent.press(screen.getByRole('button', { name: 'Veículo' }));

    // 'manutencao' = Disponível e Em Manutenção; veículo em viagem não chega ao seletor.
    expect(mockVeiculos).toHaveBeenCalledTimes(1);
    expect(mockVeiculos).toHaveBeenCalledWith('manutencao');
    expect(screen.getByRole('button', { name: 'ABC-1234 · Volvo FH 540' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'BRA2E19 · Scania R 450' })).toBeOnTheScreen();
  });

  // MAN-03
  it('o seletor de Forma de pagamento mostra as formas ativas', async () => {
    await renderPronto();

    fireEvent.press(screen.getByRole('button', { name: 'Forma de pagamento' }));

    expect(mockFormas).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Boleto' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Pix' })).toBeOnTheScreen();
  });
});

describe('ManutencaoFormView — salvar', () => {
  // MAN-05
  it('caminho feliz: registra, mostra o Snackbar e volta à lista', async () => {
    mockRegistrar.mockResolvedValue({ ok: true, data: 'm1' });
    await renderPronto();

    preencher();
    fireEvent.press(screen.getByRole('tab', { name: 'Pago' }));
    await salvar();

    expect(mockRegistrar).toHaveBeenCalledWith({
      veiculoId: 'v1',
      dataManutencao: '2026-10-18',
      descricao: 'Troca de pneus',
      valorCentavos: 113,
      formaPagamentoId: 'f2',
      statusPagamento: 'Pago',
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Manutenção registrada. O veículo está em manutenção.');

    act(() => {
      jest.advanceTimersByTime(1200);
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  // MAN-06, MAN-07, MAN-09, MAN-10, MAN-11
  it('campos vazios bloqueiam o envio com a mensagem de cada campo', async () => {
    await renderPronto();

    fireEvent.changeText(screen.getByLabelText('Data da manutenção'), '');
    await salvar();

    expect(screen.getByText('Escolha o veículo.')).toBeOnTheScreen();
    expect(screen.getByText('Informe a data da manutenção.')).toBeOnTheScreen();
    expect(screen.getByText('Descreva o serviço.')).toBeOnTheScreen();
    expect(screen.getByText('Informe um valor maior que zero.')).toBeOnTheScreen();
    expect(screen.getByText('Escolha a forma de pagamento.')).toBeOnTheScreen();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  // MAN-08
  it('data futura bloqueia o envio', async () => {
    await renderPronto();

    preencher();
    fireEvent.changeText(screen.getByLabelText('Data da manutenção'), '19102026');
    await salvar();

    expect(screen.getByText('A data da manutenção não pode ser futura.')).toBeOnTheScreen();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  // MAN-12
  it('descrição com mais de 100 caracteres bloqueia o envio', async () => {
    await renderPronto();

    preencher();
    expect(screen.getByLabelText('Descrição do serviço')).toHaveProp('maxLength', 100);
    fireEvent.changeText(screen.getByLabelText('Descrição do serviço'), 'a'.repeat(101));
    await salvar();

    expect(screen.getByText('A descrição pode ter no máximo 100 caracteres.')).toBeOnTheScreen();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  // MAN-13, MAN-14
  it.each([
    'Veículo em viagem não pode entrar em manutenção. Feche a viagem antes.',
    'Forma de pagamento inativa. Escolha outra.',
  ])('recusa do banco mostra o Snackbar "%s", libera o "Salvar" e não volta', async (mensagem) => {
    mockRegistrar.mockResolvedValue({ ok: false, mensagem });
    await renderPronto();

    preencher();
    await salvar();

    expect(screen.getByRole('alert')).toHaveTextContent(mensagem);
    // Depois da recusa o usuário corrige e tenta de novo.
    expect(screen.getByRole('button', { name: 'Salvar' })).not.toBeDisabled();
    act(() => {
      jest.advanceTimersByTime(1200);
    });
    expect(mockBack).not.toHaveBeenCalled();
  });

  // MAN-15
  it('enquanto salva e depois do sucesso, o "Salvar" fica em loading e ignora novos toques', async () => {
    let concluir: (valor: Awaited<ReturnType<typeof registrarManutencao>>) => void = () => undefined;
    mockRegistrar.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    await renderPronto();
    preencher();

    await salvar();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await salvar();
    expect(mockRegistrar).toHaveBeenCalledTimes(1);

    // Depois do sucesso o botão continua em loading até a tela fechar: um segundo toque gravaria
    // outra manutenção e outra despesa, porque o banco aceita duas ordens abertas no mesmo veículo.
    await act(async () => concluir({ ok: true, data: 'm1' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Manutenção registrada. O veículo está em manutenção.');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await salvar();
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
  });
});

describe('ManutencaoFormView — carga das opções', () => {
  // MAN-40: as duas cargas rodam em paralelo, e a falha de qualquer uma delas tem que aparecer.
  // Um caso por fonte (lição L-025): testar só uma deixava passar a tela que ignora a outra.
  it.each([
    [
      'dos veículos',
      () =>
        mockVeiculos
          .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar os veículos selecionáveis. Tente novamente.' })
          .mockResolvedValueOnce({ ok: true, data: veiculos }),
      'Não foi possível carregar os veículos selecionáveis. Tente novamente.',
      () => mockVeiculos,
    ],
    [
      'das formas de pagamento',
      () =>
        mockFormas
          .mockResolvedValueOnce({ ok: false, mensagem: 'Não foi possível carregar as formas de pagamento. Tente novamente.' })
          .mockResolvedValueOnce({ ok: true, data: formas }),
      'Não foi possível carregar as formas de pagamento. Tente novamente.',
      () => mockFormas,
    ],
  ])('falha na carga %s mostra o erro em português e "Tentar novamente" carrega de novo', async (_fonte, falhar, mensagem, fonte) => {
    falhar();
    render(<ManutencaoFormView />);

    expect(await screen.findByText(mensagem)).toBeOnTheScreen();
    expect(screen.queryByLabelText('Descrição do serviço')).not.toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    });

    expect(await screen.findByLabelText('Descrição do serviço')).toBeOnTheScreen();
    expect(fonte()).toHaveBeenCalledTimes(2);
  });

  // MAN-40: o Gestor de Frota vê lista vazia até a T9 (RLS de forma_pagamento).
  it('sem forma ativa, o seletor avisa "Nenhuma forma de pagamento ativa."', async () => {
    mockFormas.mockResolvedValue({ ok: true, data: [] });
    await renderPronto();

    fireEvent.press(screen.getByRole('button', { name: 'Forma de pagamento' }));

    expect(screen.getByText('Nenhuma forma de pagamento ativa.')).toBeOnTheScreen();
  });
});
