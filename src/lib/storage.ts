import { supabase } from '@/supabase/client';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export type ResultadoUpload = { ok: true; url: string } | { ok: false; mensagem: string };

export async function uploadComprovante(uri: string): Promise<ResultadoUpload> {
  try {
    const fileName = `comprovante_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`;
    
    // Ler o arquivo em base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const arrayBuffer = decode(base64);

    const { data, error } = await supabase.storage
      .from('comprovantes')
      .upload(fileName, arrayBuffer, {
        contentType: 'image/jpeg',
      });

    if (error) {
      console.error('Erro no upload (storage):', error);
      return { ok: false, mensagem: 'Não foi possível enviar a imagem. Tente novamente.' };
    }

    const { data: publicUrlData } = supabase.storage
      .from('comprovantes')
      .getPublicUrl(data.path);

    return { ok: true, url: publicUrlData.publicUrl };
  } catch (err) {
    console.error('Erro no upload (local):', err);
    return { ok: false, mensagem: 'Erro ao processar a imagem.' };
  }
}

export async function removerComprovante(url: string): Promise<{ ok: boolean; mensagem?: string }> {
  try {
    // A URL pública é do formato: https://[PROJETO].supabase.co/storage/v1/object/public/comprovantes/[NOME_ARQUIVO]
    const partes = url.split('/comprovantes/');
    if (partes.length < 2) return { ok: false, mensagem: 'URL de comprovante inválida.' };
    
    const caminho = partes[1];
    
    const { error } = await supabase.storage
      .from('comprovantes')
      .remove([caminho]);

    if (error) {
      console.error('Erro ao remover (storage):', error);
      return { ok: false, mensagem: 'Não foi possível remover a imagem.' };
    }

    return { ok: true };
  } catch (err) {
    console.error('Erro ao remover (local):', err);
    return { ok: false, mensagem: 'Erro ao processar a remoção.' };
  }
}
