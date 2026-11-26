import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { Resultado } from '@/lib/useDadosDaTela';

import type { FormatoRelatorio } from './linhas';
import { PAGINA_A4 } from './pdf';
import { MENSAGEM_ERRO_RELATORIO } from './queries';

export const MENSAGEM_SEM_COMPARTILHAMENTO = 'O compartilhamento não está disponível neste aparelho.';

export type ArquivoGerado = { uri: string; formato: FormatoRelatorio };

// mimeType: o Android escolhe os apps do Share Sheet por ele. UTI: o mesmo, no iOS.
const TIPOS: Record<FormatoRelatorio, { mimeType: string; UTI: string }> = {
  csv: { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' },
  pdf: { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' },
};

// O arquivo vai para o cache do app: o sistema limpa quando precisa, e ninguém precisa dele depois
// que foi compartilhado. Exportar de novo o mesmo período sobrescreve o arquivo de mesmo nome.
function arquivoNoCache(nome: string): File {
  const arquivo = new File(Paths.cache, nome);
  if (arquivo.exists) arquivo.delete();
  return arquivo;
}

export async function gerarArquivoCsv(nome: string, conteudo: string): Promise<Resultado<ArquivoGerado>> {
  try {
    const arquivo = arquivoNoCache(nome);
    arquivo.create();
    // O texto é gravado em UTF-8; o BOM do começo vira os bytes EF BB BF que o Excel procura.
    // Desde o SDK 58 o write() é assíncrono: sem o await, o Share Sheet podia abrir com o arquivo
    // ainda sendo gravado, e uma falha de disco escaparia deste try.
    await arquivo.write(conteudo);
    return { ok: true, data: { uri: arquivo.uri, formato: 'csv' } };
  } catch {
    return { ok: false, mensagem: MENSAGEM_ERRO_RELATORIO };
  }
}

export async function gerarArquivoPdf(nome: string, html: string): Promise<Resultado<ArquivoGerado>> {
  try {
    // O expo-print grava o PDF com um nome aleatório; o arquivo é movido para o nome com o período.
    const { uri } = await Print.printToFileAsync({ html, width: PAGINA_A4.width, height: PAGINA_A4.height });
    const destino = arquivoNoCache(nome);
    await new File(uri).move(destino);
    return { ok: true, data: { uri: destino.uri, formato: 'pdf' } };
  } catch {
    return { ok: false, mensagem: MENSAGEM_ERRO_RELATORIO };
  }
}

// Abre o Share Sheet do sistema (AC da US14: API nativa, não download no navegador). A promessa só
// termina quando o Share Sheet fecha, e não diz se a pessoa enviou ou cancelou.
export async function compartilharArquivo(arquivo: ArquivoGerado): Promise<Resultado<null>> {
  try {
    if (!(await Sharing.isAvailableAsync())) return { ok: false, mensagem: MENSAGEM_SEM_COMPARTILHAMENTO };

    await Sharing.shareAsync(arquivo.uri, { ...TIPOS[arquivo.formato], dialogTitle: 'Enviar relatório' });
    return { ok: true, data: null };
  } catch {
    return { ok: false, mensagem: MENSAGEM_ERRO_RELATORIO };
  }
}
