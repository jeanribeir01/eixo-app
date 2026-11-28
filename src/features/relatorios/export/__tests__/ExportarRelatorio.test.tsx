import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Modal } from 'react-native';

import { periodoDoMes } from '@/features/dashboard/periodo';
import { MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
import { todosPorTipo } from '@/testing/componentes';
import { colors } from '@/ui/tokens';

import { compartilharArquivo, gerarArquivoCsv, gerarArquivoPdf } from '../compartilhar';
import { ExportarRelatorio } from '../ExportarRelatorio';
import type { TransacaoRelatorio } from '../linhas';
import { buscarTransacoesDoPeriodo } from '../queries';

jest.mock('../queries', () => ({ ...jest.requireActual('../queries'), buscarTransacoesDoPeriodo: jest.fn() }));
// As funções puras (CSV, HTML, nome) rodam de verdade; só o que toca módulo nativo é falso.
jest.mock('../compartilhar', () => ({
  ...jest.requireActual('../compartilhar'),
  gerarArquivoCsv: jest.fn(),
  gerarArquivoPdf: jest.fn(),
  compartilharArquivo: jest.fn(),
}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const mockBuscar = buscarTransacoesDoPeriodo as jest.MockedFunction<typeof buscarTransacoesDoPeriodo>;
const mockCsv = gerarArquivoCsv as jest.MockedFunction<typeof gerarArquivoCsv>;
const mockPdf = gerarArquivoPdf as jest.MockedFunction<typeof gerarArquivoPdf>;
const mockCompartilhar = compartilharArquivo as jest.MockedFunction<typeof compartilharArquivo>;

const ERRO = 'Não foi possível gerar o relatório. Tente novamente.';
const NOVEMBRO = periodoDoMes(2026, 11);

const TRANSACOES: TransacaoRelatorio[] = [
  {
    id: 'a',
    dataReferencia: '2026-11-05',
    descricao: 'Manutenção do câmbio',
    categoria: 'Manutenção',
    tipo: 'Saida',
    valorCentavos: 123456,
    status: 'Pago',
  },
];

const onFeedback = jest.fn();

// A folha aberta (escolha do formato ou aviso de período vazio) aparece na árvore com os botões.
function folha() {
  return within(screen.getByTestId('folha'));
}

function botoesDaFolha() {
  return folha()
    .getAllByRole('button')
    .map((botao) => botao.props.accessibilityLabel);
}

// Toca no botão da folha pelo texto e espera o fluxo assíncrono andar.
async function tocarNaFolha(texto: string) {
  await act(async () => {
    await fireEvent.press(folha().getByRole('button', { name: texto }));
  });
}

async function renderizar() {
  await render(<ExportarRelatorio periodo={NOVEMBRO} onFeedback={onFeedback} />);
}

function botaoExportar() {
  return screen.getByRole('button', { name: 'Exportar relatório de Novembro 2026' });
}

beforeEach(() => {
  onFeedback.mockReset();
  mockBuscar.mockReset().mockResolvedValue({ ok: true, data: TRANSACOES });
  mockCsv.mockReset().mockResolvedValue({ ok: true, data: { uri: 'file:///cache/eixo-certo-2026-11.csv', formato: 'csv' } });
  mockPdf.mockReset().mockResolvedValue({ ok: true, data: { uri: 'file:///cache/eixo-certo-2026-11.pdf', formato: 'pdf' } });
  mockCompartilhar.mockReset().mockResolvedValue({ ok: true, data: null });
});

describe('ExportarRelatorio', () => {
  it('mostra o botão Exportar primário (accentStrong, DESIGN-CYAN 2.0) com o período no nome acessível (EXP-01)', async () => {
    await renderizar();

    expect(screen.getByText('Exportar')).toBeTruthy();
    expect(botaoExportar()).toHaveStyle({ backgroundColor: colors.accentStrong });
    expect(botaoExportar().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
  });

  it('PDF usa o nome da empresa do .env no cabeçalho (EXP-10)', async () => {
    process.env.EXPO_PUBLIC_NOME_EMPRESA = 'Transportes Silva';
    try {
      await renderizar();
      await fireEvent.press(botaoExportar());

      await tocarNaFolha('PDF');

      const [, html] = mockPdf.mock.calls[0];
      expect(html).toContain('<h1>Transportes Silva</h1>');
    } finally {
      delete process.env.EXPO_PUBLIC_NOME_EMPRESA;
    }
  });

  it('erro inesperado ao montar o arquivo vira Snackbar de erro e devolve o botão (EXP-18)', async () => {
    mockCsv.mockRejectedValue(new Error('inesperado'));
    await renderizar();
    await fireEvent.press(botaoExportar());

    await tocarNaFolha('Planilha (CSV)');

    expect(onFeedback).toHaveBeenCalledWith(ERRO, 'error');
    expect(mockCompartilhar).not.toHaveBeenCalled();
    expect(botaoExportar().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
  });

  it('tocar em Exportar pergunta o formato e não consulta nada antes (EXP-03)', async () => {
    await renderizar();

    await fireEvent.press(botaoExportar());

    expect(folha().getByText('Exportar relatório')).toBeOnTheScreen();
    expect(folha().getByText('Transações de Novembro 2026. Em qual formato?')).toBeOnTheScreen();
    expect(botoesDaFolha()).toEqual(['Planilha (CSV)', 'PDF', 'Cancelar']);
    expect(mockBuscar).not.toHaveBeenCalled();
  });

  it('CSV: busca o período, grava o CSV com o nome do período, compartilha e avisa (EXP-15)', async () => {
    await renderizar();
    await fireEvent.press(botaoExportar());

    await tocarNaFolha('Planilha (CSV)');

    expect(mockBuscar).toHaveBeenCalledWith(NOVEMBRO);
    expect(mockCsv).toHaveBeenCalledWith(
      'eixo-certo-2026-11.csv',
      '﻿Data;Descrição;Categoria;Valor;Status\r\n05/11/2026;Manutenção do câmbio;Manutenção;-1234,56;Pago\r\n',
    );
    expect(mockCompartilhar).toHaveBeenCalledWith({ uri: 'file:///cache/eixo-certo-2026-11.csv', formato: 'csv' });
    expect(onFeedback).toHaveBeenCalledWith('Relatório gerado.', 'success');
    expect(mockPdf).not.toHaveBeenCalled();
  });

  it('PDF: monta o HTML com empresa, período e linhas, gera o PDF e compartilha (EXP-10, EXP-15)', async () => {
    await renderizar();
    await fireEvent.press(botaoExportar());

    await tocarNaFolha('PDF');

    expect(mockPdf).toHaveBeenCalledTimes(1);
    const [nome, html] = mockPdf.mock.calls[0];
    expect(nome).toBe('eixo-certo-2026-11.pdf');
    // Sem EXPO_PUBLIC_NOME_EMPRESA no ambiente de teste, o padrão.
    expect(html).toContain('<h1>Eixo Certo</h1>');
    expect(html).toContain('Período: Novembro 2026');
    expect(html).toContain('<td>Manutenção do câmbio</td>');
    expect(mockCompartilhar).toHaveBeenCalledWith({ uri: 'file:///cache/eixo-certo-2026-11.pdf', formato: 'pdf' });
    expect(onFeedback).toHaveBeenCalledWith('Relatório gerado.', 'success');
  });

  it('fica em loading e ignora toques enquanto exporta, e volta ao fim (EXP-16)', async () => {
    let terminarEnvio: (valor: { ok: true; data: null }) => void = () => {};
    mockCompartilhar.mockReturnValue(new Promise((resolver) => (terminarEnvio = resolver)));
    await renderizar();
    await fireEvent.press(botaoExportar());

    await tocarNaFolha('PDF');

    expect(botaoExportar().props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await fireEvent.press(botaoExportar());
    expect(screen.queryByTestId('folha')).not.toBeOnTheScreen();
    expect(onFeedback).not.toHaveBeenCalled();

    await act(async () => terminarEnvio({ ok: true, data: null }));

    expect(botaoExportar().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
    expect(onFeedback).toHaveBeenCalledWith('Relatório gerado.', 'success');
  });

  it.each([
    [MENSAGEM_ACESSO_NEGADO],
    [ERRO],
  ])('erro na busca mostra "%s" e não gera nem compartilha (EXP-17)', async (mensagem) => {
    mockBuscar.mockResolvedValue({ ok: false, mensagem });
    await renderizar();
    await fireEvent.press(botaoExportar());

    await tocarNaFolha('Planilha (CSV)');

    expect(onFeedback).toHaveBeenCalledWith(mensagem, 'error');
    expect(mockCsv).not.toHaveBeenCalled();
    expect(mockCompartilhar).not.toHaveBeenCalled();
    expect(botaoExportar().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
  });

  it('erro ao gravar o CSV mostra a mensagem e não compartilha (EXP-18)', async () => {
    mockCsv.mockResolvedValue({ ok: false, mensagem: ERRO });
    await renderizar();
    await fireEvent.press(botaoExportar());

    await tocarNaFolha('Planilha (CSV)');

    expect(onFeedback).toHaveBeenCalledWith(ERRO, 'error');
    expect(onFeedback).not.toHaveBeenCalledWith('Relatório gerado.', 'success');
    expect(mockCompartilhar).not.toHaveBeenCalled();
  });

  it('erro ao gerar o PDF mostra a mensagem e não compartilha (EXP-18)', async () => {
    mockPdf.mockResolvedValue({ ok: false, mensagem: ERRO });
    await renderizar();
    await fireEvent.press(botaoExportar());

    await tocarNaFolha('PDF');

    expect(onFeedback).toHaveBeenCalledWith(ERRO, 'error');
    expect(mockCompartilhar).not.toHaveBeenCalled();
  });

  it('sem compartilhamento no aparelho, mostra a mensagem dele e não o sucesso (EXP-19)', async () => {
    mockCompartilhar.mockResolvedValue({ ok: false, mensagem: 'O compartilhamento não está disponível neste aparelho.' });
    await renderizar();
    await fireEvent.press(botaoExportar());

    await tocarNaFolha('PDF');

    expect(onFeedback).toHaveBeenCalledTimes(1);
    expect(onFeedback).toHaveBeenCalledWith('O compartilhamento não está disponível neste aparelho.', 'error');
    expect(botaoExportar().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
  });

  describe('período vazio', () => {
    beforeEach(() => {
      mockBuscar.mockResolvedValue({ ok: true, data: [] });
    });

    it('avisa antes de gerar o arquivo (EXP-20)', async () => {
      await renderizar();
      await fireEvent.press(botaoExportar());

      await tocarNaFolha('PDF');

      expect(folha().getByText('Nenhuma transação no período')).toBeOnTheScreen();
      expect(folha().getByText('Novembro 2026 não tem transações. O arquivo sairá só com o cabeçalho.')).toBeOnTheScreen();
      expect(botoesDaFolha()).toEqual(['Gerar mesmo assim', 'Cancelar']);
      expect(mockPdf).not.toHaveBeenCalled();
      expect(mockCompartilhar).not.toHaveBeenCalled();
    });

    it('Cancelar não gera arquivo, não compartilha e devolve o botão (EXP-21)', async () => {
      await renderizar();
      await fireEvent.press(botaoExportar());
      await tocarNaFolha('Planilha (CSV)');

      await tocarNaFolha('Cancelar');

      expect(mockCsv).not.toHaveBeenCalled();
      expect(mockCompartilhar).not.toHaveBeenCalled();
      expect(onFeedback).not.toHaveBeenCalled();
      expect(botaoExportar().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
    });

    it('fechar o aviso pelo voltar do Android conta como cancelar (EXP-21)', async () => {
      await renderizar();
      await fireEvent.press(botaoExportar());
      await tocarNaFolha('Planilha (CSV)');

      // O voltar do Android chega ao Modal da folha como onRequestClose.
      const aberta = todosPorTipo(Modal).find((modal) => modal.props.visible);
      const voltar = aberta?.props.onRequestClose as (() => void) | undefined;
      await act(async () => voltar?.());

      expect(mockCsv).not.toHaveBeenCalled();
      expect(botaoExportar().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
    });

    it('Gerar mesmo assim gera o CSV só com o cabeçalho e compartilha (EXP-22)', async () => {
      await renderizar();
      await fireEvent.press(botaoExportar());
      await tocarNaFolha('Planilha (CSV)');

      await tocarNaFolha('Gerar mesmo assim');

      expect(mockCsv).toHaveBeenCalledWith('eixo-certo-2026-11.csv', '﻿Data;Descrição;Categoria;Valor;Status\r\n');
      expect(mockCompartilhar).toHaveBeenCalled();
      expect(onFeedback).toHaveBeenCalledWith('Relatório gerado.', 'success');
    });

    it('Gerar mesmo assim no PDF sai com os totais zerados (EXP-22)', async () => {
      await renderizar();
      await fireEvent.press(botaoExportar());
      await tocarNaFolha('PDF');

      await tocarNaFolha('Gerar mesmo assim');

      const [, html] = mockPdf.mock.calls[0];
      expect(html).toContain('Nenhuma transação no período.');
      expect(html).toContain('<tr><td>Saldo do período</td><td class="valor">R$ 0,00</td></tr>');
    });
  });
});
