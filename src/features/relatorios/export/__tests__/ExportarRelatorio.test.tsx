import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { periodoDoMes } from '@/features/dashboard/periodo';
import { MENSAGEM_ACESSO_NEGADO } from '@/lib/errors';
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

let alerta: jest.SpyInstance;
const onFeedback = jest.fn();

function ultimoAlerta(): { titulo: string; mensagem: string; botoes: AlertButton[] } {
  const chamada = alerta.mock.calls[alerta.mock.calls.length - 1];
  return { titulo: chamada[0], mensagem: chamada[1], botoes: chamada[2] };
}

// Toca no botão do alerta pelo texto e espera o fluxo assíncrono andar.
async function tocarNoAlerta(texto: string) {
  const botao = ultimoAlerta().botoes.find((b) => b.text === texto);
  if (!botao?.onPress) throw new Error(`Botão "${texto}" não existe no alerta`);
  await act(async () => {
    botao.onPress?.();
  });
}

function renderizar() {
  render(<ExportarRelatorio periodo={NOVEMBRO} onFeedback={onFeedback} />);
}

function botaoExportar() {
  return screen.getByRole('button', { name: 'Exportar relatório de Novembro 2026' });
}

beforeEach(() => {
  alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  onFeedback.mockReset();
  mockBuscar.mockReset().mockResolvedValue({ ok: true, data: TRANSACOES });
  mockCsv.mockReset().mockReturnValue({ ok: true, data: { uri: 'file:///cache/eixo-certo-2026-11.csv', formato: 'csv' } });
  mockPdf.mockReset().mockResolvedValue({ ok: true, data: { uri: 'file:///cache/eixo-certo-2026-11.pdf', formato: 'pdf' } });
  mockCompartilhar.mockReset().mockResolvedValue({ ok: true, data: null });
});

afterEach(() => alerta.mockRestore());

describe('ExportarRelatorio', () => {
  it('mostra o botão Exportar primário (cyan preenchido) com o período no nome acessível (EXP-01)', () => {
    renderizar();

    expect(screen.getByText('Exportar')).toBeTruthy();
    expect(botaoExportar()).toHaveStyle({ backgroundColor: colors.accent });
    expect(botaoExportar().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
  });

  it('PDF usa o nome da empresa do .env no cabeçalho (EXP-10)', async () => {
    process.env.EXPO_PUBLIC_NOME_EMPRESA = 'Transportes Silva';
    try {
      renderizar();
      fireEvent.press(botaoExportar());

      await tocarNoAlerta('PDF');

      const [, html] = mockPdf.mock.calls[0];
      expect(html).toContain('<h1>Transportes Silva</h1>');
    } finally {
      delete process.env.EXPO_PUBLIC_NOME_EMPRESA;
    }
  });

  it('erro inesperado ao montar o arquivo vira Snackbar de erro e devolve o botão (EXP-18)', async () => {
    mockCsv.mockImplementation(() => {
      throw new Error('inesperado');
    });
    renderizar();
    fireEvent.press(botaoExportar());

    await tocarNoAlerta('Planilha (CSV)');

    expect(onFeedback).toHaveBeenCalledWith(ERRO, 'error');
    expect(mockCompartilhar).not.toHaveBeenCalled();
    expect(botaoExportar().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
  });

  it('tocar em Exportar pergunta o formato e não consulta nada antes (EXP-03)', () => {
    renderizar();

    fireEvent.press(botaoExportar());

    const { titulo, botoes } = ultimoAlerta();
    expect(titulo).toBe('Exportar relatório');
    expect(botoes.map((b) => b.text)).toEqual(['Planilha (CSV)', 'PDF', 'Cancelar']);
    expect(botoes[2].style).toBe('cancel');
    expect(mockBuscar).not.toHaveBeenCalled();
  });

  it('CSV: busca o período, grava o CSV com o nome do período, compartilha e avisa (EXP-15)', async () => {
    renderizar();
    fireEvent.press(botaoExportar());

    await tocarNoAlerta('Planilha (CSV)');

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
    renderizar();
    fireEvent.press(botaoExportar());

    await tocarNoAlerta('PDF');

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
    renderizar();
    fireEvent.press(botaoExportar());

    await tocarNoAlerta('PDF');

    expect(botaoExportar().props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    const alertasAntes = alerta.mock.calls.length;
    fireEvent.press(botaoExportar());
    expect(alerta.mock.calls.length).toBe(alertasAntes);
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
    renderizar();
    fireEvent.press(botaoExportar());

    await tocarNoAlerta('Planilha (CSV)');

    expect(onFeedback).toHaveBeenCalledWith(mensagem, 'error');
    expect(mockCsv).not.toHaveBeenCalled();
    expect(mockCompartilhar).not.toHaveBeenCalled();
    expect(botaoExportar().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
  });

  it('erro ao gravar o CSV mostra a mensagem e não compartilha (EXP-18)', async () => {
    mockCsv.mockReturnValue({ ok: false, mensagem: ERRO });
    renderizar();
    fireEvent.press(botaoExportar());

    await tocarNoAlerta('Planilha (CSV)');

    expect(onFeedback).toHaveBeenCalledWith(ERRO, 'error');
    expect(onFeedback).not.toHaveBeenCalledWith('Relatório gerado.', 'success');
    expect(mockCompartilhar).not.toHaveBeenCalled();
  });

  it('erro ao gerar o PDF mostra a mensagem e não compartilha (EXP-18)', async () => {
    mockPdf.mockResolvedValue({ ok: false, mensagem: ERRO });
    renderizar();
    fireEvent.press(botaoExportar());

    await tocarNoAlerta('PDF');

    expect(onFeedback).toHaveBeenCalledWith(ERRO, 'error');
    expect(mockCompartilhar).not.toHaveBeenCalled();
  });

  it('sem compartilhamento no aparelho, mostra a mensagem dele e não o sucesso (EXP-19)', async () => {
    mockCompartilhar.mockResolvedValue({ ok: false, mensagem: 'O compartilhamento não está disponível neste aparelho.' });
    renderizar();
    fireEvent.press(botaoExportar());

    await tocarNoAlerta('PDF');

    expect(onFeedback).toHaveBeenCalledTimes(1);
    expect(onFeedback).toHaveBeenCalledWith('O compartilhamento não está disponível neste aparelho.', 'error');
    expect(botaoExportar().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
  });

  describe('período vazio', () => {
    beforeEach(() => {
      mockBuscar.mockResolvedValue({ ok: true, data: [] });
    });

    it('avisa antes de gerar o arquivo (EXP-20)', async () => {
      renderizar();
      fireEvent.press(botaoExportar());

      await tocarNoAlerta('PDF');

      const { titulo, mensagem, botoes } = ultimoAlerta();
      expect(titulo).toBe('Nenhuma transação no período');
      expect(mensagem).toContain('Novembro 2026');
      expect(botoes.map((b) => b.text)).toEqual(['Cancelar', 'Gerar mesmo assim']);
      expect(mockPdf).not.toHaveBeenCalled();
      expect(mockCompartilhar).not.toHaveBeenCalled();
    });

    it('Cancelar não gera arquivo, não compartilha e devolve o botão (EXP-21)', async () => {
      renderizar();
      fireEvent.press(botaoExportar());
      await tocarNoAlerta('Planilha (CSV)');

      await tocarNoAlerta('Cancelar');

      expect(mockCsv).not.toHaveBeenCalled();
      expect(mockCompartilhar).not.toHaveBeenCalled();
      expect(onFeedback).not.toHaveBeenCalled();
      expect(botaoExportar().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
    });

    it('fechar o aviso pelo voltar do Android conta como cancelar (EXP-21)', async () => {
      renderizar();
      fireEvent.press(botaoExportar());
      await tocarNoAlerta('Planilha (CSV)');

      const opcoes = alerta.mock.calls[alerta.mock.calls.length - 1][3];
      await act(async () => opcoes.onDismiss());

      expect(mockCsv).not.toHaveBeenCalled();
      expect(botaoExportar().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
    });

    it('Gerar mesmo assim gera o CSV só com o cabeçalho e compartilha (EXP-22)', async () => {
      renderizar();
      fireEvent.press(botaoExportar());
      await tocarNoAlerta('Planilha (CSV)');

      await tocarNoAlerta('Gerar mesmo assim');

      expect(mockCsv).toHaveBeenCalledWith('eixo-certo-2026-11.csv', '﻿Data;Descrição;Categoria;Valor;Status\r\n');
      expect(mockCompartilhar).toHaveBeenCalled();
      expect(onFeedback).toHaveBeenCalledWith('Relatório gerado.', 'success');
    });

    it('Gerar mesmo assim no PDF sai com os totais zerados (EXP-22)', async () => {
      renderizar();
      fireEvent.press(botaoExportar());
      await tocarNoAlerta('PDF');

      await tocarNoAlerta('Gerar mesmo assim');

      const [, html] = mockPdf.mock.calls[0];
      expect(html).toContain('Nenhuma transação no período.');
      expect(html).toContain('<tr><td>Saldo do período</td><td class="valor">R$ 0,00</td></tr>');
    });
  });
});
