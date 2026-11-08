import { hojeISO, intervaloDoMes, isoParaDataBR, nomeDoMes } from '@/lib/datas';

// Período escolhido no filtro dos dashboards (US11, reutilizado pelas US12 e US13). As datas são ISO
// (AAAA-MM-DD) e valem inclusive nas duas pontas: é o formato que uma RPC recebe em parâmetro `date`.
export type ModoPeriodo = 'mes' | 'ano' | 'customizado';

export type Periodo = {
  modo: ModoPeriodo;
  dataInicial: string;
  dataFinal: string;
};

// Lê ano e mês direto do texto ISO: passar por Date no meio arriscaria trocar o dia por causa do fuso.
function anoEMes(iso: string): [number, number] {
  const [ano, mes] = iso.split('-').map(Number);
  return [ano, mes];
}

export function periodoDoMes(ano: number, mes: number): Periodo {
  const { inicioData, fimData } = intervaloDoMes(ano, mes);
  return { modo: 'mes', dataInicial: inicioData, dataFinal: fimData };
}

export function periodoDoAno(ano: number): Periodo {
  return { modo: 'ano', dataInicial: `${ano}-01-01`, dataFinal: `${ano}-12-31` };
}

export function mesAtual(): Periodo {
  const [ano, mes] = anoEMes(hojeISO());
  return periodoDoMes(ano, mes);
}

export function anoAtual(): Periodo {
  const [ano] = anoEMes(hojeISO());
  return periodoDoAno(ano);
}

export function deslocarMes(periodo: Periodo, meses: number): Periodo {
  const [ano, mes] = anoEMes(periodo.dataInicial);
  // O Date resolve a virada de ano: mês 13 de 2026 vira janeiro de 2027.
  const destino = new Date(ano, mes - 1 + meses, 1);
  return periodoDoMes(destino.getFullYear(), destino.getMonth() + 1);
}

export function deslocarAno(periodo: Periodo, anos: number): Periodo {
  const [ano] = anoEMes(periodo.dataInicial);
  return periodoDoAno(ano + anos);
}

export function rotuloDoPeriodo(periodo: Periodo): string {
  const [ano, mes] = anoEMes(periodo.dataInicial);
  if (periodo.modo === 'mes') return nomeDoMes(ano, mes);
  if (periodo.modo === 'ano') return String(ano);
  return `${isoParaDataBR(periodo.dataInicial)} a ${isoParaDataBR(periodo.dataFinal)}`;
}
