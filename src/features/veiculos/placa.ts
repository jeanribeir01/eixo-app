// Placa antiga: 3 letras + 4 dígitos (ex.: ABC1234). Placa Mercosul: 3 letras, 1 dígito, 1 letra,
// 2 dígitos (ex.: ABC1D23). A comparação e o armazenamento usam sempre a forma normalizada
// (maiúscula, sem hífen) para que "ABC-1234" e "abc1234" sejam reconhecidas como a mesma placa.
const REGEX_PLACA_ANTIGA = /^[A-Z]{3}\d{4}$/;
const REGEX_PLACA_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/;

export function normalizarPlaca(valor: string): string {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isPlacaValida(placaNormalizada: string): boolean {
  return REGEX_PLACA_ANTIGA.test(placaNormalizada) || REGEX_PLACA_MERCOSUL.test(placaNormalizada);
}

// Aplica a máscara de exibição a uma placa já normalizada. A Mercosul não leva hífen; a antiga sim.
export function formatarPlaca(placaNormalizada: string): string {
  if (REGEX_PLACA_ANTIGA.test(placaNormalizada)) {
    return `${placaNormalizada.slice(0, 3)}-${placaNormalizada.slice(3)}`;
  }

  return placaNormalizada;
}
