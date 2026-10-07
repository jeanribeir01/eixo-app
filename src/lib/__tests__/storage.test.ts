import { uploadComprovante, removerComprovante } from '../storage';
import { supabase } from '@/supabase/client';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

jest.mock('@/supabase/client', () => ({
  supabase: {
    storage: {
      from: jest.fn(),
    },
  },
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

jest.mock('base64-arraybuffer', () => ({
  decode: jest.fn(),
}));

describe('storage.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadComprovante', () => {
    it('deve fazer upload de uma imagem e retornar a url publica', async () => {
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('base64_fake');
      (decode as jest.Mock).mockReturnValue(new ArrayBuffer(8));

      const mockUpload = jest.fn().mockResolvedValue({ data: { path: 'fake_path.jpg' }, error: null });
      const mockGetPublicUrl = jest.fn().mockReturnValue({ data: { publicUrl: 'https://fake.url/fake_path.jpg' } });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      const resultado = await uploadComprovante('file://test.jpg');

      expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith('file://test.jpg', { encoding: 'base64' });
      expect(decode).toHaveBeenCalledWith('base64_fake');
      expect(supabase.storage.from).toHaveBeenCalledWith('comprovantes');
      expect(mockUpload).toHaveBeenCalled();
      expect(resultado).toEqual({ ok: true, url: 'https://fake.url/fake_path.jpg' });
    });

    it('deve retornar erro quando upload falhar', async () => {
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('base64_fake');
      const mockUpload = jest.fn().mockResolvedValue({ data: null, error: new Error('Upload error') });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      const resultado = await uploadComprovante('file://test.jpg');

      expect(resultado).toEqual({ ok: false, mensagem: 'Não foi possível enviar a imagem. Tente novamente.' });
    });

    it('deve retornar erro quando leitura de arquivo falhar', async () => {
      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(new Error('File system error'));

      const resultado = await uploadComprovante('file://test.jpg');

      expect(resultado).toEqual({ ok: false, mensagem: 'Erro ao processar a imagem.' });
    });
  });

  describe('removerComprovante', () => {
    it('deve remover a imagem com sucesso', async () => {
      const mockRemove = jest.fn().mockResolvedValue({ error: null });
      (supabase.storage.from as jest.Mock).mockReturnValue({
        remove: mockRemove,
      });

      const resultado = await removerComprovante('https://test.supabase.co/storage/v1/object/public/comprovantes/fake_path.jpg');

      expect(supabase.storage.from).toHaveBeenCalledWith('comprovantes');
      expect(mockRemove).toHaveBeenCalledWith(['fake_path.jpg']);
      expect(resultado).toEqual({ ok: true });
    });

    it('deve retornar erro se a url for invalida', async () => {
      const resultado = await removerComprovante('https://invalid.url');
      expect(resultado).toEqual({ ok: false, mensagem: 'URL de comprovante inválida.' });
    });

    it('deve retornar erro se supabase remove falhar', async () => {
      const mockRemove = jest.fn().mockResolvedValue({ error: new Error('Remove error') });
      (supabase.storage.from as jest.Mock).mockReturnValue({
        remove: mockRemove,
      });

      const resultado = await removerComprovante('https://test.supabase.co/storage/v1/object/public/comprovantes/fake_path.jpg');

      expect(resultado).toEqual({ ok: false, mensagem: 'Não foi possível remover a imagem.' });
    });
  });
});
