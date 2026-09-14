import * as SecureStore from 'expo-secure-store';

import { SECURE_STORE_CHUNK_SIZE, secureStorage } from '../secureStorage';

// Mock em memória do SecureStore: o teste verifica o que o adapter grava de fato no armazenamento seguro.
// jest.mock é içado para antes dos imports pelo babel-jest.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const KEY = 'sb-projeto-auth-token';

function bigValue(length: number) {
  return Array.from({ length }, (_, i) => String.fromCharCode(97 + (i % 26))).join('');
}

beforeEach(() => {
  store.clear();
});

describe('secureStorage (AUTH-10, AUTH-11)', () => {
  it('usa partes de no máximo 1800 caracteres', () => {
    expect(SECURE_STORE_CHUNK_SIZE).toBe(1800);
  });

  it('grava um valor de 5000 caracteres em partes ≤ 1800 no SecureStore e lê exatamente o original', async () => {
    const value = bigValue(5000);

    await secureStorage.setItem(KEY, value);

    const storedValues = [...store.values()];
    const storedText = storedValues.filter((v) => v.length > 0 && !/^\d+$/.test(v));
    expect(storedText.length).toBe(3);
    expect(storedText.every((part) => part.length <= 1800)).toBe(true);
    expect(await secureStorage.getItem(KEY)).toBe(value);
  });

  it('grava valor pequeno e lê de volta igual', async () => {
    await secureStorage.setItem(KEY, '{"access_token":"abc"}');

    expect(await secureStorage.getItem(KEY)).toBe('{"access_token":"abc"}');
  });

  it('retorna null para chave nunca gravada', async () => {
    expect(await secureStorage.getItem(KEY)).toBeNull();
  });

  it('sobrescrever com valor menor não deixa partes antigas nem mistura conteúdo', async () => {
    await secureStorage.setItem(KEY, bigValue(5000));
    await secureStorage.setItem(KEY, 'curto');

    expect(await secureStorage.getItem(KEY)).toBe('curto');
    expect(store.size).toBe(2); // 1 parte + contador
  });

  it('removeItem apaga todas as partes e a leitura seguinte retorna null', async () => {
    await secureStorage.setItem(KEY, bigValue(5000));

    await secureStorage.removeItem(KEY);

    expect(store.size).toBe(0);
    expect(await secureStorage.getItem(KEY)).toBeNull();
  });
});
