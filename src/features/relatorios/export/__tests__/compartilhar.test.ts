import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { compartilharArquivo, gerarArquivoCsv, gerarArquivoPdf } from '../compartilhar';

// Sistema de arquivos falso: guarda o conteúdo por URI, para o teste ler o que foi gravado.
const mockDisco = new Map<string, string>();
const mockFalhaAoGravar = { ativa: false };

jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...partes: (string | File)[]) {
      this.uri = partes.map((parte) => (typeof parte === 'string' ? parte : parte.uri)).join('');
    }
    get exists() {
      return mockDisco.has(this.uri);
    }
    delete() {
      mockDisco.delete(this.uri);
    }
    create() {
      if (mockDisco.has(this.uri)) throw new Error('já existe');
      mockDisco.set(this.uri, '');
    }
    // Assíncrono como o write() do SDK 58: a gravação só termina depois de um tique, então quem não
    // esperar a promessa vê o arquivo vazio e deixa a falha escapar do try.
    async write(conteudo: string) {
      await Promise.resolve();
      if (mockFalhaAoGravar.ativa) throw new Error('disco cheio');
      mockDisco.set(this.uri, conteudo);
    }
    async move(destino: File) {
      if (mockDisco.has(destino.uri)) throw new Error('destino existe');
      mockDisco.set(destino.uri, mockDisco.get(this.uri) ?? '');
      mockDisco.delete(this.uri);
      this.uri = destino.uri;
    }
  }
  return { File, Paths: { cache: 'file:///cache/' } };
});

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const mockPrint = Print.printToFileAsync as jest.MockedFunction<typeof Print.printToFileAsync>;
const mockDisponivel = Sharing.isAvailableAsync as jest.MockedFunction<typeof Sharing.isAvailableAsync>;
const mockShare = Sharing.shareAsync as jest.MockedFunction<typeof Sharing.shareAsync>;

const ERRO = 'Não foi possível gerar o relatório. Tente novamente.';

beforeEach(() => {
  mockDisco.clear();
  mockFalhaAoGravar.ativa = false;
  mockPrint.mockReset();
  mockDisponivel.mockReset().mockResolvedValue(true);
  mockShare.mockReset().mockResolvedValue(undefined);
});

describe('gerarArquivoCsv', () => {
  it('grava o conteúdo no cache com o nome do período (EXP-14)', async () => {
    const resultado = await gerarArquivoCsv('eixo-certo-2026-11.csv', '﻿Data;Descrição\r\n');

    expect(resultado).toEqual({ ok: true, data: { uri: 'file:///cache/eixo-certo-2026-11.csv', formato: 'csv' } });
    expect(mockDisco.get('file:///cache/eixo-certo-2026-11.csv')).toBe('﻿Data;Descrição\r\n');
  });

  it('exportar de novo o mesmo período sobrescreve o arquivo', async () => {
    mockDisco.set('file:///cache/eixo-certo-2026-11.csv', 'antigo');

    const resultado = await gerarArquivoCsv('eixo-certo-2026-11.csv', 'novo');

    expect(resultado.ok).toBe(true);
    expect(mockDisco.get('file:///cache/eixo-certo-2026-11.csv')).toBe('novo');
  });

  it('erro ao gravar vira a mensagem genérica (EXP-18)', async () => {
    mockFalhaAoGravar.ativa = true;

    expect(await gerarArquivoCsv('eixo-certo-2026-11.csv', 'x')).toEqual({ ok: false, mensagem: ERRO });
  });
});

describe('gerarArquivoPdf', () => {
  it('gera o PDF em A4 a partir do HTML e o move para o nome do período (EXP-12, EXP-14)', async () => {
    mockDisco.set('file:///cache/Print/abc123.pdf', '%PDF');
    mockPrint.mockResolvedValue({ uri: 'file:///cache/Print/abc123.pdf', numberOfPages: 3 });

    const resultado = await gerarArquivoPdf('eixo-certo-2026.pdf', '<html>relatório</html>');

    expect(mockPrint).toHaveBeenCalledWith({ html: '<html>relatório</html>', width: 595, height: 842 });
    expect(resultado).toEqual({ ok: true, data: { uri: 'file:///cache/eixo-certo-2026.pdf', formato: 'pdf' } });
    expect(mockDisco.get('file:///cache/eixo-certo-2026.pdf')).toBe('%PDF');
    expect(mockDisco.has('file:///cache/Print/abc123.pdf')).toBe(false);
  });

  it('substitui um PDF anterior de mesmo nome', async () => {
    mockDisco.set('file:///cache/eixo-certo-2026.pdf', 'antigo');
    mockDisco.set('file:///cache/Print/novo.pdf', 'novo');
    mockPrint.mockResolvedValue({ uri: 'file:///cache/Print/novo.pdf', numberOfPages: 1 });

    const resultado = await gerarArquivoPdf('eixo-certo-2026.pdf', '<html></html>');

    expect(resultado.ok).toBe(true);
    expect(mockDisco.get('file:///cache/eixo-certo-2026.pdf')).toBe('novo');
  });

  it('falha do expo-print vira a mensagem genérica (EXP-18)', async () => {
    mockPrint.mockRejectedValue(new Error('WebView falhou'));

    expect(await gerarArquivoPdf('eixo-certo-2026.pdf', '<html></html>')).toEqual({ ok: false, mensagem: ERRO });
  });
});

describe('compartilharArquivo', () => {
  it('abre o Share Sheet com o CSV e o mime type text/csv (EXP-15)', async () => {
    const resultado = await compartilharArquivo({ uri: 'file:///cache/eixo-certo-2026-11.csv', formato: 'csv' });

    expect(mockShare).toHaveBeenCalledWith('file:///cache/eixo-certo-2026-11.csv', {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'Enviar relatório',
    });
    expect(resultado).toEqual({ ok: true, data: null });
  });

  it('abre o Share Sheet com o PDF e o mime type application/pdf (EXP-15)', async () => {
    await compartilharArquivo({ uri: 'file:///cache/eixo-certo-2026-11.pdf', formato: 'pdf' });

    expect(mockShare).toHaveBeenCalledWith('file:///cache/eixo-certo-2026-11.pdf', {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Enviar relatório',
    });
  });

  it('sem compartilhamento no aparelho, avisa e não chama o shareAsync (EXP-19)', async () => {
    mockDisponivel.mockResolvedValue(false);

    const resultado = await compartilharArquivo({ uri: 'file:///cache/x.csv', formato: 'csv' });

    expect(resultado).toEqual({ ok: false, mensagem: 'O compartilhamento não está disponível neste aparelho.' });
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('erro do shareAsync vira a mensagem genérica (EXP-18)', async () => {
    mockShare.mockRejectedValue(new Error('activity not found'));

    expect(await compartilharArquivo({ uri: 'file:///cache/x.pdf', formato: 'pdf' })).toEqual({
      ok: false,
      mensagem: ERRO,
    });
  });
});
