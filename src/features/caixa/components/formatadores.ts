import type { TextTone } from '@/ui';

// Só formatação para exibir: nenhum valor é somado aqui (o cálculo é do banco, EIX-35).

const formatadorBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// "R$ 1.234,56" (com espaço não separável, que impede quebrar "R$" do número). Divide por 100 só
// para exibir: o valor continua inteiro em centavos em todo o resto do app.
export function formatarMoeda(centavos: number): string {
  return formatadorBRL.format(Math.abs(centavos) / 100);
}

// Cor nunca é o único indicador (DESIGN_CYAN §1): positivo leva "+", negativo leva "−" (sinal de
// menos tipográfico, mais legível que o hífen).
export function formatarMoedaComSinal(centavos: number): string {
  if (centavos > 0) return `+ ${formatarMoeda(centavos)}`;
  if (centavos < 0) return `− ${formatarMoeda(centavos)}`;
  return formatarMoeda(centavos);
}

// Verde para positivo, vermelho para negativo; zero fica neutro.
export function tomDoValor(centavos: number): TextTone {
  if (centavos > 0) return 'success';
  if (centavos < 0) return 'danger';
  return 'primary';
}

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

// '2026-11' → 'Novembro de 2026'. Lista própria em vez de Intl.DateTimeFormat: sem fuso horário
// no meio, o mês nunca "volta um" por causa de UTC.
export function formatarMes(mes: string): string {
  const [ano, numeroMes] = mes.split('-');
  return `${MESES[Number(numeroMes) - 1]} de ${ano}`;
}
