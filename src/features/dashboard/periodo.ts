import { intervaloDoMes, isoParaDataBR, mesDeHoje, nomeDoMes, somarMeses } from '@/lib/datas';

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
  const { ano, mes } = mesDeHoje();
  return periodoDoMes(ano, mes);
}

export function anoAtual(): Periodo {
  return periodoDoAno(mesDeHoje().ano);
}

export function deslocarMes(periodo: Periodo, meses: number): Periodo {
  const [ano, mes] = anoEMes(periodo.dataInicial);
  const destino = somarMeses({ ano, mes }, meses);
  return periodoDoMes(destino.ano, destino.mes);
}

export function deslocarAno(periodo: Periodo, anos: number): Periodo {
  const [ano] = anoEMes(periodo.dataInicial);
  return periodoDoAno(ano + anos);
}

// Troca de aba entre Mês e Ano (ou saída do período customizado) parte do período em uso, não de hoje:
// quem voltou a março de 2024 e toca em "Ano" quer ver 2024. De um ano para "Mês", o mês é o de hoje
// dentro daquele ano; no ano atual, isso dá o mês atual.
export function converterPeriodo(periodo: Periodo, modo: 'mes' | 'ano'): Periodo {
  const [ano, mes] = anoEMes(periodo.dataInicial);
  if (modo === 'ano') return periodoDoAno(ano);
  if (periodo.modo === 'ano') return periodoDoMes(ano, mesDeHoje().mes);
  return periodoDoMes(ano, mes);
}

export function mesmoPeriodo(a: Periodo, b: Periodo): boolean {
  return a.modo === b.modo && a.dataInicial === b.dataInicial && a.dataFinal === b.dataFinal;
}

export function rotuloDoPeriodo(periodo: Periodo): string {
  const [ano, mes] = anoEMes(periodo.dataInicial);
  if (periodo.modo === 'mes') return nomeDoMes(ano, mes);
  if (periodo.modo === 'ano') return String(ano);
  return `${isoParaDataBR(periodo.dataInicial)} a ${isoParaDataBR(periodo.dataFinal)}`;
}
