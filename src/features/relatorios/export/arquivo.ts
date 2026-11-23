import type { Periodo } from '@/features/dashboard/periodo';

import type { FormatoRelatorio } from './linhas';

// Nome do arquivo com o período (AC da US14): o contador sabe de qual mês é sem abrir o arquivo.
// Só letras, números e hífen: vale em qualquer sistema de arquivos e em anexo de e-mail.
//   mês: eixo-certo-2026-11.csv · ano: eixo-certo-2026.csv
//   customizado: eixo-certo-2026-11-01-a-2026-11-15.csv
export function nomeDoArquivo(periodo: Periodo, formato: FormatoRelatorio): string {
  return `eixo-certo-${trechoDoPeriodo(periodo)}.${formato}`;
}

function trechoDoPeriodo(periodo: Periodo): string {
  if (periodo.modo === 'mes') return periodo.dataInicial.slice(0, 7);
  if (periodo.modo === 'ano') return periodo.dataInicial.slice(0, 4);
  return `${periodo.dataInicial}-a-${periodo.dataFinal}`;
}
