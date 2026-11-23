// Cabeçalho do Início: "Bom dia, Jean" e "Domingo, 23 de novembro". Listas próprias em vez de
// Intl.DateTimeFormat, como em formatarMes: sem depender do pt-BR do Hermes.

const DIAS_DA_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

// Pelo relógio do aparelho: é a hora de quem está olhando a tela.
export function saudacao(agora: Date, nome: string): string {
  const hora = agora.getHours();
  const periodo = hora < 5 ? 'Boa noite' : hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  // Só o primeiro nome: "Bom dia, Jean Ribeiro" soa como formulário.
  const primeiroNome = nome.trim().split(/\s+/)[0];
  return primeiroNome ? `${periodo}, ${primeiroNome}` : periodo;
}

export function dataPorExtenso(agora: Date): string {
  return `${DIAS_DA_SEMANA[agora.getDay()]}, ${agora.getDate()} de ${MESES[agora.getMonth()]}`;
}
