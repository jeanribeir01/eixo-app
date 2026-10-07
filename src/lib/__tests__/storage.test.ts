import { File } from 'expo-file-system';

import { supabase } from '@/supabase/client';

import { removerComprovante, uploadComprovante, urlDoComprovante } from '../storage';

const mockArrayBuffer = jest.fn();

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ arrayBuffer: mockArrayBuffer })),
}));

jest.mock('@/supabase/client', () => ({
  supabase: { storage: { from: jest.fn() } },
}));

const mockFrom = supabase.storage.from as jest.Mock;
const bucket = { upload: jest.fn(), createSignedUrl: jest.fn(), remove: jest.fn() };
const erroDoStorage = { message: 'detalhe técnico do storage' };

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockReturnValue(bucket);
});

describe('uploadComprovante (EIX-34)', () => {
  it('lê os bytes da imagem, envia ao bucket privado como JPEG e devolve o caminho (AC 4)', async () => {
    const bytes = new ArrayBuffer(8);
    mockArrayBuffer.mockResolvedValue(bytes);
    bucket.upload.mockResolvedValue({ data: { path: 'gerado.jpg' }, error: null });

    const resultado = await uploadComprovante('file://comprimida.jpg');

    expect(File).toHaveBeenCalledWith('file://comprimida.jpg');
    expect(mockFrom).toHaveBeenCalledWith('comprovantes');
    expect(bucket.upload).toHaveBeenCalledWith(expect.stringMatching(/\.jpg$/), bytes, { contentType: 'image/jpeg' });
    expect(resultado).toEqual({ ok: true, data: 'gerado.jpg' });
  });

  it('dois envios seguidos usam caminhos diferentes', async () => {
    mockArrayBuffer.mockResolvedValue(new ArrayBuffer(8));
    bucket.upload.mockResolvedValue({ data: { path: 'x.jpg' }, error: null });

    await uploadComprovante('file://a.jpg');
    await uploadComprovante('file://b.jpg');

    expect(bucket.upload.mock.calls[0][0]).not.toBe(bucket.upload.mock.calls[1][0]);
  });

  it('erro do Storage vira mensagem em português, sem detalhe técnico', async () => {
    mockArrayBuffer.mockResolvedValue(new ArrayBuffer(8));
    bucket.upload.mockResolvedValue({ data: null, error: erroDoStorage });

    expect(await uploadComprovante('file://comprimida.jpg')).toEqual({
      ok: false,
      mensagem: 'Não foi possível enviar o comprovante. Tente novamente.',
    });
  });

  it('falha ao ler o arquivo não chega a enviar', async () => {
    mockArrayBuffer.mockRejectedValue(new Error('arquivo sumiu'));

    expect(await uploadComprovante('file://comprimida.jpg')).toEqual({
      ok: false,
      mensagem: 'Não foi possível ler a imagem. Tente novamente.',
    });
    expect(bucket.upload).not.toHaveBeenCalled();
  });
});

describe('urlDoComprovante (EIX-34)', () => {
  it('gera uma signed URL de 60 segundos para o caminho', async () => {
    bucket.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://assinada.example/a.jpg' }, error: null });

    expect(await urlDoComprovante('a.jpg')).toEqual({ ok: true, data: 'https://assinada.example/a.jpg' });
    expect(mockFrom).toHaveBeenCalledWith('comprovantes');
    expect(bucket.createSignedUrl).toHaveBeenCalledWith('a.jpg', 60);
  });

  it('erro (ex.: perfil sem acesso ao bucket) vira mensagem em português', async () => {
    bucket.createSignedUrl.mockResolvedValue({ data: null, error: erroDoStorage });

    expect(await urlDoComprovante('a.jpg')).toEqual({ ok: false, mensagem: 'Não foi possível abrir o comprovante.' });
  });
});

describe('removerComprovante (EIX-34)', () => {
  it('apaga o arquivo do bucket pelo caminho (AC 6)', async () => {
    bucket.remove.mockResolvedValue({ data: [], error: null });

    expect(await removerComprovante('a.jpg')).toEqual({ ok: true, data: null });
    expect(bucket.remove).toHaveBeenCalledWith(['a.jpg']);
  });

  it('erro vira mensagem em português', async () => {
    bucket.remove.mockResolvedValue({ data: null, error: erroDoStorage });

    expect(await removerComprovante('a.jpg')).toEqual({ ok: false, mensagem: 'Não foi possível apagar o comprovante.' });
  });
});
