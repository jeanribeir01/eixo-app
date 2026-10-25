import { getRandomBytes } from 'expo-crypto';

// UUID v7 (RFC 9562) gerado no aparelho. É o id de toda linha criada offline (CLAUDE.md §5): o
// servidor recebe o registro já com o id, e reenviar a mesma operação não cria outro (ADR 0004).
//
// Por que v7 e não v4: os 48 primeiros bits são o horário em milissegundos, então ids gerados
// depois ficam maiores. O índice da chave primária cresce em ordem e a fila de sync sai na ordem
// em que as coisas aconteceram.
//
// Os bytes aleatórios vêm do `expo-crypto`, que usa o gerador seguro do sistema. `Math.random`
// não serve: é previsível e, em dois aparelhos, pode repetir sequência.
export function gerarUuidV7(agora: number = Date.now()): string {
  const bytes = getRandomBytes(16);

  // Bytes 0 a 5: horário em ms, do mais significativo para o menos (big-endian). Divisão em vez
  // de deslocamento de bits porque o número passa de 32 bits, e o `>>` do JavaScript corta em 32.
  let horario = agora;
  for (let i = 5; i >= 0; i -= 1) {
    bytes[i] = horario % 256;
    horario = Math.floor(horario / 256);
  }

  // Versão 7 nos 4 bits altos do byte 6 e variante RFC (10xx) nos 2 bits altos do byte 8.
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
