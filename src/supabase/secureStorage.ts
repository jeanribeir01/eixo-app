import * as SecureStore from 'expo-secure-store';

// A sessão do Supabase (access + refresh token + dados do usuário) passa de 2048 bytes,
// limite a partir do qual o SecureStore pode recusar o valor. O CLAUDE.md proíbe AsyncStorage
// para sessão, então dividimos o texto em partes menores, todas guardadas no Keystore/Keychain.
export const SECURE_STORE_CHUNK_SIZE = 1800;

// Chaves do SecureStore aceitam apenas letras, números, ".", "-" e "_".
// A chave do supabase-js ("sb-<projeto>-auth-token") já respeita isso.
const countKey = (key: string) => `${key}.count`;
const partKey = (key: string, index: number) => `${key}.${index}`;

function splitIntoChunks(value: string): string[] {
  const chunks: string[] = [];
  for (let start = 0; start < value.length; start += SECURE_STORE_CHUNK_SIZE) {
    chunks.push(value.slice(start, start + SECURE_STORE_CHUNK_SIZE));
  }
  return chunks;
}

async function readCount(key: string): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(countKey(key));
  return raw === null ? null : Number(raw);
}

async function getItem(key: string): Promise<string | null> {
  const count = await readCount(key);
  if (count === null) return null;

  const parts = await Promise.all(
    Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(partKey(key, index))),
  );

  // Parte faltando = gravação interrompida no meio. Melhor tratar como "sem sessão" e pedir login
  // de novo do que entregar um JSON quebrado ao supabase-js.
  if (parts.some((part) => part === null)) return null;

  return parts.join('');
}

async function removeItem(key: string): Promise<void> {
  const count = await readCount(key);
  if (count === null) return;

  await Promise.all(
    Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(partKey(key, index))),
  );
  await SecureStore.deleteItemAsync(countKey(key));
}

async function setItem(key: string, value: string): Promise<void> {
  // Apaga a versão anterior primeiro: se o valor novo tiver menos partes, não sobram partes velhas.
  await removeItem(key);

  const chunks = splitIntoChunks(value);
  for (const [index, chunk] of chunks.entries()) {
    await SecureStore.setItemAsync(partKey(key, index), chunk);
  }
  // O contador é gravado por último: se o app fechar no meio, a leitura vê "sem valor" em vez de lixo.
  await SecureStore.setItemAsync(countKey(key), String(chunks.length));
}

export const secureStorage = { getItem, setItem, removeItem };
