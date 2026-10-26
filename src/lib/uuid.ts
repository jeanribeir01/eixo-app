import { getRandomBytes } from 'expo-crypto';

// UUID v7 (RFC 9562): os 48 bits mais significativos são o timestamp em milissegundos e o
// restante é aleatório. A ordenação cronológica ajuda a paginar a outbox e a depurar a fila; o
// aleatório vem de `expo-crypto` (CSPRNG do sistema), nunca de `Math.random`.
//
// O formato precisa ser v7 porque o banco e o sync usam o id gerado no aparelho como chave de
// idempotência (ADR 0004). Um fallback inseguro aqui contaminaria todos os registros offline.
const TAMANHO_UUID = 16;

export function gerarUUIDv7(agora: number = Date.now()): string {
  const bytes = getRandomBytes(TAMANHO_UUID);

  // 48 bits de timestamp big-endian nos bytes 0..5. `agora` é inteiro (Date.now()).
  let timestamp = Math.floor(agora);
  for (let indice = 5; indice >= 0; indice -= 1) {
    bytes[indice] = timestamp % 256;
    timestamp = Math.floor(timestamp / 256);
  }

  // Versão 7 nos 4 bits altos do byte 6 e variante RFC 4122 (10xx) no byte 8.
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
