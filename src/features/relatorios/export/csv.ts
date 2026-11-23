import { isoParaDataBR } from '@/lib/datas';

import { statusDoRelatorio, type TransacaoRelatorio } from './linhas';

// Formato que o Excel em português abre com dois cliques, sem o assistente de importação:
// - BOM UTF-8: sem ele o Excel lê o arquivo como ANSI e "Manutenção" vira "ManutenÃ§Ã£o".
// - `;`: no Excel pt-BR a vírgula é o separador decimal, então a lista usa ponto e vírgula.
// - CRLF: quebra de linha do RFC 4180, a que o Excel espera.
export const BOM = '﻿';
const SEPARADOR = ';';
const QUEBRA = '\r\n';

const CABECALHO = ['Data', 'Descrição', 'Categoria', 'Valor', 'Status'];

// Texto que começa com estes caracteres o Excel trata como fórmula (=HYPERLINK(...) abre um link ao
// clicar). A descrição é digitada pelo usuário, então ganha um apóstrofo na frente (CSV injection).
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

// RFC 4180: campo com separador, aspas ou quebra de linha vai entre aspas, e a aspa de dentro dobra.
function campo(texto: string): string {
  if (/[;"\r\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

function texto(valor: string): string {
  return campo(INICIO_DE_FORMULA.test(valor) ? `'${valor}` : valor);
}

// Número que o Excel pt-BR soma: vírgula decimal, sem "R$" e sem ponto de milhar. Saída leva "-".
// Conta em inteiros (centavos) para nunca passar por ponto flutuante.
export function valorCsv(transacao: Pick<TransacaoRelatorio, 'valorCentavos' | 'tipo'>): string {
  const reais = Math.floor(transacao.valorCentavos / 100);
  const centavos = String(transacao.valorCentavos % 100).padStart(2, '0');
  const sinal = transacao.tipo === 'Saida' ? '-' : '';
  return `${sinal}${reais},${centavos}`;
}

export function gerarCsv(transacoes: TransacaoRelatorio[]): string {
  const linhas = transacoes.map((transacao) =>
    [
      isoParaDataBR(transacao.dataReferencia),
      texto(transacao.descricao),
      texto(transacao.categoria),
      valorCsv(transacao),
      statusDoRelatorio(transacao),
    ].join(SEPARADOR),
  );
  return BOM + [CABECALHO.join(SEPARADOR), ...linhas].join(QUEBRA) + QUEBRA;
}
