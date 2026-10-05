// Datas do formulário são digitadas como DD/MM/AAAA (sem calendário nativo, decisão da
// EIX-33) e trafegam como ISO YYYY-MM-DD. `mes` é sempre de 1 a 12, como as pessoas falam.

const NOMES_DOS_MESES = [
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

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, '0');
}

// Data como texto ISO a partir dos campos locais — nunca via toISOString(), que converte
// para UTC e pode trocar o dia (23h30 em Brasília já é amanhã em UTC).
function dataLocalISO(data: Date): string {
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

export function mascararData(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

// Devolve null para qualquer data que não exista no calendário (31/02, mês 13, dia 00).
export function dataBRParaISO(texto: string): string | null {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!partes) return null;

  const dia = Number(partes[1]);
  const mes = Number(partes[2]);
  const ano = Number(partes[3]);
  // O Date "corrige" datas impossíveis (31/02 vira 03/03); se mudou, a data não existe.
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return null;

  return dataLocalISO(data);
}

export function isoParaDataBR(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

export function hojeISO(): string {
  return dataLocalISO(new Date());
}

export type IntervaloDoMes = {
  // Para colunas `date` (data_vencimento): primeiro e último dia, inclusive.
  inicioData: string;
  fimData: string;
  // Para colunas `timestamptz` (data_inclusao): início do mês local e início do mês
  // seguinte (exclusivo), já em UTC como o Supabase espera.
  inicioInstante: string;
  fimInstante: string;
};

export function intervaloDoMes(ano: number, mes: number): IntervaloDoMes {
  const inicio = new Date(ano, mes - 1, 1);
  const inicioDoProximo = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes, 0);

  return {
    inicioData: dataLocalISO(inicio),
    fimData: dataLocalISO(ultimoDia),
    inicioInstante: inicio.toISOString(),
    fimInstante: inicioDoProximo.toISOString(),
  };
}

export function nomeDoMes(ano: number, mes: number): string {
  return `${NOMES_DOS_MESES[mes - 1]} ${ano}`;
}
