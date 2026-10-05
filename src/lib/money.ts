// Dinheiro no app é sempre inteiro em centavos (CLAUDE.md §5: nunca float para valor
// financeiro). A conversão para reais acontece só na borda com o Supabase, onde a
// coluna é numeric(12,2).

// numeric(12,2) cabe até 9.999.999.999,99 = 12 dígitos em centavos.
const MAX_DIGITOS = 12;

// Campo de valor "estilo caixa eletrônico": cada dígito digitado entra pela direita.
// Recebe o texto do campo (com ou sem máscara) e devolve os centavos.
export function digitosParaCentavos(texto: string): number {
  const digitos = texto.replace(/\D/g, '').slice(0, MAX_DIGITOS);
  return digitos ? Number(digitos) : 0;
}

// Formatação manual em vez de Intl.NumberFormat: não dependemos do suporte a pt-BR do
// Hermes, e o resultado é o mesmo em teste e no aparelho.
export function formatarMoeda(centavos: number): string {
  const reais = Math.floor(centavos / 100);
  const resto = String(centavos % 100).padStart(2, '0');
  const reaisComPontos = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${reaisComPontos},${resto}`;
}

export function centavosParaReais(centavos: number): number {
  return centavos / 100;
}

// O PostgREST devolve numeric como number (ex.: 19.99). Math.round corrige o resíduo de
// ponto flutuante de 19.99 * 100 = 1998.9999999999998.
export function reaisParaCentavos(valor: number): number {
  return Math.round(valor * 100);
}
