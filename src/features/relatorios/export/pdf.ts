import { isoParaDataBR } from '@/lib/datas';
import { colors, spacing, typography } from '@/ui/tokens';

import { moedaComSinal, statusDoRelatorio, totaisDoRelatorio, type TransacaoRelatorio } from './linhas';

// Folha A4 em pontos (72 por polegada), o papel padrão no Brasil. O `expo-print` recebe a página em
// pontos; o padrão dele é o Carta americano.
export const PAGINA_A4 = { width: 595, height: 842 } as const;

export type DadosDoPdf = {
  empresa: string;
  periodo: string; // rótulo do FiltroPeriodo ("novembro 2026", "2026", "01/11/2026 a 15/11/2026")
  geradoEm: string; // ISO AAAA-MM-DD
  transacoes: TransacaoRelatorio[];
};

// A descrição é digitada pelo usuário e vai para dentro de um HTML que o sistema renderiza: sem
// escape, um "<b>" ou um "<script>" mudaria o documento.
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Entrada com "+", saída com "−": o sinal diz o tipo, porque o arquivo não usa cor.
function valorPdf(transacao: TransacaoRelatorio): string {
  const centavos = transacao.tipo === 'Saida' ? -transacao.valorCentavos : transacao.valorCentavos;
  return moedaComSinal(centavos, '+ ');
}

function linha(transacao: TransacaoRelatorio): string {
  return (
    '<tr class="linha">' +
    `<td>${isoParaDataBR(transacao.dataReferencia)}</td>` +
    `<td>${escaparHtml(transacao.descricao)}</td>` +
    `<td>${escaparHtml(transacao.categoria)}</td>` +
    `<td class="valor">${valorPdf(transacao)}</td>` +
    `<td>${statusDoRelatorio(transacao)}</td>` +
    '</tr>'
  );
}

// Cores e medidas saem dos tokens do design system, como nas telas: stone + borda hairline, sem cyan
// (papel não tem ação primária). O CSS mede em px, que o motor de impressão lê como pontos.
const CSS = `
  @page { size: A4; margin: ${spacing.xl}px ${spacing.lg}px; }
  body { font-family: Inter, -apple-system, Roboto, sans-serif; color: ${colors.textPrimary};
    font-size: ${typography.caption.fontSize}px; line-height: ${typography.caption.lineHeight}px; margin: 0; }
  header { margin-bottom: ${spacing.lg}px; }
  h1 { font-size: ${typography.subheading.fontSize}px; font-weight: 400; margin: 0 0 ${spacing.xs}px; }
  .meta { color: ${colors.textBody}; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  /* O cabeçalho da tabela se repete em toda página e nenhuma linha é cortada ao meio. */
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  th { text-align: left; font-weight: 500; color: ${colors.textBody};
    border-bottom: 1px solid ${colors.borderMuted}; padding: ${spacing.xs}px; }
  td { border-bottom: 1px solid ${colors.border}; padding: ${spacing.xs}px; vertical-align: top; }
  .valor { text-align: right; white-space: nowrap; }
  .vazio { color: ${colors.textBody}; padding: ${spacing.md}px ${spacing.xs}px; }
  .totais { margin-top: ${spacing.lg}px; margin-left: auto; border-collapse: collapse;
    page-break-inside: avoid; break-inside: avoid; }
  .totais td { border-bottom: 1px solid ${colors.border}; padding: ${spacing.xs}px ${spacing.sm}px; }
  .totais tr:last-child td { border-bottom: none; font-weight: 500; }
`;

export function gerarHtmlPdf({ empresa, periodo, geradoEm, transacoes }: DadosDoPdf): string {
  const totais = totaisDoRelatorio(transacoes);
  const corpo =
    transacoes.length > 0
      ? transacoes.map(linha).join('')
      : '<tr><td class="vazio" colspan="5">Nenhuma transação no período.</td></tr>';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>${CSS}</style>
</head>
<body>
<header>
<h1>${escaparHtml(empresa)}</h1>
<p class="meta">Relatório de transações · Período: ${escaparHtml(periodo)}</p>
<p class="meta">Gerado em ${isoParaDataBR(geradoEm)}</p>
</header>
<table>
<thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="valor">Valor</th><th>Status</th></tr></thead>
<tbody>${corpo}</tbody>
</table>
<table class="totais">
<tr><td>Total de entradas</td><td class="valor">${moedaComSinal(totais.entradasCentavos, '+ ')}</td></tr>
<tr><td>Total de saídas</td><td class="valor">${moedaComSinal(-totais.saidasCentavos)}</td></tr>
<tr><td>Saldo do período</td><td class="valor">${moedaComSinal(totais.saldoCentavos)}</td></tr>
</table>
</body>
</html>`;
}
