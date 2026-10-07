import { File } from 'expo-file-system';

import { supabase } from '@/supabase/client';

// Comprovantes de movimentação (US03-b) no bucket privado `comprovantes`. Só Admin e Financeiro
// leem e escrevem nele: as policies estão em 20260924000600_storage_comprovantes.sql.
const BUCKET = 'comprovantes';

// A signed URL só precisa durar o tempo de a imagem carregar na tela. Como o bucket é privado,
// quem tiver o link consegue abrir o arquivo até ele expirar; por isso a validade é curta.
const VALIDADE_URL_SEGUNDOS = 60;

export type ResultadoStorage<T> = { ok: true; data: T } | { ok: false; mensagem: string };

// Envia a imagem (já comprimida) e devolve o caminho dentro do bucket, que é o que a movimentação
// guarda. A URL não é guardada porque expira.
export async function uploadComprovante(uri: string): Promise<ResultadoStorage<string>> {
  try {
    // O `readAsStringAsync` de 'expo-file-system' lança erro desde o SDK 54; a API nova lê o
    // arquivo direto como bytes, sem passar por base64.
    const bytes = await new File(uri).arrayBuffer();
    const caminho = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

    const { data, error } = await supabase.storage.from(BUCKET).upload(caminho, bytes, { contentType: 'image/jpeg' });
    if (error) return { ok: false, mensagem: 'Não foi possível enviar o comprovante. Tente novamente.' };

    return { ok: true, data: data.path };
  } catch {
    return { ok: false, mensagem: 'Não foi possível ler a imagem. Tente novamente.' };
  }
}

export async function urlDoComprovante(caminho: string): Promise<ResultadoStorage<string>> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, VALIDADE_URL_SEGUNDOS);
  if (error || !data) return { ok: false, mensagem: 'Não foi possível abrir o comprovante.' };

  return { ok: true, data: data.signedUrl };
}

export async function removerComprovante(caminho: string): Promise<ResultadoStorage<null>> {
  const { error } = await supabase.storage.from(BUCKET).remove([caminho]);
  if (error) return { ok: false, mensagem: 'Não foi possível apagar o comprovante.' };

  return { ok: true, data: null };
}
